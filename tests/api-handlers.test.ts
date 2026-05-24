import assert from "node:assert/strict";
import { promises as dns } from "node:dns";
import bookingsHandler, { resetBookingsHandlerStateForTest } from "../api/bookings";
import eventsHandler, { resetEventsHandlerStateForTest } from "../api/events";
import flightsHandler, { resetFlightsHandlerStateForTest } from "../api/flights";
import importMetadataHandler, {
  resetImportMetadataHandlerStateForTest,
  setImportMetadataFetchTransportForTest,
} from "../api/import-metadata";
import roadRouteHandler from "../api/road-route";
import { resetApiGuardStateForTest } from "../api/_shared/api-guard";
import type {
  ApiRequest,
  ApiResponse,
  BookingApiResponse,
  EventsApiResponse,
  FlightApiResponse,
  ImportMetadataApiResponse,
  RoadRouteApiResponse,
} from "../src/types/api";

type TestResponse = ApiResponse & {
  statusCode: number;
  headers: Record<string, string>;
  body?: unknown;
};

type ErrorApiResponse = {
  error: string;
};

type OsrmRoadRouteApiResponse = Extract<RoadRouteApiResponse, { meta: { source: "osrm" } }>;

async function main() {
  resetApiGuardStateForTest();
  resetImportMetadataHandlerStateForTest();

  await testApiGuardRejectsDisallowedOrigins();
  await testApiGuardRateLimitsByClient();
  await testBookingsFallbackWithoutCredentials();
  await testBookingsLiveAmadeusNormalization();
  await testBookingsProviderLimitFallback();
  await testEventsFallbackWithoutCredentials();
  await testEventsVerifiedCalendarSource();
  await testEventsDeduplicatesVerifiedCalendarAndCuratedListings();
  await testEventsLiveProviderNormalization();
  await testEventsTicketmasterKeywordFallback();
  await testEventsRejectUntrustedProviderLocation();
  await testFlightsLiveAviationStackNormalization();
  await testFlightsRateLimitFallbackAndCooldown();
  await testImportMetadataBlocksPrivateUrls();
  await testImportMetadataBlocksPrivateDnsResolution();
  await testImportMetadataArticlePreview();
  await testRoadRouteRejectsOutOfBoundsCoordinates();
  await testRoadRouteNormalization();

  console.log("API handler checks passed.");
}

async function testApiGuardRejectsDisallowedOrigins() {
  resetApiGuardStateForTest();
  const response = createResponse();
  await flightsHandler(
    {
      method: "GET",
      headers: {
        origin: "https://not-irieverse.example",
      },
      query: {
        origin: "JFK",
        destination: "MBJ",
      },
    },
    response
  );

  assert.equal(response.statusCode, 403);
  assert.equal(response.headers["access-control-allow-origin"], undefined);
  const body = assertBody<ErrorApiResponse>(response.body);
  assert.equal(body.error, "Origin not allowed.");
}

async function testApiGuardRateLimitsByClient() {
  resetApiGuardStateForTest();
  const restoreEnv = withEnv({
    IRIEVERSE_API_RATE_LIMIT_FLIGHTS: "1",
    IRIEVERSE_API_RATE_LIMIT_FLIGHTS_WINDOW_SECONDS: "60",
    AVIATIONSTACK_API_KEY: undefined,
    VITE_AVIATIONSTACK_API_KEY: undefined,
  });
  const request: ApiRequest = {
    method: "GET",
    headers: {
      "x-forwarded-for": "203.0.113.10",
    },
    query: {
      origin: "JFK",
      destination: "MBJ",
    },
  };

  try {
    const firstResponse = createResponse();
    await flightsHandler(request, firstResponse);
    assert.equal(firstResponse.statusCode, 200);

    const secondResponse = createResponse();
    await flightsHandler(request, secondResponse);
    assert.equal(secondResponse.statusCode, 429);
    assert.equal(secondResponse.headers["retry-after"], "60");
    const body = assertBody<ErrorApiResponse>(secondResponse.body);
    assert.equal(body.error, "Too many requests. Try again shortly.");
  } finally {
    restoreEnv();
    resetApiGuardStateForTest();
  }
}

async function testFlightsLiveAviationStackNormalization() {
  resetFlightsHandlerStateForTest();
  const restoreEnv = withEnv({
    AVIATIONSTACK_API_KEY: "test-aviationstack-key",
    VITE_AVIATIONSTACK_API_KEY: undefined,
    AVIATIONSTACK_DISABLED: undefined,
    IRIEVERSE_DISABLE_LIVE_FLIGHTS: undefined,
  });
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const requestUrl = new URL(String(url));
    assert.equal(requestUrl.origin + requestUrl.pathname, "https://api.aviationstack.com/v1/flights");
    assert.equal(requestUrl.searchParams.get("access_key"), "test-aviationstack-key");
    assert.equal(requestUrl.searchParams.get("dep_iata"), "JFK");
    assert.equal(requestUrl.searchParams.get("arr_iata"), "MBJ");
    assert.equal(requestUrl.searchParams.get("flight_status"), "scheduled");

    return jsonResponse({
      data: [
        {
          airline: {
            name: "Island Air",
          },
          departure: {
            iata: "JFK",
            scheduled: "2026-06-01T12:00:00+00:00",
          },
          arrival: {
            iata: "MBJ",
            scheduled: "2026-06-01T15:45:00+00:00",
          },
          flight: {
            iata: "IA123",
            duration: 225,
          },
          flight_number: "IA123",
          flight_status: "scheduled",
        },
      ],
    });
  };

  try {
    const response = createResponse();
    await flightsHandler(
      {
        method: "GET",
        query: {
          origin: "JFK",
          destination: "MBJ",
        },
      },
      response
    );

    assert.equal(response.statusCode, 200);
    const body = assertBody<FlightApiResponse>(response.body);
    assert.equal(body.meta.source, "aviationstack");
    assert.equal(body.meta.providerConfigured, true);
    assert.equal(body.meta.origin, "JFK");
    assert.equal(body.meta.destination, "MBJ");
    assert.ok(Array.isArray(body.data));
    assert.equal(body.data[0]?.flightNumber, "IA123");
    assert.equal(body.data[0]?.airline, "Island Air");
    assert.equal(body.data[0]?.durationMinutes, 225);
  } finally {
    resetFlightsHandlerStateForTest();
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
}

async function testFlightsRateLimitFallbackAndCooldown() {
  resetFlightsHandlerStateForTest();
  const restoreEnv = withEnv({
    AVIATIONSTACK_API_KEY: "test-aviationstack-key",
    VITE_AVIATIONSTACK_API_KEY: undefined,
    AVIATIONSTACK_DISABLED: undefined,
    IRIEVERSE_DISABLE_LIVE_FLIGHTS: undefined,
    AVIATIONSTACK_COOLDOWN_SECONDS: "60",
  });
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  let fetchCount = 0;
  console.warn = () => {};

  globalThis.fetch = async () => {
    fetchCount += 1;
    return jsonResponse({
      error: {
        type: "rate_limit_reached",
        message: "Rate limit exceeded",
      },
    });
  };

  try {
    const rateLimitedResponse = createResponse();
    await flightsHandler(
      {
        method: "GET",
        query: {
          origin: "ATL",
          destination: "MBJ",
        },
      },
      rateLimitedResponse
    );

    assert.equal(rateLimitedResponse.statusCode, 200);
    const rateLimitedBody = assertBody<FlightApiResponse>(rateLimitedResponse.body);
    assert.equal(rateLimitedBody.meta.source, "fallback");
    assert.equal(rateLimitedBody.meta.reason, "aviationstack-rate-limited");
    assert.equal(rateLimitedBody.meta.providerConfigured, true);
    assert.deepEqual(rateLimitedBody.data, []);
    assert.equal(fetchCount, 1);

    const cooldownResponse = createResponse();
    await flightsHandler(
      {
        method: "GET",
        query: {
          origin: "BOS",
          destination: "MBJ",
        },
      },
      cooldownResponse
    );

    assert.equal(cooldownResponse.statusCode, 200);
    const cooldownBody = assertBody<FlightApiResponse>(cooldownResponse.body);
    assert.equal(cooldownBody.meta.source, "fallback");
    assert.equal(cooldownBody.meta.reason, "aviationstack-rate-limited");
    assert.equal(typeof cooldownBody.meta.retryAfterSeconds, "number");
    assert.equal(fetchCount, 1);
  } finally {
    resetFlightsHandlerStateForTest();
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    restoreEnv();
  }
}

async function testBookingsFallbackWithoutCredentials() {
  const restoreEnv = withEnv({
    AMADEUS_CLIENT_ID: undefined,
    AMADEUS_CLIENT_SECRET: undefined,
    AMADEUS_API_KEY: undefined,
    AMADEUS_API_SECRET: undefined,
  });

  try {
    const response = createResponse();
    await bookingsHandler(
      {
        method: "GET",
        query: {
          destination: "MBJ",
          origin: "JFK",
        },
      },
      response
    );

    assert.equal(response.statusCode, 200);
    const body = assertBody<BookingApiResponse>(response.body);
    assert.equal(body.meta.source, "fallback");
    assert.equal(body.meta.reason, "missing-amadeus-credentials");
    assert.equal(body.meta.providerConfigured, false);
    assert.ok(Array.isArray(body.data));
    assert.equal(body.data.length, 2);
  } finally {
    restoreEnv();
  }
}

async function testBookingsLiveAmadeusNormalization() {
  resetBookingsHandlerStateForTest();
  const restoreEnv = withEnv({
    AMADEUS_CLIENT_ID: "test-client",
    AMADEUS_CLIENT_SECRET: "test-secret",
    AMADEUS_BASE_URL: "https://amadeus.test",
  });
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  globalThis.fetch = async (url, init) => {
    const urlText = String(url);
    calls.push(urlText);

    if (urlText.endsWith("/v1/security/oauth2/token")) {
      assert.equal(init?.method, "POST");
      return jsonResponse({
        access_token: "test-token",
        expires_in: 1200,
      });
    }

    if (urlText.startsWith("https://amadeus.test/v1/reference-data/locations/hotels/by-city")) {
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test-token");
      return jsonResponse({
        data: [
          { hotelId: "H1" },
          { hotelId: "H2" },
        ],
      });
    }

    if (urlText.startsWith("https://amadeus.test/v3/shopping/hotel-offers")) {
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test-token");
      return jsonResponse({
        data: [
          {
            hotel: {
              hotelId: "H1",
              name: "Harbour View Stay",
            },
            offers: [
              {
                id: "offer-1",
                boardType: "BREAKFAST",
                room: {
                  typeEstimated: {
                    category: "DELUXE_ROOM",
                  },
                },
                price: {
                  total: "312.45",
                  currency: "USD",
                },
                policies: {
                  cancellations: [
                    {
                      deadline: "2026-06-01T12:00:00Z",
                    },
                  ],
                },
              },
            ],
          },
        ],
      });
    }

    throw new Error(`Unexpected Amadeus fetch: ${urlText}`);
  };

  try {
    const response = createResponse();
    await bookingsHandler(
      {
        method: "GET",
        query: {
          destination: "MBJ",
          origin: "JFK",
          checkInDate: "2026-06-01",
          checkOutDate: "2026-06-03",
          adults: "2",
        },
      },
      response
    );

    assert.equal(response.statusCode, 200);
    const body = assertBody<BookingApiResponse>(response.body);
    assert.equal(body.meta.source, "amadeus");
    assert.equal(body.meta.providerConfigured, true);
    assert.equal(body.meta.adults, 2);
    assert.ok(Array.isArray(body.data));
    assert.equal(body.data[0]?.title, "Harbour View Stay");
    assert.equal(body.data[0]?.price, 312);
    assert.deepEqual(body.data[0]?.perks, [
      "Current availability",
      "Breakfast",
      "Cancellation by 2026-06-01",
    ]);
    assert.equal(calls.length, 3);
  } finally {
    resetBookingsHandlerStateForTest();
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
}

async function testBookingsProviderLimitFallback() {
  resetBookingsHandlerStateForTest();
  const restoreEnv = withEnv({
    AMADEUS_CLIENT_ID: "test-client",
    AMADEUS_CLIENT_SECRET: "test-secret",
    AMADEUS_BASE_URL: "https://amadeus.test",
  });
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  console.warn = () => {};

  globalThis.fetch = async (url) => {
    const urlText = String(url);

    if (urlText.endsWith("/v1/security/oauth2/token")) {
      return jsonResponse({
        access_token: "test-token",
        expires_in: 1200,
      });
    }

    if (urlText.startsWith("https://amadeus.test/v1/reference-data/locations/hotels/by-city")) {
      return jsonResponse({ errors: [{ title: "Too Many Requests" }] }, { status: 429 });
    }

    throw new Error(`Unexpected Amadeus fetch: ${urlText}`);
  };

  try {
    const response = createResponse();
    await bookingsHandler(
      {
        method: "GET",
        query: {
          destination: "MBJ",
          origin: "JFK",
        },
      },
      response
    );

    assert.equal(response.statusCode, 200);
    const body = assertBody<BookingApiResponse>(response.body);
    assert.equal(body.meta.source, "fallback");
    assert.equal(body.meta.reason, "amadeus-rate-limited");
    assert.equal(body.meta.providerConfigured, true);
    assert.ok(body.data.length > 0);
  } finally {
    resetBookingsHandlerStateForTest();
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    restoreEnv();
  }
}

async function testEventsFallbackWithoutCredentials() {
  resetEventsHandlerStateForTest();
  const restoreEnv = withEnv({
    EVENTBRITE_API_KEY: undefined,
    EVENTBRITE_PRIVATE_TOKEN: undefined,
    TICKETMASTER_API_KEY: undefined,
    VITE_SUPABASE_URL: undefined,
    VITE_SUPABASE_ANON_KEY: undefined,
  });

  try {
    const response = createResponse();
    await eventsHandler(
      {
        method: "GET",
        query: {
          region: "North Coast",
          parish: "St. Ann",
          latitude: "18.4029",
          longitude: "-76.974",
        },
      },
      response
    );

    assert.equal(response.statusCode, 200);
    const body = assertBody<EventsApiResponse>(response.body);
    assert.equal(body.meta.source, "curated");
    assert.equal(body.meta.reason, "missing-event-provider-keys");
    assert.equal(body.meta.providerConfigured, false);
    assert.equal(body.meta.providers.eventbrite, false);
    assert.equal(body.meta.providers.ticketmaster, false);
    assert.equal(body.meta.providers.verifiedCalendar, false);
    assert.ok(body.data.some((event) => event.title === "Reggae Sumfest"));
  } finally {
    resetEventsHandlerStateForTest();
    restoreEnv();
  }
}

async function testEventsVerifiedCalendarSource() {
  resetEventsHandlerStateForTest();
  const restoreEnv = withEnv({
    EVENTBRITE_API_KEY: undefined,
    EVENTBRITE_PRIVATE_TOKEN: undefined,
    TICKETMASTER_API_KEY: undefined,
    VITE_SUPABASE_URL: "https://verified-events.supabase.co",
    VITE_SUPABASE_ANON_KEY: "test-supabase-anon-key",
  });
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, init) => {
    const requestUrl = new URL(String(url));
    assert.equal(requestUrl.origin + requestUrl.pathname, "https://verified-events.supabase.co/rest/v1/verified_events");
    assert.equal(new Headers(init?.headers).get("apikey"), "test-supabase-anon-key");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-supabase-anon-key");
    assert.equal(requestUrl.searchParams.get("is_published"), "eq.true");
    assert.equal(requestUrl.searchParams.get("order"), "start_date.asc");

    return jsonResponse([
      {
        id: "verified-kingston-stage",
        title: "Kingston Harbour Stage",
        city: "Kingston",
        region: "Kingston",
        parish: "Kingston",
        venue: "Kingston Waterfront",
        start_date: "2026-08-08T19:00:00-05:00",
        date_label: "August 8, 2026",
        vibes: ["music", "culture"],
        price: "Ticket required",
        ticket_requirement: "Ticket or pass required.",
        official_url: "https://example.com/kingston-stage",
        description: "Verified Kingston event listing.",
      },
      {
        id: "verified-negril-stage",
        title: "Negril Stage",
        city: "Negril",
        region: "West Coast",
        parish: "Westmoreland",
        venue: "Seven Mile Beach",
        start_date: "2026-08-09T19:00:00-05:00",
        vibes: ["music"],
        price: "Confirm access",
        description: "Verified west coast event listing.",
      },
    ]);
  };

  try {
    const response = createResponse();
    await eventsHandler(
      {
        method: "GET",
        query: {
          region: "Kingston",
          parish: "Kingston",
          latitude: "17.9712",
          longitude: "-76.7936",
        },
      },
      response
    );

    assert.equal(response.statusCode, 200);
    const body = assertBody<EventsApiResponse>(response.body);
    assert.equal(body.meta.source, "mixed");
    assert.equal(body.meta.providerConfigured, true);
    assert.equal(body.meta.providers.eventbrite, false);
    assert.equal(body.meta.providers.ticketmaster, false);
    assert.equal(body.meta.providers.verifiedCalendar, true);
    assert.ok(body.data.some((event) => event.id === "verified-verified-kingston-stage"));
    assert.equal(body.data.some((event) => event.id === "verified-verified-negril-stage"), false);
  } finally {
    resetEventsHandlerStateForTest();
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
}

async function testEventsDeduplicatesVerifiedCalendarAndCuratedListings() {
  resetEventsHandlerStateForTest();
  const restoreEnv = withEnv({
    EVENTBRITE_API_KEY: undefined,
    EVENTBRITE_PRIVATE_TOKEN: undefined,
    TICKETMASTER_API_KEY: undefined,
    VITE_SUPABASE_URL: "https://verified-events.supabase.co",
    VITE_SUPABASE_ANON_KEY: "test-supabase-anon-key",
  });
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => jsonResponse([
    {
      id: "reggae-sumfest-st-ann-2026",
      title: "Reggae Sumfest",
      city: "Priory",
      region: "North Coast",
      parish: "St. Ann",
      venue: "Plantation Cove",
      start_date: "2026-07-18T19:00:00-05:00",
      date_label: "July 18, 2026",
      vibes: ["music", "nightlife"],
      price: "Ticket/pass required",
      ticket_requirement: "Festival ticket or pass required.",
      official_url: "https://reggaesumfest.com/",
      description: "Verified Reggae Sumfest listing.",
    },
  ]);

  try {
    const response = createResponse();
    await eventsHandler(
      {
        method: "GET",
        query: {
          region: "North Coast",
          parish: "St. Ann",
          latitude: "18.4029",
          longitude: "-76.974",
        },
      },
      response
    );

    assert.equal(response.statusCode, 200);
    const body = assertBody<EventsApiResponse>(response.body);
    const sumfestEvents = body.data.filter((event) => event.title === "Reggae Sumfest");
    assert.equal(sumfestEvents.length, 1);
    assert.equal(sumfestEvents[0]?.id, "verified-reggae-sumfest-st-ann-2026");
  } finally {
    resetEventsHandlerStateForTest();
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
}

async function testEventsLiveProviderNormalization() {
  resetEventsHandlerStateForTest();
  const restoreEnv = withEnv({
    EVENTBRITE_API_KEY: "legacy-eventbrite-api-key",
    EVENTBRITE_PRIVATE_TOKEN: "test-eventbrite-private-token",
    TICKETMASTER_API_KEY: "test-ticketmaster-key",
    EVENTS_CACHE_TTL_SECONDS: "60",
    VITE_SUPABASE_URL: undefined,
    VITE_SUPABASE_ANON_KEY: undefined,
  });
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, init) => {
    const requestUrl = new URL(String(url));

    if (requestUrl.origin + requestUrl.pathname === "https://www.eventbriteapi.com/v3/users/me/organizations/") {
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-eventbrite-private-token");
      return jsonResponse({
        organizations: [
          {
            id: "org-1",
          },
        ],
      });
    }

    if (requestUrl.origin + requestUrl.pathname === "https://www.eventbriteapi.com/v3/organizations/org-1/events/") {
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-eventbrite-private-token");
      assert.equal(requestUrl.searchParams.get("status"), "live");
      assert.equal(requestUrl.searchParams.get("order_by"), "start_asc");
      assert.equal(requestUrl.searchParams.get("expand"), "venue,ticket_availability");
      return jsonResponse({
        events: [
          {
            id: "eb-1",
            name: { text: "Ochi Food Night" },
            description: { text: "Live food event in Ocho Rios with music and vendors." },
            url: "https://eventbrite.example/ochi-food",
            is_free: false,
            start: { local: "2026-07-01T19:00:00" },
            venue: {
              name: "Ocho Rios Bay",
              address: { city: "Ocho Rios", country: "Jamaica" },
            },
            ticket_availability: { is_sold_out: false },
          },
        ],
      });
    }

    if (requestUrl.origin + requestUrl.pathname === "https://app.ticketmaster.com/discovery/v2/events.json") {
      assert.equal(requestUrl.searchParams.get("apikey"), "test-ticketmaster-key");
      assert.equal(requestUrl.searchParams.get("countryCode"), "JM");
      assert.equal(typeof requestUrl.searchParams.get("geoPoint"), "string");
      assert.equal(requestUrl.searchParams.get("latlong"), null);
      assert.equal(requestUrl.searchParams.get("radius"), "160");
      assert.equal(requestUrl.searchParams.get("keyword"), null);
      return jsonResponse({
        _embedded: {
          events: [
            {
              id: "tm-1",
              name: "St Ann Live Stage",
              url: "https://ticketmaster.example/st-ann-live",
              dates: {
                start: { dateTime: "2026-07-02T01:00:00Z" },
              },
              _embedded: {
                venues: [
                  {
                    name: "Plantation Cove",
                    city: { name: "Priory" },
                    country: { countryCode: "JM", name: "Jamaica" },
                    location: { latitude: "18.423", longitude: "-77.193" },
                  },
                ],
              },
              classifications: [
                {
                  segment: { name: "Music" },
                  genre: { name: "Reggae" },
                },
              ],
              priceRanges: [
                {
                  min: 40,
                  max: 90,
                  currency: "USD",
                },
              ],
            },
          ],
        },
      });
    }

    throw new Error(`Unexpected events fetch: ${String(url)}`);
  };

  try {
    const response = createResponse();
    await eventsHandler(
      {
        method: "GET",
        query: {
          region: "North Coast",
          parish: "St. Ann",
          latitude: "18.4029",
          longitude: "-76.974",
        },
      },
      response
    );

    assert.equal(response.statusCode, 200);
    const body = assertBody<EventsApiResponse>(response.body);
    assert.equal(body.meta.source, "mixed");
    assert.equal(body.meta.providerConfigured, true);
    assert.equal(body.meta.providers.eventbrite, true);
    assert.equal(body.meta.providers.ticketmaster, true);
    assert.equal(body.meta.reason, undefined);
    assert.ok(body.data.some((event) => event.id === "eventbrite-eb-1" && event.price === "Ticket/pass required"));
    assert.ok(body.data.some((event) => event.id === "ticketmaster-tm-1" && event.price === "USD 40-90"));
    assert.ok(body.data.some((event) => event.officialUrl === "https://eventbrite.example/ochi-food"));
    assert.ok(body.data.some((event) => event.officialUrl === "https://ticketmaster.example/st-ann-live"));
  } finally {
    resetEventsHandlerStateForTest();
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
}

async function testEventsTicketmasterKeywordFallback() {
  resetEventsHandlerStateForTest();
  const restoreEnv = withEnv({
    EVENTBRITE_API_KEY: undefined,
    EVENTBRITE_PRIVATE_TOKEN: undefined,
    TICKETMASTER_API_KEY: "test-ticketmaster-key",
    EVENTS_CACHE_TTL_SECONDS: "60",
    VITE_SUPABASE_URL: undefined,
    VITE_SUPABASE_ANON_KEY: undefined,
  });
  const originalFetch = globalThis.fetch;
  const ticketmasterCalls: URL[] = [];

  globalThis.fetch = async (url) => {
    const requestUrl = new URL(String(url));
    assert.equal(requestUrl.origin + requestUrl.pathname, "https://app.ticketmaster.com/discovery/v2/events.json");
    assert.equal(requestUrl.searchParams.get("apikey"), "test-ticketmaster-key");
    assert.equal(requestUrl.searchParams.get("countryCode"), "JM");
    ticketmasterCalls.push(requestUrl);

    if (requestUrl.searchParams.get("geoPoint") || requestUrl.searchParams.get("latlong")) {
      return jsonResponse({
        page: {
          totalElements: 0,
        },
      });
    }

    assert.equal(requestUrl.searchParams.get("keyword"), "st. ann north coast jamaica");
    return jsonResponse({
      _embedded: {
        events: [
          {
            id: "tm-keyword-1",
            name: "Ocho Rios Live Stage",
            url: "https://ticketmaster.example/ochi-live",
            dates: {
              start: { localDate: "2026-07-03" },
            },
            _embedded: {
              venues: [
                {
                  name: "Ocho Rios Bay",
                  city: { name: "Ocho Rios" },
                  country: { countryCode: "JM", name: "Jamaica" },
                  location: { latitude: "18.407", longitude: "-77.104" },
                },
              ],
            },
            classifications: [
              {
                segment: { name: "Music" },
                genre: { name: "Reggae" },
              },
            ],
          },
        ],
      },
    });
  };

  try {
    const response = createResponse();
    await eventsHandler(
      {
        method: "GET",
        query: {
          region: "North Coast",
          parish: "St. Ann",
          latitude: "18.4029",
          longitude: "-76.974",
        },
      },
      response
    );

    assert.equal(response.statusCode, 200);
    const body = assertBody<EventsApiResponse>(response.body);
    assert.equal(body.meta.source, "mixed");
    assert.equal(body.meta.providerConfigured, true);
    assert.equal(body.meta.providers.eventbrite, false);
    assert.equal(body.meta.providers.ticketmaster, true);
    assert.ok(body.data.some((event) => event.id === "ticketmaster-tm-keyword-1"));
    assert.equal(ticketmasterCalls.length, 3);
  } finally {
    resetEventsHandlerStateForTest();
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
}

async function testEventsRejectUntrustedProviderLocation() {
  resetEventsHandlerStateForTest();
  const restoreEnv = withEnv({
    EVENTBRITE_API_KEY: undefined,
    EVENTBRITE_PRIVATE_TOKEN: "test-eventbrite-private-token",
    TICKETMASTER_API_KEY: undefined,
    EVENTS_CACHE_TTL_SECONDS: "60",
    VITE_SUPABASE_URL: undefined,
    VITE_SUPABASE_ANON_KEY: undefined,
  });
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, init) => {
    const requestUrl = new URL(String(url));

    if (requestUrl.origin + requestUrl.pathname === "https://www.eventbriteapi.com/v3/users/me/organizations/") {
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-eventbrite-private-token");
      return jsonResponse({
        organizations: [{ id: "org-1" }],
      });
    }

    if (requestUrl.origin + requestUrl.pathname === "https://www.eventbriteapi.com/v3/organizations/org-1/events/") {
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-eventbrite-private-token");
      return jsonResponse({
        events: [
          {
            id: "eb-wrong-place",
            name: { text: "Brooklyn Rooftop Party" },
            description: { text: "A live event outside Jamaica." },
            url: "https://eventbrite.example/brooklyn",
            is_free: true,
            start: { local: "2026-07-04T19:00:00" },
            venue: {
              name: "Brooklyn Loft",
              address: { city: "Brooklyn", region: "NY", country: "United States" },
            },
          },
        ],
      });
    }

    throw new Error(`Unexpected events fetch: ${String(url)}`);
  };

  try {
    const response = createResponse();
    await eventsHandler(
      {
        method: "GET",
        query: {
          region: "Kingston",
          parish: "Kingston",
          latitude: "17.9712",
          longitude: "-76.7936",
        },
      },
      response
    );

    assert.equal(response.statusCode, 200);
    const body = assertBody<EventsApiResponse>(response.body);
    assert.equal(body.meta.source, "curated");
    assert.equal(body.meta.reason, "no-live-provider-events");
    assert.equal(body.meta.providerConfigured, true);
    assert.equal(body.data.some((event) => event.id === "eventbrite-eb-wrong-place"), false);
  } finally {
    resetEventsHandlerStateForTest();
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
}

async function testImportMetadataBlocksPrivateUrls() {
  const response = createResponse();
  await importMetadataHandler(
    {
      method: "GET",
      query: {
        url: "http://localhost:5173/private",
      },
    },
    response
  );

  assert.equal(response.statusCode, 400);
  const body = assertBody<ErrorApiResponse>(response.body);
  assert.equal(body.error, "Expected a public http(s) URL.");
}

async function testImportMetadataArticlePreview() {
  const originalLookup = dns.lookup;
  resetImportMetadataHandlerStateForTest();
  const restoreTransport = setImportMetadataFetchTransportForTest(async (url, options) => {
    assert.equal(url.hostname, "example.com");
    assert.equal(options.address, "93.184.216.34");

    if (options.method === "HEAD") {
      return new Response(null, { status: 200 });
    }

    return new Response(
      [
        "<html><head>",
        "<meta property=\"og:title\" content=\"Jamaica Food Guide\">",
        "<meta property=\"og:description\" content=\"Where to eat well\">",
        "<meta property=\"og:image\" content=\"/hero.jpg\">",
        "<meta property=\"og:site_name\" content=\"Island Notes\">",
        "</head></html>",
      ].join(""),
      {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
      }
    );
  });

  dns.lookup = (async () => [{ address: "93.184.216.34", family: 4 }]) as unknown as typeof dns.lookup;

  try {
    const response = createResponse();
    await importMetadataHandler(
      {
        method: "GET",
        query: {
          url: "https://example.com/food",
        },
      },
      response
    );

    assert.equal(response.statusCode, 200);
    const body = assertBody<ImportMetadataApiResponse>(response.body);
    assert.equal(body.data.sourcePlatform, "article");
    assert.equal(body.data.title, "Jamaica Food Guide");
    assert.equal(body.data.description, "Where to eat well");
    assert.equal(body.data.imageUrl, "https://example.com/hero.jpg");
    assert.equal(body.data.siteName, "Island Notes");
    assert.equal(body.data.confidence, "high");
  } finally {
    dns.lookup = originalLookup;
    restoreTransport();
    resetImportMetadataHandlerStateForTest();
  }
}

async function testImportMetadataBlocksPrivateDnsResolution() {
  const originalLookup = dns.lookup;
  const originalWarn = console.warn;
  resetImportMetadataHandlerStateForTest();
  let transportCalled = false;
  const restoreTransport = setImportMetadataFetchTransportForTest(async () => {
    transportCalled = true;
    throw new Error("Private DNS result should not be fetched");
  });

  dns.lookup = (async () => [{ address: "127.0.0.1", family: 4 }]) as unknown as typeof dns.lookup;
  console.warn = () => {};

  try {
    const response = createResponse();
    await importMetadataHandler(
      {
        method: "GET",
        query: {
          url: "https://private.example/food",
        },
      },
      response
    );

    assert.equal(response.statusCode, 200);
    assert.equal(transportCalled, false);
    const body = assertBody<ImportMetadataApiResponse>(response.body);
    assert.equal(body.data.reason, "metadata-unavailable");
    assert.equal(body.data.confidence, "low");
  } finally {
    dns.lookup = originalLookup;
    console.warn = originalWarn;
    restoreTransport();
    resetImportMetadataHandlerStateForTest();
  }
}

async function testRoadRouteRejectsOutOfBoundsCoordinates() {
  resetApiGuardStateForTest();
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return jsonResponse({});
  };

  try {
    const response = createResponse();
    await roadRouteHandler(
      {
        method: "GET",
        query: {
          from: "-73.9857,40.7484",
          to: "-73.9851,40.758",
        },
      },
      response
    );

    assert.equal(response.statusCode, 400);
    assert.equal(fetchCount, 0);
    const body = assertBody<ErrorApiResponse>(response.body);
    assert.equal(body.error, "Route coordinates must stay within Jamaica planning bounds.");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testRoadRouteNormalization() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({
    routes: [
      {
        geometry: {
          coordinates: [
            [-77.8939, 18.4762],
            [-78.0, 18.4],
            [-78.3488, 18.2728],
          ],
        },
        distance: 82_420,
        duration: 6_240,
        legs: [
          {
            steps: [
              {
                distance: 1200,
                duration: 360,
                name: "Queens Drive",
                maneuver: {
                  type: "depart",
                  location: [-77.8939, 18.4762],
                },
              },
              {
                distance: 9800,
                duration: 1200,
                ref: "A1",
                maneuver: {
                  type: "turn",
                  modifier: "left",
                  location: [-78.0, 18.4],
                },
              },
            ],
          },
        ],
      },
    ],
  });

  try {
    const response = createResponse();
    await roadRouteHandler(
      {
        method: "GET",
        query: {
          from: "-77.8939,18.4762",
          to: "-78.3488,18.2728",
        },
      },
      response
    );

    assert.equal(response.statusCode, 200);
    const body = assertBody<OsrmRoadRouteApiResponse>(response.body);
    assert.equal(body.meta.source, "osrm");
    assert.equal(body.meta.stepCount, 2);
    assert.equal(body.data.distanceKm, 82.4);
    assert.equal(body.data.durationMinutes, 104);
    assert.equal(body.data.steps[0]?.instruction, "Start on Queens Drive");
    assert.equal(body.data.steps[1]?.instruction, "Turn left onto A1");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function createResponse(): TestResponse {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };
}

function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return new Response(JSON.stringify(payload), {
    ...init,
    status: init.status ?? 200,
    headers,
  });
}

function assertBody<T extends object>(value: unknown): T {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
  return value as T;
}

function withEnv(values: Record<string, string | undefined>) {
  const previousValues = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]])
  );

  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });

  return () => {
    Object.entries(previousValues).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
