import { BookingOption } from "../types/travel";
import type { BookingApiMeta } from "../types/api";

const BOOKINGS_API = getBookingApiUrl();

interface BookingSearchParams {
  checkInDate?: string;
  checkOutDate?: string;
  adults?: number;
}

export type BookingSourceMeta = {
  source: BookingApiMeta["source"] | "api" | "local";
  reason?: string;
  endpointConfigured: boolean;
  providerConfigured: boolean;
  checkInDate?: string;
  checkOutDate?: string;
  adults?: number;
};

export type BookingOptionsResult = {
  options: BookingOption[];
  meta: BookingSourceMeta;
};

export function getInitialBookingSourceMeta(): BookingSourceMeta {
  return BOOKINGS_API
    ? {
        source: "api",
        endpointConfigured: true,
        providerConfigured: false,
        reason: "endpoint-configured",
      }
    : {
        source: "local",
        endpointConfigured: false,
        providerConfigured: false,
        reason: "local-sample-data",
      };
}

export async function fetchBookingOptions(
  destinationAirportCode: string,
  originAirportCode: string,
  searchParams: BookingSearchParams = {}
): Promise<BookingOptionsResult> {
  if (BOOKINGS_API) {
    try {
      const response = await fetch(buildBookingEndpoint(destinationAirportCode, originAirportCode, searchParams));
      if (!response.ok) {
        throw new Error(`Booking fetch failed: ${response.statusText}`);
      }

      const payload: unknown = await response.json();
      const data = normalizeBookingResponse(payload);
      const meta = getEndpointBookingMeta(payload);

      return {
        options: data.slice(0, 4),
        meta,
      };
    } catch {
      return {
        options: await fetchLocalBookingOptions(destinationAirportCode),
        meta: {
          source: "local",
          reason: "booking-proxy-request-failed",
          endpointConfigured: true,
          providerConfigured: false,
        },
      };
    }
  }

  return {
    options: await fetchLocalBookingOptions(destinationAirportCode),
    meta: getInitialBookingSourceMeta(),
  };
}

function getBookingApiUrl(): string {
  const configured = import.meta.env.VITE_BOOKING_API_URL?.trim();
  if (configured) {
    return /^(0|false|off|local|disabled)$/i.test(configured) ? "" : configured;
  }
  return "/api/bookings";
}

function buildBookingEndpoint(
  destinationAirportCode: string,
  originAirportCode: string,
  searchParams: BookingSearchParams
) {
  const baseUrl = typeof window === "undefined" ? "http://localhost" : window.location.origin;
  const url = new URL(BOOKINGS_API as string, baseUrl);
  url.searchParams.set("destination", destinationAirportCode);
  url.searchParams.set("origin", originAirportCode);
  if (searchParams.checkInDate) url.searchParams.set("checkInDate", searchParams.checkInDate);
  if (searchParams.checkOutDate) url.searchParams.set("checkOutDate", searchParams.checkOutDate);
  if (searchParams.adults) url.searchParams.set("adults", String(searchParams.adults));
  return url.toString();
}

function normalizeBookingResponse(payload: unknown): BookingOption[] {
  if (Array.isArray(payload)) return payload as BookingOption[];
  if (isRecord(payload) && Array.isArray(payload.data)) return payload.data as BookingOption[];
  return [];
}

function getEndpointBookingMeta(payload: unknown): BookingSourceMeta {
  if (isRecord(payload) && isRecord(payload.meta)) {
    const meta: BookingSourceMeta = {
      source: normalizeBookingSource(payload.meta.source),
      endpointConfigured: true,
      providerConfigured: payload.meta.providerConfigured === true,
    };
    const reason = asString(payload.meta.reason);
    const checkInDate = asString(payload.meta.checkInDate);
    const checkOutDate = asString(payload.meta.checkOutDate);
    const adults = asNumber(payload.meta.adults);
    if (reason) meta.reason = reason;
    if (checkInDate) meta.checkInDate = checkInDate;
    if (checkOutDate) meta.checkOutDate = checkOutDate;
    if (adults !== undefined) meta.adults = adults;
    return meta;
  }

  return {
    source: "api",
    endpointConfigured: true,
    providerConfigured: true,
    reason: "custom-endpoint",
  };
}

function normalizeBookingSource(value: unknown): BookingSourceMeta["source"] {
  return value === "amadeus" || value === "fallback" || value === "local" || value === "api"
    ? value
    : "api";
}

function getFallbackBookingOptions(payload: unknown, destinationAirportCode: string): BookingOption[] {
  if (!isRecord(payload)) return [];
  const options = payload[destinationAirportCode];
  return Array.isArray(options) ? options as BookingOption[] : [];
}

async function fetchLocalBookingOptions(destinationAirportCode: string): Promise<BookingOption[]> {
  const response = await fetch("/data/bookings.json");
  if (!response.ok) {
    throw new Error(`Local booking data failed: ${response.statusText}`);
  }
  const payload: unknown = await response.json();
  return getFallbackBookingOptions(payload, destinationAirportCode).slice(0, 4);
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
