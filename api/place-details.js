const GOOGLE_PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const PLACE_DETAILS_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const PLACE_DETAILS_CACHE = new Map();
const PLACE_DETAILS_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.location",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.currentOpeningHours",
  "places.regularOpeningHours",
  "places.businessStatus",
  "places.primaryTypeDisplayName",
  "places.types",
].join(",");
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

module.exports = async function placeDetailsHandler(req, res) {
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

  const query = normalizePlaceDetailsQuery(req.query);
  if (!query) {
    res.status(400).json({ error: "Expected a Jamaica place name." });
    return;
  }

  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    res.status(200).json({
      data: null,
      meta: {
        source: "curated",
        providerConfigured: false,
      },
    });
    return;
  }

  const cacheKey = buildCacheKey(query);
  const cached = getCachedPlaceDetails(cacheKey);
  if (cached) {
    res.status(200).json({
      data: cached,
      meta: {
        source: "google-places",
        providerConfigured: true,
        cached: true,
      },
    });
    return;
  }

  try {
    const details = await fetchGooglePlaceDetails(apiKey, query);
    if (details) {
      setCachedPlaceDetails(cacheKey, details);
    }

    res.status(200).json({
      data: details,
      meta: {
        source: details ? "google-places" : "curated",
        providerConfigured: true,
        cached: false,
      },
    });
  } catch (error) {
    console.warn(`Place details lookup unavailable; using curated details. ${formatErrorForLog(error)}`);
    res.status(200).json({
      data: null,
      meta: {
        source: "curated",
        providerConfigured: true,
        reason: "lookup-unavailable",
      },
    });
  }
};

function setResponseHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=43200, stale-while-revalidate=86400");
}

async function fetchGooglePlaceDetails(apiKey, query) {
  const body = {
    textQuery: buildTextQuery(query),
    languageCode: "en",
    regionCode: "JM",
    pageSize: 5,
  };

  if (Number.isFinite(query.latitude) && Number.isFinite(query.longitude)) {
    body.locationBias = {
      circle: {
        center: {
          latitude: query.latitude,
          longitude: query.longitude,
        },
        radius: query.kind === "experience" ? 12000 : 35000,
      },
    };
  }

  const response = await fetchWithTimeout(GOOGLE_PLACES_TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": PLACE_DETAILS_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Google Places lookup failed: ${response.status}`);
  }

  const payload = await response.json();
  const place = chooseBestPlaceMatch(Array.isArray(payload.places) ? payload.places : [], query);
  return place ? normalizeGooglePlace(place) : null;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5500);

  try {
    return await fetch(url, {
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

function normalizeGooglePlace(place) {
  const currentHours = isRecord(place.currentOpeningHours) ? place.currentOpeningHours : null;
  const regularHours = isRecord(place.regularOpeningHours) ? place.regularOpeningHours : null;
  const openingHours = currentHours ?? regularHours;
  const location = isRecord(place.location) ? place.location : {};

  return stripEmptyValues({
    id: asString(place.id),
    name: localizedText(place.displayName),
    address: asString(place.formattedAddress),
    shortAddress: asString(place.shortFormattedAddress),
    latitude: asNumber(location.latitude),
    longitude: asNumber(location.longitude),
    mapsUrl: asString(place.googleMapsUri),
    websiteUrl: asString(place.websiteUri),
    phone: asString(place.nationalPhoneNumber),
    internationalPhone: asString(place.internationalPhoneNumber),
    rating: asNumber(place.rating),
    userRatingCount: asNumber(place.userRatingCount),
    priceLevel: normalizePriceLevel(place.priceLevel),
    openNow: openingHours && typeof openingHours.openNow === "boolean" ? openingHours.openNow : undefined,
    weekdayDescriptions: openingHours && Array.isArray(openingHours.weekdayDescriptions)
      ? openingHours.weekdayDescriptions.filter((description) => typeof description === "string")
      : [],
    businessStatus: humanizeEnum(place.businessStatus),
    primaryType: localizedText(place.primaryTypeDisplayName),
    types: Array.isArray(place.types) ? place.types.filter((type) => typeof type === "string").slice(0, 6) : [],
    source: "google-places",
  });
}

function normalizePlaceDetailsQuery(rawQuery = {}) {
  const name = cleanText(getFirstQueryValue(rawQuery.name));
  if (!name) return null;

  return {
    kind: cleanText(getFirstQueryValue(rawQuery.kind)) === "experience" ? "experience" : "destination",
    name,
    placeQuery: cleanText(getFirstQueryValue(rawQuery.placeQuery)),
    region: cleanText(getFirstQueryValue(rawQuery.region)),
    location: cleanText(getFirstQueryValue(rawQuery.location)),
    requiredTerms: parseTermList(getFirstQueryValue(rawQuery.requiredTerms)),
    blockedTerms: parseTermList(getFirstQueryValue(rawQuery.blockedTerms)),
    latitude: asNumber(getFirstQueryValue(rawQuery.latitude)),
    longitude: asNumber(getFirstQueryValue(rawQuery.longitude)),
  };
}

function buildTextQuery(query) {
  if (query.placeQuery) return query.placeQuery;

  return [query.name, query.location, query.region, "Jamaica"]
    .filter(Boolean)
    .join(", ");
}

function chooseBestPlaceMatch(places, query) {
  return places
    .map((place) => ({
      place,
      score: scorePlaceMatch(place, query),
    }))
    .filter((candidate) => candidate.score >= 0)
    .sort((a, b) => b.score - a.score)[0]?.place ?? null;
}

function scorePlaceMatch(place, query) {
  const searchableText = buildSearchablePlaceText(place);
  if (!searchableText) return -1;

  if (isBlockedPlaceMatch(searchableText, query)) {
    return -1;
  }

  const requiredTerms = query.requiredTerms.map(normalizeSearchText).filter(Boolean);
  if (requiredTerms.length && !requiredTerms.every((term) => searchTextIncludes(searchableText, term))) {
    return -1;
  }

  const queryTerms = getSignificantTerms(query.placeQuery || query.name);
  const matchedTerms = queryTerms.filter((term) => searchTextIncludes(searchableText, term));
  let score = matchedTerms.length * 12;

  if (searchableText.includes("jamaica")) score += 10;
  if (query.location && searchTextIncludes(searchableText, normalizeSearchText(query.location))) score += 8;
  if (query.region && searchTextIncludes(searchableText, normalizeSearchText(query.region))) score += 4;

  const placeLocation = isRecord(place.location) ? place.location : {};
  const distanceKm = calculateDistanceKm(
    query.latitude,
    query.longitude,
    asNumber(placeLocation.latitude),
    asNumber(placeLocation.longitude)
  );

  if (Number.isFinite(distanceKm)) {
    score += Math.max(0, 25 - distanceKm);
  }

  return score;
}

function isBlockedPlaceMatch(searchableText, query) {
  const doctorCaveMatch = searchableText.includes("doctor s cave") || searchableText.includes("doctors cave");
  const blockedTerms = [
    ...DEFAULT_BLOCKED_PLACE_TERMS,
    ...query.blockedTerms,
  ].map(normalizeSearchText).filter(Boolean);

  return !doctorCaveMatch && blockedTerms.some((term) => searchTextIncludes(searchableText, term));
}

function buildSearchablePlaceText(place) {
  return normalizeSearchText([
    localizedText(place.displayName),
    asString(place.formattedAddress),
    asString(place.shortFormattedAddress),
    localizedText(place.primaryTypeDisplayName),
    ...(Array.isArray(place.types) ? place.types.filter((type) => typeof type === "string") : []),
  ].join(" "));
}

function getSignificantTerms(value) {
  const ignoredTerms = new Set([
    "and",
    "bay",
    "beach",
    "coast",
    "jamaica",
    "jm",
    "near",
    "north",
    "parish",
    "rio",
    "saint",
    "south",
    "st",
    "the",
    "west",
  ]);

  return normalizeSearchText(value)
    .split(" ")
    .filter((term) => term.length > 2 && !ignoredTerms.has(term))
    .slice(0, 8);
}

function calculateDistanceKm(fromLatitude, fromLongitude, toLatitude, toLongitude) {
  if (![fromLatitude, fromLongitude, toLatitude, toLongitude].every(Number.isFinite)) return NaN;

  const earthRadiusKm = 6371;
  const latitudeDelta = degreesToRadians(toLatitude - fromLatitude);
  const longitudeDelta = degreesToRadians(toLongitude - fromLongitude);
  const startLatitude = degreesToRadians(fromLatitude);
  const endLatitude = degreesToRadians(toLatitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function degreesToRadians(value) {
  return value * (Math.PI / 180);
}

function buildCacheKey(query) {
  return [
    query.kind,
    query.name.toLowerCase(),
    query.placeQuery.toLowerCase(),
    query.region.toLowerCase(),
    query.location.toLowerCase(),
    query.requiredTerms.join(",").toLowerCase(),
    query.blockedTerms.join(",").toLowerCase(),
    Number.isFinite(query.latitude) ? query.latitude.toFixed(3) : "",
    Number.isFinite(query.longitude) ? query.longitude.toFixed(3) : "",
  ].join(":");
}

function getCachedPlaceDetails(cacheKey) {
  const cached = PLACE_DETAILS_CACHE.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > PLACE_DETAILS_CACHE_TTL_MS) {
    PLACE_DETAILS_CACHE.delete(cacheKey);
    return null;
  }
  return cached.data;
}

function setCachedPlaceDetails(cacheKey, data) {
  PLACE_DETAILS_CACHE.set(cacheKey, {
    timestamp: Date.now(),
    data,
  });
}

function getGooglePlacesApiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.PLACES_API_KEY ||
    ""
  ).trim();
}

function normalizePriceLevel(value) {
  const text = asString(value);
  if (!text || text === "PRICE_LEVEL_UNSPECIFIED") return "";
  if (text === "PRICE_LEVEL_FREE") return "Free";
  if (text === "PRICE_LEVEL_INEXPENSIVE") return "$";
  if (text === "PRICE_LEVEL_MODERATE") return "$$";
  if (text === "PRICE_LEVEL_EXPENSIVE") return "$$$";
  if (text === "PRICE_LEVEL_VERY_EXPENSIVE") return "$$$$";
  return humanizeEnum(text);
}

function localizedText(value) {
  if (typeof value === "string") return cleanText(value);
  if (isRecord(value)) return cleanText(value.text);
  return "";
}

function humanizeEnum(value) {
  return asString(value)
    .replace(/^PRICE_LEVEL_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function getFirstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function parseTermList(value) {
  return asString(value)
    .split(",")
    .map((term) => cleanText(term))
    .filter(Boolean)
    .slice(0, 12);
}

function cleanText(value) {
  return asString(value).replace(/\s+/g, " ").trim();
}

function normalizeSearchText(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function searchTextIncludes(searchableText, term) {
  return searchableText.includes(term);
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function isRecord(value) {
  return typeof value === "object" && value !== null;
}
