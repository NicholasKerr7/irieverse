import { BookingOption } from "../types/travel";

const BOOKINGS_API = import.meta.env.VITE_BOOKING_API_URL?.trim();

export async function fetchBookingOptions(destinationAirportCode: string, originAirportCode: string) {
  const endpoint = BOOKINGS_API
    ? `${BOOKINGS_API}?destination=${encodeURIComponent(destinationAirportCode)}&origin=${encodeURIComponent(originAirportCode)}`
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
