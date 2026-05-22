import type { ApiRequest, ApiResponse, FlightApiResponse } from "../src/types/api";
import type { FlightOption } from "../src/types/travel";
import { guardApiRequest } from "./_shared/api-guard.js";

const AVIATIONSTACK_BASE_URL = "https://api.aviationstack.com/v1/flights";
const MAX_FLIGHT_OPTIONS = 4;
const DEFAULT_CACHE_TTL_SECONDS = 15 * 60;
const DEFAULT_RATE_LIMIT_COOLDOWN_SECONDS = 30 * 60;
const FLIGHT_CACHE = new Map<string, { payload: FlightApiResponse; expiresAt: number }>();

let aviationStackCooldownUntil = 0;
let aviationStackCooldownReason = "";

export function resetFlightsHandlerStateForTest() {
  FLIGHT_CACHE.clear();
  aviationStackCooldownUntil = 0;
  aviationStackCooldownReason = "";
}

export default async function flightsHandler(req: ApiRequest, res: ApiResponse) {
  if (!guardApiRequest(req, res, {
    routeId: "flights",
    allowedMethods: ["GET", "HEAD"],
    cacheControl: "s-maxage=600, stale-while-revalidate=1800",
    rateLimitMax: 60,
  })) return;

  const query = req.query ?? {};
  const origin = normalizeAirportCode(query.origin);
  const destination = normalizeAirportCode(query.destination);

  if (!origin || !destination) {
    res.status(400).json({ error: "Expected origin and destination as IATA airport codes." });
    return;
  }

  if (isAviationStackDisabled()) {
    res.status(200).json(buildFallbackResponse("aviationstack-disabled", Boolean(getAviationStackApiKey()), origin, destination));
    return;
  }

  const apiKey = getAviationStackApiKey();
  if (!apiKey) {
    res.status(200).json(buildFallbackResponse("missing-aviationstack-key", false, origin, destination));
    return;
  }

  const cacheKey = getFlightCacheKey(origin, destination);
  const cachedResponse = getCachedFlightResponse(cacheKey);
  if (cachedResponse) {
    res.status(200).json(cachedResponse);
    return;
  }

  const cooldown = getAviationStackCooldown();
  if (cooldown.active) {
    const fallback = buildFallbackResponse(cooldown.reason, true, origin, destination);
    res.status(200).json({
      ...fallback,
      meta: {
        ...fallback.meta,
        retryAfterSeconds: cooldown.retryAfterSeconds,
      },
    });
    return;
  }

  try {
    const flights = await fetchAviationStackFlights(apiKey, origin, destination);
    const payload: FlightApiResponse = {
      data: flights,
      meta: {
        source: "aviationstack",
        providerConfigured: true,
        origin,
        destination,
        cached: false,
      },
    };
    setFlightCache(cacheKey, payload);
    res.status(200).json(payload);
  } catch (error) {
    const isRateLimited = error instanceof AviationStackError && error.status === 429;
    if (isRateLimited) {
      startAviationStackCooldown("aviationstack-rate-limited");
      console.warn("AviationStack rate limit reached; live flight lookups are cooling down.");
      res.status(200).json(buildFallbackResponse("aviationstack-rate-limited", true, origin, destination));
      return;
    }

    console.warn(`AviationStack flight lookup unavailable; using saved examples. ${formatErrorForLog(error)}`);
    res.status(200).json(buildFallbackResponse("aviationstack-request-failed", true, origin, destination));
  }
}

function getAviationStackApiKey(): string {
  return (
    process.env.AVIATIONSTACK_API_KEY ||
    // Legacy local fallback for existing ignored .env.local files. Do not use VITE_ for production.
    process.env.VITE_AVIATIONSTACK_API_KEY ||
    ""
  ).trim();
}

function isAviationStackDisabled(): boolean {
  const value = process.env.AVIATIONSTACK_DISABLED || process.env.IRIEVERSE_DISABLE_LIVE_FLIGHTS || "";
  return /^(1|true|yes|on)$/i.test(value.trim());
}

async function fetchAviationStackFlights(apiKey: string, origin: string, destination: string): Promise<FlightOption[]> {
  const params = new URLSearchParams({
    access_key: apiKey,
    dep_iata: origin,
    arr_iata: destination,
    limit: "5",
    flight_status: "scheduled",
  });

  const response = await fetch(`${AVIATIONSTACK_BASE_URL}?${params}`);
  if (!response.ok) {
    throw new AviationStackError(response.status, `AviationStack error: ${response.status}`);
  }

  const payload: unknown = await response.json();
  const payloadRecord = isRecord(payload) ? payload : {};
  const errorRecord = isRecord(payloadRecord.error) ? payloadRecord.error : null;
  if (errorRecord) {
    const errorType = asString(errorRecord.type) ?? "";
    const message = asString(errorRecord.message) ?? (errorType || "AviationStack API error");
    const status = isRateLimitError(message, errorType)
      ? 429
      : Number(errorRecord.code) || undefined;
    throw new AviationStackError(status, message);
  }

  return (Array.isArray(payloadRecord.data) ? payloadRecord.data : [])
    .map((item) => normalizeFlightItem(item, origin, destination))
    .slice(0, MAX_FLIGHT_OPTIONS);
}

class AviationStackError extends Error {
  status?: number;

  constructor(status: number | undefined, message: string) {
    super(message);
    this.name = "AviationStackError";
    if (status !== undefined) this.status = status;
  }
}

function buildFallbackResponse(
  reason: string,
  providerConfigured: boolean,
  origin: string,
  destination: string
): FlightApiResponse {
  return {
    data: [],
    meta: {
      source: "fallback",
      reason,
      providerConfigured,
      origin,
      destination,
    },
  };
}

function getFlightCacheKey(origin: string, destination: string): string {
  return `${origin}-${destination}`;
}

function getCachedFlightResponse(cacheKey: string): FlightApiResponse | null {
  const entry = FLIGHT_CACHE.get(cacheKey);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    FLIGHT_CACHE.delete(cacheKey);
    return null;
  }

  return {
    ...entry.payload,
    meta: {
      ...entry.payload.meta,
      cached: true,
      cacheTtlSeconds: Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000)),
    },
  };
}

function setFlightCache(cacheKey: string, payload: FlightApiResponse) {
  FLIGHT_CACHE.set(cacheKey, {
    payload,
    expiresAt: Date.now() + getCacheTtlSeconds() * 1000,
  });
}

function getCacheTtlSeconds(): number {
  return getPositiveEnvNumber("AVIATIONSTACK_CACHE_TTL_SECONDS", DEFAULT_CACHE_TTL_SECONDS);
}

function startAviationStackCooldown(reason: string) {
  aviationStackCooldownReason = reason;
  aviationStackCooldownUntil = Date.now() + getRateLimitCooldownSeconds() * 1000;
}

function getAviationStackCooldown(): { active: boolean; reason: string; retryAfterSeconds: number } {
  const retryAfterSeconds = Math.ceil((aviationStackCooldownUntil - Date.now()) / 1000);
  return {
    active: retryAfterSeconds > 0,
    reason: aviationStackCooldownReason || "aviationstack-rate-limited",
    retryAfterSeconds: Math.max(0, retryAfterSeconds),
  };
}

function getRateLimitCooldownSeconds(): number {
  return getPositiveEnvNumber("AVIATIONSTACK_COOLDOWN_SECONDS", DEFAULT_RATE_LIMIT_COOLDOWN_SECONDS);
}

function getPositiveEnvNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function formatErrorForLog(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRateLimitError(message: string, type: string): boolean {
  const normalized = `${message} ${type}`.toLowerCase();
  return normalized.includes("rate") || normalized.includes("quota") || normalized.includes("limit");
}

function normalizeFlightItem(item: unknown, origin: string, destination: string): FlightOption {
  const record = isRecord(item) ? item : {};
  const airline = record.airline;
  const departure = isRecord(record.departure) ? record.departure : {};
  const arrival = isRecord(record.arrival) ? record.arrival : {};
  const flight = isRecord(record.flight) ? record.flight : {};
  const durationMinutes = asNumber(flight.duration) ?? asNumber(record.durationMinutes);

  return {
    flightNumber: asString(record.flight_number) ?? asString(record.flightNumber) ?? "—",
    airline: getAirlineName(airline),
    origin: asString(departure.iata) ?? asString(record.dep_iata) ?? origin,
    destination: asString(arrival.iata) ?? asString(record.arr_iata) ?? destination,
    departureTimeUTC: asString(departure.scheduled) ?? asString(record.departureTimeUTC) ?? asString(record.dep_time_utc) ?? new Date().toISOString(),
    arrivalTimeUTC: asString(arrival.scheduled) ?? asString(record.arrivalTimeUTC) ?? asString(record.arr_time_utc) ?? new Date().toISOString(),
    status: asString(record.flight_status) ?? asString(record.status) ?? "Scheduled",
    ...(durationMinutes !== undefined ? { durationMinutes } : {}),
  };
}

function getAirlineName(value: unknown): string {
  if (isRecord(value)) {
    return asString(value.name) ?? asString(value.iata) ?? "Airline";
  }
  return asString(value) ?? "Airline";
}

function normalizeAirportCode(value: unknown): string | null {
  const firstValue = Array.isArray(value) ? value[0] : value;
  if (typeof firstValue !== "string") return null;
  const normalized = firstValue.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
