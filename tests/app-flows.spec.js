const { test, expect } = require("@playwright/test");

test("saved import updates duplicate links instead of adding clutter", async ({ page }) => {
  const issues = collectPageIssues(page);

  await page.route("**/api/import-metadata**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          url: "https://www.google.com/maps/place/Devon+House,+Kingston,+Jamaica",
          finalUrl: "https://maps.google.com/?cid=devon-house",
          sourcePlatform: "google-maps",
          sourceLabel: "Google Maps",
          title: "Devon House",
          description: "26 Hope Road, Kingston · Restaurant · 4.6 rating from 248 reviews",
          siteName: "Google Maps",
          confidence: "high",
          place: {
            name: "Devon House",
            address: "26 Hope Road, Kingston, Jamaica",
            shortAddress: "26 Hope Road, Kingston",
            latitude: 18.0179,
            longitude: -76.7875,
            mapsUrl: "https://maps.google.com/?cid=devon-house",
            rating: 4.6,
            userRatingCount: 248,
            primaryType: "Restaurant",
          },
        },
      }),
    });
  });

  await openCleanTab(page, "saved", [
    "irieverse_imported_ideas",
    "irieverse_saved_collections",
    "irieverse_imported_idea_days",
  ]);

  const urlInput = page.getByPlaceholder("https://maps.google.com/... or social link");
  const titleInput = page.getByPlaceholder("Jerk stop in Port Antonio");
  const noteInput = page.getByPlaceholder("Why this belongs in the trip");
  const saveButton = page.getByRole("button", { name: "Save to Irieverse" });

  await urlInput.fill("https://www.google.com/maps/place/Devon+House,+Kingston,+Jamaica?utm_source=qa#details");
  await expect(page.getByText("26 Hope Road, Kingston").first()).toBeVisible();
  await titleInput.fill("Devon House ice cream");
  await noteInput.fill("First note.");
  await saveButton.click();
  await waitForImportedIdeas(page, (ideas) => ideas.length === 1);

  await urlInput.fill("https://google.com/maps/place/Devon+House,+Kingston,+Jamaica");
  await titleInput.fill("Devon House stop");
  await noteInput.fill("Updated note for the same saved link.");
  await saveButton.click();

  const ideas = await waitForImportedIdeas(
    page,
    (items) => items.length === 1 && items[0].title === "Devon House stop" && items[0].note.includes("Updated note")
  );

  expect(ideas[0]).toEqual(
    expect.objectContaining({
      sourcePlatform: "google-maps",
      linkedDestinationId: "kingston",
      place: expect.objectContaining({
        shortAddress: "26 Hope Road, Kingston",
        primaryType: "Restaurant",
        rating: 4.6,
      }),
    })
  );
  expect(ideas[0].extractedPlaceName.toLowerCase()).toContain("devon house");
  await expect(page.getByText("Imported idea updated")).toBeVisible();

  await openCleanTab(page, "map", []);
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 15000 });
  await expect(page.getByRole("button", { name: "Open saved idea Devon House" })).toBeVisible();
  await page.getByRole("button", { name: "Open saved idea Devon House" }).click();
  await expect(page.getByTestId("imported-place-detail-sheet").getByText("26 Hope Road, Kingston").first()).toBeVisible();
  await page.getByLabel("Close saved idea details").click();
  const mapDrawer = page.getByTestId("map-trip-drawer");
  await mapDrawer.getByRole("button", { name: "Unplanned" }).click();
  await expect(mapDrawer.getByText("Good Jamaica ideas to add next.")).toBeVisible();
  await expect(mapDrawer.getByText("Devon House", { exact: true })).toHaveCount(0);
  await mapDrawer.getByRole("button", { name: "Overview" }).click();
  await mapDrawer.getByRole("button", { name: /Kingston/ }).first().click();
  await expect(mapDrawer.getByText("Exact stops from your board")).toBeVisible();
  await expect(mapDrawer.getByRole("button", { name: "Open exact stop Devon House" })).toBeVisible();
  await mapDrawer.getByLabel("Move Devon House to day").selectOption("1");
  await expectLocalStorage(page, "irieverse_imported_idea_days", (assignments) => Object.values(assignments).includes("1"));
  await mapDrawer.getByRole("button", { name: /Day 1/ }).click();
  await expect(mapDrawer.getByRole("button", { name: "Open exact stop Devon House" })).toBeVisible();
  await expect(mapDrawer.getByText("1 saved stop pinned into this day.")).toBeVisible();

  await openCleanTab(page, "trips", []);
  const exactStopBadge = page.getByText("Exact stop").first();
  await exactStopBadge.scrollIntoViewIfNeeded();
  await expect(exactStopBadge).toBeVisible();
  await expect(page.getByText(/26 Hope Road, Kingston.*Restaurant.*4\.6/).first()).toBeVisible();

  await expectNoHorizontalOverflow(page);
  expect(issues).toEqual([]);
});

test("google place imports auto-anchor from coordinates", async ({ page }) => {
  const issues = collectPageIssues(page);

  await page.route("**/api/import-metadata**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          url: "https://maps.google.com/?cid=quiet-garden",
          finalUrl: "https://maps.google.com/?cid=quiet-garden",
          sourcePlatform: "google-maps",
          sourceLabel: "Google Maps",
          title: "Quiet Garden",
          description: "Courtyard hideaway · 4.5 rating",
          siteName: "Google Maps",
          confidence: "high",
          place: {
            name: "Quiet Garden",
            address: "Hope Road",
            shortAddress: "Hope Road",
            latitude: 18.0179,
            longitude: -76.7875,
            mapsUrl: "https://maps.google.com/?cid=quiet-garden",
            rating: 4.5,
            primaryType: "Cafe",
          },
        },
      }),
    });
  });

  await openCleanTab(page, "saved", [
    "irieverse_imported_ideas",
    "irieverse_saved_collections",
  ]);

  await page.getByPlaceholder("https://maps.google.com/... or social link").fill("https://maps.google.com/?cid=quiet-garden");
  await expect(page.getByText("Quiet Garden").first()).toBeVisible();
  await page.getByRole("button", { name: "Save to Irieverse" }).click();

  const ideas = await waitForImportedIdeas(
    page,
    (items) => items.length === 1 && items[0].title === "Quiet Garden"
  );

  expect(ideas[0]).toEqual(
    expect.objectContaining({
      linkedDestinationId: "kingston",
      place: expect.objectContaining({
        shortAddress: "Hope Road",
      }),
    })
  );
  await expectNoHorizontalOverflow(page);
  expect(issues).toEqual([]);
});

test("share-target imports preserve provided titles", async ({ page }) => {
  const issues = collectPageIssues(page);
  const params = new URLSearchParams({
    tab: "saved",
    source: "share-target",
    shared_title: "QA Blue Mountain coffee stop",
    shared_url: "https://maps.google.com/?q=Blue+Mountain+Coffee+Jamaica",
    shared_text: "Production QA import idea attached to a Jamaica board.",
  });

  await page.goto(`/?${params}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Shared idea ready to save")).toBeVisible();
  await expect(page.getByPlaceholder("Jerk stop in Port Antonio")).toHaveValue("QA Blue Mountain coffee stop");
  await page.waitForTimeout(6000);
  await expect(page.getByPlaceholder("Jerk stop in Port Antonio")).toHaveValue("QA Blue Mountain coffee stop");
  await expect(page.locator("textarea")).toHaveValue("Production QA import idea attached to a Jamaica board.");

  expect(issues).toEqual([]);
});

test("trip day cards support area edits, locks, and single-day add-on refresh", async ({ page }) => {
  const issues = collectPageIssues(page);

  await openCleanTab(page, "trips", [
    "irieverse_manual_route",
    "irieverse_locked_route",
    "irieverse_day_experiences",
  ]);

  const dayAreaLabel = page.getByText("Day area").first();
  await dayAreaLabel.scrollIntoViewIfNeeded();
  const firstDayAreaSelect = dayAreaLabel.locator("xpath=ancestor::label[1]").locator("select");
  await firstDayAreaSelect.selectOption("kingston");
  await expectLocalStorage(page, "irieverse_manual_route", (route) => route[0] === "kingston");

  await page.getByRole("button", { name: "Keep day" }).first().click();
  await expectLocalStorage(page, "irieverse_locked_route", (locked) => locked.includes("kingston"));

  await page.getByRole("button", { name: "Unlock day" }).first().click();
  await expectLocalStorage(page, "irieverse_locked_route", (locked) => !locked.includes("kingston"));

  await page.getByRole("button", { name: "Try another" }).first().click();
  await expectLocalStorage(
    page,
    "irieverse_day_experiences",
    (overrides) => typeof overrides["1"] === "string" && overrides["1"].length > 0
  );

  await page.getByRole("button", { name: "Use auto" }).first().click();
  await expectLocalStorage(page, "irieverse_day_experiences", (overrides) => !overrides["1"]);

  await expectNoHorizontalOverflow(page);
  expect(issues).toEqual([]);
});

test("trip route order controls move, lock, remove, and reset stops", async ({ page }) => {
  const issues = collectPageIssues(page);

  await openCleanTab(page, "trips", [
    "irieverse_planning_mode",
    "irieverse_planning_template",
    "irieverse_manual_route",
    "irieverse_locked_route",
  ]);

  await page.getByText("Route intelligence").scrollIntoViewIfNeeded();

  const firstLaterButton = page.locator('button[aria-label^="Move "][aria-label$=" later"]:not([disabled])').first();
  const laterLabel = await firstLaterButton.getAttribute("aria-label");
  expect(laterLabel).toMatch(/^Move .+ later$/);
  const movedStopName = laterLabel.replace(/^Move /, "").replace(/ later$/, "");

  await firstLaterButton.click();
  const routeAfterLater = await waitForLocalStorageValue(
    page,
    "irieverse_manual_route",
    (route) => Array.isArray(route) && route.length > 1
  );
  const routeAfterLaterJson = JSON.stringify(routeAfterLater);

  await page.locator(`button[aria-label="Move ${movedStopName} earlier"]:not([disabled])`).first().click();
  await expect
    .poll(() =>
      page.evaluate((storageKey) => window.localStorage.getItem(storageKey) || "null", "irieverse_manual_route")
    )
    .not.toBe(routeAfterLaterJson);

  await page.locator('button[aria-label^="Keep "][aria-label$=" on this day"]').first().click();
  await expectLocalStorage(page, "irieverse_locked_route", (locked) => Array.isArray(locked) && locked.length === 1);

  await page.locator('button[aria-label^="Unlock route day for "]').first().click();
  await expectLocalStorage(page, "irieverse_locked_route", (locked) => Array.isArray(locked) && locked.length === 0);

  const removeButtonsBefore = await page.locator('button[aria-label^="Remove "][aria-label$=" from route"]').count();
  await page.locator('button[aria-label^="Remove "][aria-label$=" from route"]').first().click();
  await expect
    .poll(() => page.locator('button[aria-label^="Remove "][aria-label$=" from route"]').count())
    .toBe(removeButtonsBefore - 1);

  await page.getByRole("button", { name: "Auto" }).first().click();
  await expectLocalStorage(page, "irieverse_manual_route", (route) => Array.isArray(route) && route.length === 0);

  await expectNoHorizontalOverflow(page);
  expect(issues).toEqual([]);
});

test("traveler-facing screens avoid integration jargon", async ({ page }) => {
  const issues = collectPageIssues(page);
  const internalTerms = /\b(Supabase|schema|OSRM|AviationStack|Amadeus|fallback|Fallback data|Irieverse sample|API key|public\.trips|heuristic|metadata parsing|Manual idea)\b/i;

  for (const tab of ["home", "explore", "map", "saved", "trips"]) {
    await openCleanTab(page, tab, []);

    if (tab === "trips") {
      const detailsButton = page.getByRole("button", { name: "Show details" }).first();
      if (await detailsButton.isVisible()) {
        await detailsButton.click();
      }
    }

    const visibleText = await page.locator("body").innerText();
    expect(visibleText, `${tab} screen should not expose internal integration terms`).not.toMatch(internalTerms);

    const exampleLinks = await page.locator('a[href*="example.com"]').count();
    expect(exampleLinks, `${tab} screen should not expose placeholder links`).toBe(0);
  }

  expect(issues).toEqual([]);
});

test("empty states give clear recovery actions", async ({ page }) => {
  const issues = collectPageIssues(page);

  await openCleanTab(page, "explore", []);
  await page.getByPlaceholder("Search Mobay, Negril, jerk, music...").fill("zzzz-no-match");
  await expect(page.getByText("No Jamaica places matched")).toBeVisible();

  await page.getByRole("button", { name: "Experiences" }).click();
  await expect(page.getByText("No experiences matched")).toBeVisible();

  await openCleanTab(page, "map", []);
  await page.getByLabel("Search and filters").click();
  await page.getByPlaceholder("Search beaches, food, music, culture...").fill("zzzz-no-match");
  await expect(page.getByText("No map pins match")).toBeVisible();
  await page.getByText("Clear search", { exact: true }).click();
  await expect(page.getByText("No map pins match")).toBeHidden();

  await openCleanTab(page, "saved", [
    "irieverse_saved_places",
    "irieverse_saved_experiences",
    "irieverse_imported_ideas",
    "irieverse_saved_collections",
  ]);
  await expect(page.getByText("No saved Jamaica ideas yet")).toBeVisible();
  await page.getByRole("button", { name: "Paste a link" }).click();
  await expect(page.getByPlaceholder("https://maps.google.com/... or social link")).toBeFocused();

  await expectNoHorizontalOverflow(page);
  expect(issues).toEqual([]);
});

test("map place details open with curated fallback content", async ({ page }) => {
  const issues = collectPageIssues(page);

  await openCleanTab(page, "map", []);
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /Day 2/ }).click();
  await expect(page.getByText("Day 2 Plan")).toBeVisible();
  await page.getByRole("button", { name: /Details/ }).first().click();

  const detailSheet = page.getByTestId("place-detail-sheet");
  await expect(detailSheet.getByRole("heading", { name: "Negril" })).toBeVisible();
  await expect(detailSheet.getByText("About this place")).toBeVisible();
  await expect(detailSheet.getByText("Good to know")).toBeVisible();
  await expect(detailSheet.getByRole("button", { name: "Maps" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(issues).toEqual([]);
});

test("map route preview keeps route notes secondary", async ({ page }) => {
  const issues = collectPageIssues(page);

  await page.route("**/api/road-route**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          coordinates: [
            [-77.8939, 18.4762],
            [-78.02, 18.39],
            [-78.3488, 18.2728],
          ],
          distanceKm: 78.4,
          durationMinutes: 108,
          summary: "Road-aware preview",
          steps: [
            {
              id: "depart",
              instruction: "Head west on A1",
              distanceKm: 11.2,
              durationMinutes: 18,
              roadName: "A1",
              maneuverType: "depart",
              modifier: "west",
              direction: "West",
            },
            {
              id: "continue",
              instruction: "Continue toward Lucea",
              distanceKm: 34.6,
              durationMinutes: 45,
              roadName: "A1",
              maneuverType: "continue",
              modifier: "",
              direction: "Continue",
            },
            {
              id: "turn",
              instruction: "Turn left toward Negril",
              distanceKm: 19.1,
              durationMinutes: 27,
              roadName: "",
              maneuverType: "turn",
              modifier: "left",
              direction: "Left",
            },
          ],
          source: "osrm",
        },
        meta: { source: "osrm", stepCount: 3 },
      }),
    });
  });

  await openCleanTab(page, "map", []);
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 15000 });
  await page.getByRole("button", { name: /Day 2/ }).click();

  const mapDrawer = page.getByTestId("map-trip-drawer");
  await expect(mapDrawer.getByText("Road-following preview")).toBeVisible();
  const routeNotes = mapDrawer.getByText("Route notes");
  await expect(routeNotes).toBeVisible();
  await routeNotes.click();
  await expect(mapDrawer.getByText(/Head west on A1/)).toBeVisible();
  await expect(mapDrawer.getByText(/Continue toward Lucea/)).toBeVisible();

  await expectNoHorizontalOverflow(page);
  expect(issues).toEqual([]);
});

test("map place details surface live visit data when available", async ({ page }) => {
  const issues = collectPageIssues(page);

  await page.route("**/api/place-details**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: "places/negril-live",
          name: "Seven Mile Beach",
          address: "Seven Mile Beach, Norman Manley Boulevard, Negril, Jamaica",
          shortAddress: "Seven Mile Beach, Negril",
          mapsUrl: "https://maps.google.com/?cid=123",
          websiteUrl: "https://visitnegril.example",
          phone: "+1 876-555-0199",
          rating: 4.7,
          userRatingCount: 1240,
          openNow: true,
          weekdayDescriptions: ["Monday: 9:00 AM - 6:00 PM"],
          businessStatus: "Operational",
          priceLevel: "$$",
          primaryType: "Beach",
          source: "google-places",
        },
        meta: { source: "google-places", providerConfigured: true },
      }),
    });
  });

  await openCleanTab(page, "map", []);
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /Day 2/ }).click();
  await page.getByRole("button", { name: /Details/ }).first().click();

  const detailSheet = page.getByTestId("place-detail-sheet");
  await expect(detailSheet.getByText("Visit details")).toBeVisible();
  await expect(detailSheet.getByText("Open now").first()).toBeVisible();
  await expect(detailSheet.getByText("Seven Mile Beach, Negril").first()).toBeVisible();
  await expect(detailSheet.getByRole("link", { name: /Website/ })).toBeVisible();
  await expect(detailSheet.getByText("Monday: 9:00 AM - 6:00 PM")).toBeVisible();
  await expect(detailSheet.getByText("Status")).toHaveCount(0);
  await expect(detailSheet.getByText("Operational")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expect(issues).toEqual([]);
});

test("map place details reject mismatched live data", async ({ page }) => {
  const issues = collectPageIssues(page);
  const placeDetailRequests = [];

  await page.route("**/api/place-details**", async (route) => {
    const url = new URL(route.request().url());
    placeDetailRequests.push(url.searchParams.toString());

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: "places/northcoast-imaging",
          name: "Northcoast Imaging Limited",
          address: "Doctor's Cave Beach Plaza, Montego Bay, Jamaica",
          shortAddress: "Doctor's Cave Beach Plaza",
          mapsUrl: "https://maps.google.com/?cid=northcoast-imaging",
          phone: "+1 876-555-0111",
          rating: 4.1,
          userRatingCount: 84,
          openNow: true,
          weekdayDescriptions: ["Monday: 8:00 AM - 5:00 PM"],
          primaryType: "Medical Diagnostic Imaging Center",
          types: ["health", "point_of_interest"],
          source: "google-places",
        },
        meta: { source: "google-places", providerConfigured: true },
      }),
    });
  });

  await openCleanTab(page, "map", []);
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /Day 1/ }).click();
  await page.getByRole("button", { name: /Details/ }).first().click();

  const detailSheet = page.getByTestId("place-detail-sheet");
  await expect(detailSheet.getByRole("heading", { name: "Montego Bay" })).toBeVisible();
  await expect.poll(() => placeDetailRequests.length).toBeGreaterThan(0);
  await expect(detailSheet.getByText("Northcoast Imaging Limited")).toHaveCount(0);
  await expect(detailSheet.getByText("Medical Diagnostic Imaging Center")).toHaveCount(0);
  expect(placeDetailRequests.some((query) => query.includes("placeQuery=Doctor%27s+Cave+Beach"))).toBe(true);
  await expectNoHorizontalOverflow(page);
  expect(issues).toEqual([]);
});

async function openCleanTab(page, tab, storageKeys) {
  await page.goto(`/?tab=${tab}`, { waitUntil: "domcontentloaded" });
  await page.evaluate((keys) => {
    keys.forEach((key) => window.localStorage.removeItem(key));
  }, storageKeys);
  await page.reload({ waitUntil: "domcontentloaded" });
}

async function waitForImportedIdeas(page, predicate) {
  await page.waitForFunction(
    ({ predicateSource }) => {
      const ideas = JSON.parse(window.localStorage.getItem("irieverse_imported_ideas") || "[]");
      return Function("ideas", `return (${predicateSource})(ideas);`)(ideas);
    },
    { predicateSource: predicate.toString() }
  );

  return page.evaluate(() => JSON.parse(window.localStorage.getItem("irieverse_imported_ideas") || "[]"));
}

async function expectLocalStorage(page, key, predicate) {
  await page.waitForFunction(
    ({ storageKey, predicateSource }) => {
      const value = JSON.parse(window.localStorage.getItem(storageKey) || "null");
      return Function("value", `return (${predicateSource})(value);`)(value);
    },
    { storageKey: key, predicateSource: predicate.toString() }
  );
}

async function waitForLocalStorageValue(page, key, predicate) {
  await expectLocalStorage(page, key, predicate);
  return page.evaluate((storageKey) => JSON.parse(window.localStorage.getItem(storageKey) || "null"), key);
}

async function expectNoHorizontalOverflow(page) {
  const sizes = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth);
}

function collectPageIssues(page) {
  const issues = [];

  page.on("console", (message) => {
    const text = message.text();
    const expectedLocalFetchNoise =
      text.includes("TypeError: Failed to fetch") ||
      text.includes("Failed to load resource") ||
      (text.includes("api.open-meteo.com") && text.includes("CORS policy"));
    if (message.type() === "error" && !expectedLocalFetchNoise) {
      issues.push(`console: ${text}`);
    }
  });

  page.on("pageerror", (error) => {
    issues.push(`pageerror: ${error.message}`);
  });

  page.on("dialog", async (dialog) => {
    issues.push(`dialog: ${dialog.message()}`);
    await dialog.dismiss().catch(() => {});
  });

  return issues;
}
