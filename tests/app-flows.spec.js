const { test, expect } = require("@playwright/test");

test("saved import updates duplicate links instead of adding clutter", async ({ page }) => {
  const issues = collectPageIssues(page);

  await openCleanTab(page, "saved", [
    "irieverse_imported_ideas",
    "irieverse_saved_collections",
  ]);

  const urlInput = page.getByPlaceholder("https://maps.google.com/... or social link");
  const titleInput = page.getByPlaceholder("Jerk stop in Port Antonio");
  const noteInput = page.getByPlaceholder("Why this belongs in the trip");
  const saveButton = page.getByRole("button", { name: "Save to Irieverse" });

  await urlInput.fill("https://www.google.com/maps/place/Devon+House,+Kingston,+Jamaica?utm_source=qa#details");
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
    })
  );
  expect(ideas[0].extractedPlaceName.toLowerCase()).toContain("devon house");
  await expect(page.getByText("Imported idea updated")).toBeVisible();
  await expectNoHorizontalOverflow(page);
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

test("traveler-facing screens avoid integration jargon", async ({ page }) => {
  const issues = collectPageIssues(page);
  const internalTerms = /\b(Supabase|schema|OSRM|AviationStack|Amadeus|fallback|API key|public\.trips)\b/i;

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
  await page.getByPlaceholder("Search beaches, food, music, culture...").fill("zzzz-no-match");
  await expect(page.getByText("No map pins match")).toBeVisible();
  await page.getByText("Clear search", { exact: true }).click();
  await expect(page.getByText("No map pins match")).toBeHidden();

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
    const expectedLocalFetchNoise = text.includes("TypeError: Failed to fetch") || text.includes("Failed to load resource");
    if (message.type() === "error" && !expectedLocalFetchNoise) {
      issues.push(`console: ${text}`);
    }
  });

  page.on("pageerror", (error) => {
    issues.push(`pageerror: ${error.message}`);
  });

  return issues;
}
