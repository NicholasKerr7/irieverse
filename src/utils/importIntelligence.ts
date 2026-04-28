import { DESTINATIONS } from "../data/content";
import type { Destination, ImportedIdeaCategory, ImportedIdeaSourcePlatform } from "../types/travel";

export type ImportLinkSuggestion = {
  sourcePlatform: ImportedIdeaSourcePlatform;
  sourceLabel: string;
  title: string;
  extractedPlaceName: string;
  category: ImportedIdeaCategory;
  linkedDestinationId: string;
  confidence: "high" | "medium" | "low";
};

type ImportLinkInput = {
  url?: string;
  title?: string;
  note?: string;
};

const GENERIC_SHARED_TITLES = [
  "check out this place",
  "google maps",
  "instagram",
  "tiktok",
  "youtube",
  "watch this video",
  "shared from",
];

const DESTINATION_ALIASES: Record<string, string[]> = {
  mobay: ["montego bay", "mobay", "hip strip", "doctor's cave", "doctors cave", "great river"],
  negril: ["negril", "seven mile", "rick's cafe", "ricks cafe", "west end", "norman manley boulevard"],
  ochi: ["ocho rios", "ochi", "dunn's river", "dunns river", "blue hole", "white river"],
  kingston: ["kingston", "devon house", "bob marley", "dub club", "trenchtown", "new kingston"],
  portland: ["port antonio", "portland", "boston bay", "frenchman's cove", "frenchmans cove", "blue lagoon", "rio grande"],
  southcoast: ["south coast", "treasure beach", "pelican bar", "ys falls", "black river", "accompong", "cockpit country"],
};

export function analyzeImportLink(input: ImportLinkInput): ImportLinkSuggestion {
  const normalizedUrl = normalizeUrl(input.url ?? "");
  const parsedUrl = parseUrl(normalizedUrl);
  const sourcePlatform = detectSourcePlatform(parsedUrl);
  const sourceLabel = getSourceLabel(sourcePlatform, parsedUrl);
  const humanTitle = cleanHumanTitle(input.title ?? "");
  const note = normalizeText(input.note ?? "");
  const placeFromUrl = parsedUrl ? extractPlaceFromUrl(parsedUrl, sourcePlatform) : "";
  const articleTitle = parsedUrl && sourcePlatform === "article" ? titleFromArticleUrl(parsedUrl) : "";
  const socialTitle = titleFromSocialUrl(parsedUrl, sourcePlatform);
  const extractedPlaceName = cleanPlaceName(placeFromUrl || humanTitle || articleTitle || "");
  const title = firstNonEmpty(
    humanTitle,
    extractedPlaceName,
    articleTitle,
    socialTitle,
    sourcePlatform === "manual" ? "" : `${sourceLabel} Jamaica idea`
  );
  const searchableText = [
    humanTitle,
    extractedPlaceName,
    articleTitle,
    socialTitle,
    note,
    normalizedUrl,
    sourceLabel,
  ].join(" ");
  const category = inferImportCategory(searchableText, sourcePlatform);
  const linkedDestinationId = inferLinkedDestinationId(searchableText);

  return {
    sourcePlatform,
    sourceLabel,
    title,
    extractedPlaceName,
    category,
    linkedDestinationId,
    confidence: getSuggestionConfidence(sourcePlatform, extractedPlaceName, linkedDestinationId),
  };
}

function detectSourcePlatform(url: URL | null): ImportedIdeaSourcePlatform {
  if (!url) return "manual";
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const path = url.pathname.toLowerCase();

  if (host.includes("maps.google.") || host === "maps.app.goo.gl" || host === "goo.gl" || path.includes("/maps/")) {
    return "google-maps";
  }
  if (host.includes("tiktok.com")) return "tiktok";
  if (host.includes("instagram.com")) return "instagram";
  if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
  return "article";
}

function getSourceLabel(source: ImportedIdeaSourcePlatform, url: URL | null): string {
  if (source === "google-maps") return "Google Maps";
  if (source === "tiktok") return "TikTok";
  if (source === "instagram") return "Instagram";
  if (source === "youtube") return "YouTube";
  if (source === "article" && url) return readableHost(url.hostname);
  return "Manual idea";
}

function extractPlaceFromUrl(url: URL, source: ImportedIdeaSourcePlatform): string {
  if (source === "google-maps") return extractGoogleMapsPlace(url);
  if (source === "article") return titleFromArticleUrl(url);
  return "";
}

function extractGoogleMapsPlace(url: URL): string {
  const queryValue = firstNonEmpty(
    url.searchParams.get("query") ?? "",
    url.searchParams.get("q") ?? "",
    url.searchParams.get("daddr") ?? "",
    url.searchParams.get("destination") ?? ""
  );
  if (queryValue) return cleanPlaceName(queryValue);

  const segments = url.pathname
    .split("/")
    .map((segment) => decodeUrlPart(segment))
    .filter(Boolean);
  const placeIndex = segments.findIndex((segment) => segment.toLowerCase() === "place" || segment.toLowerCase() === "search");
  if (placeIndex >= 0 && segments[placeIndex + 1]) {
    return cleanPlaceName(segments[placeIndex + 1]);
  }

  const candidate = segments
    .filter((segment) => !/^(maps|dir|@|data|search|place)$/i.test(segment))
    .find((segment) => /jamaica|beach|restaurant|hotel|bar|museum|falls|bay|cafe|coffee/i.test(segment));

  return cleanPlaceName(candidate ?? "");
}

function titleFromSocialUrl(url: URL | null, source: ImportedIdeaSourcePlatform): string {
  if (!url) return "";
  const segments = url.pathname.split("/").filter(Boolean);

  if (source === "tiktok") {
    const creator = segments.find((segment) => segment.startsWith("@"));
    return creator ? `TikTok by ${creator}` : "TikTok Jamaica idea";
  }

  if (source === "instagram") {
    const creator = segments[0] && !["p", "reel", "reels", "stories"].includes(segments[0]) ? ` by @${segments[0]}` : "";
    if (segments.some((segment) => segment === "reel" || segment === "reels")) return `Instagram reel${creator}`;
    if (segments.includes("p")) return `Instagram post${creator}`;
    return `Instagram Jamaica idea${creator}`;
  }

  if (source === "youtube") {
    if (url.hostname === "youtu.be" || segments.includes("shorts")) return "YouTube Jamaica video";
    return "YouTube Jamaica idea";
  }

  return "";
}

function titleFromArticleUrl(url: URL): string {
  const pathTitle = url.pathname
    .split("/")
    .reverse()
    .map((segment) => decodeUrlPart(segment))
    .find((segment) => segment && !/^\d+$/.test(segment) && !/^amp$/i.test(segment));

  return titleCase(cleanPlaceName(pathTitle ?? readableHost(url.hostname)));
}

function inferImportCategory(text: string, source: ImportedIdeaSourcePlatform): ImportedIdeaCategory {
  const normalized = text.toLowerCase();
  if (/restaurant|jerk|food|cookshop|coffee|cafe|café|dining|eatery|brunch|lunch|dinner|barbecue|bbq|patty|rum punch/.test(normalized)) {
    return "food";
  }
  if (/beach|cove|sand|sea|snorkel|swim|waterfall|falls|lagoon|reef|river|rafting|boat/.test(normalized)) {
    return "beach";
  }
  if (/hotel|resort|villa|stay|airbnb|guesthouse|booking|expedia|suite|lodging/.test(normalized)) {
    return "hotel";
  }
  if (/club|nightlife|dancehall|party|bar crawl|sound system|rooftop|late night/.test(normalized)) {
    return "nightlife";
  }
  if (/reggae|music|concert|festival|selector|sound|youtube|playlist/.test(normalized)) {
    return "music";
  }
  if (/museum|culture|history|heritage|gallery|art|maroon|craft|market|mural/.test(normalized)) {
    return "culture";
  }
  if (source === "google-maps") return "hidden-gem";
  return "hidden-gem";
}

function inferLinkedDestinationId(text: string): string {
  const normalized = normalizeForMatch(text);
  const scored = DESTINATIONS.map((destination) => ({
    destination,
    score: getDestinationMatchScore(destination, normalized),
  })).sort((first, second) => second.score - first.score);

  return scored[0]?.score > 0 ? scored[0].destination.id : "";
}

function getDestinationMatchScore(destination: Destination, normalizedText: string): number {
  const aliases = [
    destination.name,
    destination.region,
    ...destination.highlights,
    ...(DESTINATION_ALIASES[destination.id] ?? []),
  ];

  return aliases.reduce((score, alias) => {
    const normalizedAlias = normalizeForMatch(alias);
    if (!normalizedAlias) return score;
    if (normalizedText.includes(normalizedAlias)) return score + (alias === destination.name ? 12 : 4);
    return score;
  }, 0);
}

function getSuggestionConfidence(
  source: ImportedIdeaSourcePlatform,
  extractedPlaceName: string,
  linkedDestinationId: string
): ImportLinkSuggestion["confidence"] {
  if (source === "google-maps" && extractedPlaceName && linkedDestinationId) return "high";
  if (extractedPlaceName || linkedDestinationId) return "medium";
  return "low";
}

function cleanHumanTitle(value: string): string {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  const lower = normalized.toLowerCase();
  if (GENERIC_SHARED_TITLES.some((title) => lower === title || lower.startsWith(`${title}:`))) return "";
  return normalized;
}

function cleanPlaceName(value: string): string {
  return normalizeText(decodeUrlPart(value))
    .replace(/\s*-\s*google maps$/i, "")
    .replace(/\s*\|\s*google maps$/i, "")
    .replace(/\b(jamaica|google maps|maps)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,.\-\s]+|[,.\-\s]+$/g, "")
    .trim();
}

function normalizeUrl(value: string): string {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(normalized)) return `https://${normalized}`;
  return normalized;
}

function parseUrl(value: string): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function decodeUrlPart(value: string): string {
  const normalized = value.replace(/\+/g, " ").replace(/[-_]+/g, " ");
  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
}

function readableHost(host: string): string {
  return host
    .replace(/^www\./, "")
    .split(".")
    .filter((part) => !["com", "org", "net", "co", "uk"].includes(part))
    .map(titleCase)
    .join(" ");
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function firstNonEmpty(...values: string[]): string {
  return values.map(normalizeText).find(Boolean) ?? "";
}
