const DEFAULT_ROUTING_BASE_URL = "https://router.project-osrm.org";
const MAX_ROUTE_DISTANCE_KM = 400;

module.exports = async function roadRouteHandler(req, res) {
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
  const from = parseCoordinate(query.from);
  const to = parseCoordinate(query.to);

  if (!from || !to) {
    res.status(400).json({ error: "Expected from and to as lon,lat coordinate pairs." });
    return;
  }

  if (haversineDistanceKm(from, to) > MAX_ROUTE_DISTANCE_KM) {
    res.status(400).json({ error: "Route is outside the supported Jamaica driving range." });
    return;
  }

  try {
    const route = await fetchOsrmRoute(from, to);
    res.status(200).json({
      data: route,
    });
  } catch (error) {
    console.error("Road route lookup failed", error);
    res.status(200).json({
      data: null,
      meta: {
        source: "fallback",
        reason: "road-route-unavailable",
      },
    });
  }
};

function setResponseHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
}

async function fetchOsrmRoute(from, to) {
  const baseUrl = (process.env.ROUTING_API_BASE_URL || DEFAULT_ROUTING_BASE_URL).replace(/\/$/, "");
  const coordinates = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const url = new URL(`${baseUrl}/route/v1/driving/${coordinates}`);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "false");
  url.searchParams.set("alternatives", "false");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OSRM route failed: ${response.status}`);
  }

  const payload = await response.json();
  const route = Array.isArray(payload.routes) ? payload.routes[0] : null;
  const coordinatesList = route?.geometry?.coordinates;

  if (!Array.isArray(coordinatesList) || coordinatesList.length < 2) {
    throw new Error("OSRM did not return route geometry");
  }

  return {
    coordinates: coordinatesList.map(normalizeCoordinatePair).filter(Boolean),
    distanceKm: Math.round(Number(route.distance ?? 0) / 1000),
    durationMinutes: Math.max(1, Math.round(Number(route.duration ?? 0) / 60)),
    source: "osrm",
  };
}

function parseCoordinate(value) {
  const firstValue = Array.isArray(value) ? value[0] : value;
  if (typeof firstValue !== "string") return null;

  const [longitudeRaw, latitudeRaw] = firstValue.split(",");
  const longitude = Number(longitudeRaw);
  const latitude = Number(latitudeRaw);

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { longitude, latitude };
}

function isCoordinatePair(value) {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1]))
  );
}

function normalizeCoordinatePair(value) {
  if (!isCoordinatePair(value)) return null;
  return [Number(value[0]), Number(value[1])];
}

function haversineDistanceKm(from, to) {
  const earthRadiusKm = 6371;
  const toRadians = (value) => (value * Math.PI) / 180;
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}
