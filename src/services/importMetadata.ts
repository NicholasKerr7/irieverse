import type { ImportedIdeaSourcePlatform } from "../types/travel";
import type { ImportMetadata, ImportMetadataPlace } from "../types/api";

export type { ImportMetadata } from "../types/api";

export async function fetchImportMetadata(url: string, signal?: AbortSignal): Promise<ImportMetadata | null> {
  const normalizedUrl = normalizeMetadataUrl(url);
  if (!normalizedUrl) return null;

  const endpoint = new URL("/api/import-metadata", getBaseUrl());
  endpoint.searchParams.set("url", normalizedUrl);

  const response = await fetch(endpoint.toString(), signal ? { signal } : {});
  if (!response.ok) {
    throw new Error(`Import metadata lookup failed: ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.data)) return null;

  return normalizeImportMetadata(payload.data, normalizedUrl);
}

function normalizeImportMetadata(data: Record<string, unknown>, fallbackUrl: string): ImportMetadata {
  const metadata: ImportMetadata = {
    url: asString(data.url) || fallbackUrl,
    finalUrl: asString(data.finalUrl) || asString(data.url) || fallbackUrl,
    sourcePlatform: normalizeSourcePlatform(data.sourcePlatform),
    sourceLabel: asString(data.sourceLabel) || "Website",
    title: asString(data.title),
    description: asString(data.description),
    imageUrl: asString(data.imageUrl),
    siteName: asString(data.siteName),
    confidence: normalizeConfidence(data.confidence),
    cached: data.cached === true,
  };
  const place = normalizeImportMetadataPlace(data.place);
  const reason = asString(data.reason);
  if (place) metadata.place = place;
  if (reason) metadata.reason = reason;
  return metadata;
}

function normalizeMetadataUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function getBaseUrl(): string {
  return typeof window === "undefined" ? "http://localhost" : window.location.origin;
}

function normalizeSourcePlatform(value: unknown): ImportedIdeaSourcePlatform {
  return value === "google-maps" ||
    value === "tiktok" ||
    value === "instagram" ||
    value === "youtube" ||
    value === "article" ||
    value === "manual"
    ? value
    : "article";
}

function normalizeConfidence(value: unknown): ImportMetadata["confidence"] {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

function normalizeImportMetadataPlace(value: unknown): ImportMetadataPlace | undefined {
  if (!isRecord(value)) return undefined;
  const place: ImportMetadataPlace = {
    name: asString(value.name),
    address: asString(value.address),
    shortAddress: asString(value.shortAddress),
    mapsUrl: asString(value.mapsUrl),
    websiteUrl: asString(value.websiteUrl),
    phone: asString(value.phone),
    primaryType: asString(value.primaryType),
    types: asStringArray(value.types),
  };
  const latitude = asNumber(value.latitude);
  const longitude = asNumber(value.longitude);
  const rating = asNumber(value.rating);
  const userRatingCount = asNumber(value.userRatingCount);
  if (latitude !== undefined) place.latitude = latitude;
  if (longitude !== undefined) place.longitude = longitude;
  if (rating !== undefined) place.rating = rating;
  if (userRatingCount !== undefined) place.userRatingCount = userRatingCount;

  const hasUsefulPlaceData = Boolean(
    place.name ||
      place.address ||
      place.shortAddress ||
      place.mapsUrl ||
      place.websiteUrl ||
      place.phone ||
      place.primaryType ||
      place.types.length ||
      place.rating !== undefined ||
      place.latitude !== undefined ||
      place.longitude !== undefined
  );

  return hasUsefulPlaceData ? place : undefined;
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
