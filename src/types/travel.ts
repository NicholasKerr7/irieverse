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

export interface PlannerDay {
  day: number;
  destName: string;
  destRegion: string;
  vibe: string;
  highlight: string;
  suggestedBudget: number;
  isBase: boolean;
  experience?: Experience;
}

export interface ItineraryPlan {
  base: Destination;
  days: number;
  plannerVibe: Vibe | "mixed";
  budgetPerDay: number;
  daysPlan: PlannerDay[];
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
