import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ApiRequest, ApiResponse, EventsApiResponse, QueryRecord } from "../src/types/api";
import type { LiveEvent } from "../src/types/travel";
import { guardApiRequest } from "./_shared/api-guard.js";

const EVENTBRITE_API_BASE_URL = "https://www.eventbriteapi.com/v3";
const TICKETMASTER_EVENTS_URL = "https://app.ticketmaster.com/discovery/v2/events.json";
const VERIFIED_EVENTS_TABLE = "verified_events";
const DEFAULT_TICKETMASTER_RADIUS_KM = 160;
const DEFAULT_EVENT_RANGE_DAYS = 365;
const DEFAULT_CACHE_TTL_SECONDS = 30 * 60;
const MAX_LIVE_EVENTS_PER_PROVIDER = 12;
const MAX_EVENTS_RESPONSE = 18;
const JAMAICA_TIME_ZONE = "America/Jamaica";
const TICKETMASTER_GEOHASH_PRECISION = 7;
const GEOHASH_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
const JAMAICA_EVENT_TERMS = [
  "jamaica",
  "jm",
  "kingston",
  "montego bay",
  "mobay",
  "ocho rios",
  "negril",
  "port antonio",
  "portland",
  "st. ann",
  "st ann",
  "st. james",
  "st james",
  "st. mary",
  "st mary",
  "st. elizabeth",
  "st elizabeth",
  "st. thomas",
  "st thomas",
  "st. catherine",
  "st catherine",
  "trelawny",
  "hanover",
  "westmoreland",
  "clarendon",
  "manchester",
  "spanish town",
  "portmore",
  "falmouth",
  "lucea",
  "mandeville",
  "morant bay",
  "may pen",
];
const REGION_EVENT_TERMS: Record<string, string[]> = {
  "kingston": ["kingston", "st. andrew", "st andrew", "new kingston", "half way tree", "liguanea", "hope road", "waterfront", "national stadium"],
  "south-east": ["kingston", "st. andrew", "st andrew", "st. catherine", "st catherine", "spanish town", "portmore", "hellshire", "fort clarence"],
  "north coast": ["montego bay", "mobay", "st. james", "st james", "falmouth", "trelawny", "ocho rios", "st. ann", "st ann", "priory", "plantation cove", "runaway bay", "discovery bay", "st. mary", "st mary", "oracabessa", "port maria"],
  "north-east": ["st. mary", "st mary", "oracabessa", "port maria", "highgate", "portland", "port antonio"],
  "north-west": ["hanover", "lucea", "montego bay", "mobay", "negril", "st. james", "st james"],
  "west coast": ["negril", "westmoreland", "hanover", "lucea", "savanna-la-mar", "seven mile", "west end"],
  "east": ["portland", "port antonio", "boston bay", "st. thomas", "st thomas", "morant", "morant bay", "bath", "blue lagoon"],
  "south coast": ["st. elizabeth", "st elizabeth", "black river", "treasure beach", "clarendon", "may pen", "denbigh", "alligator pond"],
  "south-west": ["st. elizabeth", "st elizabeth", "black river", "treasure beach", "accompong", "ys falls", "westmoreland"],
  "central highlands": ["manchester", "mandeville", "christiana", "cockpit country", "accompong", "st. elizabeth", "st elizabeth"],
};
const PARISH_EVENT_TERMS: Record<string, string[]> = {
  "kingston": ["kingston", "waterfront", "national stadium"],
  "st. andrew": ["st. andrew", "st andrew", "new kingston", "half way tree", "liguanea", "hope road"],
  "st. catherine": ["st. catherine", "st catherine", "spanish town", "portmore", "hellshire", "fort clarence"],
  "st. ann": ["st. ann", "st ann", "ocho rios", "priory", "plantation cove", "runaway bay", "discovery bay"],
  "st. james": ["st. james", "st james", "montego bay", "mobay", "gloucester", "hip strip"],
  "st. mary": ["st. mary", "st mary", "oracabessa", "port maria", "highgate"],
  "st. elizabeth": ["st. elizabeth", "st elizabeth", "black river", "treasure beach", "accompong", "ys falls"],
  "st. thomas": ["st. thomas", "st thomas", "morant", "morant bay", "bath"],
  "trelawny": ["trelawny", "falmouth", "albert town"],
  "hanover": ["hanover", "lucea"],
  "westmoreland": ["westmoreland", "negril", "savanna-la-mar", "seven mile", "west end"],
  "clarendon": ["clarendon", "may pen", "denbigh"],
  "manchester": ["manchester", "mandeville", "alligator pond"],
  "portland": ["portland", "port antonio", "boston bay", "blue lagoon"],
};
const PARISH_DEFAULT_REGION: Record<string, string> = {
  "kingston": "Kingston",
  "st. andrew": "Kingston",
  "st. catherine": "South-East",
  "st. ann": "North Coast",
  "st. james": "North Coast",
  "st. mary": "North-East",
  "st. elizabeth": "South-West",
  "st. thomas": "East",
  "trelawny": "North Coast",
  "hanover": "North-West",
  "westmoreland": "West Coast",
  "clarendon": "South Coast",
  "manchester": "Central Highlands",
  "portland": "East",
};

const EVENT_CACHE = new Map<string, { payload: EventsApiResponse; expiresAt: number }>();
let cachedCuratedEvents: LiveEvent[] | null = null;

type EventQuery = {
  region?: string;
  parish?: string;
  latitude?: number;
  longitude?: number;
};

type SupabaseVerifiedEventRow = {
  id?: unknown;
  title?: unknown;
  city?: unknown;
  region?: unknown;
  parish?: unknown;
  venue?: unknown;
  start_date?: unknown;
  date_label?: unknown;
  vibes?: unknown;
  price?: unknown;
  ticket_requirement?: unknown;
  official_url?: unknown;
  description?: unknown;
  source_label?: unknown;
};

export function resetEventsHandlerStateForTest() {
  EVENT_CACHE.clear();
  cachedCuratedEvents = null;
}

export default async function eventsHandler(req: ApiRequest, res: ApiResponse) {
  if (!guardApiRequest(req, res, {
    routeId: "events",
    allowedMethods: ["GET", "HEAD"],
    cacheControl: "s-maxage=900, stale-while-revalidate=3600",
    rateLimitMax: 60,
  })) return;

  const query = normalizeEventQuery(req.query ?? {});
  const providerKeys = getEventProviderKeys();
  const providerConfigured = hasEventProviderConfigured(providerKeys);
  const cacheKey = getEventCacheKey(query);
  const cachedResponse = getCachedEventsResponse(cacheKey);
  if (cachedResponse) {
    res.status(200).json(cachedResponse);
    return;
  }

  const curatedEvents = filterCuratedEvents(await getCuratedEvents(), query);

  if (!providerConfigured) {
    const payload = buildEventsPayload({
      query,
      curatedEvents,
      liveEvents: [],
      providerKeys,
      reason: "missing-event-provider-keys",
    });
    setEventsCache(cacheKey, payload);
    res.status(200).json(payload);
    return;
  }

  try {
    const liveResult = await fetchLiveEvents(query, providerKeys);
    const reason = liveResult.reason ?? (liveResult.events.length ? undefined : "no-live-provider-events");
    const payload = buildEventsPayload({
      query,
      curatedEvents,
      liveEvents: liveResult.events,
      providerKeys,
      ...(reason ? { reason } : {}),
    });
    setEventsCache(cacheKey, payload);
    res.status(200).json(payload);
  } catch (error) {
    console.warn(`Live event lookup unavailable; using curated calendar. ${formatErrorForLog(error)}`);
    const payload = buildEventsPayload({
      query,
      curatedEvents,
      liveEvents: [],
      providerKeys,
      reason: "event-provider-request-failed",
    });
    setEventsCache(cacheKey, payload);
    res.status(200).json(payload);
  }
}

async function fetchLiveEvents(
  query: EventQuery,
  providerKeys: ReturnType<typeof getEventProviderKeys>
): Promise<{ events: LiveEvent[]; reason?: string }> {
  const requests: Array<Promise<LiveEvent[]>> = [];
  if (providerKeys.eventbrite) requests.push(fetchEventbriteEvents(providerKeys.eventbrite, query));
  if (providerKeys.ticketmaster) requests.push(fetchTicketmasterEvents(providerKeys.ticketmaster, query));
  if (providerKeys.verifiedCalendar) requests.push(fetchVerifiedIslandEvents(providerKeys.verifiedCalendar, query));
  if (!requests.length) return { events: [] };

  const settled = await Promise.allSettled(requests);
  const events = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const failures = settled.flatMap((result) => result.status === "rejected" ? [result.reason] : []);
  const successfulProviderCount = settled.filter((result) => result.status === "fulfilled").length;
  return {
    events: dedupeEvents(events).slice(0, MAX_EVENTS_RESPONSE),
    ...(events.length === 0 && failures.length
      ? { reason: successfulProviderCount > 0 ? "partial-event-provider-request-failed" : getProviderFailureReason(failures) }
      : {}),
  };
}

async function fetchEventbriteEvents(apiKey: string, query: EventQuery): Promise<LiveEvent[]> {
  let organizationIds: string[] = [];
  try {
    organizationIds = await getEventbriteOrganizationIds(apiKey);
  } catch (error) {
    console.warn(`Eventbrite organization lookup unavailable. ${formatErrorForLog(error)}`);
  }

  if (!organizationIds.length) return [];

  const eventRequests = organizationIds
    .slice(0, 3)
    .map((organizationId) => fetchEventbriteOrganizationEvents(apiKey, organizationId));

  const settled = await Promise.allSettled(eventRequests);
  const fulfilledEvents = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const failures = settled.flatMap((result) => result.status === "rejected" ? [result.reason] : []);

  if (!fulfilledEvents.length && failures.length === eventRequests.length) {
    throw failures[0];
  }

  return dedupeEvents(
    fulfilledEvents
      .map((event) => normalizeEventbriteEvent(event, query))
      .filter((event): event is LiveEvent => Boolean(event))
  ).slice(0, MAX_LIVE_EVENTS_PER_PROVIDER);
}

async function getEventbriteOrganizationIds(apiKey: string): Promise<string[]> {
  const configuredIds = readCsvEnv("EVENTBRITE_ORGANIZATION_ID");
  if (configuredIds.length) return configuredIds;

  const url = new URL(`${EVENTBRITE_API_BASE_URL}/users/me/organizations/`);
  const payload = await fetchEventbriteJson(apiKey, url);
  const payloadRecord = isRecord(payload) ? payload : {};
  const organizations = Array.isArray(payloadRecord.organizations) ? payloadRecord.organizations : [];
  return organizations
    .map((organization) => isRecord(organization) ? asString(organization.id) : undefined)
    .filter((id): id is string => Boolean(id));
}

async function fetchEventbriteOrganizationEvents(apiKey: string, organizationId: string): Promise<unknown[]> {
  const url = new URL(`${EVENTBRITE_API_BASE_URL}/organizations/${encodeURIComponent(organizationId)}/events/`);
  addEventbriteEventSearchParams(url);

  const payload = await fetchEventbriteJson(apiKey, url);
  const payloadRecord = isRecord(payload) ? payload : {};
  return Array.isArray(payloadRecord.events) ? payloadRecord.events : [];
}

function addEventbriteEventSearchParams(url: URL) {
  url.searchParams.set("status", "live");
  url.searchParams.set("order_by", "start_asc");
  url.searchParams.set("expand", "venue,ticket_availability");
  url.searchParams.set("page_size", String(MAX_LIVE_EVENTS_PER_PROVIDER));
}

async function fetchEventbriteJson(apiKey: string, url: URL): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!response.ok) {
    throw new EventProviderError(response.status, `Eventbrite failed: ${response.status}`);
  }

  return response.json();
}

async function fetchTicketmasterEvents(apiKey: string, query: EventQuery): Promise<LiveEvent[]> {
  const urls = buildTicketmasterEventUrls(apiKey, query);
  const failures: unknown[] = [];

  for (const url of urls) {
    try {
      const events = await fetchTicketmasterEventsUrl(url, query);
      if (events.length) return events.slice(0, MAX_LIVE_EVENTS_PER_PROVIDER);
    } catch (error) {
      if (error instanceof EventProviderError && error.status === 429) {
        throw error;
      }
      failures.push(error);
    }
  }

  if (failures.length === urls.length && failures.length > 0) {
    throw failures[0];
  }

  return [];
}

async function fetchTicketmasterEventsUrl(url: URL, query: EventQuery): Promise<LiveEvent[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new EventProviderError(response.status, `Ticketmaster failed: ${response.status}`);
  }

  const payload: unknown = await response.json();
  const payloadRecord = isRecord(payload) ? payload : {};
  const embedded = isRecord(payloadRecord._embedded) ? payloadRecord._embedded : {};
  return (Array.isArray(embedded.events) ? embedded.events : [])
    .map((event) => normalizeTicketmasterEvent(event, query))
    .filter((event): event is LiveEvent => Boolean(event));
}

async function fetchVerifiedIslandEvents(
  config: NonNullable<ReturnType<typeof getEventProviderKeys>["verifiedCalendar"]>,
  query: EventQuery
): Promise<LiveEvent[]> {
  const url = new URL(`${config.url}/rest/v1/${VERIFIED_EVENTS_TABLE}`);
  url.searchParams.set("select", [
    "id",
    "title",
    "city",
    "region",
    "parish",
    "venue",
    "start_date",
    "date_label",
    "vibes",
    "price",
    "ticket_requirement",
    "official_url",
    "description",
    "source_label",
  ].join(","));
  url.searchParams.set("is_published", "eq.true");
  url.searchParams.set("start_date", `gte.${new Date().toISOString()}`);
  url.searchParams.set("order", "start_date.asc");
  url.searchParams.set("limit", String(MAX_EVENTS_RESPONSE));

  const response = await fetch(url, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
    },
  });

  if (!response.ok) {
    throw new EventProviderError(response.status, `Verified events lookup failed: ${response.status}`);
  }

  const payload: unknown = await response.json();
  return (Array.isArray(payload) ? payload : [])
    .map((row) => normalizeVerifiedEvent(row, query))
    .filter((event): event is LiveEvent => Boolean(event))
    .slice(0, MAX_LIVE_EVENTS_PER_PROVIDER);
}

function buildTicketmasterEventUrls(apiKey: string, query: EventQuery): URL[] {
  const urls: URL[] = [];
  const seen = new Set<string>();
  const radiusKm = getPositiveEnvNumber("EVENTS_TICKETMASTER_RADIUS_KM", DEFAULT_TICKETMASTER_RADIUS_KM);

  if (query.latitude !== undefined && query.longitude !== undefined) {
    const geoPointUrl = createTicketmasterBaseUrl(apiKey);
    geoPointUrl.searchParams.set("geoPoint", encodeGeohash(query.latitude, query.longitude, TICKETMASTER_GEOHASH_PRECISION));
    geoPointUrl.searchParams.set("radius", String(radiusKm));
    geoPointUrl.searchParams.set("unit", "km");
    addUniqueUrl(urls, seen, geoPointUrl);

    const localUrl = createTicketmasterBaseUrl(apiKey);
    localUrl.searchParams.set("latlong", `${query.latitude},${query.longitude}`);
    localUrl.searchParams.set("radius", String(radiusKm));
    localUrl.searchParams.set("unit", "km");
    addUniqueUrl(urls, seen, localUrl);
  }

  for (const keyword of buildTicketmasterKeywords(query)) {
    const keywordUrl = createTicketmasterBaseUrl(apiKey);
    keywordUrl.searchParams.set("keyword", keyword);
    addUniqueUrl(urls, seen, keywordUrl);
  }

  if (!urls.length) {
    addUniqueUrl(urls, seen, createTicketmasterBaseUrl(apiKey));
  }

  return urls;
}

function createTicketmasterBaseUrl(apiKey: string): URL {
  const { rangeStart, rangeEnd } = getEventRange();
  const url = new URL(TICKETMASTER_EVENTS_URL);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("countryCode", "JM");
  url.searchParams.set("locale", "*");
  url.searchParams.set("includeTBA", "yes");
  url.searchParams.set("size", String(MAX_LIVE_EVENTS_PER_PROVIDER));
  url.searchParams.set("sort", "date,asc");
  url.searchParams.set("startDateTime", rangeStart);
  url.searchParams.set("endDateTime", rangeEnd);
  return url;
}

function addUniqueUrl(urls: URL[], seen: Set<string>, url: URL) {
  const key = url.toString();
  if (seen.has(key)) return;
  seen.add(key);
  urls.push(url);
}

function normalizeEventbriteEvent(event: unknown, query: EventQuery): LiveEvent | null {
  if (!isRecord(event)) return null;
  const id = asString(event.id);
  const nameRecord = isRecord(event.name) ? event.name : {};
  const title = asString(nameRecord.text);
  if (!id || !title) return null;

  const venue = isRecord(event.venue) ? event.venue : {};
  const address = isRecord(venue.address) ? venue.address : {};
  const start = isRecord(event.start) ? event.start : {};
  const description = isRecord(event.description) ? asString(event.description.text) : undefined;
  const isFree = event.is_free === true;
  const officialUrl = asString(event.url);
  const latitude = asCoordinate(venue.latitude, -90, 90) ?? asCoordinate(address.latitude, -90, 90);
  const longitude = asCoordinate(venue.longitude, -180, 180) ?? asCoordinate(address.longitude, -180, 180);
  const searchableText = [
    title,
    description,
    officialUrl,
    asString(venue.name),
    asString(address.city),
    asString(address.region),
    asString(address.country),
    asString(address.localized_address_display),
    asString(address.address_1),
    asString(address.address_2),
  ].filter(Boolean).join(" ");

  if (!isTrustedProviderEvent(searchableText, query, latitude, longitude, asString(address.country))) return null;

  const inferredArea = inferJamaicaEventArea(searchableText);

  return {
    id: `eventbrite-${id}`,
    title,
    city: asString(address.city) ?? asString(venue.name) ?? query.parish ?? "Jamaica",
    region: inferredArea.region ?? query.region ?? query.parish ?? "Jamaica",
    ...(inferredArea.parish ?? query.parish ? { parish: inferredArea.parish ?? query.parish } : {}),
    venue: asString(venue.name) ?? "Eventbrite venue",
    startDate: asString(start.local) ?? asString(start.utc) ?? new Date().toISOString(),
    vibes: uniqueStrings(["eventbrite", asString(event.format_id), asString(event.category_id)]).slice(0, 3),
    price: isFree ? "Free registration" : "Ticket/pass required",
    ticketRequirement: isFree
      ? "Free registration may still be required."
      : "Ticket, pass, or registration may be required. Confirm on Eventbrite.",
    ...(officialUrl ? { officialUrl } : {}),
    description: description ? truncateText(description, 180) : "Live Eventbrite listing for this Jamaica area.",
    sourceKind: "eventbrite",
    sourceLabel: "Eventbrite",
  };
}

function normalizeTicketmasterEvent(event: unknown, query: EventQuery): LiveEvent | null {
  if (!isRecord(event)) return null;
  const id = asString(event.id);
  const title = asString(event.name);
  if (!id || !title) return null;

  const embedded = isRecord(event._embedded) ? event._embedded : {};
  const venues = Array.isArray(embedded.venues) ? embedded.venues : [];
  const venue = isRecord(venues[0]) ? venues[0] : {};
  const cityRecord = isRecord(venue.city) ? venue.city : {};
  const countryRecord = isRecord(venue.country) ? venue.country : {};
  const stateRecord = isRecord(venue.state) ? venue.state : {};
  const addressRecord = isRecord(venue.address) ? venue.address : {};
  const locationRecord = isRecord(venue.location) ? venue.location : {};
  const dates = isRecord(event.dates) ? event.dates : {};
  const start = isRecord(dates.start) ? dates.start : {};
  const classifications = Array.isArray(event.classifications) ? event.classifications : [];
  const firstClassification = isRecord(classifications[0]) ? classifications[0] : {};
  const segment = isRecord(firstClassification.segment) ? asString(firstClassification.segment.name) : undefined;
  const genre = isRecord(firstClassification.genre) ? asString(firstClassification.genre.name) : undefined;
  const officialUrl = asString(event.url);
  const latitude = asCoordinate(locationRecord.latitude, -90, 90);
  const longitude = asCoordinate(locationRecord.longitude, -180, 180);
  const searchableText = [
    title,
    asString(event.info),
    asString(event.pleaseNote),
    officialUrl,
    asString(venue.name),
    asString(cityRecord.name),
    asString(stateRecord.name),
    asString(stateRecord.stateCode),
    asString(countryRecord.name),
    asString(countryRecord.countryCode),
    asString(addressRecord.line1),
  ].filter(Boolean).join(" ");

  if (!isTrustedProviderEvent(
    searchableText,
    query,
    latitude,
    longitude,
    [asString(countryRecord.countryCode), asString(countryRecord.name)].filter(Boolean).join(" ")
  )) return null;

  const inferredArea = inferJamaicaEventArea(searchableText);

  return {
    id: `ticketmaster-${id}`,
    title,
    city: asString(cityRecord.name) ?? query.parish ?? "Jamaica",
    region: inferredArea.region ?? query.region ?? query.parish ?? "Jamaica",
    ...(inferredArea.parish ?? query.parish ? { parish: inferredArea.parish ?? query.parish } : {}),
    venue: asString(venue.name) ?? "Ticketmaster venue",
    startDate: asString(start.dateTime) ?? normalizeLocalDate(asString(start.localDate)) ?? new Date().toISOString(),
    vibes: uniqueStrings(["ticketmaster", segment, genre]).slice(0, 3),
    price: formatTicketmasterPrice(event),
    ticketRequirement: "Ticket or pass may be required. Confirm availability and access with the ticketing listing.",
    ...(officialUrl ? { officialUrl } : {}),
    description: asString(event.info) ?? asString(event.pleaseNote) ?? "Live Ticketmaster listing for this Jamaica area.",
    sourceKind: "ticketmaster",
    sourceLabel: "Ticketmaster",
  };
}

function normalizeVerifiedEvent(row: unknown, query: EventQuery): LiveEvent | null {
  if (!isRecord(row)) return null;
  const event = row as SupabaseVerifiedEventRow;
  const id = asString(event.id);
  const title = asString(event.title);
  const city = asString(event.city);
  const region = asString(event.region);
  const venue = asString(event.venue);
  const startDate = asString(event.start_date);
  const description = asString(event.description);
  if (!id || !title || !city || !region || !venue || !startDate || !description) return null;

  const parish = asString(event.parish);
  if (!eventMatchesQuery(region, parish, query)) return null;

  const vibes = Array.isArray(event.vibes)
    ? event.vibes.filter((vibe): vibe is string => typeof vibe === "string" && vibe.trim().length > 0)
    : [];
  const dateLabel = asString(event.date_label);
  const price = asString(event.price);
  const ticketRequirement = asString(event.ticket_requirement);
  const officialUrl = asString(event.official_url);
  const sourceLabel = asString(event.source_label);

  return {
    id: `verified-${id}`,
    title,
    city,
    region,
    ...(parish ? { parish } : {}),
    venue,
    startDate,
    ...(dateLabel ? { dateLabel } : {}),
    vibes: uniqueStrings(["verified", ...vibes]).slice(0, 4),
    ...(price ? { price } : {}),
    ...(ticketRequirement ? { ticketRequirement } : {}),
    ...(officialUrl ? { officialUrl } : {}),
    description: truncateText(description, 220),
    sourceKind: "verified",
    sourceLabel: sourceLabel ?? "Verified island calendar",
  };
}

function buildEventsPayload(args: {
  query: EventQuery;
  curatedEvents: LiveEvent[];
  liveEvents: LiveEvent[];
  providerKeys: ReturnType<typeof getEventProviderKeys>;
  reason?: string;
}): EventsApiResponse {
  const data = dedupeEvents([...args.liveEvents, ...args.curatedEvents])
    .sort((first, second) => new Date(first.startDate).getTime() - new Date(second.startDate).getTime())
    .slice(0, MAX_EVENTS_RESPONSE);
  const hasLive = args.liveEvents.length > 0;
  const hasCurated = args.curatedEvents.length > 0;
  const meta: EventsApiResponse["meta"] = {
    source: hasLive && hasCurated ? "mixed" : hasLive ? "live" : "curated",
    providerConfigured: hasEventProviderConfigured(args.providerKeys),
    providers: {
      eventbrite: Boolean(args.providerKeys.eventbrite),
      ticketmaster: Boolean(args.providerKeys.ticketmaster),
      verifiedCalendar: Boolean(args.providerKeys.verifiedCalendar),
    },
    ...(args.query.region ? { region: args.query.region } : {}),
    ...(args.query.parish ? { parish: args.query.parish } : {}),
    cached: false,
  };
  if (args.reason) meta.reason = args.reason;
  return { data, meta };
}

async function getCuratedEvents(): Promise<LiveEvent[]> {
  if (cachedCuratedEvents) return cachedCuratedEvents;
  const filePath = path.join(process.cwd(), "public", "data", "events.json");
  const fileContents = await readFile(filePath, "utf8");
  const parsed: unknown = JSON.parse(fileContents);
  cachedCuratedEvents = Array.isArray(parsed)
    ? parsed.filter(isLiveEventLike).map(normalizeCuratedEvent)
    : [];
  return cachedCuratedEvents;
}

function normalizeCuratedEvent(event: LiveEvent): LiveEvent {
  return {
    ...event,
    sourceKind: event.sourceKind ?? "curated",
    sourceLabel: event.sourceLabel ?? "Curated Jamaica calendar",
  };
}

function filterCuratedEvents(events: LiveEvent[], query: EventQuery): LiveEvent[] {
  const region = query.region?.toLowerCase();
  const parish = query.parish?.toLowerCase();
  if (!region && !parish) return events;
  return events.filter((event) => {
    const eventRegion = event.region?.toLowerCase();
    const eventParish = event.parish?.toLowerCase();
    return Boolean((region && eventRegion === region) || (parish && eventParish === parish));
  });
}

function eventMatchesQuery(region: string | undefined, parish: string | undefined, query: EventQuery): boolean {
  const queryRegion = query.region?.toLowerCase();
  const queryParish = query.parish?.toLowerCase();
  const eventRegion = region?.toLowerCase();
  const eventParish = parish?.toLowerCase();
  if (!queryRegion && !queryParish) return true;
  return Boolean((queryRegion && eventRegion === queryRegion) || (queryParish && eventParish === queryParish));
}

function getEventProviderKeys() {
  const supabaseUrl = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.vite_supabase_url ||
    process.env.supabase_url ||
    ""
  ).trim().replace(/\/$/, "");
  const supabaseAnonKey = (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.vite_supabase_anon_key ||
    process.env.supabase_anon_key ||
    ""
  ).trim();
  const supabaseDisabled = /^(1|true|yes|on)$/i.test(
    process.env.VITE_SUPABASE_DISABLED || process.env.SUPABASE_DISABLED || ""
  );

  return {
    eventbrite: (
      process.env.EVENTBRITE_PRIVATE_TOKEN ||
      process.env.EVENTBRITE_API_KEY ||
      process.env.eventbrite_private_token ||
      process.env.eventbrite_api_key ||
      ""
    ).trim(),
    ticketmaster: (process.env.TICKETMASTER_API_KEY || process.env.ticketmaster_api_key || "").trim(),
    verifiedCalendar: !supabaseDisabled && supabaseUrl && supabaseAnonKey
      ? { url: supabaseUrl, anonKey: supabaseAnonKey }
      : null,
  };
}

function hasEventProviderConfigured(providerKeys: ReturnType<typeof getEventProviderKeys>): boolean {
  return Boolean(providerKeys.eventbrite || providerKeys.ticketmaster || providerKeys.verifiedCalendar);
}

function readCsvEnv(name: string): string[] {
  return (process.env[name] || process.env[name.toLowerCase()] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeEventQuery(query: QueryRecord): EventQuery {
  const region = asString(query.region);
  const parish = asString(query.parish);
  const latitude = asCoordinate(query.latitude, -90, 90);
  const longitude = asCoordinate(query.longitude, -180, 180);
  return {
    ...(region ? { region } : {}),
    ...(parish ? { parish } : {}),
    ...(latitude !== undefined ? { latitude } : {}),
    ...(longitude !== undefined ? { longitude } : {}),
  };
}

function buildProviderQuery(query: EventQuery): string {
  return [query.parish, query.region, "Jamaica"].filter(Boolean).join(" ");
}

function buildTicketmasterKeywords(query: EventQuery): string[] {
  return uniqueStrings([
    buildProviderQuery(query),
    query.parish ? `${query.parish} Jamaica` : undefined,
    query.region ? `${query.region} Jamaica` : undefined,
  ]).filter((keyword) => keyword !== "jamaica");
}

function isTrustedProviderEvent(
  searchableText: string,
  query: EventQuery,
  latitude: number | undefined,
  longitude: number | undefined,
  countryValue?: string
): boolean {
  const normalizedText = normalizeSearchText(searchableText);
  const normalizedCountry = normalizeSearchText(countryValue ?? "");
  if (normalizedCountry && !isJamaicaCountry(normalizedCountry)) return false;
  if (isNearbyQueryEvent(query, latitude, longitude)) return true;
  if (!isJamaicaCountry(normalizedCountry) && !containsAnyTerm(normalizedText, JAMAICA_EVENT_TERMS)) return false;

  const areaTerms = getEventQueryAreaTerms(query);
  return !areaTerms.length || containsAnyTerm(normalizedText, areaTerms);
}

function isJamaicaCountry(normalizedCountry: string): boolean {
  return containsAnyTerm(normalizedCountry, ["jm", "jamaica"]);
}

function isNearbyQueryEvent(
  query: EventQuery,
  latitude: number | undefined,
  longitude: number | undefined
): boolean {
  if (
    query.latitude === undefined ||
    query.longitude === undefined ||
    latitude === undefined ||
    longitude === undefined
  ) return false;

  const radiusKm = getPositiveEnvNumber("EVENTS_TICKETMASTER_RADIUS_KM", DEFAULT_TICKETMASTER_RADIUS_KM);
  return getDistanceKm(query.latitude, query.longitude, latitude, longitude) <= radiusKm + 25;
}

function getEventQueryAreaTerms(query: EventQuery): string[] {
  return uniqueStrings([
    query.region,
    query.parish,
    ...getTermsForLookup(REGION_EVENT_TERMS, query.region),
    ...getTermsForLookup(PARISH_EVENT_TERMS, query.parish),
  ]);
}

function inferJamaicaEventArea(searchableText: string): { region?: string; parish?: string } {
  const normalizedText = normalizeSearchText(searchableText);

  for (const [parish, terms] of Object.entries(PARISH_EVENT_TERMS)) {
    if (containsAnyTerm(normalizedText, [parish, ...terms])) {
      const region = PARISH_DEFAULT_REGION[parish];
      return {
        parish: titleCaseArea(parish),
        ...(region ? { region } : {}),
      };
    }
  }

  for (const [region, terms] of Object.entries(REGION_EVENT_TERMS)) {
    if (containsAnyTerm(normalizedText, [region, ...terms])) {
      return {
        region: titleCaseArea(region),
      };
    }
  }

  return {};
}

function getTermsForLookup(source: Record<string, string[]>, value: string | undefined): string[] {
  const key = normalizeAreaKey(value);
  return key ? source[key] ?? [] : [];
}

function normalizeAreaKey(value: string | undefined): string {
  return normalizeSearchText(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[’']/g, "").replace(/\s+/g, " ").trim();
}

function containsAnyTerm(normalizedText: string, terms: string[]): boolean {
  return terms.some((term) => containsTerm(normalizedText, term));
}

function containsTerm(normalizedText: string, term: string): boolean {
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedTerm) return false;
  const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escapedTerm}($|[^a-z0-9])`, "i").test(normalizedText);
}

function titleCaseArea(value: string): string {
  return value
    .split(/(\s+|-)/)
    .map((part) => {
      if (/^\s+$|-$/.test(part)) return part;
      if (part === "st.") return "St.";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}

function getDistanceKm(fromLatitude: number, fromLongitude: number, toLatitude: number, toLongitude: number): number {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(toLatitude - fromLatitude);
  const longitudeDelta = toRadians(toLongitude - fromLongitude);
  const fromLatitudeRad = toRadians(fromLatitude);
  const toLatitudeRad = toRadians(toLatitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitudeRad) * Math.cos(toLatitudeRad) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function encodeGeohash(latitude: number, longitude: number, precision: number): string {
  let latitudeRange: [number, number] = [-90, 90];
  let longitudeRange: [number, number] = [-180, 180];
  let isLongitude = true;
  let bit = 0;
  let character = 0;
  let hash = "";
  const bits = [16, 8, 4, 2, 1];

  while (hash.length < precision) {
    if (isLongitude) {
      const mid = (longitudeRange[0] + longitudeRange[1]) / 2;
      if (longitude >= mid) {
        character |= bits[bit] ?? 0;
        longitudeRange = [mid, longitudeRange[1]];
      } else {
        longitudeRange = [longitudeRange[0], mid];
      }
    } else {
      const mid = (latitudeRange[0] + latitudeRange[1]) / 2;
      if (latitude >= mid) {
        character |= bits[bit] ?? 0;
        latitudeRange = [mid, latitudeRange[1]];
      } else {
        latitudeRange = [latitudeRange[0], mid];
      }
    }

    isLongitude = !isLongitude;
    if (bit < 4) {
      bit += 1;
    } else {
      hash += GEOHASH_BASE32[character];
      bit = 0;
      character = 0;
    }
  }

  return hash;
}

function getEventRange() {
  const now = new Date();
  const end = new Date(now);
  end.setDate(now.getDate() + DEFAULT_EVENT_RANGE_DAYS);
  return {
    rangeStart: toProviderDateTime(now),
    rangeEnd: toProviderDateTime(end),
  };
}

function toProviderDateTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function normalizeLocalDate(value: string | undefined): string | undefined {
  return value ? `${value}T00:00:00-05:00` : undefined;
}

function formatTicketmasterPrice(event: Record<string, unknown>): string {
  const ranges = Array.isArray(event.priceRanges) ? event.priceRanges : [];
  const firstRange = isRecord(ranges[0]) ? ranges[0] : null;
  const min = asNumber(firstRange?.min);
  const max = asNumber(firstRange?.max);
  const currency = asString(firstRange?.currency) ?? "USD";
  if (min !== undefined && max !== undefined) {
    return min === max ? `${currency} ${Math.round(min)}` : `${currency} ${Math.round(min)}-${Math.round(max)}`;
  }
  return "Ticket/pass required";
}

function dedupeEvents(events: LiveEvent[]): LiveEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = [
      normalizeEventIdentityPart(event.title),
      getEventIdentityDate(event.startDate),
      normalizeEventIdentityPart(event.parish ?? event.region ?? event.city),
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeEventIdentityPart(value: string): string {
  return normalizeSearchText(value).replace(/\bst\s+/g, "st. ");
}

function getEventIdentityDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: JAMAICA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : value.slice(0, 10);
}

function getEventCacheKey(query: EventQuery): string {
  return [
    query.region ?? "",
    query.parish ?? "",
    query.latitude?.toFixed(4) ?? "",
    query.longitude?.toFixed(4) ?? "",
  ].join("|");
}

function getCachedEventsResponse(cacheKey: string): EventsApiResponse | null {
  const cached = EVENT_CACHE.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    EVENT_CACHE.delete(cacheKey);
    return null;
  }
  return {
    ...cached.payload,
    meta: {
      ...cached.payload.meta,
      cached: true,
    },
  };
}

function setEventsCache(cacheKey: string, payload: EventsApiResponse) {
  EVENT_CACHE.set(cacheKey, {
    payload,
    expiresAt: Date.now() + getCacheTtlSeconds() * 1000,
  });
}

function getCacheTtlSeconds(): number {
  return getPositiveEnvNumber("EVENTS_CACHE_TTL_SECONDS", DEFAULT_CACHE_TTL_SECONDS);
}

function getPositiveEnvNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function isLiveEventLike(value: unknown): value is LiveEvent {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.city === "string" &&
    typeof value.region === "string" &&
    typeof value.venue === "string" &&
    typeof value.startDate === "string"
  );
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim().toLowerCase()).filter((value): value is string => Boolean(value))));
}

function truncateText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1).trim()}...` : normalized;
}

function asString(value: unknown): string | undefined {
  const item = Array.isArray(value) ? value[0] : value;
  return typeof item === "string" && item.trim() ? item.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asCoordinate(value: unknown, min: number, max: number): number | undefined {
  const item = Array.isArray(value) ? value[0] : value;
  const parsed = typeof item === "number" ? item : typeof item === "string" && item.trim() ? Number(item) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatErrorForLog(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getProviderFailureReason(errors: unknown[]): string {
  return errors.some((error) => error instanceof EventProviderError && error.status === 429)
    ? "event-provider-rate-limited"
    : "event-provider-request-failed";
}

class EventProviderError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "EventProviderError";
    this.status = status;
  }
}
