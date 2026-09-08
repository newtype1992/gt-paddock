import { test, expect } from "@playwright/test";
test("GT7 pairing renders real units, records and disconnects", async ({
  page,
}) => {
  await page.route("http://127.0.0.1:4181/**", async (route) => {
    expect(route.request().headers().authorization).toBe(
      "Bearer testing-pair-code",
    );
    const session = {
      id: "test",
      car_id: 82,
      started_at: Date.now() / 1000,
      laps: [{ lap: 1, time_ms: 109800 }],
      top_speed: 250,
      source: "console",
    };
    const body = route.request().url().endsWith("/sessions")
      ? [session]
      : {
          source: "console",
          stale: false,
          session,
          sample: {
            car_id: 82,
            packet_id: 1,
            captured_at: Date.now() / 1000,
            on_track: true,
            speed: 123,
            rpm: 5000,
            gear: 4,
            fuel: 60,
            lap: 2,
            throttle: 80,
            brake: 0,
            tyres: [80, 81, 82, 83],
            last_lap_ms: 109800,
          },
        };
    await route.fulfill({
      json: body,
      headers: { "Access-Control-Allow-Origin": "http://127.0.0.1:4178" },
    });
  });
  await page.goto("/#Live%20telemetry");
  await page.getByLabel("Companion pairing code").fill("testing-pair-code");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText("Live", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("123", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "1:49.800" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Current car" })).toContainText(
    "Toyota Supra RZ '97",
  );
  await expect(
    page.getByRole("button", { name: /Toyota Supra RZ/ }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Driver inputs" }).click();
  await expect(
    page.getByRole("img", { name: "Throttle over the last 60 seconds" }),
  ).toBeVisible();
  await page.getByLabel("Trace time window").selectOption("30");
  await expect(
    page.getByRole("img", { name: "Brake over the last 30 seconds" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Freeze charts" }).click();
  await expect(page.getByText("FROZEN", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Resume charts" }).click();
  await expect(page.getByText("FROZEN", { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: "test-results/telemetry-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("region", { name: "Live telemetry readings" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/telemetry-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(
    page.getByText("Disconnected", { exact: true }).first(),
  ).toBeVisible();
});
