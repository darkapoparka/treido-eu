import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test("manual order recommendations open their canonical products and retain a saved selection", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-manual");
  await page.goto("/orders/REF-manual-shirt");
  const tire = page.locator(".product-card").filter({
    has: page.locator('a.product-copy[href="/products/order-tire-trim"]'),
  });
  await expect(tire).toContainText("Chemical Guys");
  const ratingHeight = await tire
    .locator(".rating")
    .evaluate((rating) => rating.getBoundingClientRect().height);
  expect(ratingHeight).toBeGreaterThanOrEqual(15);
  expect(ratingHeight).toBeLessThanOrEqual(17);
  await tire.getByRole("button", { name: /^Save Tire\+Trim/ }).click();
  await expect(
    tire.getByRole("button", { name: /^Unsave Tire\+Trim/ }),
  ).toBeVisible();
  await tire.locator(".product-copy").click();
  await expect(page).toHaveURL(/\/products\/order-tire-trim$/);
  await expect(
    page.getByRole("heading", {
      name: "Tire+Trim Gel Plastic and Rubber High-Glo…",
      exact: true,
    }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    tire.getByRole("button", { name: /^Unsave Tire\+Trim/ }),
  ).toBeVisible();
});

test("later captured manual delivery yields to local unmark and mark actions", async ({
  page,
}) => {
  // Geometry is the settled source composition. Continuous motion is exercised
  // separately by the cancellation journey below.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await useReferenceScenario(page, "orders-manual-delivered");
  await page.goto("/orders/REF-manual-shirt?history=delivered-later");
  await expect(
    page.getByText("Arrived at 5:09 PM", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".tracking-detail .product-copy").first(),
  ).toHaveAttribute("href", "/products/home-drmtlgy-eye");
  await page
    .getByRole("button", { name: "Unmark as delivered", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Label created", exact: true }),
  ).toBeVisible();
  const manualContinuationGeometry = await page
    .locator(".tracking-empty")
    .evaluate((empty) => {
      const carrier = document.querySelector<HTMLElement>(".tracking-carrier");
      const panel = document.querySelector<HTMLElement>(
        ".tracking-action-panel",
      );
      const deals = [...document.querySelectorAll<HTMLElement>("h2")].find(
        (node) => node.textContent?.includes("Your deals"),
      );
      const heading = empty.querySelector<HTMLElement>("h2");
      const copy = empty.querySelector<HTMLElement>("p");
      const action = empty.querySelector<HTMLElement>(".muted-button");
      if (!carrier || !panel || !deals || !heading || !copy || !action)
        throw new Error("Manual tracking continuation is incomplete");
      const carrierRect = carrier.getBoundingClientRect();
      const emptyRect = empty.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const dealsRect = deals.getBoundingClientRect();
      const headingRect = heading.getBoundingClientRect();
      const copyRect = copy.getBoundingClientRect();
      const actionRect = action.getBoundingClientRect();
      return {
        carrierGap: emptyRect.top - carrierRect.bottom,
        emptyHeight: emptyRect.height,
        contentInset: headingRect.left - emptyRect.left,
        headingToCopy: copyRect.top - headingRect.bottom,
        copyToAction: actionRect.top - copyRect.bottom,
        panelGap: panelRect.top - emptyRect.bottom,
        dealsGap: dealsRect.top - panelRect.bottom,
      };
    });
  expect(manualContinuationGeometry.carrierGap).toBeGreaterThanOrEqual(12);
  expect(manualContinuationGeometry.carrierGap).toBeLessThanOrEqual(14);
  expect(manualContinuationGeometry.emptyHeight).toBeGreaterThanOrEqual(151);
  expect(manualContinuationGeometry.emptyHeight).toBeLessThanOrEqual(153);
  expect(manualContinuationGeometry.contentInset).toBeGreaterThanOrEqual(16);
  expect(manualContinuationGeometry.contentInset).toBeLessThanOrEqual(18);
  expect(manualContinuationGeometry.headingToCopy).toBeGreaterThanOrEqual(1);
  expect(manualContinuationGeometry.headingToCopy).toBeLessThanOrEqual(3);
  expect(manualContinuationGeometry.copyToAction).toBeGreaterThanOrEqual(15);
  expect(manualContinuationGeometry.copyToAction).toBeLessThanOrEqual(17);
  expect(manualContinuationGeometry.panelGap).toBeGreaterThanOrEqual(12);
  expect(manualContinuationGeometry.panelGap).toBeLessThanOrEqual(14);
  expect(manualContinuationGeometry.dealsGap).toBeGreaterThanOrEqual(24);
  expect(manualContinuationGeometry.dealsGap).toBeLessThanOrEqual(26);
  await expect(page).not.toHaveURL(/[?&]history=/);
  await expect(
    page.locator(".tracking-detail .product-copy").first(),
  ).toHaveAttribute("href", "/products/order-tire-trim");
  await page
    .getByRole("button", { name: "Mark as delivered", exact: true })
    .click();
  const confetti = page.locator(".delivery-confetti");
  await expect(confetti).toBeVisible();
  await expect(confetti.locator("i")).toHaveCount(42);
  const celebrationGeometry = await confetti.evaluate((node) => {
    const particles = [...node.querySelectorAll("i")].map((particle) => {
      const rect = particle.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    });
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return {
      position: style.position,
      pointerEvents: style.pointerEvents,
      width: rect.width,
      height: rect.height,
      firstTop: Math.min(...particles.map((particle) => particle.top)),
      lastBottom: Math.max(...particles.map((particle) => particle.bottom)),
    };
  });
  expect(celebrationGeometry.position).toBe("fixed");
  expect(celebrationGeometry.pointerEvents).toBe("none");
  expect(celebrationGeometry.width).toBeGreaterThanOrEqual(392);
  expect(celebrationGeometry.width).toBeLessThanOrEqual(394);
  expect(celebrationGeometry.height).toBeGreaterThanOrEqual(792);
  expect(celebrationGeometry.height).toBeLessThanOrEqual(794);
  expect(celebrationGeometry.firstTop).toBeGreaterThanOrEqual(94);
  expect(celebrationGeometry.firstTop).toBeLessThanOrEqual(100);
  expect(celebrationGeometry.lastBottom).toBeGreaterThanOrEqual(487);
  expect(celebrationGeometry.lastBottom).toBeLessThanOrEqual(491);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(394);
  await expect(
    page.getByText("Arrived at 7:34 PM", { exact: true }),
  ).toBeVisible();
});

test("tracking map follows delivery state and returns through its connected hide/show history", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-transit");
  await page.goto("/orders/REF-1001?view=tracking&map=1");
  const map = page.locator(".tracking-map");
  const geography = map.locator(":scope > img");
  await expect(geography).toHaveAttribute(
    "src",
    "/api/reference-media/order-tracking-map-transit",
  );
  await expect(map.locator(":scope > svg")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Mark as delivered", exact: true })
    .click();
  await expect(geography).toHaveAttribute(
    "src",
    "/api/reference-media/order-tracking-map-delivered",
  );
  await expect(map.locator(":scope > svg")).toBeAttached();
  await page.locator(".tracking-status-card").click();
  await expect(map).toHaveCount(0);
  await page.goBack();
  await expect(geography).toHaveAttribute(
    "src",
    "/api/reference-media/order-tracking-map-delivered",
  );
  await page
    .getByRole("button", { name: "Unmark as delivered", exact: true })
    .click();
  await expect(geography).toHaveAttribute(
    "src",
    "/api/reference-media/order-tracking-map-transit",
  );
  await expect(map.locator(":scope > svg")).toHaveCount(0);
});

test("manual delivery keeps its recommendation continuation through deals and Back", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-manual");
  await page.goto("/orders/REF-manual-shirt");
  await expect(page.locator("[data-manual-picked-photo]")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Mark as delivered", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Delivered today", exact: true }),
  ).toBeVisible();
  const preview = page.locator("[data-manual-picked-photo]");
  await expect(preview).toBeVisible();
  await expect(preview.locator("img")).toHaveAttribute(
    "src",
    "/api/reference-media/order-manual-picked-photo",
  );
  const deals = page.getByRole("link", { name: "Your deals", exact: true });
  await expect(deals).toHaveAttribute("href", "/deals");
  await deals.focus();
  await deals.press("Enter");
  await expect(page).toHaveURL(/\/deals$/);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Delivered today", exact: true }),
  ).toBeVisible();
  await expect(preview).toBeVisible();
  await page
    .getByRole("button", { name: "Unmark as delivered", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Label created", exact: true }),
  ).toBeVisible();
  await expect(preview).toHaveCount(0);
});

test("rapid delivery undo cancels celebration without an old timer clearing the next status", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-manual");
  await page.goto("/orders/REF-manual-shirt");
  const clockStart = new Date("2026-09-20T12:00:00Z");
  await page.clock.install({ time: clockStart });
  // Freeze wall time so actions cannot consume the source celebration interval.
  await page.clock.pauseAt(new Date(clockStart.getTime() + 1000));
  const mark = page.getByRole("button", {
    name: "Mark as delivered",
    exact: true,
  });
  const undo = page.getByRole("button", {
    name: "Unmark as delivered",
    exact: true,
  });
  const confetti = page.locator(".delivery-confetti");
  const toast = page.locator(".order-action-toast");
  await mark.click();
  await expect(confetti).toBeVisible();
  await page.clock.fastForward(700);
  await undo.click();
  await expect(confetti).toHaveCount(0);
  await expect(toast).toHaveText("Unmarked as delivered");
  await page.clock.fastForward(700);
  await mark.click();
  await page.clock.fastForward(1200);
  await expect(confetti).toBeVisible();
  await expect(toast).toHaveText("Marked as delivered");
  await page.clock.fastForward(300);
  await expect(confetti).toBeVisible();
  await expect(toast).toBeVisible();
  await page.clock.fastForward(400);
  await expect(toast).toHaveCount(0);
  await expect(confetti).toBeVisible();
  await page.clock.fastForward(1500);
  await expect(confetti).toHaveCount(0);
});

test("manual tracking keeps carrier controls and dock fade usable at mobile widths", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-manual");
  await page.goto("/orders/REF-manual-shirt");
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await expect(page.locator(".tracking-empty")).toHaveCSS(
      "border-radius",
      "16px",
    );
    const controls = await page
      .locator(".tracking-carrier button")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const bounds = element.getBoundingClientRect();
          const panel = element.closest("section")!.getBoundingClientRect();
          return bounds.left >= panel.left && bounds.right <= panel.right;
        }),
      );
    expect(controls.every(Boolean)).toBe(true);
    const fade = await page.locator(".tracking-detail").evaluate((element) => {
      const style = getComputedStyle(element, "::after");
      return { height: style.height, pointerEvents: style.pointerEvents };
    });
    expect(fade).toEqual({ height: "116px", pointerEvents: "none" });
    const carrier = page.getByRole("button", {
      name: "Open carrier tracking",
      exact: true,
    });
    await carrier.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(carrier).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});
