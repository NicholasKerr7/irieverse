import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type {
  FlightApiResponse,
  ImportMetadataApiResponse,
  PlaceDetailsApiResponse,
  RoadRouteApiResponse,
} from "../src/types/api";

const BASE_URL = process.env.IRIEVERSE_PRODUCTION_URL ?? "https://irieverse.vercel.app";
const SCREENSHOT_DIR = path.join(process.cwd(), "public", "screenshots");

type SupabaseRestCredentials = {
  origin: string;
  apiKey: string;
  authorization: string;
};

type SupabaseRestTracker = {
  getCredentials: () => SupabaseRestCredentials | null;
};

type WebManifest = {
  icons: Array<{ src: string; purpose?: string }>;
  shortcuts: Array<{ url: string }>;
  share_target: {
    action: string;
    method: string;
    params: {
      title: string;
      text: string;
      url: string;
    };
  };
  screenshots: Array<{ src: string }>;
};

test.setTimeout(240_000);

test.use({
  acceptDownloads: true,
  colorScheme: "dark",
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  viewport: { width: 390, height: 844 },
});

test("production mobile flows, screenshots, and live integrations", async ({ page, request }) => {
  const issues = collectPageIssues(page);
  const qaRunId = `production-qa-${Date.now()}`;
  const supabaseRest = trackSupabaseRest(page);
  let sharedTripCleanup: { tripId: string; editToken: string } | null = null;
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  await verifyProductionAssets(request);
  await verifyFlightApi(request);
  await verifyImportMetadataApi(request);
  await verifyPlaceDetailsApi(request);
  await verifyRoadRouteApi(request);

  await openTab(page, "");
  await expect(page).toHaveTitle(/IrieVerse/);
  await expect(page.getByText("Plan Jamaica with IrieVerse").first()).toBeVisible();
  await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();
  await expect(page.getByTestId("desktop-header-nav")).toBeHidden();
  await expectHeroVideoReady(page);
  await screenshot(page, "mobile-home.png");

  await openTab(page, "explore");
  await expect(page.getByText("Explore Jamaica")).toBeVisible();
  await page.getByRole("button", { name: "Save destination" }).first().click();
  await expect(page.getByRole("button", { name: "Remove from saved" }).first()).toBeVisible();
  await screenshot(page, "mobile-explore-places.png");

  await page.getByRole("button", { name: /Experiences/ }).first().click();
  await expect(page.getByText("Experiences").first()).toBeVisible();
  await screenshot(page, "mobile-explore-experiences.png");

  await openTab(page, "map");
  await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();
  await expect(page.getByTestId("desktop-header-nav")).toBeHidden();
  await expectMapCanvasReady(page);
  await page.waitForTimeout(4500);
  await screenshot(page, "mobile-map.png");

  await openSharedIdea(page);
  await expect(page.getByText("Your Jamaica boards.")).toBeVisible();
  await expect(page.getByText("Shared idea ready to save")).toBeVisible();
  await expect(page.getByText("Google Maps").first()).toBeVisible();
  await expect(page.getByText("Food").first()).toBeVisible();
  await expect(page.locator('input[type="url"]')).toHaveValue("https://maps.google.com/?q=Blue+Mountain+Coffee+Jamaica");
  await expect(page.locator('input[type="text"]')).toHaveValue("QA Blue Mountain coffee stop");
  await expect(page.locator("textarea")).toHaveValue("Production QA import idea attached to a Jamaica board.");
  await expect(page).not.toHaveURL(/shared_url=/);
  await page.locator("select").nth(1).selectOption({ index: 1 });
  await page.getByRole("button", { name: /Save to Irieverse/ }).click();
  await expect(page.getByText("Imported idea saved")).toBeVisible();
  await expect(page.getByText("QA Blue Mountain coffee stop")).toBeVisible();
  await screenshot(page, "mobile-saved-import.png");

  await page.getByTestId("mobile-bottom-nav").getByRole("button", { name: /^Trips$/ }).click();
  await expect(page.getByText("Build your Jamaica trip.")).toBeVisible();
  await expect(page.getByText("Upcoming trip")).toBeVisible();
  await screenshot(page, "mobile-trips.png");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export calendar/ }).last().click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/irieverse.*\.ics$/i);

  const shareButton = page.getByRole("button", { name: /^(Create link|Update link|Save copy)$/ }).last();
  if (await shareButton.isEnabled()) {
    await shareButton.click();
    await expect(page.getByText(/Share link (created|updated)|Share links need one more setup step|Share links are unavailable|Share links are blocked|The share link was not created/)).toBeVisible({ timeout: 15000 });
    const shareUrl = await page
      .locator('input[placeholder="Create a view-only share link"]')
      .inputValue()
      .catch(() => "");
    const sharedTripId = extractSharedTripId(shareUrl);
    if (sharedTripId) {
      const editToken = await page.evaluate((tripId) => {
        const tokens = JSON.parse(window.localStorage.getItem("irieverse_trip_edit_tokens") || "{}");
        return tokens[tripId] || "";
      }, sharedTripId);
      sharedTripCleanup = { tripId: sharedTripId, editToken };
    }
  } else {
    await expect(page.getByText("Share links unavailable").first()).toBeVisible();
  }

  expect(issues).toEqual([]);

  if (sharedTripCleanup) {
    await cleanupSharedTrip(
      request,
      supabaseRest.getCredentials(),
      sharedTripCleanup.tripId,
      sharedTripCleanup.editToken,
      qaRunId
    );
  }
});

test("production desktop map screenshot", async ({ browser }) => {
  const page = await browser.newPage({
    colorScheme: "dark",
    viewport: { width: 1440, height: 1000 },
  });
  const issues = collectPageIssues(page);

  await openTab(page, "map");
  await expect(page.getByTestId("desktop-header-nav")).toBeVisible();
  await expect(page.getByTestId("mobile-bottom-nav")).toBeHidden();
  await expectMapCanvasReady(page);
  await expect(page.getByText("IrieVerse Map")).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(4500);
  await screenshot(page, "desktop-map.png");

  expect(issues).toEqual([]);
  await page.close();
});

test("production desktop home uses hero navigation", async ({ browser }) => {
  const page = await browser.newPage({
    colorScheme: "dark",
    viewport: { width: 1440, height: 1000 },
  });
  const issues = collectPageIssues(page);

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await expect(page.getByTestId("hero-desktop-nav")).toBeVisible();
  await expect(page.getByTestId("desktop-header-nav")).toBeHidden();
  await expect(page.getByTestId("mobile-bottom-nav")).toBeHidden();
  await expectHeroVideoReady(page);
  await screenshot(page, "desktop-home.png");

  await page.getByTestId("hero-desktop-nav").getByRole("button", { name: "Map" }).click();
  await expect(page).toHaveURL(/tab=map/);
  await expect(page.getByTestId("desktop-header-nav")).toBeVisible();

  expect(issues).toEqual([]);
  await page.close();
});

async function openTab(page: Page, tab: string) {
  const url = tab ? `${BASE_URL}/?tab=${tab}` : BASE_URL;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await expectVisibleNavigation(page);
}

async function openSharedIdea(page: Page) {
  const params = new URLSearchParams({
    tab: "saved",
    source: "share-target",
    shared_title: "QA Blue Mountain coffee stop",
    shared_url: "https://maps.google.com/?q=Blue+Mountain+Coffee+Jamaica",
    shared_text: "Production QA import idea attached to a Jamaica board.",
  });

  await page.goto(`${BASE_URL}/?${params}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await expectVisibleNavigation(page);
}

async function expectVisibleNavigation(page: Page) {
  const viewport = page.viewportSize();
  if (viewport && viewport.width >= 768) {
    const tab = new URL(page.url()).searchParams.get("tab");
    if (!tab) {
      await expect(page.getByTestId("hero-desktop-nav")).toBeVisible();
      await expect(page.getByTestId("desktop-header-nav")).toBeHidden();
      await expect(page.getByTestId("mobile-bottom-nav")).toBeHidden();
      return;
    }

    await expect(page.getByTestId("desktop-header-nav")).toBeVisible();
    await expect(page.getByTestId("mobile-bottom-nav")).toBeHidden();
    return;
  }

  await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();
  await expect(page.getByTestId("desktop-header-nav")).toBeHidden();
}

async function expectMapCanvasReady(page: Page) {
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 30000 });
}

async function screenshot(page: Page, filename: string) {
  await page.waitForTimeout(350);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, filename),
    fullPage: false,
  });
}

async function expectHeroVideoReady(page: Page) {
  const video = page.locator('video[src$="/media/hero.mp4"], video[src="/media/hero.mp4"]').first();
  await expect(video).toBeVisible();

  const playback = await video.evaluate(async (element) => {
    const videoElement = element as HTMLVideoElement;
    const haveCurrentData = 2;

    videoElement.muted = true;
    videoElement.playsInline = true;
    if (videoElement.networkState === HTMLMediaElement.NETWORK_EMPTY) {
      videoElement.load();
    }
    await videoElement.play().catch(() => {});

    await new Promise<void>((resolve) => {
      if (videoElement.readyState >= haveCurrentData || videoElement.error) {
        resolve();
        return;
      }

      const finish = () => resolve();
      videoElement.addEventListener("loadeddata", finish, { once: true });
      videoElement.addEventListener("canplay", finish, { once: true });
      videoElement.addEventListener("error", finish, { once: true });
      window.setTimeout(finish, 20000);
    });

    return {
      duration: Number.isFinite(videoElement.duration) ? videoElement.duration : 0,
      errorCode: videoElement.error?.code ?? null,
      networkState: videoElement.networkState,
      readyState: videoElement.readyState,
      videoHeight: videoElement.videoHeight,
      videoWidth: videoElement.videoWidth,
    };
  });

  expect(playback.errorCode, "hero video should not report a media decode error").toBeNull();
  expect(playback.readyState, "hero video should have decoded current frame data").toBeGreaterThanOrEqual(2);
  expect(playback.videoWidth, "hero video should expose decoded video width").toBeGreaterThan(0);
  expect(playback.videoHeight, "hero video should expose decoded video height").toBeGreaterThan(0);
  expect(playback.duration, "hero video should expose a finite duration").toBeGreaterThan(1);
}

function collectPageIssues(page: Page): string[] {
  const issues: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      if (isIgnorableHeroVideoFailure(message.location().url, message.text())) return;
      issues.push(`console: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    issues.push(`pageerror: ${error.message}`);
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    const failureText = request.failure()?.errorText ?? "";
    if (isIgnorableHeroVideoFailure(url, failureText)) return;
    if (url.includes("/api/road-route") && failureText.includes("ERR_ABORTED")) return;
    if (url.startsWith(BASE_URL)) {
      issues.push(`requestfailed: ${url} ${failureText}`.trim());
    }
  });

  return issues;
}

function isIgnorableHeroVideoFailure(url: string, failureText: string): boolean {
  return url.endsWith("/media/hero.mp4") && failureText.includes("ERR_ABORTED");
}

function trackSupabaseRest(page: Page): SupabaseRestTracker {
  let credentials: SupabaseRestCredentials | null = null;

  page.on("request", (request) => {
    const requestUrl = request.url();
    if (!requestUrl.includes(".supabase.co/rest/v1/")) return;

    const headers = request.headers();
    if (!headers.apikey || !headers.authorization) return;

    credentials = {
      origin: new URL(requestUrl).origin,
      apiKey: headers.apikey,
      authorization: headers.authorization,
    };
  });

  return {
    getCredentials: () => credentials,
  };
}

function extractSharedTripId(shareUrl: string): string | null {
  if (!shareUrl) return null;
  try {
    return new URL(shareUrl).searchParams.get("trip");
  } catch {
    return null;
  }
}

async function cleanupSharedTrip(
  request: APIRequestContext,
  credentials: SupabaseRestCredentials | null,
  tripId: string,
  editToken: string,
  qaRunId: string
) {
  if (!credentials) {
    throw new Error("Supabase REST request credentials should be captured.");
  }
  if (!editToken) {
    throw new Error("local edit token should be stored for QA cleanup.");
  }

  const rpcEndpoint = `${credentials.origin}/rest/v1/rpc`;
  const headers = {
    apikey: credentials.apiKey,
    authorization: credentials.authorization,
    "content-type": "application/json",
  };
  const editTokenHash = crypto.createHash("sha256").update(editToken).digest("hex");

  const fetchResponse = await request.post(`${rpcEndpoint}/read_trip_share`, {
    headers,
    data: { p_trip_id: tripId },
  });
  expect(fetchResponse.ok(), "shared QA trip should be readable before cleanup").toBe(true);
  const tripData = await fetchResponse.json();

  const markedData = {
    ...(tripData ?? {}),
    qa: {
      source: "production-qa",
      runId: qaRunId,
      markedAt: new Date().toISOString(),
    },
  };

  const markResponse = await request.post(`${rpcEndpoint}/update_trip_share`, {
    headers,
    data: {
      p_trip_id: tripId,
      p_trip_data: markedData,
      p_edit_token_hash: editTokenHash,
    },
  });
  expect(markResponse.ok(), "shared QA trip should be marked for cleanup").toBe(true);

  const deleteResponse = await request.post(`${rpcEndpoint}/delete_trip_share`, {
    headers,
    data: {
      p_trip_id: tripId,
      p_edit_token_hash: editTokenHash,
    },
  });
  expect(deleteResponse.ok(), "marked QA trip should be deleted").toBe(true);

  const verifyResponse = await request.post(`${rpcEndpoint}/read_trip_share`, {
    headers,
    data: { p_trip_id: tripId },
  });
  expect(verifyResponse.ok(), "deleted QA trip should no longer be readable").toBe(false);
}

async function verifyProductionAssets(request: APIRequestContext) {
  const assetPaths = [
    "/",
    "/?tab=map",
    "/manifest.webmanifest",
    "/favicon-16.png",
    "/favicon-32.png",
    "/icon-72.png",
    "/icon-96.png",
    "/icon-128.png",
    "/icon-144.png",
    "/icon-192.png",
    "/icon-384.png",
    "/icon-512.png",
    "/icon-1024.png",
    "/maskable-icon-192.png",
    "/maskable-icon-512.png",
    "/apple-touch-icon.png",
    "/sw.js",
  ];

  for (const assetPath of assetPaths) {
    const response = await request.get(`${BASE_URL}${assetPath}`);
    expect(response.ok(), `${assetPath} should return 2xx`).toBe(true);
  }

  const manifest = await (await request.get(`${BASE_URL}/manifest.webmanifest`)).json() as WebManifest;
  expect(manifest.icons.map((icon) => icon.src)).toEqual(
    expect.arrayContaining([
      "/icon-72.png",
      "/icon-96.png",
      "/icon-128.png",
      "/icon-144.png",
      "/icon-192.png",
      "/icon-384.png",
      "/icon-512.png",
      "/icon-1024.png",
      "/maskable-icon-192.png",
      "/maskable-icon-512.png",
    ])
  );
  expect(manifest.icons.filter((icon) => icon.purpose === "maskable").map((icon) => icon.src)).toEqual(
    expect.arrayContaining(["/maskable-icon-192.png", "/maskable-icon-512.png"])
  );
  expect(manifest.shortcuts.map((shortcut) => shortcut.url)).toEqual(
    expect.arrayContaining(["/?tab=explore", "/?tab=map", "/?tab=trips"])
  );
  expect(manifest.share_target).toMatchObject({
    action: "/?tab=saved&source=share-target",
    method: "GET",
    params: {
      title: "shared_title",
      text: "shared_text",
      url: "shared_url",
    },
  });
  expect(manifest.screenshots.map((screenshot) => screenshot.src)).toEqual(
    expect.arrayContaining([
      "/screenshots/mobile-home.png",
      "/screenshots/mobile-map.png",
      "/screenshots/desktop-home.png",
      "/screenshots/desktop-map.png",
    ])
  );
}

async function verifyRoadRouteApi(request: APIRequestContext) {
  const response = await request.get(
    `${BASE_URL}/api/road-route?from=-77.8939,18.4762&to=-78.3488,18.2728`
  );
  expect(response.ok()).toBe(true);
  const payload = await response.json() as RoadRouteApiResponse;
  expect(payload.data?.source).toBe("osrm");
  expect(payload.meta.source).toBe("osrm");
  if (!payload.data || payload.meta.source !== "osrm") {
    throw new Error("Expected OSRM road route response.");
  }
  expect(payload.data.coordinates.length).toBeGreaterThan(100);
  expect(payload.data.distanceKm).toBeGreaterThan(1);
  expect(Array.isArray(payload.data.steps)).toBe(true);
  expect(payload.data.steps.length).toBeGreaterThan(1);
  expect(payload.data.steps[0]).toEqual(
    expect.objectContaining({
      instruction: expect.any(String),
      direction: expect.any(String),
      maneuverType: expect.any(String),
    })
  );
  expect(payload.meta.stepCount).toBeGreaterThan(1);
}

async function verifyPlaceDetailsApi(request: APIRequestContext) {
  const response = await request.get(
    `${BASE_URL}/api/place-details?kind=destination&name=Negril&region=West%20Coast&latitude=18.2728&longitude=-78.3488&placeQuery=${encodeURIComponent("Seven Mile Beach, Negril, Jamaica")}&requiredTerms=seven,mile`
  );
  expect(response.ok()).toBe(true);
  const payload = await response.json() as PlaceDetailsApiResponse;
  expect(["google-places", "curated"]).toContain(payload.meta?.source);
  expect(typeof payload.meta?.providerConfigured).toBe("boolean");
  if (payload.data) {
    expect(payload.data).toEqual(
      expect.objectContaining({
        source: "google-places",
        mapsUrl: expect.any(String),
      })
    );
  }

  const mobayResponse = await request.get(
    `${BASE_URL}/api/place-details?kind=destination&name=Montego%20Bay&region=North%20Coast&latitude=18.4762&longitude=-77.8939&placeQuery=${encodeURIComponent("Doctor's Cave Beach, Montego Bay, Jamaica")}&requiredTerms=doctor,cave&blockedTerms=imaging,diagnostic,medical,clinic,radiology`
  );
  expect(mobayResponse.ok()).toBe(true);
  const mobayPayload = await mobayResponse.json() as PlaceDetailsApiResponse;
  expect(["google-places", "curated"]).toContain(mobayPayload.meta?.source);
  if (mobayPayload.data) {
    const resultText = [
      mobayPayload.data.name,
      mobayPayload.data.address,
      mobayPayload.data.primaryType,
      ...(mobayPayload.data.types ?? []),
    ].join(" ");
    expect(resultText).toMatch(/doctor|cave/i);
    expect(resultText).not.toMatch(/northcoast|imaging|diagnostic|medical|clinic|radiology/i);
  }
}

async function verifyImportMetadataApi(request: APIRequestContext) {
  const response = await request.get(
    `${BASE_URL}/api/import-metadata?url=${encodeURIComponent("https://www.google.com/maps/place/Devon+House,+Kingston,+Jamaica")}`
  );
  expect(response.ok()).toBe(true);
  const payload = await response.json() as ImportMetadataApiResponse;
  expect(payload.data).toEqual(
    expect.objectContaining({
      sourcePlatform: "google-maps",
      sourceLabel: "Google Maps",
      title: expect.any(String),
    })
  );
  if (payload.data?.confidence === "high") {
    expect(payload.data.place).toEqual(
      expect.objectContaining({
        mapsUrl: expect.any(String),
      })
    );
  }
  expect(["high", "medium", "low"]).toContain(payload.data?.confidence);
}

async function verifyFlightApi(request: APIRequestContext) {
  const response = await request.get(
    `${BASE_URL}/api/flights?origin=JFK&destination=MBJ`
  );
  expect(response.ok()).toBe(true);
  const payload = await response.json() as FlightApiResponse;
  expect(Array.isArray(payload.data)).toBe(true);
  expect(["aviationstack", "fallback"]).toContain(payload.meta?.source);
  expect(typeof payload.meta?.providerConfigured).toBe("boolean");
}
