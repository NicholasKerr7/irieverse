import { expect, test, type Page } from "@playwright/test";
import type { ImportedIdea } from "../src/types/travel";

const PREVIEW_IMAGE_URL = [
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80'%3E",
  "%3Crect width='120' height='80' fill='%230ea5e9'/%3E",
  "%3Ccircle cx='82' cy='24' r='12' fill='%23facc15'/%3E",
  "%3Cpath d='M0 64 C24 42 38 52 58 36 C76 22 92 48 120 30 L120 80 L0 80 Z' fill='%230f766e'/%3E",
  "%3C/svg%3E",
].join("");

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
          imageUrl: PREVIEW_IMAGE_URL,
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
    (items) => items.some((item) => item.title === "Devon House stop" && item.note.includes("Updated note"))
  );
  const devonHouseIdea = ideas[0];
  if (!devonHouseIdea?.extractedPlaceName) {
    throw new Error("Expected Devon House imported idea metadata.");
  }

  expect(devonHouseIdea).toEqual(
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
  expect(devonHouseIdea.extractedPlaceName.toLowerCase()).toContain("devon house");
  await expect(page.getByText("Imported idea updated")).toBeVisible();

  await openCleanTab(page, "map", []);
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 15000 });
  await expect(page.getByRole("button", { name: "Open saved idea Devon House" })).toBeVisible();
  await page.getByRole("button", { name: "Open saved idea Devon House" }).click();
  const plannedDetailSheet = page.getByTestId("imported-place-detail-sheet");
  await expect(plannedDetailSheet.getByText("Trip-ready map idea")).toBeVisible();
  await expect(plannedDetailSheet.getByRole("img", { name: "Devon House" })).toBeVisible();
  await expect(plannedDetailSheet.getByText("26 Hope Road, Kingston").first()).toBeVisible();
  await page.getByLabel("Close saved idea details").click();
  const mapDrawer = page.getByTestId("map-trip-drawer");
  await expect(mapDrawer.getByText("Exact stops from your board")).toBeVisible();
  await mapDrawer.getByRole("button", { name: "Unplanned" }).click();
  await expect(mapDrawer.getByText("Good Jamaica ideas to add next.")).toBeVisible();
  await expect(mapDrawer.getByText("Devon House", { exact: true })).toHaveCount(0);
  await mapDrawer.getByRole("button", { name: "Overview" }).click();
  await mapDrawer.getByRole("button", { name: /Kingston/ }).first().click();
  await expect(mapDrawer.getByText("Exact stops from your board")).toBeVisible();
  await expect(mapDrawer.getByRole("button", { name: "Open exact stop Devon House" })).toBeVisible();
  await mapDrawer.getByLabel("Move Devon House to day").selectOption("1");
  await expectLocalStorage(page, "irieverse_imported_idea_days", (assignments: Record<string, string>) => Object.values(assignments).includes("1"));
  await mapDrawer.getByRole("button", { name: /Day 1/ }).click();
  await expect(mapDrawer.getByRole("button", { name: "Open exact stop Devon House" })).toBeVisible();
  await expect(mapDrawer.getByText("1 saved stop pinned into this day.")).toBeVisible();

  await openCleanTab(page, "trips", []);
  const exactStopBadge = page.getByText("Exact stop").first();
  await exactStopBadge.scrollIntoViewIfNeeded();
  await expect(exactStopBadge).toBeVisible();
  await expect(page.getByText(/26 Hope Road, Kingston.*Restaurant.*4\.6/).first()).toBeVisible();
  await page.getByRole("button", { name: /Add ideas/ }).click();
  await expect(page.getByText("1 route-ready")).toBeVisible();
  await expect(page.getByText("Map anchor ready for route planning")).toBeVisible();
  await expect(page.getByText("Trip board")).toBeVisible();
  await expect(page.getByText("Saved ideas by day")).toBeVisible();
  await expect(page.getByText("Pinned day 1")).toBeVisible();
  await page.getByLabel("Assign Devon House stop to day").selectOption("2");
  await expect(page.getByText("Pinned day 2")).toBeVisible();
  await expectLocalStorage(page, "irieverse_imported_idea_days", (assignments: Record<string, string>) => Object.values(assignments).includes("2"));
  await page.getByLabel("Assign Devon House stop to day").selectOption("unplanned");
  await expect(page.getByText("Unplanned").first()).toBeVisible();
  await expect(page.getByLabel("Assign Devon House stop to day")).toHaveValue("unplanned");
  await expectLocalStorage(page, "irieverse_imported_idea_days", (assignments: Record<string, string>) => Object.values(assignments).includes("unplanned"));

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
    (items) => items.some((item) => item.title === "Quiet Garden")
  );
  const quietGardenIdea = ideas[0];
  if (!quietGardenIdea) {
    throw new Error("Expected Quiet Garden imported idea.");
  }

  expect(quietGardenIdea).toEqual(
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

test("unplaced imported map ideas ask to be placed before trip use", async ({ page }) => {
  const issues = collectPageIssues(page);
  const unplacedIdea = {
    id: "qa-unplaced-map-idea",
    title: "Loose beach pin",
    url: "https://maps.google.com/?cid=loose-beach-pin",
    note: "Needs a Jamaica area before trip use.",
    category: "beach",
    collectionId: "wishlist",
    createdAt: "2026-05-13T00:00:00.000Z",
    sourcePlatform: "google-maps",
    sourceLabel: "Google Maps",
    linkedDestinationId: "",
    place: {
      name: "Loose beach pin",
      shortAddress: "Coastal Jamaica",
      latitude: 18.181,
      longitude: -76.46,
      mapsUrl: "https://maps.google.com/?cid=loose-beach-pin",
      primaryType: "Beach",
    },
  };

  await page.goto("/?tab=map", { waitUntil: "domcontentloaded" });
  await page.evaluate((idea) => {
    window.localStorage.setItem("irieverse_imported_ideas", JSON.stringify([idea]));
  }, unplacedIdea);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 15000 });

  await page.getByRole("button", { name: "Open saved idea Loose beach pin" }).click();
  const detailSheet = page.getByTestId("imported-place-detail-sheet");
  await expect(detailSheet.getByText("Saved map idea")).toBeVisible();
  await expect(detailSheet.getByText("Attach this saved idea to a Jamaica area in Saved before turning it into a full trip day.")).toBeVisible();
  await expect(detailSheet.getByRole("button", { name: "Place it" })).toBeVisible();
  await expect(detailSheet.getByRole("button", { name: "Trip" })).toHaveCount(0);

  await page.goto("/?tab=trips", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Add ideas/ }).click();
  await expect(page.getByText("1 need placing")).toBeVisible();
  await expect(page.getByText("1 saved import need Jamaica map anchors")).toBeVisible();
  await expect(page.getByText("Trip board")).toBeVisible();
  await expect(page.getByText("1 import still need placing")).toBeVisible();
  await page.getByRole("button", { name: "Place in Saved" }).first().click();
  await expect(page.getByRole("button", { name: "Place imports" })).toBeVisible();
  await expect(page.getByText("Needs placing").first()).toBeVisible();
  await expect(page.getByText("1 to place").first()).toBeVisible();
  await page.getByRole("button", { name: "Place imports" }).click();
  await expect(page.getByText("Map anchors needed")).toBeVisible();
  await expect(page.getByText("Nearest Jamaica area from place data")).toBeVisible();
  await expect(page.getByRole("button", { name: /Use Port Antonio & Portland/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Place" }).first()).toBeVisible();
  await page.getByRole("button", { name: /Use Port Antonio & Portland/ }).click();
  await waitForImportedIdeas(page, (ideas) => ideas[0]?.linkedDestinationId === "portland");
  await expect(page.getByText("Route-ready").first()).toBeVisible();
  await expect(page.getByText("1 to place")).toHaveCount(0);

  await page.goto("/?tab=trips", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Add ideas/ }).click();
  await expect(page.getByText("1 route-ready")).toBeVisible();
  await expect(page.getByText("Map anchor ready for route planning")).toBeVisible();

  await expectNoHorizontalOverflow(page);
  expect(issues).toEqual([]);
});

test("local mode uses JMD budgets, radius starts, and persisted quick planning", async ({ page }) => {
  const issues = collectPageIssues(page);
  const plannerKeys = [
    "irieverse_planning_mode",
    "irieverse_planning_template",
    "irieverse_planner_base",
    "irieverse_planner_days",
    "irieverse_planner_vibe",
    "irieverse_planner_budget",
    "irieverse_planner_currency",
    "irieverse_planner_start_date",
    "irieverse_manual_route",
  ];

  await openCleanTab(page, "home", plannerKeys);
  await page.getByRole("button", { name: /I live here/ }).click();
  await expectLocalStorageText(page, "irieverse_planning_mode", (value) => value === "local");

  await page.getByTestId("mobile-bottom-nav").getByRole("button", { name: /^Trips$/ }).click();
  await expect(page.getByText("Plan a Jamaica day without overthinking it.")).toBeVisible();
  await expect(page.getByText("Quick Plan").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "JMD" }).first()).toBeVisible();
  await expect(page.getByText(/J\$9k|J\$9,000/).first()).toBeVisible();

  await page.getByRole("button", { name: "90 min" }).click();
  await expectLocalStorageText(page, "irieverse_planner_currency", (value) => value === "JMD");
  await expectLocalStorageText(page, "irieverse_planner_days", (value) => value === "2");
  await expectLocalStorageText(page, "irieverse_planning_template", (value) => value === "river-and-beach-day");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("Plan a Jamaica day without overthinking it.")).toBeVisible();
  await expect(page.getByRole("button", { name: "JMD" }).first()).toBeVisible();
  await expect(page.getByText("2 days").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.goto("/manifest.webmanifest", { waitUntil: "domcontentloaded" });
  await page.evaluate((keys) => {
    keys.forEach((key) => window.localStorage.removeItem(key));
  }, plannerKeys);
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
  await expectLocalStorage(page, "irieverse_manual_route", (route: string[]) => route[0] === "kingston");

  await page.getByRole("button", { name: "Keep day" }).first().click();
  await expectLocalStorage(page, "irieverse_locked_route", (locked: string[]) => locked.includes("kingston"));

  await page.getByRole("button", { name: "Unlock day" }).first().click();
  await expectLocalStorage(page, "irieverse_locked_route", (locked: string[]) => !locked.includes("kingston"));

  await page.getByRole("button", { name: "Try another" }).first().click();
  await expectLocalStorage(
    page,
    "irieverse_day_experiences",
    (overrides: Record<string, string>) => typeof overrides["1"] === "string" && overrides["1"].length > 0
  );

  await page.getByRole("button", { name: "Use auto" }).first().click();
  await expectLocalStorage(page, "irieverse_day_experiences", (overrides: Record<string, string>) => !overrides["1"]);

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
  if (!laterLabel) {
    throw new Error("Expected enabled route move button to have a label.");
  }
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

test("app hides visual scrollbars while preserving page and panel scrolling", async ({ page }) => {
  const issues = collectPageIssues(page);

  await openCleanTab(page, "home", []);
  await page.waitForTimeout(1000);

  const pageScrollBefore = await page.evaluate(() => {
    const scrollElement = document.scrollingElement ?? document.documentElement;
    return {
      canScroll: scrollElement.scrollHeight > scrollElement.clientHeight,
      htmlScrollbarWidth: getComputedStyle(document.documentElement).scrollbarWidth,
      bodyScrollbarWidth: getComputedStyle(document.body).scrollbarWidth,
    };
  });
  expect(pageScrollBefore.canScroll).toBe(true);
  expect(pageScrollBefore.htmlScrollbarWidth).toBe("none");
  expect(pageScrollBefore.bodyScrollbarWidth).toBe("none");

  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "auto" }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

  await openCleanTab(page, "map", []);
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 15000 });
  await page.getByLabel("Expand trip drawer").click();

  const scrollPanelStyles = await page.evaluate(() => {
    const scrollableElements = [...document.querySelectorAll<HTMLElement>("*")]
      .filter((element) => {
        const style = getComputedStyle(element);
        const hasScrollOverflow = /(auto|scroll)/.test(`${style.overflowX} ${style.overflowY}`);
        return hasScrollOverflow && (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth);
      })
      .map((element) => getComputedStyle(element).scrollbarWidth);

    return {
      count: scrollableElements.length,
      styles: scrollableElements,
    };
  });

  expect(scrollPanelStyles.count).toBeGreaterThan(0);
  expect(scrollPanelStyles.styles.every((style) => style === "none")).toBe(true);
  await expectNoHorizontalOverflow(page);
  expect(issues).toEqual([]);
});

test("image cards recover when remote provider images fail", async ({ page }) => {
  const issues = collectPageIssues(page);

  await page.route(
    /https:\/\/(images\.pexels\.com|images\.unsplash\.com|upload\.wikimedia\.org|commons\.wikimedia\.org|pixabay\.com)\//,
    (route) => route.abort()
  );

  await openCleanTab(page, "explore", []);
  await expect(page.getByRole("heading", { name: "Parish guide, attractions, and island experiences." })).toBeVisible();
  await expect(page.getByText("Montego Bay").first()).toBeVisible();
  await page.waitForTimeout(1000);

  const brokenImages = await page.evaluate(() =>
    Array.from(document.images)
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.alt || image.currentSrc)
  );
  expect(brokenImages).toEqual([]);
  await expectNoHorizontalOverflow(page);
  expect(issues).toEqual([]);
});

test("legal pages are reachable from the footer", async ({ page }) => {
  const issues = collectPageIssues(page);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/page=privacy/);
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  await expect(page.getByText("Last updated: May 15, 2026")).toBeVisible();

  await page.getByRole("link", { name: "Terms" }).click();
  await expect(page).toHaveURL(/page=terms/);
  await expect(page.getByRole("heading", { name: "Terms of Use" })).toBeVisible();

  await page.getByRole("button", { name: "Back home" }).click();
  await expect(page).not.toHaveURL(/page=/);
  await expect(page.getByRole("heading", { name: "Plan Jamaica with IrieVerse" })).toBeVisible();

  await expectNoHorizontalOverflow(page);
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
  await expect(detailSheet.locator('[aria-label="Trip fit"]')).toBeVisible();
  await expect(detailSheet.getByText("Easy day stop")).toBeVisible();
  await expect(detailSheet.getByText("About this place")).toBeVisible();
  await expect(detailSheet.getByText("Good to know before you go")).toBeVisible();
  await expect(detailSheet.getByRole("button", { name: "Open map" })).toBeVisible();
  await expect(detailSheet.getByText("Airport")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expect(issues).toEqual([]);
});

test("map trip drawer keeps every planned day visible", async ({ page }) => {
  const issues = collectPageIssues(page);

  await page.route("**/api/road-route**", async (route) => {
    const url = new URL(route.request().url());
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          coordinates: buildMockRoadCoordinates(from, to),
          distanceKm: 78.4,
          durationMinutes: 108,
          summary: "Road-aware preview",
          steps: [],
          source: "osrm",
        },
        meta: { source: "osrm", stepCount: 0 },
      }),
    });
  });

  await openCleanTab(page, "map", []);
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 15000 });
  await expectVisibleMapDayTabs(page, 5);

  await page.setViewportSize({ width: 1280, height: 900 });
  await openCleanTab(page, "map", []);
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 15000 });
  await expectVisibleMapDayTabs(page, 5);

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
  await expect(mapDrawer.getByText("Road-aware planning")).toBeVisible();
  await expect(mapDrawer.getByText("Use this to compare day flow before opening your map app.")).toBeVisible();
  const routeNotes = mapDrawer.getByText("Drive notes");
  await expect(routeNotes).toBeVisible();
  await routeNotes.click();
  await expect(mapDrawer.getByText(/Head west on A1/)).toBeVisible();
  await expect(mapDrawer.getByText(/Continue toward Lucea/)).toBeVisible();

  await expectNoHorizontalOverflow(page);
  expect(issues).toEqual([]);
});

test("map route preview waits for road geometry before showing route details", async ({ page }) => {
  const issues = collectPageIssues(page);
  const routeRequests: string[] = [];
  let releaseRoadRoutes = () => {};
  const roadRoutesReleased = new Promise<void>((resolve) => {
    releaseRoadRoutes = resolve;
  });

  await page.route("**/api/road-route**", async (route) => {
    const url = new URL(route.request().url());
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    routeRequests.push(`${from} -> ${to}`);

    await roadRoutesReleased;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          coordinates: buildMockRoadCoordinates(from, to),
          distanceKm: 78.4,
          durationMinutes: 108,
          summary: "Road-aware preview",
          steps: [],
          source: "osrm",
        },
        meta: { source: "osrm", stepCount: 0 },
      }),
    });
  });

  await openCleanTab(page, "map", []);
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 15000 });
  await expect(page.getByText("Building preview")).toBeVisible({ timeout: 10000 });
  await expect.poll(() => routeRequests.length).toBeGreaterThan(0);

  await page.getByRole("button", { name: /Day 2/ }).click();
  const mapDrawer = page.getByTestId("map-trip-drawer");
  await expect(mapDrawer.getByText("Building the road preview...")).toBeVisible();
  await expect(mapDrawer.getByText("The road preview is still being prepared for this leg.")).toHaveCount(0);

  releaseRoadRoutes();
  await expect(mapDrawer.getByText("Road-aware", { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(mapDrawer.getByText("Building the road preview...")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expect(issues).toEqual([]);
});

test("map route preview falls back to public road geometry when the app proxy fails", async ({ page }) => {
  const issues = collectPageIssues(page);
  let proxyRequests = 0;
  let publicRouteRequests = 0;

  await page.route("**/api/road-route**", async (route) => {
    proxyRequests += 1;
    await route.fulfill({
      status: 500,
      contentType: "text/plain",
      body: "FUNCTION_INVOCATION_FAILED",
    });
  });

  await page.route("https://router.project-osrm.org/route/v1/driving/**", async (route) => {
    publicRouteRequests += 1;
    const url = new URL(route.request().url());
    const coordinatePath = decodeURIComponent(url.pathname.split("/driving/")[1] ?? "");
    const [from = "", to = ""] = coordinatePath.split(";");

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        routes: [
          {
            geometry: {
              coordinates: buildMockRoadCoordinates(from, to),
            },
            distance: 78400,
            duration: 6480,
            legs: [],
          },
        ],
      }),
    });
  });

  await openCleanTab(page, "map", []);
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 15000 });
  await expect(page.getByText("Road-aware")).toBeVisible({ timeout: 15000 });

  expect(proxyRequests).toBeGreaterThan(0);
  expect(publicRouteRequests).toBeGreaterThan(0);
  await expectNoHorizontalOverflow(page);
  expect(issues).toEqual([]);
});

test("map route preview reuses identical startup road lookups", async ({ page }) => {
  const issues = collectPageIssues(page);
  const routeRequestCounts = new Map<string, number>();

  await page.route("**/api/road-route**", async (route) => {
    const url = new URL(route.request().url());
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    const requestKey = `${from} -> ${to}`;
    routeRequestCounts.set(requestKey, (routeRequestCounts.get(requestKey) ?? 0) + 1);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          coordinates: buildMockRoadCoordinates(from, to),
          distanceKm: 78.4,
          durationMinutes: 108,
          summary: "Road-aware preview",
          steps: [],
          source: "osrm",
        },
        meta: { source: "osrm", stepCount: 0 },
      }),
    });
  });

  await openCleanTab(page, "map", []);
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 15000 });
  await expect(page.getByText("Road-aware")).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1000);
  await expectMapTopControlsToHaveSeparateHitTargets(page);
  await page.getByLabel("Expand trip drawer").click();
  await expect(page.getByLabel("Search and filters")).toHaveCount(0);
  await expect(page.getByTestId("map-trip-drawer").getByRole("heading", { name: "5-day North Coast" })).toBeVisible();

  expect(routeRequestCounts.size).toBeGreaterThan(0);
  expect(Array.from(routeRequestCounts.values()).every((count) => count === 1)).toBe(true);
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
  const placeDetailRequests: string[] = [];

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

async function openCleanTab(page: Page, tab: string, storageKeys: string[]) {
  const defaultStorageKeys = [
    "irieverse_planning_mode",
    "irieverse_planning_template",
    "irieverse_planner_base",
    "irieverse_planner_days",
    "irieverse_planner_vibe",
    "irieverse_planner_budget",
    "irieverse_planner_currency",
    "irieverse_planner_start_date",
  ];
  await page.goto("/manifest.webmanifest", { waitUntil: "domcontentloaded" });
  await page.evaluate((keys) => {
    Array.from(new Set(keys)).forEach((key) => window.localStorage.removeItem(key));
  }, [...defaultStorageKeys, ...storageKeys]);
  await page.goto(`/?tab=${tab}`, { waitUntil: "domcontentloaded" });
}

async function waitForImportedIdeas(
  page: Page,
  predicate: (ideas: ImportedIdea[]) => boolean
): Promise<ImportedIdea[]> {
  await page.waitForFunction(
    ({ predicateSource }) => {
      const ideas = JSON.parse(window.localStorage.getItem("irieverse_imported_ideas") || "[]");
      return Function("ideas", `return (${predicateSource})(ideas);`)(ideas);
    },
    { predicateSource: predicate.toString() }
  );

  return page.evaluate(() => JSON.parse(window.localStorage.getItem("irieverse_imported_ideas") || "[]"));
}

async function expectLocalStorage<T>(page: Page, key: string, predicate: (value: T) => boolean) {
  await page.waitForFunction(
    ({ storageKey, predicateSource }) => {
      const value = JSON.parse(window.localStorage.getItem(storageKey) || "null");
      return Function("value", `return (${predicateSource})(value);`)(value);
    },
    { storageKey: key, predicateSource: predicate.toString() }
  );
}

async function expectLocalStorageText(page: Page, key: string, predicate: (value: string | null) => boolean) {
  await page.waitForFunction(
    ({ storageKey, predicateSource }) => {
      const value = window.localStorage.getItem(storageKey);
      return Function("value", `return (${predicateSource})(value);`)(value);
    },
    { storageKey: key, predicateSource: predicate.toString() }
  );
}

async function waitForLocalStorageValue<T>(
  page: Page,
  key: string,
  predicate: (value: T) => boolean
): Promise<T> {
  await expectLocalStorage(page, key, predicate);
  return page.evaluate((storageKey) => JSON.parse(window.localStorage.getItem(storageKey) || "null"), key);
}

async function expectNoHorizontalOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth);
}

function parseRouteCoordinate(value: string): [number, number] {
  const [longitude, latitude] = value.split(",").map(Number);
  return [longitude ?? 0, latitude ?? 0];
}

function buildMockRoadCoordinates(from: string, to: string): Array<[number, number]> {
  const [fromLongitude, fromLatitude] = parseRouteCoordinate(from);
  const [toLongitude, toLatitude] = parseRouteCoordinate(to);
  const midpoint: [number, number] = [
    (fromLongitude + toLongitude) / 2 + 0.05,
    (fromLatitude + toLatitude) / 2 - 0.04,
  ];
  return [
    [fromLongitude, fromLatitude],
    midpoint,
    [toLongitude, toLatitude],
  ];
}

async function expectVisibleMapDayTabs(page: Page, expectedDays: number) {
  const drawer = page.getByTestId("map-trip-drawer");
  await expect(drawer).toBeVisible();

  for (let day = 1; day <= expectedDays; day += 1) {
    const dayTab = drawer.getByRole("button", { name: new RegExp(`Day ${day}`) });
    await expect(dayTab, `Day ${day} tab should be visible in the map drawer`).toBeVisible();
    await expect(dayTab, `Day ${day} tab should not be clipped offscreen`).toBeInViewport();
  }
}

async function expectMapTopControlsToHaveSeparateHitTargets(page: Page) {
  const boxes = await page.evaluate(() => {
    const controls = ["Search and filters", "Open Trips", "Switch to light mode"];
    return controls.map((label) => {
      const candidates = [...document.querySelectorAll("button")]
        .filter((button) => button.getAttribute("aria-label") === label)
        .map((button) => {
          const rect = button.getBoundingClientRect();
          return {
            label,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            right: rect.right,
            bottom: rect.bottom,
          };
        })
        .filter((box) => box.width > 0 && box.height > 0 && box.y < 100);
      return candidates[0] ?? null;
    });
  });
  const [searchBox, tripsBox, themeBox] = boxes;

  expect(searchBox).toBeTruthy();
  expect(tripsBox).toBeTruthy();
  expect(themeBox).toBeTruthy();
  expect(boxesOverlap(searchBox!, tripsBox!)).toBe(false);
  expect(boxesOverlap(tripsBox!, themeBox!)).toBe(false);
}

function boxesOverlap(
  first: { x: number; y: number; right: number; bottom: number },
  second: { x: number; y: number; right: number; bottom: number }
): boolean {
  return first.x < second.right && first.right > second.x && first.y < second.bottom && first.bottom > second.y;
}

function collectPageIssues(page: Page): string[] {
  const issues: string[] = [];

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
