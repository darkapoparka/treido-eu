import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

const normalGreeting = "Hey, I am Sol. What are we hunting for today, Alex?";
const phase = (page: Page, value: string) =>
  page.locator(`[data-sol-phase="${value}"]`);
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
async function capture(page: Page, id: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((image) =>
        image.decode().catch(() => undefined),
      ),
    );
  });
  const broken = await page
    .locator("img:visible")
    .evaluateAll((elements) =>
      elements
        .filter((element) => !(element as HTMLImageElement).naturalWidth)
        .map((element) => element.getAttribute("src")),
    );
  expect(broken, `${id} must not capture broken artwork`).toEqual([]);
  await mkdir(".qa/shop-parity/media-review", { recursive: true });
  await page.screenshot({
    path: `.qa/shop-parity/media-review/${id}-live.png`,
  });
}
async function enter(page: Page) {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/minis");
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await page.locator('.mini-feature[href="/minis/sol"]').click();
  const access = page.getByRole("dialog", { name: "Continue", exact: true });
  await expect(access).toBeVisible();
  await access.getByRole("button", { name: "Agree", exact: true }).click();
  await expect(access).not.toBeVisible();
}
async function connect(page: Page) {
  await button(page, "Allow & Continue ›").click();
  await page
    .getByRole("dialog", {
      name: "Allow access to your microphone?",
      exact: true,
    })
    .getByRole("button", { name: "Share", exact: true })
    .click();
  await expect(phase(page, "greeting")).toBeVisible();
}

test("Sol setup follows catalogue, consent, welcome, permission, connecting and greeting without a provider request", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 793 });
  await useReferenceScenario(page, "home-welcome");
  const outside: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      !["GET", "HEAD"].includes(request.method()) ||
      (url.protocol.startsWith("http") && url.hostname !== "127.0.0.1")
    )
      outside.push(`${request.method()} ${url.origin}${url.pathname}`);
  });
  await page.goto("/minis");
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await capture(page, "f053-001");
  await page.locator('.mini-feature[href="/minis/sol"]').click();
  const access = page.getByRole("dialog", { name: "Continue", exact: true });
  await expect(access).toBeVisible();
  await expect(access).toContainText(
    "does not share your profile with Sol: Browse by Voice",
  );
  await expect(page.locator(".sol-welcome-art")).toHaveAttribute(
    "src",
    "/api/reference-media/sol-welcome-loading-art",
  );
  await expect(page.locator(".sol-decoration-lower-right")).toHaveAttribute(
    "src",
    "/api/reference-media/sol-welcome-loading-lower-right",
  );
  await capture(page, "f053-002");
  await access.getByRole("button", { name: "Agree", exact: true }).click();
  await expect(access).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Hi, I’m Sol", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".sol-welcome-art")).toHaveAttribute(
    "src",
    "/api/reference-media/sol-welcome-art",
  );
  await capture(page, "f053-003");
  await button(page, "Allow & Continue ›").click();
  const microphone = page.getByRole("dialog", {
    name: "Allow access to your microphone?",
    exact: true,
  });
  await expect(microphone).toBeVisible();
  await expect(microphone).toContainText(
    "does not request microphone access or send audio",
  );
  await expect(page.locator(".sol-welcome-art")).toHaveAttribute(
    "src",
    "/api/reference-media/sol-welcome-permission-art",
  );
  await expect(page.locator(".sol-decoration-lower-right")).toHaveAttribute(
    "src",
    "/api/reference-media/sol-welcome-permission-lower-right",
  );
  await capture(page, "f053-004");
  await microphone.getByRole("button", { name: "Share", exact: true }).click();
  await expect(phase(page, "connecting")).toBeVisible();
  await capture(page, "f053-005");
  await expect(
    page.getByRole("heading", { name: normalGreeting, exact: true }),
  ).toBeVisible();
  await capture(page, "f053-006");
  expect(outside).toEqual([]);
});

test("the captured sunglasses conversation reaches the correct two choices and real AKIRA result, not another product", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 793 });
  await enter(page);
  await connect(page);
  await capture(page, "f054-001");
  await button(page, "Sol preview controls").click();
  await button(page, "Use captured sunglasses voice example").click();
  await expect(phase(page, "response")).toBeVisible();
  await capture(page, "f054-002");
  await expect(phase(page, "choices")).toBeVisible();
  await expect(button(page, "Gold rimless glasses")).toBeVisible();
  await expect(button(page, "Dark sunglasses")).toBeVisible();
  await capture(page, "f054-003");
  await button(page, "Gold rimless glasses").click();
  await expect(phase(page, "selected")).toBeVisible();
  await expect(button(page, "Gold rimless glasses")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(button(page, "Dark sunglasses")).toHaveCount(0);
  await capture(page, "f054-004");
  const results = page.getByRole("region", {
    name: "Captured sunglasses recommendations",
    exact: true,
  });
  await expect(results).toBeVisible();
  await expect(
    results.locator('.product-media a[href="/products/u-see-me"]'),
  ).toBeVisible();
  await expect(results).toContainText("AKIRA");
  await expect(results).toContainText("$14.90");
  await expect(results.locator('[data-product-id="hush-glasses"]')).toHaveCount(
    1,
  );
  await expect(
    results.locator('a[href="/products/round-sunglasses"]'),
  ).toHaveCount(0);
  await capture(page, "f054-005");
  const save = results.getByRole("button", {
    name: /^Save U SEE ME GLASSES$/i,
  });
  await save.click();
  await expect(
    results.getByRole("button", { name: /^Unsave U SEE ME GLASSES$/i }),
  ).toHaveAttribute("aria-pressed", "true");
  await results.getByRole("button", { name: "Save HUSH", exact: true }).click();
  await page
    .getByRole("link", { name: "Close Sol: Browse by Voice", exact: true })
    .click();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("link", { name: "Saved", exact: true }).click();
  await expect(
    page.locator('.saved-grid [data-product-id="u-see-me"]'),
  ).toBeVisible();
  const hush = page.locator('.saved-grid [data-product-id="hush-glasses"]');
  await expect(hush).toBeVisible();
  await expect(hush.locator("img")).toHaveCount(0);
  await expect(hush).toContainText("$95.00");
  await hush
    .getByRole("button", { name: "View captured HUSH", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Captured item details", exact: true }),
  ).toContainText("FORK Eyewear");
});

test("mute, text drafting, baseball-cap choices and browser history retain their own source state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 793 });
  await enter(page);
  await connect(page);
  await capture(page, "f056-001");
  await button(page, "Mute microphone preview").click();
  await expect(button(page, "Unmute microphone preview")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("heading", {
      name: "Hey Alex, I’m Sol. What are we hunting for today?",
      exact: true,
    }),
  ).toBeVisible();
  await capture(page, "f056-002");
  await button(page, "Unmute microphone preview").click();
  await expect(
    page.getByRole("heading", { name: normalGreeting, exact: true }),
  ).toBeVisible();
  await capture(page, "f055-001");
  await button(page, "Type instead").click();
  const input = page.getByRole("textbox", { name: "Message Sol", exact: true });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("");
  await capture(page, "f055-002");
  await input.fill("Baseball cap");
  await capture(page, "f055-003");
  await input.press("Enter");
  await expect(phase(page, "choices")).toHaveAttribute(
    "data-sol-topic",
    "caps",
  );
  await expect(button(page, "Tan embroidered cap")).toBeVisible();
  await expect(button(page, "Boston baseball cap")).toBeVisible();
  await expect(input).toHaveValue("");
  await capture(page, "f055-004");
  await button(page, "Boston baseball cap").click();
  await expect(phase(page, "selected")).toHaveAttribute(
    "data-sol-topic",
    "caps",
  );
  await expect(phase(page, "selected").getByRole("status")).toContainText(
    "Boston baseball cap selected",
  );
  await expect(
    page.getByRole("region", { name: "Captured sunglasses recommendations" }),
  ).toHaveCount(0);
  await page.goBack();
  await expect(phase(page, "choices")).toBeVisible();
  await page.goBack();
  await expect(phase(page, "greeting")).toBeVisible();
  await expect(input).toHaveValue("Baseball cap");
  await page.goForward();
  await expect(phase(page, "choices")).toHaveAttribute(
    "data-sol-topic",
    "caps",
  );
});

test("cancelling microphone setup restores focus and Back cancels the pending local connection", async ({
  page,
}) => {
  await enter(page);
  await button(page, "Allow & Continue ›").click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(button(page, "Allow & Continue ›")).toBeFocused();
  await button(page, "Allow & Continue ›").click();
  await button(page, "Share").click();
  await expect(phase(page, "connecting")).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Hi, I’m Sol", exact: true }),
  ).toBeVisible();
  // Deliberately cross the documented local 2400ms playback interval: a stale
  // timer must not bring a dismissed conversation back over the welcome page.
  await page.waitForTimeout(2700);
  await expect(
    page.getByRole("heading", { name: "Hi, I’m Sol", exact: true }),
  ).toBeVisible();
  await expect(phase(page, "greeting")).toHaveCount(0);
});

test("Sol setup sheets keep actions reachable at short sibling viewports", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/minis/sol");
  const access = page.getByRole("dialog", { name: "Continue", exact: true });
  await expect(access).toBeVisible();
  const viewports = [
    { width: 320, height: 568 },
    { width: 393, height: 650 },
    { width: 430, height: 793 },
  ];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    const contained = await access.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const actions = [...element.querySelectorAll("button")].map((button) =>
        button.getBoundingClientRect(),
      );
      return (
        bounds.left >= 0 &&
        bounds.right <= innerWidth &&
        bounds.top >= 0 &&
        bounds.bottom <= innerHeight &&
        actions.every(
          (action) =>
            action.left >= 0 &&
            action.right <= innerWidth &&
            action.top >= 0 &&
            action.bottom <= innerHeight,
        ) &&
        document.documentElement.scrollWidth <= innerWidth
      );
    });
    expect(
      contained,
      `Sol access at ${viewport.width}x${viewport.height}`,
    ).toBe(true);
  }
  await page.setViewportSize({ width: 393, height: 793 });
  await access.getByRole("button", { name: "Agree", exact: true }).click();
  const trigger = button(page, "Allow & Continue ›");
  await trigger.click();
  const permission = page.getByRole("dialog", {
    name: "Allow access to your microphone?",
    exact: true,
  });
  await expect(permission).toBeVisible();
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    const contained = await permission.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const actions = [...element.querySelectorAll("button")].map((button) =>
        button.getBoundingClientRect(),
      );
      return (
        bounds.left >= 0 &&
        bounds.right <= innerWidth &&
        bounds.top >= 0 &&
        bounds.bottom <= innerHeight &&
        actions.every(
          (action) =>
            action.left >= 0 &&
            action.right <= innerWidth &&
            action.top >= 0 &&
            action.bottom <= innerHeight,
        ) &&
        document.documentElement.scrollWidth <= innerWidth
      );
    });
    expect(
      contained,
      `Sol microphone permission at ${viewport.width}x${viewport.height}`,
    ).toBe(true);
  }
  await page.setViewportSize({ width: 393, height: 793 });
  await permission.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(trigger).toBeFocused();
});
test("Sol contains its editable composer at sibling widths and keeps unsupported queries as drafts", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await button(page, "Sol preview controls").click();
  await button(page, "Continue with text").click();
  const input = page.getByRole("textbox", { name: "Message Sol", exact: true });
  await expect(input).toBeFocused();
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await input.fill("A different question");
    await expect(button(page, "Send local message")).toBeVisible();
    const contained = await input.evaluate((element) => {
      const box = element.closest("form")!.getBoundingClientRect();
      return (
        box.left >= 0 &&
        box.right <= innerWidth &&
        box.bottom <= innerHeight &&
        document.documentElement.scrollWidth <= innerWidth
      );
    });
    expect(contained, `Sol at ${width}`).toBe(true);
  }
  await input.press("Enter");
  const unavailable = page.getByRole("dialog", {
    name: "Recorded responses",
    exact: true,
  });
  await expect(unavailable).toBeVisible();
  await expect(unavailable).toContainText("has not been sent anywhere");
  await button(page, "Return to my draft").click();
  await expect(unavailable).not.toBeVisible();
  await expect(input).toHaveValue("A different question");
  await expect(input).toBeFocused();
});
