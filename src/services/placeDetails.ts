import type { Destination, Experience } from "../types/travel";
import type { PlaceDetails, PlaceDetailsApiResponse } from "../types/api";

export type { PlaceDetails } from "../types/api";

export type PlaceDetailsSourceMeta = {
  source: PlaceDetailsApiResponse["meta"]["source"];
  providerConfigured: boolean;
  reason?: string;
  cached?: boolean;
};

export type PlaceDetailsLookupResult = {
  details: PlaceDetails | null;
  meta: PlaceDetailsSourceMeta;
};

type PlaceDetailsLookup =
  | { kind: "destination"; destination: Destination }
  | { kind: "experience"; experience: Experience; linkedDestination?: Destination };

export async function fetchPlaceDetails(
  lookup: PlaceDetailsLookup,
  signal?: AbortSignal
): Promise<PlaceDetailsLookupResult> {
  const endpoint = new URL("/api/place-details", getBaseUrl());
  const placeLookup = lookup.kind === "destination" ? lookup.destination.placeLookup : lookup.experience.placeLookup;

  if (lookup.kind === "experience" && !placeLookup?.query) {
    return {
      details: null,
      meta: {
        source: "curated",
        providerConfigured: false,
        reason: "missing-place-query",
      },
    };
  }

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

  if (placeLookup?.query) {
    endpoint.searchParams.set("placeQuery", placeLookup.query);
  }

  if (placeLookup?.requiredTerms?.length) {
    endpoint.searchParams.set("requiredTerms", placeLookup.requiredTerms.join(","));
  }

  if (placeLookup?.blockedTerms?.length) {
    endpoint.searchParams.set("blockedTerms", placeLookup.blockedTerms.join(","));
  }

  const response = await fetch(endpoint.toString(), signal ? { signal } : {});
  if (!response.ok) {
    throw new Error(`Place details lookup failed: ${response.status}`);
  }

  const payload: unknown = await response.json();
  const meta = normalizePlaceDetailsMeta(payload);
  if (!isRecord(payload) || !isRecord(payload.data)) {
    return {
      details: null,
      meta,
    };
  }

  const details = normalizePlaceDetails(payload.data);
  if (!isAcceptablePlaceDetails(details, lookup)) {
    return {
      details: null,
      meta: {
        ...meta,
        source: "curated",
        reason: meta.reason ?? "live-place-mismatch",
      },
    };
  }

  return {
    details,
    meta,
  };
}

function normalizePlaceDetailsMeta(payload: unknown): PlaceDetailsSourceMeta {
  if (isRecord(payload) && isRecord(payload.meta)) {
    const source = payload.meta.source === "google-places" ? "google-places" : "curated";
    const meta: PlaceDetailsSourceMeta = {
      source,
      providerConfigured: payload.meta.providerConfigured === true,
    };
    const reason = asString(payload.meta.reason);
    if (reason) meta.reason = reason;
    if (typeof payload.meta.cached === "boolean") meta.cached = payload.meta.cached;
    return meta;
  }

  return {
    source: "curated",
    providerConfigured: false,
    reason: "missing-place-metadata",
  };
}

function normalizePlaceDetails(data: Record<string, unknown>): PlaceDetails {
  const details: PlaceDetails = {
    id: asString(data.id),
    name: asString(data.name),
    address: asString(data.address),
    shortAddress: asString(data.shortAddress),
    mapsUrl: asString(data.mapsUrl),
    websiteUrl: asString(data.websiteUrl),
    phone: asString(data.phone),
    internationalPhone: asString(data.internationalPhone),
    priceLevel: asString(data.priceLevel),
    weekdayDescriptions: asStringArray(data.weekdayDescriptions),
    businessStatus: asString(data.businessStatus),
    primaryType: asString(data.primaryType),
    types: asStringArray(data.types),
    source: "google-places",
  };
  const latitude = asNumber(data.latitude);
  const longitude = asNumber(data.longitude);
  const rating = asNumber(data.rating);
  const userRatingCount = asNumber(data.userRatingCount);
  if (latitude !== undefined) details.latitude = latitude;
  if (longitude !== undefined) details.longitude = longitude;
  if (rating !== undefined) details.rating = rating;
  if (userRatingCount !== undefined) details.userRatingCount = userRatingCount;
  if (typeof data.openNow === "boolean") details.openNow = data.openNow;
  return details;
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

const DEFAULT_BLOCKED_PLACE_TERMS = [
  "diagnostic",
  "imaging",
  "laboratory",
  "medical",
  "pharmacy",
  "radiology",
  "ultrasound",
  "xray",
];

function isAcceptablePlaceDetails(details: PlaceDetails, lookup: PlaceDetailsLookup): boolean {
  const placeLookup = lookup.kind === "destination" ? lookup.destination.placeLookup : lookup.experience.placeLookup;
  const searchableText = normalizeSearchText([
    details.name,
    details.address,
    details.shortAddress,
    details.primaryType,
    ...details.types,
  ].join(" "));
  const placeNameText = normalizeSearchText(details.name);

  const blockedTerms = [
    ...DEFAULT_BLOCKED_PLACE_TERMS,
    ...(placeLookup?.blockedTerms ?? []),
  ].map(normalizeSearchText).filter(Boolean);

  if (blockedTerms.some((term) => searchTextIncludes(searchableText, term))) {
    return false;
  }

  const requiredTerms = (placeLookup?.requiredTerms ?? [])
    .map(normalizeSearchText)
    .filter(Boolean);

  if (!requiredTerms.length) return true;

  return requiredTerms.every((term) => searchTextIncludes(placeNameText, term));
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function searchTextIncludes(searchableText: string, term: string): boolean {
  return searchableText.includes(term);
}
