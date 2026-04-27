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

    const payload: unknown = await response.json();
    if (isRecord(payload) && Array.isArray(payload.data)) {
      return normalizeFlightResponse(payload.data, originCode, destinationCode);
    }
    if (isRecord(payload) && payload.error) {
      const error = isRecord(payload.error) ? payload.error : null;
      throw new Error(asString(error?.message) ?? "AviationStack API error");
    }
    return [];
  }

  if (!cachedSampleFlights) {
    const response = await fetch("/data/flights-sample.json");
    if (!response.ok) {
      throw new Error("Failed to load sample flights");
    }
    cachedSampleFlights = await response.json() as Record<string, FlightOption[]>;
  }

  return cachedSampleFlights[routeKey] ?? [];
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
