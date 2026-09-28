import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test("new shopper keeps the chosen captured example through splash, email and preferences", async ({
  page,
}) => {
  await useReferenceScenario(page, "onboarding-new");
  await page.goto("/onboarding?step=splash&journey=new&reference=captured");
  await page.getByRole("link", { name: "Get Started", exact: true }).click();
  await page
    .getByRole("link", { name: "Continue to sign in", exact: true })
    .click();
  await page.waitForURL((url) => url.pathname === "/login");
  await expect(page).toHaveURL(/reference=captured.*journey=new/);
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("alexsmith.mobbin+3@gmail.com");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Verification code", exact: true })
    .fill("530547");
  await expect(
    page.getByRole("heading", {
      name: "What are you shopping for?",
      exact: true,
    }),
  ).toBeVisible({ timeout: 12000 });
  await page.getByRole("button", { name: "Everything", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Track all of your orders in one place",
      exact: true,
    }),
  ).toBeVisible();
});

test("preference Next keeps source spacing and remains reachable at buyer widths", async ({
  page,
}) => {
  await useReferenceScenario(page, "onboarding-new");
  await page.goto(
    "/onboarding?step=preferences&journey=new&reference=captured",
  );
  const next = page.getByRole("button", { name: "Next", exact: true });
  const hiddenNext = page.locator(".onboarding-actions button");
  await expect(hiddenNext).toBeDisabled();
  await expect(hiddenNext).toBeHidden();
  const everything = page.getByRole("button", {
    name: "Everything",
    exact: true,
  });
  await expect(page.locator(".onboarding-step-1 > p")).toHaveCSS(
    "color",
    "rgb(85, 85, 85)",
  );
  await everything.click();
  await expect(everything).toHaveAttribute("aria-pressed", "true");
  await expect(everything).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await expect(everything).toHaveCSS("color", "rgb(255, 255, 255)");
  const mens = page.getByRole("button", { name: "Men's", exact: true });
  await mens.click();
  await expect(mens).toHaveAttribute("aria-pressed", "true");
  await expect(mens).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await expect(everything).toHaveAttribute("aria-pressed", "false");
  await everything.click();
  await expect(mens).toHaveAttribute("aria-pressed", "false");
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await expect(next).toBeInViewport();
    const choiceBounds = await everything.boundingBox();
    const nextBounds = await next.boundingBox();
    expect(choiceBounds).not.toBeNull();
    expect(nextBounds).not.toBeNull();
    expect(nextBounds!.y - choiceBounds!.y - choiceBounds!.height).toBeCloseTo(
      14,
      0,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", {
      name: "Track all of your orders in one place",
      exact: true,
    }),
  ).toBeVisible();
  await page.goBack();
  await expect(everything).toHaveAttribute("aria-pressed", "true");
  await page.goForward();
  await expect(
    page.getByRole("link", { name: "Connect Google", exact: true }),
  ).toBeVisible();
});

test("widget links open the corresponding local order and return to the same previews", async ({
  page,
}) => {
  await useReferenceScenario(page, "order-widgets");
  await page.goto("/widgets");
  for (const size of ["large", "medium", "small"]) {
    await page
      .getByRole("link", {
        name: `Open KITSCH order from ${size} widget`,
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/\/orders\/REF-1001$/);
    await expect(
      page.getByText("Waiting for details", { exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(page.locator(`.widget-${size}`)).toBeVisible();
  }
  await page
    .getByRole("link", {
      name: "Open delivered T-shirt order from large widget",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/orders\/REF-manual-shirt\?view=tracking$/);
  await expect(
    page.getByRole("heading", { name: "Delivered today", exact: true }),
  ).toBeVisible();
});

test("fresh preview cold launch follows the current Shop entry controls", async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");

  await expect(page.locator(".shop-splash.purple")).toBeVisible();
  await page
    .getByRole("link", { name: "Get Started", exact: true })
    .waitFor({ state: "visible", timeout: 5000 });
  await page.getByRole("link", { name: "Get Started", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Let’s track your recent order",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Select 'Allow paste' to check for order information", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Track my order", exact: true }),
  ).toBeInViewport();
  await page.getByRole("link", { name: "Skip", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to Shop", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
});
