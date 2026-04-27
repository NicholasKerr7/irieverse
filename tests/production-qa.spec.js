const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const BASE_URL = process.env.IRIEVERSE_PRODUCTION_URL ?? "https://irieverse.vercel.app";
const SCREENSHOT_DIR = path.join(process.cwd(), "public", "screenshots");

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
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  await verifyProductionAssets(request);
  await verifyRoadRouteApi(request);

  await openTab(page, "");
  await expect(page).toHaveTitle(/IrieVerse/);
  await expect(page.getByText("IrieVerse Travel OS").first()).toBeVisible();
  await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();
  await expect(page.getByTestId("desktop-header-nav")).toBeHidden();
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
  await expect(page.getByText("IrieVerse Map")).toBeVisible();
  await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();
  await expect(page.getByTestId("desktop-header-nav")).toBeHidden();
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(4500);
  await screenshot(page, "mobile-map.png");

  await openSharedIdea(page);
  await expect(page.getByText("Your Jamaica boards.")).toBeVisible();
  await expect(page.getByText("Shared idea ready to save")).toBeVisible();
  await expect(page.locator('input[type="url"]')).toHaveValue("https://maps.google.com/?q=Blue+Mountain+Coffee+Jamaica");
  await expect(page.locator('input[type="text"]')).toHaveValue("QA Blue Mountain coffee stop");
  await expect(page.locator("textarea")).toHaveValue("Production QA import idea attached to a Jamaica board.");
  await expect(page).not.toHaveURL(/shared_url=/);
  await page.locator("select").nth(1).selectOption({ index: 1 });
  await page.getByRole("button", { name: /Save to Irieverse/ }).click();
  await expect(page.getByText("Imported idea saved")).toBeVisible();
  await expect(page.getByText("QA Blue Mountain coffee stop")).toBeVisible();
  await screenshot(page, "mobile-saved-import.png");

  await page.getByRole("button", { name: /^Trip$/ }).first().click();
  await expect(page.getByText("Build your Jamaica plan.")).toBeVisible();
  await expect(page.getByText("Upcoming trip")).toBeVisible();
  await screenshot(page, "mobile-trips.png");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export ICS/ }).last().click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/irieverse.*\.ics$/i);

  const shareButton = page.getByRole("button", { name: /^Share$/ }).last();
  if (await shareButton.isEnabled()) {
    await shareButton.click();
    await expect(page.getByText(/Share link updated|Unable to share trip right now/)).toBeVisible({ timeout: 15000 });
    const shareUrl = await page
      .locator('input[placeholder="Create a share link to collaborate"]')
      .inputValue()
      .catch(() => "");
    const sharedTripId = extractSharedTripId(shareUrl);
    if (sharedTripId) {
      await cleanupSharedTrip(request, supabaseRest.getCredentials(), sharedTripId, qaRunId);
    }
  } else {
    await expect(page.getByText(/enable live sharing/i)).toBeVisible();
  }

  expect(issues).toEqual([]);
});

test("production desktop map screenshot", async ({ browser }) => {
  const page = await browser.newPage({
    colorScheme: "dark",
    viewport: { width: 1440, height: 1000 },
  });
  const issues = collectPageIssues(page);

  await openTab(page, "map");
  await expect(page.getByText("IrieVerse Map")).toBeVisible();
  await expect(page.getByTestId("desktop-header-nav")).toBeVisible();
  await expect(page.getByTestId("mobile-bottom-nav")).toBeHidden();
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(4500);
  await screenshot(page, "desktop-map.png");

  expect(issues).toEqual([]);
  await page.close();
});

async function openTab(page, tab) {
  const url = tab ? `${BASE_URL}/?tab=${tab}` : BASE_URL;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await expectVisibleNavigation(page);
}

async function openSharedIdea(page) {
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

async function expectVisibleNavigation(page) {
  const viewport = page.viewportSize();
  if (viewport && viewport.width >= 768) {
    await expect(page.getByTestId("desktop-header-nav")).toBeVisible();
    await expect(page.getByTestId("mobile-bottom-nav")).toBeHidden();
    return;
  }

  await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();
  await expect(page.getByTestId("desktop-header-nav")).toBeHidden();
}

async function screenshot(page, filename) {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, filename),
    fullPage: false,
  });
}

function collectPageIssues(page) {
  const issues = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      issues.push(`console: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    issues.push(`pageerror: ${error.message}`);
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    const failureText = request.failure()?.errorText ?? "";
    if (url.endsWith("/media/hero.mp4") && failureText.includes("ERR_ABORTED")) return;
    if (url.startsWith(BASE_URL)) {
      issues.push(`requestfailed: ${url} ${failureText}`.trim());
    }
  });

  return issues;
}

function trackSupabaseRest(page) {
  let credentials = null;

  page.on("request", (request) => {
    const requestUrl = request.url();
    if (!requestUrl.includes(".supabase.co/rest/v1/trips")) return;

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

function extractSharedTripId(shareUrl) {
  if (!shareUrl) return null;
  try {
    return new URL(shareUrl).searchParams.get("trip");
  } catch {
    return null;
  }
}

async function cleanupSharedTrip(request, credentials, tripId, qaRunId) {
  expect(credentials, "Supabase REST request credentials should be captured").toBeTruthy();

  const tripFilter = `id=eq.${encodeURIComponent(tripId)}`;
  const tripEndpoint = `${credentials.origin}/rest/v1/trips`;
  const headers = {
    apikey: credentials.apiKey,
    authorization: credentials.authorization,
    "content-type": "application/json",
  };

  const fetchResponse = await request.get(`${tripEndpoint}?${tripFilter}&select=data`, { headers });
  expect(fetchResponse.ok(), "shared QA trip should be readable before cleanup").toBe(true);
  const rows = await fetchResponse.json();
  expect(rows).toHaveLength(1);

  const markedData = {
    ...(rows[0].data ?? {}),
    qa: {
      source: "production-qa",
      runId: qaRunId,
      markedAt: new Date().toISOString(),
    },
  };

  const markResponse = await request.patch(`${tripEndpoint}?${tripFilter}`, {
    headers: {
      ...headers,
      prefer: "return=minimal",
    },
    data: {
      data: markedData,
    },
  });
  expect(markResponse.ok(), "shared QA trip should be marked for cleanup").toBe(true);

  const deleteResponse = await request.delete(`${tripEndpoint}?${tripFilter}`, {
    headers: {
      ...headers,
      prefer: "return=minimal",
    },
  });
  expect(deleteResponse.ok(), "marked QA trip should be deleted").toBe(true);

  const verifyResponse = await request.get(`${tripEndpoint}?${tripFilter}&select=id`, { headers });
  expect(verifyResponse.ok(), "cleanup verification query should succeed").toBe(true);
  expect(await verifyResponse.json()).toEqual([]);
}

async function verifyProductionAssets(request) {
  const assetPaths = [
    "/",
    "/?tab=map",
    "/manifest.webmanifest",
    "/icon-192.png",
    "/icon-512.png",
    "/apple-touch-icon.png",
    "/sw.js",
  ];

  for (const assetPath of assetPaths) {
    const response = await request.get(`${BASE_URL}${assetPath}`);
    expect(response.ok(), `${assetPath} should return 2xx`).toBe(true);
  }

  const manifest = await (await request.get(`${BASE_URL}/manifest.webmanifest`)).json();
  expect(manifest.icons.map((icon) => icon.src)).toEqual(
    expect.arrayContaining(["/icon-192.png", "/icon-512.png", "/icon.svg"])
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
      "/screenshots/desktop-map.png",
    ])
  );
}

async function verifyRoadRouteApi(request) {
  const response = await request.get(
    `${BASE_URL}/api/road-route?from=-77.8939,18.4762&to=-78.3488,18.2728`
  );
  expect(response.ok()).toBe(true);
  const payload = await response.json();
  expect(payload.data?.source).toBe("osrm");
  expect(payload.data?.coordinates?.length).toBeGreaterThan(100);
  expect(payload.data?.distanceKm).toBeGreaterThan(1);
}
