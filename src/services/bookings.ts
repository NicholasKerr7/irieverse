import { BookingOption } from "../types/travel";
import type { BookingApiMeta } from "../types/api";

const BOOKINGS_API = import.meta.env.VITE_BOOKING_API_URL?.trim();

interface BookingSearchParams {
  checkInDate?: string;
  checkOutDate?: string;
  adults?: number;
}

export type BookingSourceMeta = {
  source: BookingApiMeta["source"] | "api" | "local";
  reason?: string;
  endpointConfigured: boolean;
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
        reason: "endpoint-configured",
      }
    : {
        source: "local",
        endpointConfigured: false,
        reason: "local-sample-data",
      };
}

export async function fetchBookingOptions(
  destinationAirportCode: string,
  originAirportCode: string,
  searchParams: BookingSearchParams = {}
): Promise<BookingOptionsResult> {
  const endpoint = BOOKINGS_API
    ? buildBookingEndpoint(destinationAirportCode, originAirportCode, searchParams)
    : `/data/bookings.json`;

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Booking fetch failed: ${response.statusText}`);
  }
  const payload: unknown = await response.json();
  const data: BookingOption[] = BOOKINGS_API
    ? normalizeBookingResponse(payload)
    : getFallbackBookingOptions(payload, destinationAirportCode);
  const meta = BOOKINGS_API
    ? getEndpointBookingMeta(payload)
    : getInitialBookingSourceMeta();

  return {
    options: data.slice(0, 4),
    meta,
  };
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
    return {
      source: normalizeBookingSource(payload.meta.source),
      reason: asString(payload.meta.reason),
      endpointConfigured: true,
      checkInDate: asString(payload.meta.checkInDate),
      checkOutDate: asString(payload.meta.checkOutDate),
      adults: asNumber(payload.meta.adults),
    };
  }

  return {
    source: "api",
    endpointConfigured: true,
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

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
