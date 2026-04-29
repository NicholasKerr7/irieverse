import type { ImportedIdeaSourcePlatform } from "../types/travel";

export type ImportMetadata = {
  url: string;
  finalUrl: string;
  sourcePlatform: ImportedIdeaSourcePlatform;
  sourceLabel: string;
  title: string;
  description: string;
  imageUrl: string;
  siteName: string;
  confidence: "high" | "medium" | "low";
  reason?: string;
  cached?: boolean;
};

export async function fetchImportMetadata(url: string, signal?: AbortSignal): Promise<ImportMetadata | null> {
  const normalizedUrl = normalizeMetadataUrl(url);
  if (!normalizedUrl) return null;

  const endpoint = new URL("/api/import-metadata", getBaseUrl());
  endpoint.searchParams.set("url", normalizedUrl);

  const response = await fetch(endpoint.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Import metadata lookup failed: ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.data)) return null;

  return normalizeImportMetadata(payload.data, normalizedUrl);
}

function normalizeImportMetadata(data: Record<string, unknown>, fallbackUrl: string): ImportMetadata {
  return {
    url: asString(data.url) || fallbackUrl,
    finalUrl: asString(data.finalUrl) || asString(data.url) || fallbackUrl,
    sourcePlatform: normalizeSourcePlatform(data.sourcePlatform),
    sourceLabel: asString(data.sourceLabel) || "Website",
    title: asString(data.title),
    description: asString(data.description),
    imageUrl: asString(data.imageUrl),
    siteName: asString(data.siteName),
    confidence: normalizeConfidence(data.confidence),
    reason: asString(data.reason) || undefined,
    cached: data.cached === true,
  };
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

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
