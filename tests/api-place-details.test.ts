import assert from "node:assert/strict";
import placeDetailsHandler from "../api/place-details";
import type { ApiRequest, ApiResponse } from "../src/types/api";

const query = {
  kind: "destination",
  name: "Montego Bay",
  region: "North Coast",
  latitude: "18.4762",
  longitude: "-77.8939",
  placeQuery: "Doctor's Cave Beach, Montego Bay, Jamaica",
  requiredTerms: "doctor,cave",
  blockedTerms: "imaging,diagnostic,medical,clinic,radiology",
};

async function main() {
  process.env.GOOGLE_PLACES_API_KEY = "test-google-places-key";

  const addressOnlyMatch = await invokePlaceDetails(query, [
    buildPlace({
      name: "Beach View Gift Shop",
      address: "Doctor's Cave Beach Plaza, Montego Bay, Jamaica",
      primaryType: "Store",
      types: ["store", "point_of_interest"],
    }),
  ]);

  assert.equal(addressOnlyMatch.statusCode, 200);
  assert.equal(addressOnlyMatch.body.data, null);
  assert.equal(addressOnlyMatch.body.meta.source, "curated");

  const blockedBusinessMatch = await invokePlaceDetails(query, [
    buildPlace({
      name: "Northcoast Imaging Limited",
      address: "Doctor's Cave Beach Plaza, Montego Bay, Jamaica",
      primaryType: "Medical Diagnostic Imaging Center",
      types: ["health", "point_of_interest"],
    }),
  ]);

  assert.equal(blockedBusinessMatch.statusCode, 200);
  assert.equal(blockedBusinessMatch.body.data, null);
  assert.equal(blockedBusinessMatch.body.meta.source, "curated");

  const trustedPlaceMatch = await invokePlaceDetails(query, [
    buildPlace({
      name: "Northcoast Imaging Limited",
      address: "Doctor's Cave Beach Plaza, Montego Bay, Jamaica",
      primaryType: "Medical Diagnostic Imaging Center",
      types: ["health", "point_of_interest"],
    }),
    buildPlace({
      name: "Doctor's Cave Beach",
      address: "Gloucester Avenue, Montego Bay, Jamaica",
      primaryType: "Beach",
      types: ["beach", "tourist_attraction", "point_of_interest"],
      rating: 4.5,
    }),
  ]);

  assert.equal(trustedPlaceMatch.statusCode, 200);
  assert.equal(trustedPlaceMatch.body.meta.source, "google-places");
  assert.equal(trustedPlaceMatch.body.data.name, "Doctor's Cave Beach");
  assert.equal(trustedPlaceMatch.body.data.primaryType, "Beach");

  console.log("API place-details trust checks passed.");
}

type TestPlace = ReturnType<typeof buildPlace>;

async function invokePlaceDetails(query: ApiRequest["query"], places: TestPlace[]) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ places }),
  }) as Response;

  try {
    const response = createResponse();
    await placeDetailsHandler({ method: "GET", query }, response);
    return response;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function buildPlace({
  name,
  address,
  primaryType,
  types,
  rating,
}: {
  name: string;
  address: string;
  primaryType: string;
  types: string[];
  rating?: number;
}) {
  return {
    id: `places/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    displayName: { text: name },
    formattedAddress: address,
    shortFormattedAddress: address.replace(", Jamaica", ""),
    location: {
      latitude: 18.4762,
      longitude: -77.8939,
    },
    googleMapsUri: "https://maps.google.com/?cid=test",
    rating,
    userRatingCount: rating ? 128 : undefined,
    primaryTypeDisplayName: { text: primaryType },
    types,
  };
}

type TestResponse = ApiResponse & {
  statusCode: number;
  headers: Record<string, string>;
  body?: unknown;
};

function createResponse(): TestResponse {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
