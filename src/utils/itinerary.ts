import { DESTINATIONS, EXPERIENCES } from "../data/content";
import type { Destination, Experience, ImportedIdea, ItineraryPlan, Vibe } from "../types/travel";
import { formatDriveTime } from "./format";

const EARTH_RADIUS_KM = 6371;

type BuildItineraryArgs = {
  destination: Destination;
  manualRouteDestinationIds: string[];
  savedPlaces: Set<string>;
  importedIdeas: ImportedIdea[];
  plannerVibe: Vibe;
  plannerBudget: number;
  plannerDays: number;
};

export function buildItineraryPlan({
  destination,
  manualRouteDestinationIds,
  savedPlaces,
  importedIdeas,
  plannerVibe,
  plannerBudget,
  plannerDays,
}: BuildItineraryArgs): ItineraryPlan {
  const safeDays = clampPlannerDays(plannerDays);
  const preferredDestinationIds = new Set<string>([
    destination.id,
    ...manualRouteDestinationIds,
    ...Array.from(savedPlaces),
    ...importedIdeas
      .map((idea) => idea.linkedDestinationId)
      .filter((id): id is string => Boolean(id)),
  ]);
  const candidatePool = buildDestinationPool(destination, preferredDestinationIds, plannerVibe);
  const optimizedRouteDestinations = buildRouteOrder(destination, candidatePool, preferredDestinationIds, plannerVibe, safeDays);
  const manualRouteDestinations = buildManualRouteOrder(
    destination,
    manualRouteDestinationIds,
    candidatePool,
    safeDays
  );
  const routeDestinations = manualRouteDestinations ?? optimizedRouteDestinations;
  const routeMode = manualRouteDestinations ? "manual" : "optimized";
  const expPool = EXPERIENCES.slice().sort((a, b) => b.rating - a.rating);

  const daysPlan = Array.from({ length: safeDays }, (_, index) => {
    const tripDestination = routeDestinations[Math.min(index, routeDestinations.length - 1)] ?? destination;
    const previousDestination = index === 0
      ? null
      : routeDestinations[Math.min(index - 1, routeDestinations.length - 1)] ?? destination;
    const distanceFromPreviousKm = previousDestination
      ? roundDistance(haversineDistance(
          previousDestination.latitude,
          previousDestination.longitude,
          tripDestination.latitude,
          tripDestination.longitude
        ))
      : 0;
    const driveMinutesFromPrevious = estimateDriveMinutes(distanceFromPreviousKm);
    const transferSeverity = getTransferSeverity(driveMinutesFromPrevious);
    const destinationVibe = chooseDayVibe(tripDestination, plannerVibe, index);
    const energyLevel = chooseEnergyLevel(index, destinationVibe);
    const highlight =
      tripDestination.highlights[index % tripDestination.highlights.length] ??
      tripDestination.highlights[0];
    const matchedExperiences = rankExperiencesForDay(expPool, tripDestination, destinationVibe, energyLevel);
    const experience = matchedExperiences[0] ?? expPool[index % expPool.length];

    return {
      day: index + 1,
      destinationId: tripDestination.id,
      destName: tripDestination.name,
      destRegion: tripDestination.region,
      vibe: destinationVibe,
      highlight,
      suggestedBudget: plannerBudget,
      isBase: tripDestination.id === destination.id,
      routeNote: buildRouteNote(previousDestination, tripDestination, distanceFromPreviousKm, driveMinutesFromPrevious),
      distanceFromPreviousKm,
      driveMinutesFromPrevious,
      transferSeverity,
      energyLevel,
      experience,
    };
  });

  return {
    base: destination,
    days: safeDays,
    plannerVibe,
    budgetPerDay: plannerBudget,
    daysPlan,
    routeSummary: buildRouteSummary(routeDestinations, destination, routeMode),
  };
}

export function clampPlannerDays(days: number): number {
  if (!Number.isFinite(days)) return 5;
  return Math.max(1, Math.min(Math.round(days), 14));
}

export function clampPlannerBudget(budget: number): number {
  if (!Number.isFinite(budget)) return 150;
  return Math.max(50, Math.min(Math.round(budget), 600));
}

export function addDaysToISODate(startDateISO: string, days: number): string | undefined {
  const startDate = new Date(`${startDateISO}T00:00:00`);
  if (Number.isNaN(startDate.getTime())) return undefined;
  const checkoutDate = new Date(startDate);
  checkoutDate.setDate(startDate.getDate() + clampPlannerDays(days));
  return checkoutDate.toISOString().slice(0, 10);
}

export function buildDestinationPool(
  base: Destination,
  preferredDestinationIds: Set<string>,
  plannerVibe: Vibe | "mixed"
): Destination[] {
  const seen = new Set<string>();
  const pool: Destination[] = [];
  const append = (destination: Destination) => {
    if (seen.has(destination.id)) return;
    seen.add(destination.id);
    pool.push(destination);
  };

  append(base);
  DESTINATIONS.filter((destination) => preferredDestinationIds.has(destination.id)).forEach(append);
  DESTINATIONS
    .filter((destination) => plannerVibe === "mixed" || destination.vibes.includes(plannerVibe))
    .sort((a, b) => b.rating - a.rating)
    .forEach(append);
  DESTINATIONS.slice()
    .sort((a, b) => b.rating - a.rating)
    .forEach(append);

  return pool;
}

export function buildRouteOrder(
  base: Destination,
  candidatePool: Destination[],
  preferredDestinationIds: Set<string>,
  plannerVibe: Vibe | "mixed",
  days: number
): Destination[] {
  const route = [base];
  const remaining = candidatePool.filter((destination) => destination.id !== base.id);
  const maxStops = Math.min(days, candidatePool.length);

  while (route.length < maxStops && remaining.length) {
    const current = route[route.length - 1];
    const nextIndex = remaining.reduce((bestIndex, candidate, index) => {
      const best = remaining[bestIndex];
      return routeCandidateScore(current, candidate, preferredDestinationIds, plannerVibe) <
        routeCandidateScore(current, best, preferredDestinationIds, plannerVibe)
        ? index
        : bestIndex;
    }, 0);
    const [next] = remaining.splice(nextIndex, 1);
    route.push(next);
  }

  return route;
}

export function normalizeRouteDestinationIds(ids: string[], baseId: string, days: number): string[] {
  const maxStops = Math.max(0, clampPlannerDays(days) - 1);
  const validDestinationIds = new Set(DESTINATIONS.map((destination) => destination.id));
  const seen = new Set<string>();
  const normalized: string[] = [];

  ids.forEach((id) => {
    if (id === baseId || !validDestinationIds.has(id) || seen.has(id)) return;
    seen.add(id);
    normalized.push(id);
  });

  return normalized.slice(0, maxStops);
}

export function arraysEqual(first: string[], second: string[]): boolean {
  return first.length === second.length && first.every((item, index) => item === second[index]);
}

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function buildManualRouteOrder(
  base: Destination,
  manualDestinationIds: string[],
  candidatePool: Destination[],
  days: number
): Destination[] | null {
  const manualIds = normalizeRouteDestinationIds(manualDestinationIds, base.id, days);
  if (!manualIds.length) return null;

  const destinationsById = new Map(candidatePool.map((destination) => [destination.id, destination]));
  const route: Destination[] = [base];

  manualIds.forEach((id) => {
    const destination = destinationsById.get(id);
    if (destination && !route.some((stop) => stop.id === destination.id)) {
      route.push(destination);
    }
  });

  return route.slice(0, Math.max(1, days));
}

function routeCandidateScore(
  current: Destination,
  candidate: Destination,
  preferredDestinationIds: Set<string>,
  plannerVibe: Vibe | "mixed"
): number {
  const distanceKm = haversineDistance(current.latitude, current.longitude, candidate.latitude, candidate.longitude);
  const preferredBoost = preferredDestinationIds.has(candidate.id) ? -55 : 0;
  const vibePenalty = plannerVibe !== "mixed" && !candidate.vibes.includes(plannerVibe) ? 35 : 0;
  const sameRegionBoost = current.region === candidate.region ? -30 : 0;
  const longTransferPenalty = distanceKm > 145 ? 45 : 0;
  const ratingBoost = candidate.rating * -4;

  return distanceKm + preferredBoost + vibePenalty + sameRegionBoost + longTransferPenalty + ratingBoost;
}

function chooseDayVibe(destination: Destination, plannerVibe: Vibe | "mixed", dayIndex: number): string {
  if (dayIndex === 0) return "chill";
  if ((plannerVibe === "nightlife" || plannerVibe === "adventure") && dayIndex % 3 === 2) {
    return "chill";
  }
  if (plannerVibe !== "mixed") return plannerVibe;
  return destination.vibes[dayIndex % destination.vibes.length] ?? destination.vibes[0] ?? "chill";
}

function chooseEnergyLevel(dayIndex: number, destinationVibe: string): "soft" | "balanced" | "high" {
  if (dayIndex === 0 || dayIndex % 3 === 2) return "soft";
  if (destinationVibe === "nightlife" || destinationVibe === "adventure") return "high";
  return "balanced";
}

function rankExperiencesForDay(
  experiences: Experience[],
  destination: Destination,
  dayVibe: string,
  energyLevel: "soft" | "balanced" | "high"
): Experience[] {
  return experiences
    .map((experience) => ({
      experience,
      score:
        (experience.linkedDestinationId === destination.id ? 70 : 0) +
        (experience.region === destination.region || destination.name.includes(experience.region) ? 28 : 0) +
        (experience.vibes.includes(dayVibe) ? 18 : 0) +
        (energyLevel === "high" && experience.energy === "high" ? 16 : 0) +
        (energyLevel === "soft" && experience.energy === "high" ? -28 : 0) +
        experience.rating,
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.experience);
}

function buildRouteNote(
  previousDestination: Destination | null,
  destination: Destination,
  distanceKm: number,
  driveMinutes: number
): string {
  if (!previousDestination) return "Soft landing near your base";
  if (previousDestination.id === destination.id) return "Stay local and go deeper";
  if (previousDestination.region === destination.region) return "Short regional hop";
  if (driveMinutes >= 180) return "Long transfer day";
  if (distanceKm <= 70) return "Easy coastal transfer";
  return "Route-aware transfer";
}

function buildRouteSummary(
  routeDestinations: Destination[],
  base: Destination,
  routeMode: ItineraryPlan["routeSummary"]["routeMode"]
): ItineraryPlan["routeSummary"] {
  const stops = routeDestinations.map((destination, index) => {
    const previousDestination = index > 0 ? routeDestinations[index - 1] : null;
    const distanceFromPreviousKm = previousDestination
      ? roundDistance(haversineDistance(
          previousDestination.latitude,
          previousDestination.longitude,
          destination.latitude,
          destination.longitude
        ))
      : 0;
    const driveMinutesFromPrevious = estimateDriveMinutes(distanceFromPreviousKm);
    const transferSeverity = getTransferSeverity(driveMinutesFromPrevious);

    return {
      destinationId: destination.id,
      name: destination.name,
      region: destination.region,
      latitude: destination.latitude,
      longitude: destination.longitude,
      day: index + 1,
      isBase: destination.id === base.id,
      distanceFromPreviousKm,
      driveMinutesFromPrevious,
      transferSeverity,
    };
  });
  const legs = stops.slice(1).map((stop, index) => {
    const previousStop = stops[index];
    return {
      fromDestinationId: previousStop.destinationId,
      toDestinationId: stop.destinationId,
      fromName: previousStop.name,
      toName: stop.name,
      distanceKm: stop.distanceFromPreviousKm,
      driveMinutes: stop.driveMinutesFromPrevious,
      transferSeverity: stop.transferSeverity,
    };
  });
  const totalDistanceKm = legs.reduce((sum, leg) => sum + leg.distanceKm, 0);
  const totalDriveMinutes = legs.reduce((sum, leg) => sum + leg.driveMinutes, 0);
  const regionCount = new Set(stops.map((stop) => stop.region)).size;
  const baseTone = totalDriveMinutes > 420 ? "Wide island loop" : totalDriveMinutes > 240 ? "Balanced island route" : "Compact regional route";
  const warnings = buildRouteWarnings(legs);

  return {
    totalDistanceKm,
    totalDriveMinutes,
    regionCount,
    routeTone: routeMode === "manual" ? `${baseTone} - edited` : baseTone,
    routeMode,
    stops,
    legs,
    warnings,
  };
}

function buildRouteWarnings(routeLegs: ItineraryPlan["routeSummary"]["legs"]): ItineraryPlan["routeSummary"]["warnings"] {
  return routeLegs
    .filter((leg) => leg.transferSeverity !== "easy")
    .map((leg, index) => ({
      id: `${leg.fromDestinationId}-${leg.toDestinationId}-${index}`,
      day: index + 2,
      severity: leg.transferSeverity === "long" ? "long" : "moderate",
      title: leg.transferSeverity === "long" ? `Long transfer into ${leg.toName}` : `Busy transfer into ${leg.toName}`,
      body: `${formatDriveTime(leg.driveMinutes)} from ${leg.fromName}; consider a lighter activity day.`,
    }));
}

function roundDistance(distanceKm: number): number {
  if (!Number.isFinite(distanceKm)) return 0;
  return Math.round(distanceKm);
}

function estimateDriveMinutes(distanceKm: number): number {
  if (!distanceKm) return 0;
  return Math.max(20, Math.round((distanceKm / 52) * 60));
}

function getTransferSeverity(minutes: number): "easy" | "moderate" | "long" {
  if (minutes >= 180) return "long";
  if (minutes >= 110) return "moderate";
  return "easy";
}
