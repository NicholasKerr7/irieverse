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
    console.warn("Place details lookup failed", error);
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
    pageSize: 1,
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
  const place = Array.isArray(payload.places) ? payload.places[0] : null;
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
    region: cleanText(getFirstQueryValue(rawQuery.region)),
    location: cleanText(getFirstQueryValue(rawQuery.location)),
    latitude: asNumber(getFirstQueryValue(rawQuery.latitude)),
    longitude: asNumber(getFirstQueryValue(rawQuery.longitude)),
  };
}

function buildTextQuery(query) {
  return [query.name, query.location, query.region, "Jamaica"]
    .filter(Boolean)
    .join(", ");
}

function buildCacheKey(query) {
  return [
    query.kind,
    query.name.toLowerCase(),
    query.region.toLowerCase(),
    query.location.toLowerCase(),
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

function cleanText(value) {
  return asString(value).replace(/\s+/g, " ").trim();
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
