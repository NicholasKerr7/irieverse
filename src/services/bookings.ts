import { BookingOption } from "../types/travel";

const BOOKINGS_API = import.meta.env.VITE_BOOKING_API_URL?.trim();

interface BookingSearchParams {
  checkInDate?: string;
  checkOutDate?: string;
  adults?: number;
}

export async function fetchBookingOptions(
  destinationAirportCode: string,
  originAirportCode: string,
  searchParams: BookingSearchParams = {}
) {
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
  return data.slice(0, 4);
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

function getFallbackBookingOptions(payload: unknown, destinationAirportCode: string): BookingOption[] {
  if (!isRecord(payload)) return [];
  const options = payload[destinationAirportCode];
  return Array.isArray(options) ? options as BookingOption[] : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
