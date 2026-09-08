import { test, expect } from "@playwright/test";

const ids = {
  alice: "00000000-0000-4000-8000-000000000001",
  bob: "00000000-0000-4000-8000-000000000002",
};
function session(name) {
  const user = {
    id: ids[name],
    email: `${name}@example.com`,
    aud: "authenticated",
    role: "authenticated",
    email_confirmed_at: new Date().toISOString(),
  };
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      exp: Math.floor(Date.now() / 1000) + 3600,
      aud: "authenticated",
      role: "authenticated",
    }),
  ).toString("base64url");
  return {
    user,
    access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test-signature`,
    refresh_token: "test-refresh",
    token_type: "bearer",
    expires_in: 3600,
  };
}
async function mock(page) {
  let current = "alice";
  const profiles = {};
  const calls = [];
  await page.route("https://*.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());
    const data = route.request().postDataJSON();
    calls.push(url.pathname);
    if (url.pathname.endsWith("/token")) {
      current = data.email?.startsWith("bob") ? "bob" : "alice";
      return route.fulfill({ json: session(current) });
    }
    if (url.pathname.endsWith("/user"))
      return route.fulfill({ json: session(current).user });
    if (url.pathname.endsWith("/signup"))
      return route.fulfill({
        json: { user: session("alice").user, session: null },
      });
    if (url.pathname.endsWith("/driver_profiles")) {
      if (route.request().method() === "POST") {
        expect(data.owner_id).toBe(ids[current]);
        expect(data.visibility).toBe("private");
        profiles[current] = data;
        return route.fulfill({ json: data });
      }
      expect(url.searchParams.get("owner_id")).toBe(`eq.${ids[current]}`);
      return route.fulfill({ json: profiles[current] ?? null });
    }
    return route.fulfill({ json: {} });
  });
  return calls;
}
async function openAccess(page) {
  await page.goto("/#Settings");
  await page
    .getByRole("button", { name: "Sign in / Create account", exact: true })
    .click();
}
async function login(page, email = "alice@example.com") {
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
}

test("onboarding saves private profile, persists after reload and clears on account switch", async ({
  page,
}) => {
  await mock(page);
  await openAccess(page);
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Set up your driver profile" }),
  ).toBeVisible();
  await page.getByLabel("Display name", { exact: true }).fill("Alice Driver");
  await page.getByLabel("PSN ID (optional)").fill("alice_driver");
  await page
    .getByLabel("GT7 profile URL (optional)")
    .fill(
      "https://www.gran-turismo.com/us/gt7/user/mymenu/00000000-0000-4000-8000-000000000001/profile",
    );
  await page.getByRole("button", { name: "Save private profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Private profile saved.");
  await page.reload();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
    "Alice Driver",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/private-profile-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("button", { name: "Sign in / Create account", exact: true })
    .click();
  await login(page, "bob@example.com");
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.getByText("Alice Driver", { exact: true })).toHaveCount(0);
});

test("registration, reset and resend show email instructions", async ({
  page,
}) => {
  const calls = await mock(page);
  await openAccess(page);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill("alice@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("test-password-only");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .last()
    .click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Sign in / Create account", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill("alice@example.com");
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText(
    "If this address has an account",
  );
  expect(calls).toContain("/auth/v1/recover");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Sign in / Create account", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill("alice@example.com");
  await page
    .getByRole("button", { name: "Resend confirmation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Resend confirmation", exact: true })
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  expect(calls).toContain("/auth/v1/resend");
});

test("recovery callback opens password update and expired link shows a clear error", async ({
  page,
}) => {
  await mock(page);
  const s = session("alice");
  await page.goto(
    "/#" +
      new URLSearchParams({
        access_token: s.access_token,
        refresh_token: s.refresh_token,
        token_type: "bearer",
        expires_in: "3600",
        type: "recovery",
      }),
  );
  await page
    .getByLabel("New password", { exact: true })
    .fill("new-test-password");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("new-test-password");
  await page
    .getByRole("button", { name: "Set new password", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/#error=access_denied&error_code=otp_expired");
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("invalid or expired");
});
