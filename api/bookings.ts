import type { ApiRequest, ApiResponse, BookingApiResponse } from "../src/types/api";
import type { BookingOption } from "../src/types/travel";

const AMADEUS_TEST_BASE_URL = "https://test.api.amadeus.com";
const AMADEUS_PRODUCTION_BASE_URL = "https://api.amadeus.com";
const DEFAULT_ADULTS = 2;
const DEFAULT_STAY_NIGHTS = 2;
const HOTEL_SEARCH_RADIUS_KM = 45;
const MAX_HOTELS_FOR_OFFERS = 16;
const MAX_BOOKING_OPTIONS = 4;

const CITY_CODE_BY_DESTINATION: Record<string, CityCode> = {
  KIN: "KIN",
  MBJ: "MBJ",
  NEG: "MBJ",
  OCJ: "KIN",
};

const DESTINATION_LABELS = {
  KIN: "Kingston, Jamaica",
  MBJ: "Montego Bay, Jamaica",
} as const;

type CityCode = keyof typeof DESTINATION_LABELS;

const FALLBACK_BOOKINGS = {
  MBJ: [
    {
      id: "mbj-boutique-bliss",
      title: "Boutique Bliss on the Hip Strip",
      provider: "Curated Jamaica pick",
      type: "hotel",
      price: 245,
      currency: "USD",
      url: "https://www.google.com/search?q=Boutique+hotel+Hip+Strip+Montego+Bay",
      description: "Ocean-view suites steps from jerk smoke pits and curated vinyl nights.",
      rating: 4.7,
      perks: ["Breakfast included", "Rooftop plunge pool", "Late checkout"],
    },
    {
      id: "mbj-flight-jetblue",
      title: "JetBlue Mint - NYC to MBJ nonstop",
      provider: "Curated flight pick",
      type: "flight",
      price: 620,
      currency: "USD",
      url: "https://www.google.com/search?q=flights+JFK+to+MBJ",
      description: "Midday departure with lie-flat seats and Gate 5 lounge access.",
      perks: ["2 checked bags", "Priority security"],
    },
  ],
  KIN: [
    {
      id: "kin-skyline-lofts",
      title: "Skyline Lofts & Sound Studio",
      provider: "Curated Jamaica pick",
      type: "hotel",
      price: 210,
      currency: "USD",
      url: "https://www.google.com/search?q=boutique+hotel+Kingston+Jamaica",
      description: "Industrial lofts with attached dub studio and rooftop vinyl bar.",
      rating: 4.5,
      perks: ["Studio drop-in", "Night market shuttle", "Rooftop bar"],
    },
  ],
} satisfies Record<CityCode, BookingOption[]>;

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export default async function bookingsHandler(req: ApiRequest, res: ApiResponse) {
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

  const query = req.query ?? {};
  const destination = normalizeAirportCode(query.destination);
  const cityCode = CITY_CODE_BY_DESTINATION[destination] ?? "MBJ";
  const earliestCheckInDate = getDateOffset(1);
  const requestedCheckInDate = normalizeDate(query.checkInDate);
  const checkInDate = requestedCheckInDate && requestedCheckInDate >= earliestCheckInDate
    ? requestedCheckInDate
    : earliestCheckInDate;
  const requestedCheckOutDate = normalizeDate(query.checkOutDate);
  const checkOutDate = requestedCheckOutDate && requestedCheckOutDate > checkInDate
    ? requestedCheckOutDate
    : getDateOffset(DEFAULT_STAY_NIGHTS, checkInDate);
  const adults = clampInteger(query.adults, 1, 9, DEFAULT_ADULTS);
  const clientId = process.env.AMADEUS_CLIENT_ID || process.env.AMADEUS_API_KEY;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET || process.env.AMADEUS_API_SECRET;

  if (!clientId || !clientSecret) {
    const payload: BookingApiResponse = {
      data: getFallbackBookings(cityCode),
      meta: {
        source: "fallback",
        reason: "missing-amadeus-credentials",
      },
    };
    res.status(200).json(payload);
    return;
  }

  try {
    const baseUrl = getAmadeusBaseUrl();
    const accessToken = await getAmadeusAccessToken(baseUrl, clientId, clientSecret);
    const hotelIds = await getHotelIdsByCity(baseUrl, accessToken, cityCode);
    const amadeusOptions = hotelIds.length
      ? await getHotelOffers(baseUrl, accessToken, {
          hotelIds,
          cityCode,
          checkInDate,
          checkOutDate,
          adults,
        })
      : [];

    const payload: BookingApiResponse = {
      data: amadeusOptions.length ? amadeusOptions : getFallbackBookings(cityCode),
      meta: {
        source: amadeusOptions.length ? "amadeus" : "fallback",
        ...(amadeusOptions.length ? {} : { reason: "no-amadeus-offers" }),
        checkInDate,
        checkOutDate,
        adults,
      },
    };
    res.status(200).json(payload);
  } catch (error) {
    console.warn(`Amadeus booking lookup unavailable; using curated stays. ${formatErrorForLog(error)}`);
    const payload: BookingApiResponse = {
      data: getFallbackBookings(cityCode),
      meta: {
        source: "fallback",
        reason: "amadeus-request-failed",
      },
    };
    res.status(200).json(payload);
  }
}

function setResponseHeaders(res: ApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
}

function getAmadeusBaseUrl(): string {
  if (process.env.AMADEUS_BASE_URL) {
    return process.env.AMADEUS_BASE_URL.replace(/\/$/, "");
  }

  return process.env.AMADEUS_ENV === "production"
    ? AMADEUS_PRODUCTION_BASE_URL
    : AMADEUS_TEST_BASE_URL;
}

async function getAmadeusAccessToken(baseUrl: string, clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const response = await fetch(`${baseUrl}/v1/security/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Amadeus auth failed: ${response.status}`);
  }

  const payload: unknown = await response.json();
  const payloadRecord = isRecord(payload) ? payload : {};
  const accessToken = asString(payloadRecord.access_token);
  if (!accessToken) {
    throw new Error("Amadeus auth response did not include an access token");
  }

  cachedToken = {
    accessToken,
    expiresAt: Date.now() + (asNumber(payloadRecord.expires_in) ?? 1200) * 1000,
  };

  return cachedToken.accessToken;
}

async function getHotelIdsByCity(baseUrl: string, accessToken: string, cityCode: CityCode): Promise<string[]> {
  const url = new URL(`${baseUrl}/v1/reference-data/locations/hotels/by-city`);
  url.searchParams.set("cityCode", cityCode);
  url.searchParams.set("radius", String(HOTEL_SEARCH_RADIUS_KM));
  url.searchParams.set("radiusUnit", "KM");
  url.searchParams.set("hotelSource", "ALL");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Amadeus hotel list failed: ${response.status}`);
  }

  const payload: unknown = await response.json();
  const payloadRecord = isRecord(payload) ? payload : {};
  return (Array.isArray(payloadRecord.data) ? payloadRecord.data : [])
    .map((hotel) => isRecord(hotel) ? asString(hotel.hotelId) : undefined)
    .filter((hotelId): hotelId is string => Boolean(hotelId))
    .slice(0, MAX_HOTELS_FOR_OFFERS);
}

type HotelOfferParams = {
  hotelIds: string[];
  cityCode: CityCode;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
};

async function getHotelOffers(
  baseUrl: string,
  accessToken: string,
  params: HotelOfferParams
): Promise<BookingOption[]> {
  const url = new URL(`${baseUrl}/v3/shopping/hotel-offers`);
  url.searchParams.set("hotelIds", params.hotelIds.join(","));
  url.searchParams.set("adults", String(params.adults));
  url.searchParams.set("checkInDate", params.checkInDate);
  url.searchParams.set("checkOutDate", params.checkOutDate);
  url.searchParams.set("currency", "USD");
  url.searchParams.set("bestRateOnly", "true");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Amadeus hotel offers failed: ${response.status}`);
  }

  const payload: unknown = await response.json();
  const payloadRecord = isRecord(payload) ? payload : {};
  return (Array.isArray(payloadRecord.data) ? payloadRecord.data : [])
    .map((item, index) => mapAmadeusOffer(item, index, params))
    .filter((option): option is BookingOption => Boolean(option))
    .slice(0, MAX_BOOKING_OPTIONS);
}

function mapAmadeusOffer(item: unknown, index: number, params: HotelOfferParams): BookingOption | null {
  const record = isRecord(item) ? item : {};
  const hotel = isRecord(record.hotel) ? record.hotel : {};
  const offer = Array.isArray(record.offers) && isRecord(record.offers[0]) ? record.offers[0] : null;
  const price = offer && isRecord(offer.price) ? offer.price : {};
  const priceValue = Number(price.total ?? price.base ?? 0);

  if (!offer || !Number.isFinite(priceValue) || priceValue <= 0) {
    return null;
  }

  const title = asString(hotel.name) || `${DESTINATION_LABELS[params.cityCode]} hotel offer`;
  const room = isRecord(offer.room) ? offer.room : {};
  const typeEstimated = isRecord(room.typeEstimated) ? room.typeEstimated : {};
  const description = isRecord(room.description) ? room.description : {};
  const roomType = asString(typeEstimated.category) || asString(description.text);
  const rawBoardType = asString(offer.boardType);
  const boardType = rawBoardType ? titleCase(rawBoardType.replace(/_/g, " ")) : null;

  return {
    id: `amadeus-${asString(hotel.hotelId) || slugify(title)}-${asString(offer.id) || index}`,
    title,
    provider: "Hotel partner",
    type: "hotel",
    price: Math.round(priceValue),
    currency: asString(price.currency) || "USD",
    url: buildHotelSearchUrl(title, params.cityCode),
    description: [
      roomType ? titleCase(roomType) : "Current hotel offer",
      `${params.checkInDate} to ${params.checkOutDate}`,
      `${params.adults} adult${params.adults === 1 ? "" : "s"}`,
    ].join(" | "),
    perks: buildPerks(offer, boardType),
  };
}

function buildPerks(offer: Record<string, unknown>, boardType: string | null): string[] {
  const perks = ["Current availability"];

  if (boardType) {
    perks.push(boardType);
  }

  const policies = isRecord(offer.policies) ? offer.policies : {};
  const cancellations = Array.isArray(policies.cancellations) ? policies.cancellations : [];
  const firstCancellation = isRecord(cancellations[0]) ? cancellations[0] : {};
  const cancellationDeadline = asString(firstCancellation.deadline);
  if (cancellationDeadline) {
    perks.push(`Cancellation by ${cancellationDeadline.slice(0, 10)}`);
  }

  return perks.slice(0, 3);
}

function buildHotelSearchUrl(title: string, cityCode: CityCode): string {
  const destinationLabel = DESTINATION_LABELS[cityCode] ?? "Jamaica";
  const query = encodeURIComponent(`${title} ${destinationLabel} booking`);
  return `https://www.google.com/search?q=${query}`;
}

function getFallbackBookings(cityCode: CityCode): BookingOption[] {
  return FALLBACK_BOOKINGS[cityCode] ?? FALLBACK_BOOKINGS.MBJ;
}

function normalizeAirportCode(value: unknown): string {
  const firstValue = Array.isArray(value) ? value[0] : value;
  return typeof firstValue === "string" ? firstValue.trim().toUpperCase() : "MBJ";
}

function normalizeDate(value: unknown): string | null {
  const firstValue = Array.isArray(value) ? value[0] : value;
  if (typeof firstValue !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(firstValue) ? firstValue : null;
}

function getDateOffset(days: number, fromDate?: string): string {
  const date = fromDate ? new Date(`${fromDate}T00:00:00Z`) : new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const firstValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(String(firstValue ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatErrorForLog(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
