const AVIATIONSTACK_BASE_URL = "https://api.aviationstack.com/v1/flights";
const MAX_FLIGHT_OPTIONS = 4;

module.exports = async function flightsHandler(req, res) {
  setResponseHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method === "HEAD") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const query = req.query ?? {};
  const origin = normalizeAirportCode(query.origin);
  const destination = normalizeAirportCode(query.destination);

  if (!origin || !destination) {
    res.status(400).json({ error: "Expected origin and destination as IATA airport codes." });
    return;
  }

  const apiKey = getAviationStackApiKey();
  if (!apiKey) {
    res.status(200).json({
      data: [],
      meta: {
        source: "fallback",
        reason: "missing-aviationstack-key",
        providerConfigured: false,
        origin,
        destination,
      },
    });
    return;
  }

  try {
    const flights = await fetchAviationStackFlights(apiKey, origin, destination);
    res.status(200).json({
      data: flights,
      meta: {
        source: "aviationstack",
        providerConfigured: true,
        origin,
        destination,
      },
    });
  } catch (error) {
    console.error("AviationStack flight lookup failed", error);
    res.status(200).json({
      data: [],
      meta: {
        source: "fallback",
        reason: "aviationstack-request-failed",
        providerConfigured: true,
        origin,
        destination,
      },
    });
  }
};

function setResponseHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");
}

function getAviationStackApiKey() {
  return (
    process.env.AVIATIONSTACK_API_KEY ||
    // Legacy local fallback for existing ignored .env.local files. Do not use VITE_ for production.
    process.env.VITE_AVIATIONSTACK_API_KEY ||
    ""
  ).trim();
}

async function fetchAviationStackFlights(apiKey, origin, destination) {
  const params = new URLSearchParams({
    access_key: apiKey,
    dep_iata: origin,
    arr_iata: destination,
    limit: "5",
    flight_status: "scheduled",
  });

  const response = await fetch(`${AVIATIONSTACK_BASE_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`AviationStack error: ${response.status}`);
  }

  const payload = await response.json();
  if (payload?.error) {
    const message = payload.error?.message || payload.error?.type || "AviationStack API error";
    throw new Error(message);
  }

  return (Array.isArray(payload?.data) ? payload.data : [])
    .map((item) => normalizeFlightItem(item, origin, destination))
    .slice(0, MAX_FLIGHT_OPTIONS);
}

function normalizeFlightItem(item, origin, destination) {
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

function getAirlineName(value) {
  if (isRecord(value)) {
    return asString(value.name) ?? asString(value.iata) ?? "Airline";
  }
  return asString(value) ?? "Airline";
}

function normalizeAirportCode(value) {
  const firstValue = Array.isArray(value) ? value[0] : value;
  if (typeof firstValue !== "string") return null;
  const normalized = firstValue.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

function asString(value) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value) {
  return typeof value === "object" && value !== null;
}
