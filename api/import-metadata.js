const dns = require("node:dns").promises;
const net = require("node:net");

const MAX_URL_LENGTH = 2048;
const MAX_HTML_BYTES = 300_000;
const METADATA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const METADATA_CACHE = new Map();
const GOOGLE_PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const GOOGLE_PLACES_IMPORT_FIELD_MASK = [
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.location",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.primaryTypeDisplayName",
  "places.types",
].join(",");

module.exports = async function importMetadataHandler(req, res) {
  setResponseHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method === "HEAD") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const rawUrl = getFirstQueryValue(req.query?.url);
  const parsedUrl = parseSafeUrl(rawUrl);
  if (!parsedUrl) {
    res.status(400).json({ error: "Expected a public http(s) URL." });
    return;
  }

  const cacheKey = parsedUrl.toString();
  const cached = getCachedMetadata(cacheKey);
  if (cached) {
    res.status(200).json({ data: { ...cached, cached: true } });
    return;
  }

  try {
    await assertPublicHostname(parsedUrl);
    const metadata = await resolveMetadata(parsedUrl);
    setCachedMetadata(cacheKey, metadata);
    res.status(200).json({ data: metadata });
  } catch (error) {
    console.warn(`Import metadata unavailable; using local link preview. ${formatErrorForLog(error)}`);
    res.status(200).json({
      data: buildBaseMetadata(parsedUrl, {
        confidence: "low",
        reason: "metadata-unavailable",
      }),
    });
  }
};

function setResponseHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
}

async function resolveMetadata(url) {
  const metadataUrl = await resolveRedirectUrl(url).catch(() => url);
  const sourcePlatform = detectSourcePlatform(metadataUrl);

  if (sourcePlatform === "youtube") {
    return resolveYouTubeMetadata(metadataUrl, url);
  }

  if (sourcePlatform === "google-maps") {
    const googleMapsMetadata = await resolveGoogleMapsMetadata(metadataUrl, url).catch((error) => {
      console.warn(`Google Maps import metadata unavailable; using local link preview. ${formatErrorForLog(error)}`);
      return null;
    });
    if (googleMapsMetadata) return googleMapsMetadata;

    return buildBaseMetadata(metadataUrl, {
      sourceUrl: url.toString(),
      finalUrl: metadataUrl.toString(),
      title: titleFromUrl(metadataUrl, sourcePlatform),
      confidence: "medium",
      reason: "platform-restricted",
    });
  }

  if (sourcePlatform === "tiktok" || sourcePlatform === "instagram") {
    return buildBaseMetadata(metadataUrl, {
      sourceUrl: url.toString(),
      finalUrl: metadataUrl.toString(),
      title: titleFromUrl(metadataUrl, sourcePlatform),
      confidence: "low",
      reason: "platform-restricted",
    });
  }

  return resolveArticleMetadata(metadataUrl, url);
}

async function resolveYouTubeMetadata(url, sourceUrl = url) {
  const oembedUrl = new URL("https://www.youtube.com/oembed");
  oembedUrl.searchParams.set("url", url.toString());
  oembedUrl.searchParams.set("format", "json");

  const response = await fetchWithTimeout(oembedUrl.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "IrieVerseBot/1.0 (+https://irieverse.app)",
    },
  });

  if (!response.ok) {
    throw new Error(`YouTube oEmbed failed: ${response.status}`);
  }

  const payload = await response.json();
  return buildBaseMetadata(url, {
    sourceUrl: sourceUrl.toString(),
    finalUrl: url.toString(),
    title: asString(payload.title),
    description: asString(payload.author_name),
    imageUrl: asString(payload.thumbnail_url),
    siteName: "YouTube",
    confidence: asString(payload.title) ? "high" : "medium",
  });
}

async function resolveGoogleMapsMetadata(url, sourceUrl = url) {
  const apiKey = getGooglePlacesApiKey();
  const placeQuery = extractGoogleMapsPlaceName(url);
  if (!apiKey || !placeQuery) return null;

  const response = await fetchWithTimeout(GOOGLE_PLACES_TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": GOOGLE_PLACES_IMPORT_FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: `${placeQuery}, Jamaica`,
      languageCode: "en",
      regionCode: "JM",
      pageSize: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google Places import lookup failed: ${response.status}`);
  }

  const payload = await response.json();
  const place = Array.isArray(payload.places) ? payload.places[0] : null;
  if (!place) return null;

  const displayName = localizedText(place.displayName) || placeQuery;
  const address = firstNonEmpty(asString(place.shortFormattedAddress), asString(place.formattedAddress));
  const mapsUrl = asString(place.googleMapsUri);
  const description = buildGooglePlaceDescription(place);
  const importPlace = buildGoogleImportPlace(place, {
    name: displayName,
    address,
    mapsUrl,
  });

  return buildBaseMetadata(url, {
    sourceUrl: sourceUrl.toString(),
    finalUrl: mapsUrl || url.toString(),
    title: displayName,
    description: description || address,
    siteName: "Google Maps",
    place: importPlace,
    confidence: displayName ? "high" : "medium",
  });
}

async function resolveArticleMetadata(url, sourceUrl = url) {
  const response = await fetchWithTimeout(url.toString(), {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "IrieVerseBot/1.0 (+https://irieverse.app)",
    },
  });

  if (!response.ok) {
    throw new Error(`Metadata page failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new Error(`Unsupported metadata content type: ${contentType}`);
  }

  const html = (await response.text()).slice(0, MAX_HTML_BYTES);
  const finalUrl = parseSafeUrl(response.url) ?? url;
  const title = firstNonEmpty(
    getMetaContent(html, ["og:title", "twitter:title", "title"]),
    getTitleTag(html),
    titleFromUrl(finalUrl, "article")
  );
  const description = getMetaContent(html, ["og:description", "twitter:description", "description"]);
  const imageUrl = normalizeImageUrl(getMetaContent(html, ["og:image", "twitter:image", "image"]), finalUrl);
  const siteName = firstNonEmpty(
    getMetaContent(html, ["og:site_name", "application-name"]),
    readableHost(finalUrl.hostname)
  );

  return buildBaseMetadata(finalUrl, {
    sourceUrl: sourceUrl.toString(),
    finalUrl: finalUrl.toString(),
    title,
    description,
    imageUrl,
    siteName,
    confidence: title ? "high" : "medium",
  });
}

function buildBaseMetadata(url, overrides = {}) {
  const sourcePlatform = detectSourcePlatform(url);
  return {
    url: overrides.sourceUrl || url.toString(),
    finalUrl: overrides.finalUrl || url.toString(),
    sourcePlatform,
    sourceLabel: overrides.siteName || getSourceLabel(sourcePlatform, url),
    title: cleanText(overrides.title ?? ""),
    description: cleanText(overrides.description ?? ""),
    imageUrl: overrides.imageUrl || "",
    siteName: cleanText(overrides.siteName ?? ""),
    place: normalizeMetadataPlace(overrides.place),
    confidence: overrides.confidence || "low",
    reason: overrides.reason,
    cached: false,
  };
}

async function resolveRedirectUrl(url) {
  let currentUrl = url;

  for (let index = 0; index < 5; index += 1) {
    await assertPublicHostname(currentUrl);
    const response = await fetchWithTimeout(currentUrl.toString(), {
      method: "HEAD",
      redirect: "manual",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "IrieVerseBot/1.0 (+https://irieverse.app)",
      },
    });

    const location = response.headers.get("location");
    if (!location || response.status < 300 || response.status >= 400) {
      return currentUrl;
    }

    const nextUrl = parseSafeUrl(new URL(location, currentUrl).toString());
    if (!nextUrl) return currentUrl;
    await assertPublicHostname(nextUrl);
    currentUrl = nextUrl;
  }

  return currentUrl;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5500);

  try {
    return await fetch(url, {
      redirect: "follow",
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function formatErrorForLog(error) {
  return error instanceof Error ? error.message : String(error);
}

function getMetaContent(html, names) {
  for (const name of names) {
    const escapedName = escapeRegExp(name);
    const metaPattern = new RegExp(
      `<meta\\s+[^>]*(?:property|name|itemprop)=["']${escapedName}["'][^>]*>`,
      "i"
    );
    const tag = html.match(metaPattern)?.[0] ?? "";
    const content = readAttribute(tag, "content");
    if (content) return decodeHtml(content);
  }
  return "";
}

function getTitleTag(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeHtml(match[1]) : "";
}

function readAttribute(tag, attribute) {
  if (!tag) return "";
  const pattern = new RegExp(`${attribute}=["']([^"']+)["']`, "i");
  return tag.match(pattern)?.[1] ?? "";
}

function parseSafeUrl(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (isBlockedHostname(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

async function assertPublicHostname(url) {
  const hostname = url.hostname.toLowerCase();
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("Blocked private IP URL");
    return;
  }

  const addresses = await dns.lookup(hostname, { all: true });
  if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new Error("Blocked private hostname URL");
  }
}

function isBlockedHostname(hostname) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  );
}

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    const [first, second] = address.split(".").map(Number);
    return (
      first === 10 ||
      first === 127 ||
      first === 0 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

function detectSourcePlatform(url) {
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

function getSourceLabel(source, url) {
  if (source === "google-maps") return "Google Maps";
  if (source === "tiktok") return "TikTok";
  if (source === "instagram") return "Instagram";
  if (source === "youtube") return "YouTube";
  if (source === "article") return readableHost(url.hostname);
  return "Manual idea";
}

function titleFromUrl(url, sourcePlatform) {
  if (sourcePlatform === "google-maps") {
    const query = extractGoogleMapsPlaceName(url);
    if (query) return titleCase(cleanText(query));
  }

  const pathTitle = url.pathname
    .split("/")
    .reverse()
    .map(decodeUrlPart)
    .find((segment) => segment && !/^\d+$/.test(segment) && !/^amp$/i.test(segment));

  return titleCase(cleanText(pathTitle || readableHost(url.hostname)));
}

function extractGoogleMapsPlaceName(url) {
  const queryValue = firstNonEmpty(
    url.searchParams.get("query") ?? "",
    url.searchParams.get("q") ?? "",
    url.searchParams.get("daddr") ?? "",
    url.searchParams.get("destination") ?? ""
  );
  if (queryValue) return cleanGoogleMapsPlaceName(queryValue);

  const segments = url.pathname
    .split("/")
    .map(decodeUrlPart)
    .filter(Boolean);
  const placeIndex = segments.findIndex((segment) => {
    const normalizedSegment = segment.toLowerCase();
    return normalizedSegment === "place" || normalizedSegment === "search";
  });
  if (placeIndex >= 0 && segments[placeIndex + 1]) {
    return cleanGoogleMapsPlaceName(segments[placeIndex + 1]);
  }

  const candidate = segments
    .filter((segment) => !/^(maps|dir|@|data|search|place)$/i.test(segment))
    .find((segment) => /jamaica|beach|restaurant|hotel|bar|museum|falls|bay|cafe|coffee|house/i.test(segment));

  return cleanGoogleMapsPlaceName(candidate ?? "");
}

function cleanGoogleMapsPlaceName(value) {
  return cleanText(decodeUrlPart(value))
    .replace(/\s*-\s*google maps$/i, "")
    .replace(/\s*\|\s*google maps$/i, "")
    .replace(/\b(jamaica|google maps|maps)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,.\-\s]+|[,.\-\s]+$/g, "")
    .trim();
}

function buildGooglePlaceDescription(place) {
  const address = firstNonEmpty(asString(place.shortFormattedAddress), asString(place.formattedAddress));
  const primaryType = localizedText(place.primaryTypeDisplayName);
  const rating = asNumber(place.rating);
  const ratingCount = asNumber(place.userRatingCount);
  const ratingLabel = rating
    ? `${rating.toFixed(1)} rating${ratingCount ? ` from ${formatCompactCount(ratingCount)} reviews` : ""}`
    : "";

  return [address, primaryType, ratingLabel].filter(Boolean).join(" · ");
}

function buildGoogleImportPlace(place, fallback = {}) {
  const location = isRecord(place.location) ? place.location : {};
  return stripEmptyValues({
    name: fallback.name || localizedText(place.displayName),
    address: fallback.address || asString(place.formattedAddress),
    shortAddress: asString(place.shortFormattedAddress),
    latitude: asNumber(location.latitude),
    longitude: asNumber(location.longitude),
    mapsUrl: fallback.mapsUrl || asString(place.googleMapsUri),
    websiteUrl: asString(place.websiteUri),
    phone: firstNonEmpty(asString(place.nationalPhoneNumber), asString(place.internationalPhoneNumber)),
    rating: asNumber(place.rating),
    userRatingCount: asNumber(place.userRatingCount),
    primaryType: localizedText(place.primaryTypeDisplayName),
    types: Array.isArray(place.types) ? place.types.filter((type) => typeof type === "string").slice(0, 6) : [],
  });
}

function normalizeMetadataPlace(value) {
  if (!isRecord(value)) return undefined;
  const place = stripEmptyValues({
    name: asString(value.name),
    address: asString(value.address),
    shortAddress: asString(value.shortAddress),
    latitude: asNumber(value.latitude),
    longitude: asNumber(value.longitude),
    mapsUrl: asString(value.mapsUrl),
    websiteUrl: asString(value.websiteUrl),
    phone: asString(value.phone),
    rating: asNumber(value.rating),
    userRatingCount: asNumber(value.userRatingCount),
    primaryType: asString(value.primaryType),
    types: Array.isArray(value.types) ? value.types.filter((type) => typeof type === "string").slice(0, 6) : [],
  });

  return Object.keys(place).length ? place : undefined;
}

function localizedText(value) {
  if (typeof value === "string") return cleanText(value);
  if (value && typeof value === "object" && typeof value.text === "string") return cleanText(value.text);
  return "";
}

function normalizeImageUrl(value, baseUrl) {
  if (!value) return "";
  try {
    const imageUrl = new URL(value, baseUrl);
    return imageUrl.protocol === "http:" || imageUrl.protocol === "https:" ? imageUrl.toString() : "";
  } catch {
    return "";
  }
}

function getCachedMetadata(cacheKey) {
  const entry = METADATA_CACHE.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    METADATA_CACHE.delete(cacheKey);
    return null;
  }
  return entry.metadata;
}

function setCachedMetadata(cacheKey, metadata) {
  METADATA_CACHE.set(cacheKey, {
    metadata,
    expiresAt: Date.now() + METADATA_CACHE_TTL_MS,
  });
}

function getFirstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function firstNonEmpty(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() ?? "";
}

function cleanText(value) {
  return decodeHtml(String(value ?? ""))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function decodeUrlPart(value) {
  const normalized = value.replace(/\+/g, " ").replace(/[-_]+/g, " ");
  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
}

function readableHost(host) {
  return host
    .replace(/^www\./, "")
    .split(".")
    .filter((part) => !["com", "org", "net", "co", "uk"].includes(part))
    .map(titleCase)
    .join(" ");
}

function titleCase(value) {
  return cleanText(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getGooglePlacesApiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.PLACES_API_KEY ||
    ""
  ).trim();
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function stripEmptyValues(value) {
  const next = {};
  Object.entries(value).forEach(([key, entryValue]) => {
    if (entryValue === undefined || entryValue === null || entryValue === "") return;
    if (Array.isArray(entryValue) && !entryValue.length) return;
    next[key] = entryValue;
  });
  return next;
}

function isRecord(value) {
  return typeof value === "object" && value !== null;
}

function formatCompactCount(value) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
