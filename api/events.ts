import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ApiRequest, ApiResponse, EventsApiResponse, QueryRecord } from "../src/types/api";
import type { LiveEvent } from "../src/types/travel";
import { guardApiRequest } from "./_shared/api-guard";

const EVENTBRITE_API_BASE_URL = "https://www.eventbriteapi.com/v3";
const TICKETMASTER_EVENTS_URL = "https://app.ticketmaster.com/discovery/v2/events.json";
const DEFAULT_RADIUS_KM = 100;
const DEFAULT_EVENT_RANGE_DAYS = 365;
const DEFAULT_CACHE_TTL_SECONDS = 30 * 60;
const MAX_LIVE_EVENTS_PER_PROVIDER = 12;
const MAX_EVENTS_RESPONSE = 18;

const EVENT_CACHE = new Map<string, { payload: EventsApiResponse; expiresAt: number }>();
let cachedCuratedEvents: LiveEvent[] | null = null;

type EventQuery = {
  region?: string;
  parish?: string;
  latitude?: number;
  longitude?: number;
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
  const providerConfigured = Boolean(providerKeys.eventbrite || providerKeys.ticketmaster);
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
  const organizationIds = await getEventbriteOrganizationIds(apiKey);
  if (!organizationIds.length) return [];

  const organizationEvents = await Promise.all(
    organizationIds.slice(0, 3).map((organizationId) => fetchEventbriteOrganizationEvents(apiKey, organizationId))
  );

  return dedupeEvents(
    organizationEvents
      .flat()
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
  url.searchParams.set("status", "live");
  url.searchParams.set("order_by", "start_asc");
  url.searchParams.set("expand", "venue,ticket_availability");
  url.searchParams.set("page_size", String(MAX_LIVE_EVENTS_PER_PROVIDER));

  const payload = await fetchEventbriteJson(apiKey, url);
  const payloadRecord = isRecord(payload) ? payload : {};
  return Array.isArray(payloadRecord.events) ? payloadRecord.events : [];
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
  const { rangeStart, rangeEnd } = getEventRange();
  const url = new URL(TICKETMASTER_EVENTS_URL);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("countryCode", "JM");
  url.searchParams.set("size", String(MAX_LIVE_EVENTS_PER_PROVIDER));
  url.searchParams.set("sort", "date,asc");
  url.searchParams.set("startDateTime", rangeStart);
  url.searchParams.set("endDateTime", rangeEnd);
  if (query.latitude !== undefined && query.longitude !== undefined) {
    url.searchParams.set("latlong", `${query.latitude},${query.longitude}`);
    url.searchParams.set("radius", String(DEFAULT_RADIUS_KM));
    url.searchParams.set("unit", "km");
  } else {
    url.searchParams.set("keyword", buildProviderQuery(query));
  }

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

  return {
    id: `eventbrite-${id}`,
    title,
    city: asString(address.city) ?? asString(venue.name) ?? query.parish ?? "Jamaica",
    region: query.region ?? query.parish ?? "Jamaica",
    ...(query.parish ? { parish: query.parish } : {}),
    venue: asString(venue.name) ?? "Eventbrite venue",
    startDate: asString(start.local) ?? asString(start.utc) ?? new Date().toISOString(),
    vibes: uniqueStrings(["eventbrite", asString(event.format_id), asString(event.category_id)]).slice(0, 3),
    price: isFree ? "Free registration" : "Ticket/pass required",
    ticketRequirement: isFree
      ? "Free registration may still be required."
      : "Ticket, pass, or registration may be required. Confirm on Eventbrite.",
    ...(officialUrl ? { officialUrl } : {}),
    description: description ? truncateText(description, 180) : "Live Eventbrite listing for this Jamaica area.",
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
  const dates = isRecord(event.dates) ? event.dates : {};
  const start = isRecord(dates.start) ? dates.start : {};
  const classifications = Array.isArray(event.classifications) ? event.classifications : [];
  const firstClassification = isRecord(classifications[0]) ? classifications[0] : {};
  const segment = isRecord(firstClassification.segment) ? asString(firstClassification.segment.name) : undefined;
  const genre = isRecord(firstClassification.genre) ? asString(firstClassification.genre.name) : undefined;
  const officialUrl = asString(event.url);

  return {
    id: `ticketmaster-${id}`,
    title,
    city: asString(cityRecord.name) ?? query.parish ?? "Jamaica",
    region: query.region ?? query.parish ?? "Jamaica",
    ...(query.parish ? { parish: query.parish } : {}),
    venue: asString(venue.name) ?? "Ticketmaster venue",
    startDate: asString(start.dateTime) ?? normalizeLocalDate(asString(start.localDate)) ?? new Date().toISOString(),
    vibes: uniqueStrings(["ticketmaster", segment, genre]).slice(0, 3),
    price: formatTicketmasterPrice(event),
    ticketRequirement: "Ticket or pass may be required. Confirm availability and access with the ticketing listing.",
    ...(officialUrl ? { officialUrl } : {}),
    description: asString(event.info) ?? asString(event.pleaseNote) ?? "Live Ticketmaster listing for this Jamaica area.",
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
    providerConfigured: Boolean(args.providerKeys.eventbrite || args.providerKeys.ticketmaster),
    providers: {
      eventbrite: Boolean(args.providerKeys.eventbrite),
      ticketmaster: Boolean(args.providerKeys.ticketmaster),
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
  cachedCuratedEvents = Array.isArray(parsed) ? parsed.filter(isLiveEventLike) : [];
  return cachedCuratedEvents;
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

function getEventProviderKeys() {
  return {
    eventbrite: (
      process.env.EVENTBRITE_PRIVATE_TOKEN ||
      process.env.EVENTBRITE_API_KEY ||
      process.env.eventbrite_private_token ||
      process.env.eventbrite_api_key ||
      ""
    ).trim(),
    ticketmaster: (process.env.TICKETMASTER_API_KEY || process.env.ticketmaster_api_key || "").trim(),
  };
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
      event.title.toLowerCase().replace(/\s+/g, " ").trim(),
      event.city.toLowerCase().trim(),
      event.startDate.slice(0, 10),
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  const item = asString(value);
  if (!item) return undefined;
  const parsed = Number(item);
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
