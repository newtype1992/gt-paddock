// Archived team-operations workflows; superseded by the driver workspace.
import { test, expect } from "@playwright/test";
test("tasks can be created, edited, completed, persisted and deleted", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByLabel("Task", { exact: true }).fill("Check wheel torque");
  await page.getByLabel("Assignee").fill("Alex");
  await page.getByLabel("Priority").selectOption("High");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("Check wheel torque", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Edit Check wheel torque", exact: true })
    .click();
  await page.getByLabel("Task", { exact: true }).fill("Torque checked");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("checkbox", { name: "Complete Torque checked" }).click();
  await expect(page.getByText("Torque checked", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Tasks/ })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByText("Torque checked", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Torque checked", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText("Torque checked", { exact: true })).toHaveCount(
    0,
  );
});
test("stints filter by session, validate lap time, and save", async ({
  page,
}) => {
  await page.goto("/#Stint%20plan");
  await page.getByRole("button", { name: "Qualifying", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "10:30", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "14:12", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Add stint", exact: true }).click();
  await page.getByLabel("Driver", { exact: true }).fill("Test Driver");
  await page.getByLabel("Target lap (m:ss.mmm)").fill("invalid");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("alert")).toContainText("1:49.800");
  await page.getByLabel("Target lap (m:ss.mmm)").fill("1:48.200");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("cell", { name: /Test Driver/ })).toBeVisible();
});
test("garage rejects duplicate numbers and preserves referenced cars", async ({
  page,
}) => {
  await page.goto("/#Garage");
  await page.getByRole("button", { name: "Add car", exact: true }).click();
  await page.getByLabel("Car number").fill("14");
  await page.getByLabel("Drivers", { exact: true }).fill("Test driver");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("alert")).toContainText("already exists");
  await page.getByLabel("Car number").fill("88");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("button", { name: "Edit car 88", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit car 14", exact: true }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByRole("alert")).toContainText("reassign");
});
test("radio entries save, search, and safely render text", async ({ page }) => {
  await page.goto("/#Radio%20log");
  await page.getByRole("button", { name: "Add entry", exact: true }).click();
  await page
    .getByLabel("Message", { exact: true })
    .fill("<img src=x onerror=alert(1)> Wheels ready");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page
    .getByRole("textbox", { name: "Search radio journal" })
    .fill("Wheels ready");
  await expect(page.locator(".radio-list article")).toHaveCount(1);
  await expect(page.locator(".radio-list img")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText("<img src=x onerror=alert(1)> Wheels ready", {
      exact: true,
    }),
  ).toBeVisible();
});
test("mobile navigation, dialog and layout work without page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Weekend overview" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Garage", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Garage", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add car", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
