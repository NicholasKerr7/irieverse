import type { Destination, Experience } from "../types/travel";

export type PlaceDetails = {
  id: string;
  name: string;
  address: string;
  shortAddress: string;
  latitude?: number;
  longitude?: number;
  mapsUrl: string;
  websiteUrl: string;
  phone: string;
  internationalPhone: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel: string;
  openNow?: boolean;
  weekdayDescriptions: string[];
  businessStatus: string;
  primaryType: string;
  types: string[];
  source: "google-places";
};

type PlaceDetailsLookup =
  | { kind: "destination"; destination: Destination }
  | { kind: "experience"; experience: Experience; linkedDestination?: Destination };

export async function fetchPlaceDetails(
  lookup: PlaceDetailsLookup,
  signal?: AbortSignal
): Promise<PlaceDetails | null> {
  const endpoint = new URL("/api/place-details", getBaseUrl());

  if (lookup.kind === "destination") {
    endpoint.searchParams.set("kind", "destination");
    endpoint.searchParams.set("name", lookup.destination.name);
    endpoint.searchParams.set("region", lookup.destination.region);
    endpoint.searchParams.set("latitude", String(lookup.destination.latitude));
    endpoint.searchParams.set("longitude", String(lookup.destination.longitude));
  } else {
    endpoint.searchParams.set("kind", "experience");
    endpoint.searchParams.set("name", lookup.experience.title);
    endpoint.searchParams.set("region", lookup.experience.region);
    endpoint.searchParams.set("location", lookup.experience.location);

    if (lookup.linkedDestination) {
      endpoint.searchParams.set("latitude", String(lookup.linkedDestination.latitude));
      endpoint.searchParams.set("longitude", String(lookup.linkedDestination.longitude));
    }
  }

  const response = await fetch(endpoint.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Place details lookup failed: ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.data)) return null;

  return normalizePlaceDetails(payload.data);
}

function normalizePlaceDetails(data: Record<string, unknown>): PlaceDetails {
  return {
    id: asString(data.id),
    name: asString(data.name),
    address: asString(data.address),
    shortAddress: asString(data.shortAddress),
    latitude: asNumber(data.latitude),
    longitude: asNumber(data.longitude),
    mapsUrl: asString(data.mapsUrl),
    websiteUrl: asString(data.websiteUrl),
    phone: asString(data.phone),
    internationalPhone: asString(data.internationalPhone),
    rating: asNumber(data.rating),
    userRatingCount: asNumber(data.userRatingCount),
    priceLevel: asString(data.priceLevel),
    openNow: typeof data.openNow === "boolean" ? data.openNow : undefined,
    weekdayDescriptions: asStringArray(data.weekdayDescriptions),
    businessStatus: asString(data.businessStatus),
    primaryType: asString(data.primaryType),
    types: asStringArray(data.types),
    source: "google-places",
  };
}

function getBaseUrl(): string {
  return typeof window === "undefined" ? "http://localhost" : window.location.origin;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
