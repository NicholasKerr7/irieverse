import { EXPERIENCES } from "../data/content";
import type { Destination, RouteLeg } from "../types/travel";

export type MapPinCategory =
  | "beaches"
  | "food"
  | "music"
  | "culture"
  | "nightlife"
  | "adventure"
  | "default";

export type MapCategoryId = "all" | "beaches" | "food" | "music" | "culture" | "nightlife";

export const MAP_CATEGORIES: Array<{ id: MapCategoryId; label: string; color: string; border: string }> = [
  { id: "all", label: "All", color: "bg-slate-200", border: "border-slate-200/50" },
  { id: "beaches", label: "Beaches", color: "bg-cyan-300", border: "border-cyan-300/50" },
  { id: "food", label: "Food", color: "bg-amber-300", border: "border-amber-300/50" },
  { id: "music", label: "Music", color: "bg-violet-300", border: "border-violet-300/50" },
  { id: "culture", label: "Culture", color: "bg-emerald-300", border: "border-emerald-300/50" },
  { id: "nightlife", label: "Nightlife", color: "bg-rose-300", border: "border-rose-300/50" },
];

const ROUTE_COLORS = ["#fb5573", "#f59e0b", "#d946ef", "#22c55e", "#8b5cf6", "#38bdf8"];

export function getLinkedExperiences(destinationId: string) {
  return EXPERIENCES.filter((experience) => experience.linkedDestinationId === destinationId);
}

export function destinationMatchesCategory(destination: Destination, category: MapCategoryId) {
  if (category === "all") return true;
  const linkedExperiences = getLinkedExperiences(destination.id);
  const destinationText = getDestinationSearchText(destination);

  if (category === "beaches") {
    return /beach|coast|lagoon|cove|sandbar|sea|sunset/.test(destinationText);
  }
  if (category === "food") {
    return linkedExperiences.some((experience) => experience.type === "food" || experience.vibes.includes("food"));
  }
  if (category === "music") {
    return (
      linkedExperiences.some((experience) => experience.type === "music") ||
      destinationText.includes("music") ||
      destinationText.includes("sound system")
    );
  }
  if (category === "culture") {
    return (
      destination.vibes.includes("culture") ||
      destination.vibes.includes("authentic") ||
      linkedExperiences.some((experience) => experience.type === "festival" || experience.vibes.includes("culture"))
    );
  }
  if (category === "nightlife") {
    return destination.vibes.includes("nightlife") || destinationText.includes("nightlife");
  }

  return true;
}

export function getDestinationPinCategory(destination: Destination): MapPinCategory {
  const linkedExperiences = getLinkedExperiences(destination.id);
  const destinationText = getDestinationSearchText(destination);

  if (destination.vibes.includes("nightlife")) return "nightlife";
  if (linkedExperiences.some((experience) => experience.type === "music")) return "music";
  if (linkedExperiences.some((experience) => experience.type === "food")) return "food";
  if (
    destination.vibes.includes("culture") ||
    destination.vibes.includes("authentic") ||
    linkedExperiences.some((experience) => experience.type === "festival")
  ) {
    return "culture";
  }
  if (/beach|coast|lagoon|cove|sandbar|sea|sunset/.test(destinationText)) return "beaches";
  if (destination.vibes.includes("adventure") || destination.vibes.includes("nature")) return "adventure";
  return "default";
}

export function getNearbyExperiences(destination: Destination) {
  const selectedName = destination.name.toLowerCase();
  const selectedNameLead = selectedName.split(" ")[0] ?? selectedName;
  const selectedRegion = destination.region.toLowerCase();

  return EXPERIENCES.filter((experience) => {
    const experienceRegion = experience.region.toLowerCase();
    return (
      experience.linkedDestinationId === destination.id ||
      experienceRegion === selectedRegion ||
      selectedName.includes(experienceRegion) ||
      experienceRegion.includes(selectedNameLead)
    );
  });
}

export function getRouteLegId(leg: RouteLeg, index: number): string {
  return `${leg.fromDestinationId}-${leg.toDestinationId}-${index}`;
}

export function getRouteStatusLabel(routeStatus: {
  isLoading: boolean;
  totalLegs: number;
  roadLegs: number;
  fallbackLegs?: number;
  failedLegs?: number;
}): string {
  if (!routeStatus.totalLegs) return "No preview";
  if (routeStatus.isLoading) return "Building preview";
  if (routeStatus.roadLegs === routeStatus.totalLegs) return "Road-aware";
  if ((routeStatus.failedLegs ?? 0) > 0 && routeStatus.roadLegs > 0) {
    return "Mixed route";
  }
  if ((routeStatus.failedLegs ?? 0) > 0) return "Planning estimate";
  if (routeStatus.roadLegs > 0) return "Mixed route";
  return "Planning estimate";
}

export function getRouteColor(index: number): string {
  return ROUTE_COLORS[index % ROUTE_COLORS.length] ?? ROUTE_COLORS[0] ?? "#22d3ee";
}

export function mergeDestinations(primary: Destination[], secondary: Destination[]): Destination[] {
  const byId = new globalThis.Map<string, Destination>();
  [...primary, ...secondary].forEach((destination) => byId.set(destination.id, destination));
  return Array.from(byId.values());
}

export function buildDrivingGuideUrl(routeDestinations: Destination[]): string {
  const [origin, ...rest] = routeDestinations;
  const destination = rest[rest.length - 1];
  if (!origin || !destination) return "https://www.google.com/maps";
  const waypoints = rest.slice(0, -1);
  const params = new URLSearchParams({
    api: "1",
    travelmode: "driving",
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
  });

  if (waypoints.length) {
    params.set(
      "waypoints",
      waypoints
        .map((waypoint) => `${waypoint.latitude},${waypoint.longitude}`)
        .join("|")
    );
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function getDestinationSearchText(destination: Destination): string {
  return [
    destination.name,
    destination.region,
    destination.headline,
    destination.description,
    destination.highlights.join(" "),
    destination.vibes.join(" "),
  ]
    .join(" ")
    .toLowerCase();
}
