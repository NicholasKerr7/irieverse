export type Vibe =
  | "all"
  | "chill"
  | "nightlife"
  | "family"
  | "romantic"
  | "adventure"
  | "culture"
  | "nature"
  | "authentic"
  | "mixed";

export type ExperienceCategory = "food" | "music" | "festival";

export type ExperienceType = "all" | ExperienceCategory;

export type PlanningMode = "visitor" | "local" | "hosting";

export type PlanningTemplateId =
  | "first-jamaica-trip"
  | "west-coast-reset"
  | "local-food-run"
  | "river-and-beach-day"
  | "host-visitors"
  | "culture-night";

export interface PlanningTemplate {
  id: PlanningTemplateId;
  mode: PlanningMode;
  title: string;
  eyebrow: string;
  body: string;
  baseId: string;
  days: number;
  vibe: Vibe;
  budget: number;
  originAirportId?: string;
  routeDestinationIds?: string[];
}

export type ImportedIdeaCategory =
  | "food"
  | "beach"
  | "music"
  | "culture"
  | "hotel"
  | "hidden-gem"
  | "nightlife"
  | "other";

export type ImportedIdeaSourcePlatform =
  | "google-maps"
  | "tiktok"
  | "instagram"
  | "youtube"
  | "article"
  | "manual";

export interface Destination {
  id: string;
  name: string;
  region: string;
  vibes: string[];
  rating: number;
  priceLevel: number;
  headline: string;
  description: string;
  highlights: string[];
  heroImage: string;
  latitude: number;
  longitude: number;
  airportCode: string;
  quickFacts?: QuickFact[];
  markerType?: "destination" | "experience";
}

export interface QuickFact {
  label: string;
  value: string;
}

export interface FlightOption {
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  departureTimeUTC: string;
  arrivalTimeUTC: string;
  status?: string;
  durationMinutes?: number;
}

export interface Experience {
  id: string;
  title: string;
  type: ExperienceCategory;
  region: string;
  location: string;
  linkedDestinationId?: string;
  vibes: string[];
  rating: number;
  energy: string;
  description: string;
  whatToExpect: string[];
  bestTime: string;
  imageUrl: string;
  approxCost: string;
}

export interface ImportedIdea {
  id: string;
  title: string;
  url: string;
  note: string;
  category: ImportedIdeaCategory;
  collectionId: string;
  createdAt: string;
  linkedDestinationId?: string;
  sourcePlatform?: ImportedIdeaSourcePlatform;
  sourceLabel?: string;
  extractedPlaceName?: string;
}

export interface WeatherPlanDay {
  date: string;
  condition: string;
  summary: string;
  maxTempC: number;
  minTempC: number;
  precipitationProbability: number;
  precipitationMm: number;
  weatherCode: number;
  planningSignal: "clear" | "cloudy" | "rain" | "storm" | "hot";
}

export interface PlannerDay {
  day: number;
  destinationId: string;
  destName: string;
  destRegion: string;
  vibe: string;
  highlight: string;
  suggestedBudget: number;
  isBase: boolean;
  routeNote: string;
  distanceFromPreviousKm: number;
  driveMinutesFromPrevious: number;
  transferSeverity: "easy" | "moderate" | "long";
  energyLevel: "soft" | "balanced" | "high";
  weather?: WeatherPlanDay;
  weatherNote?: string;
  experience?: Experience;
}

export interface RouteStop {
  destinationId: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  day: number;
  isBase: boolean;
  distanceFromPreviousKm: number;
  driveMinutesFromPrevious: number;
  transferSeverity: "easy" | "moderate" | "long";
}

export interface RouteLeg {
  fromDestinationId: string;
  toDestinationId: string;
  fromName: string;
  toName: string;
  distanceKm: number;
  driveMinutes: number;
  transferSeverity: "easy" | "moderate" | "long";
}

export interface RouteWarning {
  id: string;
  day: number;
  severity: "moderate" | "long";
  title: string;
  body: string;
}

export interface RouteSummary {
  totalDistanceKm: number;
  totalDriveMinutes: number;
  regionCount: number;
  routeTone: string;
  routeMode: "optimized" | "manual";
  stops: RouteStop[];
  legs: RouteLeg[];
  warnings: RouteWarning[];
}

export interface ItineraryPlan {
  base: Destination;
  days: number;
  plannerVibe: Vibe | "mixed";
  budgetPerDay: number;
  daysPlan: PlannerDay[];
  routeSummary: RouteSummary;
}

export interface OriginAirport {
  id: string;
  name: string;
  code: string;
  shortLabel?: string;
  latitude: number;
  longitude: number;
}

export interface LiveEvent {
  id: string;
  title: string;
  city: string;
  region: string;
  venue: string;
  startDate: string;
  price?: string;
  description?: string;
  vibes?: string[];
}

export interface BookingOption {
  id: string;
  title: string;
  provider: string;
  type: "hotel" | "flight" | "package";
  price: number;
  currency: string;
  url: string;
  description?: string;
  rating?: number;
  perks?: string[];
}
