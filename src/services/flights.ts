import { FlightOption } from "../types/travel";

let cachedSampleFlights: Record<string, FlightOption[]> | null = null;

const AVIATIONSTACK_API_KEY = import.meta.env.VITE_AVIATIONSTACK_API_KEY?.trim();

export async function fetchFlightOptions(originCode: string, destinationCode: string): Promise<FlightOption[]> {
  const routeKey = `${originCode}-${destinationCode}`.toUpperCase();

  if (AVIATIONSTACK_API_KEY) {
    const params = new URLSearchParams({
      access_key: AVIATIONSTACK_API_KEY,
      dep_iata: originCode,
      arr_iata: destinationCode,
      limit: "5",
      flight_status: "scheduled",
    });

    const response = await fetch(`https://api.aviationstack.com/v1/flights?${params}`);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AviationStack error: ${response.status} ${text}`);
    }

    const payload = await response.json();
    if (Array.isArray(payload?.data)) {
      return normalizeFlightResponse(payload.data, originCode, destinationCode);
    }
    if (payload?.error) {
      throw new Error(payload.error?.message ?? "AviationStack API error");
    }
    return [];
  }

  if (!cachedSampleFlights) {
    const response = await fetch("/data/flights-sample.json");
    if (!response.ok) {
      throw new Error("Failed to load sample flights");
    }
    cachedSampleFlights = await response.json();
  }

  return cachedSampleFlights[routeKey] ?? [];
}

function normalizeFlightResponse(data: any[], origin: string, destination: string): FlightOption[] {
  return data
    .map((item) => ({
      flightNumber: item.flight_number ?? item.flightNumber ?? "—",
      airline: item.airline?.name ?? item.airline?.iata ?? item.airline ?? "Airline",
      origin: item.departure?.iata ?? item.dep_iata ?? origin,
      destination: item.arrival?.iata ?? item.arr_iata ?? destination,
      departureTimeUTC: item.departure?.scheduled ?? item.departureTimeUTC ?? item.dep_time_utc ?? new Date().toISOString(),
      arrivalTimeUTC: item.arrival?.scheduled ?? item.arrivalTimeUTC ?? item.arr_time_utc ?? new Date().toISOString(),
      status: item.flight_status ?? item.status ?? "Scheduled",
      durationMinutes: item.flight?.duration ?? item.durationMinutes ?? undefined,
    }))
    .slice(0, 4);
}
