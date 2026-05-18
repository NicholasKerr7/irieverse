import { FlightOption } from "../types/travel";
import type { FlightApiMeta } from "../types/api";

let cachedSampleFlights: Record<string, FlightOption[]> | null = null;

const FLIGHTS_API = import.meta.env.VITE_FLIGHTS_API_URL?.trim() || "/api/flights";

export type FlightSourceMeta = {
  source: FlightApiMeta["source"] | "local";
  reason?: string;
  endpointConfigured: boolean;
  providerConfigured: boolean;
};

export type FlightOptionsResult = {
  options: FlightOption[];
  meta: FlightSourceMeta;
};

export function getInitialFlightSourceMeta(): FlightSourceMeta {
  return {
    source: FLIGHTS_API ? "fallback" : "local",
    reason: FLIGHTS_API ? "pending-flight-proxy" : "local-sample-data",
    endpointConfigured: Boolean(FLIGHTS_API),
    providerConfigured: false,
  };
}

export async function fetchFlightOptions(originCode: string, destinationCode: string): Promise<FlightOptionsResult> {
  const routeKey = `${originCode}-${destinationCode}`.toUpperCase();

  if (FLIGHTS_API) {
    try {
      const response = await fetch(buildFlightsEndpoint(originCode, destinationCode));
      if (!response.ok) {
        throw new Error(`Flight proxy failed: ${response.status}`);
      }

      const payload: unknown = await response.json();
      const meta = getEndpointFlightMeta(payload);
      const options = normalizeEndpointFlightOptions(payload, originCode, destinationCode);

      if (meta.source === "aviationstack") {
        return { options, meta };
      }

      return {
        options: await fetchSampleFlights(routeKey),
        meta: {
          ...meta,
          source: "local",
        },
      };
    } catch {
      const options = await fetchSampleFlights(routeKey);
      return {
        options,
        meta: {
          source: "local",
          reason: "flight-proxy-request-failed",
          endpointConfigured: true,
          providerConfigured: false,
        },
      };
    }
  }

  return {
    options: await fetchSampleFlights(routeKey),
    meta: {
      source: "local",
      reason: "local-sample-data",
      endpointConfigured: Boolean(FLIGHTS_API),
      providerConfigured: false,
    },
  };
}

function buildFlightsEndpoint(originCode: string, destinationCode: string): string {
  const baseUrl = typeof window === "undefined" ? "http://localhost" : window.location.origin;
  const url = new URL(FLIGHTS_API, baseUrl);
  url.searchParams.set("origin", originCode);
  url.searchParams.set("destination", destinationCode);
  return url.toString();
}

async function fetchSampleFlights(routeKey: string): Promise<FlightOption[]> {
  if (!cachedSampleFlights) {
    const response = await fetch("/data/flights-sample.json");
    if (!response.ok) {
      throw new Error("Failed to load sample flights");
    }
    cachedSampleFlights = await response.json() as Record<string, FlightOption[]>;
  }

  return cachedSampleFlights[routeKey] ?? [];
}

function normalizeEndpointFlightOptions(payload: unknown, originCode: string, destinationCode: string): FlightOption[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return [];
  return normalizeFlightResponse(payload.data, originCode, destinationCode);
}

function getEndpointFlightMeta(payload: unknown): FlightSourceMeta {
  if (isRecord(payload) && isRecord(payload.meta)) {
    return {
      source: normalizeFlightSource(payload.meta.source),
      reason: asString(payload.meta.reason),
      endpointConfigured: true,
      providerConfigured: payload.meta.providerConfigured === true,
    };
  }

  return {
    source: "fallback",
    endpointConfigured: true,
    providerConfigured: false,
    reason: "missing-flight-metadata",
  };
}

function normalizeFlightSource(value: unknown): FlightSourceMeta["source"] {
  return value === "aviationstack" || value === "fallback" || value === "local"
    ? value
    : "fallback";
}

function normalizeFlightResponse(data: unknown[], origin: string, destination: string): FlightOption[] {
  return data
    .map((item) => normalizeFlightItem(item, origin, destination))
    .slice(0, 4);
}

function normalizeFlightItem(item: unknown, origin: string, destination: string): FlightOption {
  const record = isRecord(item) ? item : {};
  const airline = record.airline;
  const departure = isRecord(record.departure) ? record.departure : {};
  const arrival = isRecord(record.arrival) ? record.arrival : {};
  const flight = isRecord(record.flight) ? record.flight : {};

  return {
    flightNumber: asString(record.flight_number) ?? asString(record.flightNumber) ?? "—",
    airline: getAirlineName(airline),
    origin: asString(departure.iata) ?? asString(record.dep_iata) ?? origin,
    destination: asString(arrival.iata) ?? asString(record.arr_iata) ?? destination,
    departureTimeUTC: asString(departure.scheduled) ?? asString(record.departureTimeUTC) ?? asString(record.dep_time_utc) ?? new Date().toISOString(),
    arrivalTimeUTC: asString(arrival.scheduled) ?? asString(record.arrivalTimeUTC) ?? asString(record.arr_time_utc) ?? new Date().toISOString(),
    status: asString(record.flight_status) ?? asString(record.status) ?? "Scheduled",
    durationMinutes: asNumber(flight.duration) ?? asNumber(record.durationMinutes) ?? undefined,
  };
}

function getAirlineName(value: unknown): string {
  if (isRecord(value)) {
    return asString(value.name) ?? asString(value.iata) ?? "Airline";
  }
  return asString(value) ?? "Airline";
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
