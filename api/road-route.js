const DEFAULT_ROUTING_BASE_URL = "https://router.project-osrm.org";
const MAX_ROUTE_DISTANCE_KM = 400;
const MAX_ROUTE_STEPS = 18;

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
  url.searchParams.set("steps", "true");
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
    steps: normalizeRouteSteps(route.legs),
    source: "osrm",
  };
}

function normalizeRouteSteps(legs) {
  return (Array.isArray(legs) ? legs : [])
    .flatMap((leg) => Array.isArray(leg?.steps) ? leg.steps : [])
    .map(mapOsrmStep)
    .filter(Boolean)
    .filter((step) => step.instruction !== "Continue" || step.distanceKm >= 0.1)
    .slice(0, MAX_ROUTE_STEPS);
}

function mapOsrmStep(step) {
  const distanceKm = roundTo(Number(step?.distance ?? 0) / 1000, 1);
  const durationMinutes = Math.max(0, Math.round(Number(step?.duration ?? 0) / 60));
  const roadName = cleanRoadName(step?.name || step?.destinations || step?.ref);
  const maneuver = step?.maneuver ?? {};
  const maneuverType = typeof maneuver.type === "string" ? maneuver.type : "continue";
  const modifier = typeof maneuver.modifier === "string" ? maneuver.modifier : "";
  const instruction = buildInstruction(maneuverType, modifier, roadName);

  if (!instruction) return null;

  return {
    instruction,
    distanceKm,
    durationMinutes,
    roadName,
    maneuverType,
    modifier,
  };
}

function buildInstruction(type, modifier, roadName) {
  if (type === "depart") {
    return roadName ? `Start on ${roadName}` : "Start route";
  }
  if (type === "arrive") {
    return "Arrive at destination";
  }
  if (type === "turn") {
    return roadName ? `Turn ${modifier || "ahead"} onto ${roadName}` : `Turn ${modifier || "ahead"}`;
  }
  if (type === "new name") {
    return roadName ? `Continue onto ${roadName}` : "Continue";
  }
  if (type === "continue") {
    return roadName ? `Continue on ${roadName}` : "Continue";
  }
  if (type === "merge") {
    return roadName ? `Merge ${modifier || "ahead"} onto ${roadName}` : `Merge ${modifier || "ahead"}`;
  }
  if (type === "on ramp") {
    return roadName ? `Take the ramp onto ${roadName}` : "Take the ramp";
  }
  if (type === "off ramp") {
    return roadName ? `Take the exit toward ${roadName}` : "Take the exit";
  }
  if (type === "roundabout" || type === "rotary") {
    return roadName ? `Enter the roundabout toward ${roadName}` : "Enter the roundabout";
  }
  if (type === "fork") {
    return roadName ? `Keep ${modifier || "ahead"} toward ${roadName}` : `Keep ${modifier || "ahead"}`;
  }

  const action = titleCase(type.replace(/_/g, " "));
  return roadName ? `${action} onto ${roadName}` : action;
}

function cleanRoadName(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function roundTo(value, places) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}

function titleCase(value) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
