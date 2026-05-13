const assert = require("node:assert/strict");
const placeDetailsHandler = require("../api/place-details.js");

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

async function invokePlaceDetails(query, places) {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ places }),
  });

  try {
    const response = createResponse();
    await placeDetailsHandler({ method: "GET", query }, response);
    return response;
  } finally {
    global.fetch = originalFetch;
  }
}

function buildPlace({
  name,
  address,
  primaryType,
  types,
  rating,
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

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
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
