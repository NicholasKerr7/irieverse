import type {
  ApiRequest,
  ApiResponse,
  RoadRoute,
  RoadRouteApiResponse,
  RoadRouteStep,
} from "../src/types/api";
import { guardApiRequest } from "./_shared/api-guard.js";

const DEFAULT_ROUTING_BASE_URL = "https://router.project-osrm.org";
const MAX_ROUTE_DISTANCE_KM = 400;
const MAX_ROUTE_STEPS = 32;
const DEFAULT_ROUTING_TIMEOUT_MS = 4500;
const DEFAULT_ROUTING_COOLDOWN_SECONDS = 45;
const JAMAICA_ROUTE_BOUNDS = {
  minLongitude: -78.85,
  maxLongitude: -75.95,
  minLatitude: 17.4,
  maxLatitude: 18.85,
};

let routingProviderLastWarningAt = 0;

type Coordinate = {
  longitude: number;
  latitude: number;
};

export default async function roadRouteHandler(req: ApiRequest, res: ApiResponse) {
  if (!guardApiRequest(req, res, {
    routeId: "road_route",
    allowedMethods: ["GET", "HEAD"],
    cacheControl: "s-maxage=86400, stale-while-revalidate=604800",
    rateLimitMax: 120,
  })) return;

  const query = req.query ?? {};
  const from = parseCoordinate(query.from);
  const to = parseCoordinate(query.to);

  if (!from || !to) {
    res.status(400).json({ error: "Expected from and to as lon,lat coordinate pairs." });
    return;
  }

  if (!isWithinJamaicaRouteBounds(from) || !isWithinJamaicaRouteBounds(to)) {
    res.status(400).json({ error: "Route coordinates must stay within Jamaica planning bounds." });
    return;
  }

  if (haversineDistanceKm(from, to) > MAX_ROUTE_DISTANCE_KM) {
    res.status(400).json({ error: "Route is outside the supported Jamaica driving range." });
    return;
  }

  try {
    const route = await fetchOsrmRoute(from, to);
    const payload: RoadRouteApiResponse = {
      data: route,
      meta: {
        source: route.source,
        stepCount: route.steps.length,
      },
    };
    res.status(200).json(payload);
  } catch (error) {
    if (!isAbortError(error) && shouldLogRoutingProviderFailure()) {
      console.warn(`Road route provider unavailable; using planning route lines temporarily. ${formatErrorForLog(error)}`);
    }
    sendRouteFallback(res, "Road preview is unavailable right now, so the app is keeping a simple route line for this leg.");
  }
}

async function fetchOsrmRoute(from: Coordinate, to: Coordinate): Promise<RoadRoute> {
  const baseUrl = (process.env.ROUTING_API_BASE_URL || DEFAULT_ROUTING_BASE_URL).replace(/\/$/, "");
  const coordinates = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const url = new URL(`${baseUrl}/route/v1/driving/${coordinates}`);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "true");
  url.searchParams.set("alternatives", "false");
  url.searchParams.set("annotations", "distance,duration");

  const response = await fetchWithTimeout(url, getRoutingTimeoutMs());
  if (!response.ok) {
    throw new Error(`OSRM route failed: ${response.status}`);
  }

  const payload: unknown = await response.json();
  const payloadRecord = isRecord(payload) ? payload : {};
  const route = Array.isArray(payloadRecord.routes) && isRecord(payloadRecord.routes[0])
    ? payloadRecord.routes[0]
    : null;
  const geometry = route && isRecord(route.geometry) ? route.geometry : {};
  const coordinatesList = geometry.coordinates;

  if (!route || !Array.isArray(coordinatesList) || coordinatesList.length < 2) {
    throw new Error("OSRM did not return route geometry");
  }

  return {
    coordinates: coordinatesList
      .map(normalizeCoordinatePair)
      .filter((coordinate): coordinate is [number, number] => Boolean(coordinate)),
    distanceKm: roundTo(Number(route.distance ?? 0) / 1000, 1),
    durationMinutes: Math.max(1, Math.round(Number(route.duration ?? 0) / 60)),
    summary: buildRouteSummary(route.legs),
    steps: normalizeRouteSteps(route.legs),
    source: "osrm",
  };
}

function sendRouteFallback(res: ApiResponse, message: string) {
  const payload: RoadRouteApiResponse = {
    data: null,
    meta: {
      source: "fallback",
      reason: "road-route-unavailable",
      message,
    },
  };
  res.status(200).json(payload);
}

async function fetchWithTimeout(url: URL, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function getRoutingTimeoutMs(): number {
  return getPositiveEnvNumber("ROUTING_API_TIMEOUT_MS", DEFAULT_ROUTING_TIMEOUT_MS);
}

function getRoutingCooldownMs(): number {
  return getPositiveEnvNumber("ROUTING_PROVIDER_COOLDOWN_SECONDS", DEFAULT_ROUTING_COOLDOWN_SECONDS) * 1000;
}

function shouldLogRoutingProviderFailure(): boolean {
  const now = Date.now();
  if (now - routingProviderLastWarningAt < getRoutingCooldownMs()) return false;
  routingProviderLastWarningAt = now;
  return true;
}

function getPositiveEnvNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function formatErrorForLog(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = isRecord(error) ? error : {};
  const name = typeof record.name === "string" ? record.name : "";
  const code = typeof record.code === "string" ? record.code : "";
  const message = error instanceof Error ? error.message : "";
  return (
    name === "AbortError" ||
    code === "ABORT_ERR" ||
    /operation was aborted|request aborted|aborted/i.test(message)
  );
}

function normalizeRouteSteps(legs: unknown): RoadRouteStep[] {
  const steps = (Array.isArray(legs) ? legs : [])
    .flatMap((leg) => {
      const legRecord = isRecord(leg) ? leg : {};
      return Array.isArray(legRecord.steps) ? legRecord.steps : [];
    })
    .map((step, index) => mapOsrmStep(step, index))
    .filter((step): step is RoadRouteStep => Boolean(step))
    .filter((step) => isUsefulStep(step));

  if (steps.length <= MAX_ROUTE_STEPS) return steps;
  return [
    ...steps.slice(0, MAX_ROUTE_STEPS - 3),
    ...steps.slice(-3),
  ];
}

function mapOsrmStep(step: unknown, index: number): RoadRouteStep | null {
  const record = isRecord(step) ? step : {};
  const distanceKm = roundTo(Number(record.distance ?? 0) / 1000, 1);
  const durationMinutes = Math.max(0, Math.round(Number(record.duration ?? 0) / 60));
  const roadName = cleanRoadName(record.name);
  const roadRef = cleanRoadName(record.ref);
  const destinations = cleanRoadName(record.destinations);
  const rotaryName = cleanRoadName(record.rotary_name);
  const displayRoadName = roadName || roadRef || destinations || rotaryName;
  const maneuver = isRecord(record.maneuver) ? record.maneuver : {};
  const maneuverType = typeof maneuver.type === "string" ? maneuver.type : "continue";
  const modifier = typeof maneuver.modifier === "string" ? maneuver.modifier : "";
  const exitNumber = Number.isFinite(Number(maneuver.exit)) ? Number(maneuver.exit) : undefined;
  const location = normalizeCoordinatePair(maneuver.location);
  const instruction = buildInstruction(maneuverType, modifier, displayRoadName, exitNumber);

  if (!instruction) return null;

  const routeStep: RoadRouteStep = {
    id: `${index}-${maneuverType}-${modifier}-${displayRoadName}`,
    instruction,
    distanceKm,
    durationMinutes,
    roadName: displayRoadName,
    maneuverType,
    modifier,
    direction: buildDirectionLabel(maneuverType, modifier, exitNumber),
  };
  if (exitNumber !== undefined) routeStep.exitNumber = exitNumber;
  if (location) routeStep.location = location;
  if (roadRef) routeStep.ref = roadRef;
  if (destinations) routeStep.destinations = destinations;
  return routeStep;
}

function isUsefulStep(step: RoadRouteStep): boolean {
  if (step.maneuverType === "depart" || step.maneuverType === "arrive") return true;
  if (step.maneuverType === "roundabout" || step.maneuverType === "rotary") return true;
  if (step.instruction !== "Continue") return true;
  return step.distanceKm >= 0.2;
}

function buildInstruction(type: string, modifier: string, roadName: string, exitNumber?: number): string {
  const direction = humanizeModifier(modifier);

  if (type === "depart") {
    return roadName ? `Start on ${roadName}` : "Start route";
  }
  if (type === "arrive") {
    return modifier ? `Arrive; destination is on the ${direction}` : "Arrive at destination";
  }
  if (type === "turn") {
    return roadName ? `Turn ${direction || "ahead"} onto ${roadName}` : `Turn ${direction || "ahead"}`;
  }
  if (type === "new name") {
    return roadName ? `Continue onto ${roadName}` : "Continue";
  }
  if (type === "continue") {
    return roadName ? `Continue on ${roadName}` : "Continue";
  }
  if (type === "merge") {
    return roadName ? `Merge ${direction || "ahead"} onto ${roadName}` : `Merge ${direction || "ahead"}`;
  }
  if (type === "on ramp") {
    return roadName ? `Take the ramp onto ${roadName}` : "Take the ramp";
  }
  if (type === "off ramp") {
    return roadName ? `Take the exit toward ${roadName}` : "Take the exit";
  }
  if (type === "roundabout" || type === "rotary") {
    const exitText = exitNumber ? `take exit ${exitNumber}` : "continue through";
    return roadName ? `At the roundabout, ${exitText} toward ${roadName}` : `At the roundabout, ${exitText}`;
  }
  if (type === "fork") {
    return roadName ? `Keep ${direction || "ahead"} toward ${roadName}` : `Keep ${direction || "ahead"}`;
  }
  if (type === "end of road") {
    return roadName ? `At the end of the road, turn ${direction || "ahead"} onto ${roadName}` : `At the end of the road, turn ${direction || "ahead"}`;
  }

  const action = titleCase(type.replace(/_/g, " "));
  return roadName ? `${action} onto ${roadName}` : action;
}

function buildDirectionLabel(type: string, modifier: string, exitNumber?: number): string {
  if ((type === "roundabout" || type === "rotary") && exitNumber) return `Exit ${exitNumber}`;
  if (modifier) return titleCase(humanizeModifier(modifier));
  return titleCase(type.replace(/_/g, " "));
}

function humanizeModifier(value: unknown): string {
  return typeof value === "string" ? value.replace(/_/g, " ").trim() : "";
}

function buildRouteSummary(legs: unknown): string {
  const roadNames: string[] = [];
  (Array.isArray(legs) ? legs : []).forEach((leg) => {
    const legRecord = isRecord(leg) ? leg : {};
    (Array.isArray(legRecord.steps) ? legRecord.steps : []).forEach((step) => {
      const stepRecord = isRecord(step) ? step : {};
      const name = cleanRoadName(stepRecord.ref || stepRecord.name || stepRecord.destinations);
      if (name && !roadNames.includes(name)) roadNames.push(name);
    });
  });
  return roadNames.slice(0, 4).join(" · ");
}

function cleanRoadName(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function roundTo(value: number, places: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseCoordinate(value: unknown): Coordinate | null {
  const firstValue = Array.isArray(value) ? value[0] : value;
  if (typeof firstValue !== "string") return null;

  const [longitudeRaw, latitudeRaw] = firstValue.split(",");
  const longitude = Number(longitudeRaw);
  const latitude = Number(latitudeRaw);

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { longitude, latitude };
}

function isCoordinatePair(value: unknown): value is [unknown, unknown, ...unknown[]] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1]))
  );
}

function normalizeCoordinatePair(value: unknown): [number, number] | null {
  if (!isCoordinatePair(value)) return null;
  return [Number(value[0]), Number(value[1])];
}

function isWithinJamaicaRouteBounds(coordinate: Coordinate): boolean {
  return (
    coordinate.longitude >= JAMAICA_ROUTE_BOUNDS.minLongitude &&
    coordinate.longitude <= JAMAICA_ROUTE_BOUNDS.maxLongitude &&
    coordinate.latitude >= JAMAICA_ROUTE_BOUNDS.minLatitude &&
    coordinate.latitude <= JAMAICA_ROUTE_BOUNDS.maxLatitude
  );
}

function haversineDistanceKm(from: Coordinate, to: Coordinate): number {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
