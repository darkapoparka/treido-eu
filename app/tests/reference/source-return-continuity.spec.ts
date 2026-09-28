import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test("account information rows restore their opener through Back and contextual Cancel", async ({
  page,
}) => {
  await page.goto("/account/privacy");
  const entry = page.getByRole("link", { name: "Delete account", exact: true });
  await entry.click();
  await expect(page).toHaveURL(/\/account\/delete$/);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(entry).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(/\/account\/delete$/);
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(entry).toBeFocused();
  await expect(
    page.getByRole("link", { name: "Privacy policy", exact: true }),
  ).toHaveAttribute("href", "https://www.shopify.com/legal/privacy/consumers");
  await page.goto("/account/delete");
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/account\/privacy$/);
});

test("Explore headings restore their source focus and scroll through native Back and Forward", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/explore");
  const heading = page.getByRole("link", {
    name: "New in beauty",
    exact: true,
  });
  await heading.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => scrollY);
  await heading.click();
  await expect(page).toHaveURL(/\/search\?category=Beauty&sort=Newest$/);
  for (let visit = 0; visit < 2; visit += 1) {
    await page.goBack();
    await expect(heading).toBeFocused();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(scroll);
    if (visit === 0) {
      await page.goForward();
      await expect(page).toHaveURL(/\/search\?category=Beauty&sort=Newest$/);
    }
  }
});

test("a prior source return does not override a later cart sheet return", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/stores/kitsch");
  const information = page
    .getByRole("link", { name: "Store information", exact: true })
    .first();
  await information.click();
  await expect(page).toHaveURL(/\/stores\/kitsch\/info$/);
  await page.goBack();
  await expect(information).toBeFocused();
  const collection = page.locator(".store-grid-heading");
  await collection.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => scrollY);
  const cart = page.getByRole("button", { name: "Open cart", exact: true });
  await cart.click();
  await expect(
    page.getByRole("dialog", { name: "Your cart", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(cart).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(scroll);
  await expect(information).not.toBeFocused();
});

test("Beauty editorial and category cards return to their actual source controls", async ({
  page,
}) => {
  await page.goto("/explore/Beauty");
  for (const name of [/Skincare starter set/, "Perfume & cologne"]) {
    const source = page.getByRole("link", { name });
    await source.scrollIntoViewIfNeeded();
    const scroll = await page.evaluate(() => scrollY);
    await source.click();
    await expect(page).toHaveURL(/\/search\?q=/);
    await page.goBack();
    await expect(source).toBeFocused();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(scroll);
  }
});

test("Support Close retains its draft, captured conversation and non-bottom reading position", async ({
  page,
}) => {
  await page.goto("/support");
  const entry = page.getByRole("link", { name: /Support Chat/ });
  await entry.click();
  const draft = page.getByRole("textbox", {
    name: "Message support",
    exact: true,
  });
  const close = page.getByRole("link", { name: "Close support", exact: true });
  await draft.fill("My unsent draft");
  await close.click();
  await expect(entry).toBeFocused();
  await entry.click();
  await expect(draft).toHaveValue("My unsent draft");
  await draft.fill("Is it possible to cancel an order and request a refund?");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByLabel("Captured example response", { exact: true }),
  ).toBeVisible();
  const conversation = page.getByLabel("Support conversation", { exact: true });
  await expect
    .poll(() =>
      conversation.evaluate(
        (element) => element.scrollHeight - element.clientHeight,
      ),
    )
    .toBeGreaterThan(80);
  await conversation.evaluate((element) => {
    element.scrollTop = 40;
  });
  await expect
    .poll(() => conversation.evaluate((element) => element.scrollTop))
    .toBe(40);
  await draft.fill("A later unsent question");
  await close.click();
  await expect(entry).toBeFocused();
  await entry.click();
  await expect(draft).toHaveValue("A later unsent question");
  await expect(
    page.getByLabel("Captured example response", { exact: true }),
  ).toBeAttached();
  await expect
    .poll(() => conversation.evaluate((element) => element.scrollTop))
    .toBe(40);
  await expect(
    page.getByRole("link", { name: /Go to orders/ }),
  ).toHaveAttribute("href", "/orders");
});
