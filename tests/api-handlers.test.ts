import assert from "node:assert/strict";
import { promises as dns } from "node:dns";
import bookingsHandler from "../api/bookings";
import importMetadataHandler from "../api/import-metadata";
import roadRouteHandler from "../api/road-route";
import type { ApiRequest, ApiResponse } from "../src/types/api";

type TestResponse = ApiResponse & {
  statusCode: number;
  headers: Record<string, string>;
  body?: unknown;
};

async function main() {
  await testBookingsFallbackWithoutCredentials();
  await testBookingsLiveAmadeusNormalization();
  await testImportMetadataBlocksPrivateUrls();
  await testImportMetadataArticlePreview();
  await testRoadRouteNormalization();

  console.log("API handler checks passed.");
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
    assertBodyRecord(response.body);
    assert.equal(response.body.meta?.source, "fallback");
    assert.equal(response.body.meta?.reason, "missing-amadeus-credentials");
    assert.ok(Array.isArray(response.body.data));
    assert.equal(response.body.data.length, 2);
  } finally {
    restoreEnv();
  }
}

async function testBookingsLiveAmadeusNormalization() {
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
    assertBodyRecord(response.body);
    assert.equal(response.body.meta?.source, "amadeus");
    assert.equal(response.body.meta?.adults, 2);
    assert.ok(Array.isArray(response.body.data));
    assert.equal(response.body.data[0]?.title, "Harbour View Stay");
    assert.equal(response.body.data[0]?.price, 312);
    assert.deepEqual(response.body.data[0]?.perks, [
      "Current availability",
      "Breakfast",
      "Cancellation by 2026-06-01",
    ]);
    assert.equal(calls.length, 3);
  } finally {
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
  assertBodyRecord(response.body);
  assert.equal(response.body.error, "Expected a public http(s) URL.");
}

async function testImportMetadataArticlePreview() {
  const originalLookup = dns.lookup;
  const originalFetch = globalThis.fetch;

  dns.lookup = (async () => [{ address: "93.184.216.34", family: 4 }]) as unknown as typeof dns.lookup;
  globalThis.fetch = async (_url, init) => {
    if (init?.method === "HEAD") {
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
  };

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
    assertBodyRecord(response.body);
    assert.equal(response.body.data?.sourcePlatform, "article");
    assert.equal(response.body.data?.title, "Jamaica Food Guide");
    assert.equal(response.body.data?.description, "Where to eat well");
    assert.equal(response.body.data?.imageUrl, "https://example.com/hero.jpg");
    assert.equal(response.body.data?.siteName, "Island Notes");
    assert.equal(response.body.data?.confidence, "high");
  } finally {
    dns.lookup = originalLookup;
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
    assertBodyRecord(response.body);
    assert.equal(response.body.meta?.source, "osrm");
    assert.equal(response.body.meta?.stepCount, 2);
    assert.equal(response.body.data?.distanceKm, 82.4);
    assert.equal(response.body.data?.durationMinutes, 104);
    assert.equal(response.body.data?.steps[0]?.instruction, "Start on Queens Drive");
    assert.equal(response.body.data?.steps[1]?.instruction, "Turn left onto A1");
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

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

function assertBodyRecord(value: unknown): asserts value is Record<string, any> {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
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
