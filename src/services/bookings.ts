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
  const payload = await response.json();
  const data: BookingOption[] = BOOKINGS_API ? normalizeBookingResponse(payload) : payload[destinationAirportCode] ?? [];
  return data.slice(0, 4);
}

function normalizeBookingResponse(payload: any): BookingOption[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}
