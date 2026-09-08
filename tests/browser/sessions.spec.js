import { test, expect } from "@playwright/test";
const session = {
  id: "recorded-supra",
  car_id: 82,
  source: "console",
  started_at: 100,
  ended_at: 120,
  samples: 202,
  top_speed: 276,
  laps: [
    { lap: 1, time_ms: 10000 },
    { lap: 2, time_ms: 10000 },
  ],
};
async function connect(page) {
  await page.route("http://127.0.0.1:4181/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith('/annotations')) {
      const { annotation } = route.request().postDataJSON();
      session.annotation = annotation;
      return route.fulfill({ json: annotation });
    }
    const samples = Array.from({ length: 201 }, (_, i) => ({
      packet_id: i,
      car_id: 82,
      lap: Math.floor(i / 100) + 1,
      captured_at: 100 + i / 10,
      speed: 100 + (i % 100),
      rpm: 5000,
      throttle: 80,
      brake: 0,
      gear: 4,
    }));
    await route.fulfill({
      json: url.includes("/export?")
        ? samples
        : url.endsWith("/sessions")
          ? [session]
          : {
              source: "console",
              session,
              stale: false,
              sample: {
                ...samples[0],
                captured_at: Date.now() / 1000,
                on_track: true,
                tyres: [80, 80, 80, 80],
              },
            },
      headers: { "Access-Control-Allow-Origin": "http://127.0.0.1:4178" },
    });
  });
  await page.goto("/#Live%20telemetry");
  await page.getByLabel("Companion pairing code").fill("test-code");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Toyota Supra RZ '97" }).first(),
  ).toBeVisible();
}
test("recordings populate overview, driven cars and session notes", async ({
  page,
}) => {
  await connect(page);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Recent sessions" }),
  ).toBeVisible();
  await expect(page.getByText("Demo data", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Open session recorded-supra" })
    .click();
  await page.getByLabel("Track (manual)").fill("Trial Mountain");
  await page.getByLabel("Layout / variation").fill("Full");
  await page.getByLabel("Direction", { exact: true }).selectOption("Reverse");
  await page.getByLabel("Fuel consumption multiplier").fill("3");
  await page.getByLabel("Tyre wear multiplier").fill("0");
  await page.getByLabel("Session notes").fill("Braked too early at turn 1.");
  await page.getByRole("button", { name: "Save session details" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved with recording on this PC.");
  await page.getByRole("button", { name: "Driven cars", exact: true }).click();
  await expect(
    page.getByText("not your owned GT7 garage", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Latest session" }).click();
  await expect(page.getByLabel("Track (manual)")).toHaveValue("Trial Mountain");
  await page.getByRole("button", { name: "Analyze laps" }).click();
  await expect(
    page.getByRole("heading", { name: "Trial Mountain / Full / Reverse" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Track and session settings" }),
  ).toContainText("3x");
  await expect(
    page.getByRole("img", { name: "Recorded lap comparison graph" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("img", { name: "Recorded lap comparison graph" })
      .locator("path"),
  ).toHaveCount(2);
  await page.getByLabel("Analysis channel").selectOption("brake");
  await expect(
    page.getByRole("img", { name: "Time delta by estimated distance" }),
  ).toBeVisible();
  await page.getByLabel("Distance cursor").fill("75");
  await expect(page.getByLabel("Distance cursor")).toHaveValue("75");
  await page.getByRole("tab", { name: "Elapsed time", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Time delta by estimated distance" }),
  ).toHaveCount(0);
  await page
    .getByRole("tab", { name: "Estimated distance", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/lap-analysis-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/lap-analysis-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page
    .getByRole("button", { name: "Live telemetry", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Disconnect", exact: true }),
  ).toBeVisible();
});
test("empty workspace has no demo or retired pages", async ({ page }) => {
  await page.goto("/#Overview");
  await expect(
    page.getByRole("heading", { name: "Connect your companion" }),
  ).toBeVisible();
  for (const label of [
    "Tasks",
    "Radio log",
    "GT7 profile",
    "Stint plan",
    "Garage",
  ])
    await expect(
      page.getByRole("button", { name: label, exact: true }),
    ).toHaveCount(0);
  await page.goto("/#Tasks");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
});
