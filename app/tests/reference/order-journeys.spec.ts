import { expect, test, type Page } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 793 });
});

async function openTrackingEditor(page: Page) {
  await page
    .getByRole("button", { name: "Edit tracking details", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Edit tracking details",
    exact: true,
  });
  await expect(editor).toBeVisible();
  return editor;
}

test("source detail status yields to local delivery changes and keeps the source recommendation order", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-waiting");
  await page.goto("/orders/REF-1001?state=waiting");
  await expect(page.locator(".order-status")).toContainText(
    "Waiting for details",
  );
  await page.locator(".order-status").click();
  const waitingPreview = page.locator('.delivery-preview[data-waiting="true"]');
  await expect(waitingPreview).toBeVisible();
  const waitingGeometry = await waitingPreview.evaluate((preview) => {
    const orderCard = document.querySelector<HTMLElement>(
      ".tracking-order-card",
    );
    const panel = document.querySelector<HTMLElement>(".tracking-action-panel");
    const heading = preview.querySelector<HTMLElement>("h2");
    const destination = preview.querySelector<HTMLElement>(
      ".delivery-destination",
    );
    if (!orderCard || !panel || !heading || !destination)
      throw new Error("Waiting tracking continuation is incomplete");
    const orderRect = orderCard.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    return {
      orderGap: previewRect.top - orderRect.bottom,
      height: previewRect.height,
      headingTop: heading.getBoundingClientRect().top - previewRect.top,
      destinationTop: destination.getBoundingClientRect().top - previewRect.top,
      panelGap: panelRect.top - previewRect.bottom,
      documentWidth: document.documentElement.scrollWidth,
    };
  });
  expect(waitingGeometry.orderGap).toBeGreaterThanOrEqual(13);
  expect(waitingGeometry.orderGap).toBeLessThanOrEqual(15);
  expect(waitingGeometry.height).toBeGreaterThanOrEqual(103);
  expect(waitingGeometry.height).toBeLessThanOrEqual(105);
  expect(waitingGeometry.headingTop).toBeGreaterThanOrEqual(15);
  expect(waitingGeometry.headingTop).toBeLessThanOrEqual(17);
  expect(waitingGeometry.destinationTop).toBeGreaterThanOrEqual(52);
  expect(waitingGeometry.destinationTop).toBeLessThanOrEqual(54);
  expect(waitingGeometry.panelGap).toBeGreaterThanOrEqual(11);
  expect(waitingGeometry.panelGap).toBeLessThanOrEqual(13);
  expect(waitingGeometry.documentWidth).toBeLessThanOrEqual(394);
  await page.goBack();
  await expect(page.locator(".order-status")).toContainText(
    "Waiting for details",
  );
  await page
    .getByRole("button", { name: "Order options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mark order as delivered", exact: true })
    .click();
  await expect(page.locator(".order-status")).toContainText("Delivered Aug 1");
  await expect(page.locator(".order-status [data-order-phase]")).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]state=/);
  await expect(page.locator(".review-invitation")).toBeVisible();
  const products = page.locator(".product-rail .product-copy");
  await expect(products.nth(0)).toHaveAttribute(
    "href",
    "/products/black-conditioner-bag",
  );
  await expect(products.nth(1)).toHaveAttribute(
    "href",
    "/products/chocolate-body-bag",
  );
  await page
    .getByRole("button", { name: "Order options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Unmark as delivered", exact: true })
    .click();
  await expect(page.locator(".order-status")).toContainText("In transit");
  await expect(page.locator(".review-invitation")).toHaveCount(0);
  await expect(
    page.locator('.order-status [data-order-phase="transit"]'),
  ).toBeVisible();
});

test("tracking edit discards cancelled text, disables unchanged save and restores the delivery preview", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-transit");
  await page.goto("/orders/REF-1001?view=tracking&state=in-transit&map=1");
  // Geometry belongs to the interactive page. The initial SSR fieldset is
  // inert while the App Router finishes the mount and its initial scrolling.
  await expect(page.locator("[data-shop-interactive]").first()).toHaveAttribute(
    "data-shop-interactive",
    "true",
  );
  const preview = page.locator(".delivery-preview");
  await preview.evaluate((node) =>
    window.scrollBy(0, node.getBoundingClientRect().top - 33),
  );
  const initialY = await preview.evaluate(
    (node) => node.getBoundingClientRect().top,
  );
  expect(initialY).toBeGreaterThanOrEqual(20);
  expect(initialY).toBeLessThanOrEqual(46);
  const transitGeometry = await preview.evaluate((node) => {
    const previewRect = node.getBoundingClientRect();
    const heading = node.querySelector<HTMLElement>("h2");
    const destination = node.querySelector<HTMLElement>(
      ".delivery-destination",
    );
    const activityRows = [
      ...node.querySelectorAll<HTMLElement>(".source-activity > div"),
    ];
    const activityButton = node.querySelector<HTMLElement>(".muted-button");
    const panel = document.querySelector<HTMLElement>(".tracking-action-panel");
    const panelRows = panel
      ? [...panel.querySelectorAll<HTMLElement>(":scope > .account-row")]
      : [];
    const recommendation = [
      ...document.querySelectorAll<HTMLElement>("h2"),
    ].find((candidate) => candidate.textContent?.includes("Popular at KITSCH"));
    const product = document.querySelector<HTMLElement>(".product-card");
    if (
      !heading ||
      !destination ||
      activityRows.length !== 2 ||
      !activityButton ||
      !panel ||
      panelRows.length !== 3 ||
      !recommendation ||
      !product
    )
      throw new Error("In-transit delivery continuation is incomplete");
    const panelRect = panel.getBoundingClientRect();
    const recommendationRect = recommendation.getBoundingClientRect();
    return {
      previewHeight: previewRect.height,
      headingTop: heading.getBoundingClientRect().top - previewRect.top,
      destinationTop: destination.getBoundingClientRect().top - previewRect.top,
      firstEventTop:
        activityRows[0].getBoundingClientRect().top - previewRect.top,
      eventStep:
        activityRows[1].getBoundingClientRect().top -
        activityRows[0].getBoundingClientRect().top,
      activityButtonTop:
        activityButton.getBoundingClientRect().top - previewRect.top,
      panelGap: panelRect.top - previewRect.bottom,
      panelHeight: panelRect.height,
      panelRowHeight: panelRows[0].getBoundingClientRect().height,
      panelRowStep:
        panelRows[1].getBoundingClientRect().top -
        panelRows[0].getBoundingClientRect().top,
      recommendationGap: recommendationRect.top - panelRect.bottom,
      productGap:
        product.getBoundingClientRect().top - recommendationRect.bottom,
      documentWidth: document.documentElement.scrollWidth,
    };
  });
  expect(transitGeometry.previewHeight).toBeGreaterThanOrEqual(281);
  expect(transitGeometry.previewHeight).toBeLessThanOrEqual(283);
  expect(transitGeometry.headingTop).toBeGreaterThanOrEqual(18);
  expect(transitGeometry.headingTop).toBeLessThanOrEqual(20);
  expect(transitGeometry.destinationTop).toBeGreaterThanOrEqual(56);
  expect(transitGeometry.destinationTop).toBeLessThanOrEqual(58);
  expect(transitGeometry.firstEventTop).toBeGreaterThanOrEqual(114);
  expect(transitGeometry.firstEventTop).toBeLessThanOrEqual(116);
  expect(transitGeometry.eventStep).toBeGreaterThanOrEqual(57);
  expect(transitGeometry.eventStep).toBeLessThanOrEqual(59);
  expect(transitGeometry.activityButtonTop).toBeGreaterThanOrEqual(222);
  expect(transitGeometry.activityButtonTop).toBeLessThanOrEqual(224);
  expect(transitGeometry.panelGap).toBeGreaterThanOrEqual(11);
  expect(transitGeometry.panelGap).toBeLessThanOrEqual(13);
  expect(transitGeometry.panelHeight).toBeGreaterThanOrEqual(155);
  expect(transitGeometry.panelHeight).toBeLessThanOrEqual(157);
  expect(transitGeometry.panelRowHeight).toBeGreaterThanOrEqual(47);
  expect(transitGeometry.panelRowHeight).toBeLessThanOrEqual(49);
  expect(transitGeometry.panelRowStep).toBeGreaterThanOrEqual(47);
  expect(transitGeometry.panelRowStep).toBeLessThanOrEqual(49);
  expect(transitGeometry.recommendationGap).toBeGreaterThanOrEqual(22);
  expect(transitGeometry.recommendationGap).toBeLessThanOrEqual(24);
  expect(transitGeometry.productGap).toBeGreaterThanOrEqual(11);
  expect(transitGeometry.productGap).toBeLessThanOrEqual(13);
  expect(transitGeometry.documentWidth).toBeLessThanOrEqual(394);
  let editor = await openTrackingEditor(page);
  await editor.evaluate(async (node) => {
    await Promise.all(
      node
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  const editorGeometry = await editor.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  });
  expect(editorGeometry.x).toBeGreaterThanOrEqual(-1);
  expect(editorGeometry.x).toBeLessThanOrEqual(1);
  expect(editorGeometry.y).toBeGreaterThanOrEqual(-1);
  expect(editorGeometry.y).toBeLessThanOrEqual(1);
  expect(editorGeometry.width).toBeGreaterThanOrEqual(392);
  expect(editorGeometry.width).toBeLessThanOrEqual(394);
  expect(editorGeometry.height).toBeGreaterThanOrEqual(792);
  expect(editorGeometry.height).toBeLessThanOrEqual(794);
  await expect(
    editor.getByRole("button", {
      name: "Update tracking details",
      exact: true,
    }),
  ).toBeDisabled();
  await editor
    .getByLabel("Package name", { exact: true })
    .fill("Discard this draft");
  await editor
    .getByRole("button", { name: "Close Edit tracking details", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  editor = await openTrackingEditor(page);
  await expect(editor.getByLabel("Package name", { exact: true })).toHaveValue(
    "Shampoo Bar Bag",
  );
  await editor
    .getByLabel("Package name", { exact: true })
    .fill("Shampoo Bar Bag KITSCH");
  await editor
    .getByRole("button", { name: "Update tracking details", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  const savedToast = page.getByRole("status");
  await expect(savedToast).toContainText("Changes saved");
  const savedToastGeometry = await savedToast.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      bottom: innerHeight - rect.bottom,
    };
  });
  expect(savedToastGeometry.width).toBeGreaterThanOrEqual(120);
  expect(savedToastGeometry.width).toBeLessThanOrEqual(123);
  expect(savedToastGeometry.height).toBeGreaterThanOrEqual(42);
  expect(savedToastGeometry.height).toBeLessThanOrEqual(44);
  expect(savedToastGeometry.bottom).toBeGreaterThanOrEqual(105);
  expect(savedToastGeometry.bottom).toBeLessThanOrEqual(107);
  const y = await preview.evaluate((node) => node.getBoundingClientRect().top);
  expect(y).toBeGreaterThanOrEqual(20);
  expect(y).toBeLessThanOrEqual(46);
  editor = await openTrackingEditor(page);
  await expect(editor.getByLabel("Package name", { exact: true })).toHaveValue(
    "Shampoo Bar Bag KITSCH",
  );
  await page.goBack();
  await expect(editor).not.toBeVisible();
  await page
    .getByRole("button", { name: "Mark as delivered", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Delivered Aug 1", exact: true }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/[?&]state=/);
});

test("captured Amazon label tracking keeps a compact carrier handoff at mobile widths", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-transit");
  await page.goto("/orders/REF-1001?view=tracking&progress=label");
  await expect(page.locator("[data-shop-interactive]").first()).toHaveAttribute(
    "data-shop-interactive",
    "true",
  );
  const carrier = page.locator(".tracking-carrier");
  await expect(carrier).toHaveAttribute("data-carrier-mark", "amazon");
  await expect(carrier).toContainText("Amazon Logistics");
  await expect(carrier).toContainText("TBA333200762603");

  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    const geometry = await page.evaluate(() => {
      const carrierCard =
        document.querySelector<HTMLElement>(".tracking-carrier");
      const orderCard = document.querySelector<HTMLElement>(
        ".tracking-order-card",
      );
      if (!carrierCard || !orderCard)
        throw new Error("Tracking continuation cards are missing");
      const carrierRect = carrierCard.getBoundingClientRect();
      const orderRect = orderCard.getBoundingClientRect();
      return {
        carrierHeight: carrierRect.height,
        continuationGap: orderRect.top - carrierRect.bottom,
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    expect(geometry.carrierHeight).toBeGreaterThanOrEqual(138);
    expect(geometry.carrierHeight).toBeLessThanOrEqual(142);
    expect(geometry.continuationGap).toBeGreaterThanOrEqual(14);
    expect(geometry.continuationGap).toBeLessThanOrEqual(18);
    expect(geometry.documentWidth).toBeLessThanOrEqual(width + 1);
  }

  await page.setViewportSize({ width: 393, height: 793 });
  const preview = page.locator(".delivery-preview");
  await preview.evaluate((node) =>
    window.scrollBy(0, node.getBoundingClientRect().top - 12),
  );
  const previewGeometry = await preview.evaluate((node) => {
    const heading = node.querySelector<HTMLElement>("h2");
    const destination = node.querySelector<HTMLElement>(
      ".delivery-destination",
    );
    const activity = node.querySelector<HTMLElement>(".source-activity");
    if (!heading || !destination || !activity)
      throw new Error("Label-created delivery preview is incomplete");
    const previewRect = node.getBoundingClientRect();
    const relativeTop = (element: HTMLElement) =>
      element.getBoundingClientRect().top - previewRect.top;
    return {
      height: previewRect.height,
      headingTop: relativeTop(heading),
      destinationTop: relativeTop(destination),
      activityTop: relativeTop(activity),
    };
  });
  expect(previewGeometry.height).toBeGreaterThanOrEqual(161);
  expect(previewGeometry.height).toBeLessThanOrEqual(163);
  expect(previewGeometry.headingTop).toBeGreaterThanOrEqual(16);
  expect(previewGeometry.headingTop).toBeLessThanOrEqual(18);
  expect(previewGeometry.destinationTop).toBeGreaterThanOrEqual(53);
  expect(previewGeometry.destinationTop).toBeLessThanOrEqual(55);
  expect(previewGeometry.activityTop).toBeGreaterThanOrEqual(111);
  expect(previewGeometry.activityTop).toBeLessThanOrEqual(113);

  const productRhythm = await page
    .locator(".product-rail .product-copy")
    .first()
    .evaluate((node) => {
      const title = node.querySelector<HTMLElement>("strong");
      const rating = node.querySelector<HTMLElement>(".rating");
      const price = node.querySelector<HTMLElement>(":scope > span:last-child");
      if (!title || !rating || !price)
        throw new Error("Order recommendation copy is incomplete");
      const titleRect = title.getBoundingClientRect();
      const ratingRect = rating.getBoundingClientRect();
      const priceRect = price.getBoundingClientRect();
      return {
        height: node.getBoundingClientRect().height,
        titleToRating: ratingRect.top - titleRect.top,
        ratingToPrice: priceRect.top - ratingRect.top,
      };
    });
  expect(productRhythm.height).toBeGreaterThanOrEqual(59);
  expect(productRhythm.height).toBeLessThanOrEqual(61);
  expect(productRhythm.titleToRating).toBeGreaterThanOrEqual(16);
  expect(productRhythm.titleToRating).toBeLessThanOrEqual(18);
  expect(productRhythm.ratingToPrice).toBeGreaterThanOrEqual(17);
  expect(productRhythm.ratingToPrice).toBeLessThanOrEqual(19);

  const recommendationGap = await page.evaluate(() => {
    const heading = [...document.querySelectorAll<HTMLElement>("h2")].find(
      (node) => node.textContent?.includes("Popular at KITSCH"),
    );
    const firstCard = document.querySelector<HTMLElement>(
      ".product-rail .product-card",
    );
    if (!heading || !firstCard)
      throw new Error("Order recommendation continuation is missing");
    return (
      firstCard.getBoundingClientRect().top -
      heading.getBoundingClientRect().bottom
    );
  });
  expect(recommendationGap).toBeGreaterThanOrEqual(12);
  expect(recommendationGap).toBeLessThanOrEqual(14);

  const inspiredRail = page.locator("[data-order-inspired-rail]");
  const inspiredCard = page.locator("[data-order-inspired-card]");
  await expect(inspiredRail).toBeVisible();
  await expect(inspiredCard).toContainText("★ (11.4K)");
  await expect(inspiredCard.locator("img")).toHaveAttribute(
    "src",
    "/api/reference-media/order-inspired-card-photo",
  );
  await expect
    .poll(() =>
      inspiredCard
        .locator("img")
        .evaluate((image) =>
          image instanceof HTMLImageElement ? image.naturalWidth : 0,
        ),
    )
    .toBeGreaterThan(0);
  const inspiredGeometry = await page.evaluate(() => {
    const heading = [...document.querySelectorAll<HTMLElement>("h2")].find(
      (node) => node.textContent?.includes("Inspired by your order"),
    );
    const rail = document.querySelector<HTMLElement>(
      "[data-order-inspired-rail]",
    );
    const card = document.querySelector<HTMLElement>(
      "[data-order-inspired-card]",
    );
    const next = rail?.querySelector<HTMLElement>(":scope > div:last-child");
    const rating = card?.querySelector<HTMLElement>("span");
    if (!heading || !rail || !card || !next || !rating)
      throw new Error("Inspired order continuation is incomplete");
    const headingRect = heading.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const nextRect = next.getBoundingClientRect();
    const ratingRect = rating.getBoundingClientRect();
    return {
      headingTop: headingRect.top,
      cardTop: cardRect.top,
      cardLeft: cardRect.left,
      cardWidth: cardRect.width,
      cardHeight: cardRect.height,
      nextLeft: nextRect.left,
      nextWidth: nextRect.width,
      ratingRight: cardRect.right - ratingRect.right,
      railRight: railRect.right,
      documentWidth: document.documentElement.scrollWidth,
    };
  });
  expect(inspiredGeometry.headingTop).toBeGreaterThanOrEqual(667);
  expect(inspiredGeometry.headingTop).toBeLessThanOrEqual(671);
  // Flow 61/010 photograph begins at source y760 (normalized y701).
  // The preceding eight pixels are outside the photo, not its background.
  expect(inspiredGeometry.cardTop).toBeGreaterThanOrEqual(699);
  expect(inspiredGeometry.cardTop).toBeLessThanOrEqual(703);
  expect(inspiredGeometry.cardLeft).toBeGreaterThanOrEqual(16);
  expect(inspiredGeometry.cardLeft).toBeLessThanOrEqual(18);
  expect(inspiredGeometry.cardWidth).toBeGreaterThanOrEqual(351);
  expect(inspiredGeometry.cardWidth).toBeLessThanOrEqual(353);
  expect(inspiredGeometry.cardHeight).toBeGreaterThanOrEqual(91);
  expect(inspiredGeometry.cardHeight).toBeLessThanOrEqual(93);
  expect(inspiredGeometry.nextLeft).toBeGreaterThanOrEqual(376);
  expect(inspiredGeometry.nextLeft).toBeLessThanOrEqual(378);
  expect(inspiredGeometry.nextWidth).toBeGreaterThanOrEqual(15);
  expect(inspiredGeometry.nextWidth).toBeLessThanOrEqual(17);
  expect(inspiredGeometry.ratingRight).toBeGreaterThanOrEqual(14);
  expect(inspiredGeometry.ratingRight).toBeLessThanOrEqual(16);
  expect(inspiredGeometry.railRight).toBeLessThanOrEqual(394);
  expect(inspiredGeometry.documentWidth).toBeLessThanOrEqual(394);
});

test("manual package validates carrier selection and email forwarding remains an explicit boundary", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-waiting");
  const writes: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url());
  });
  await page.goto("/orders?view=manual");

  const moreOptions = page.getByRole("button", {
    name: "More order options",
    exact: true,
  });
  await moreOptions.click();
  let menu = page.getByRole("dialog", { name: "More options", exact: true });
  const closeMenu = menu.getByRole("button", {
    name: "Close More options",
    exact: true,
  });
  await expect(closeMenu).toBeVisible();
  const closeSize = await closeMenu.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  expect(closeSize.width).toBeGreaterThanOrEqual(23);
  expect(closeSize.width).toBeLessThanOrEqual(25);
  expect(closeSize.height).toBeGreaterThanOrEqual(23);
  expect(closeSize.height).toBeLessThanOrEqual(25);
  await closeMenu.click();
  await expect(menu).not.toBeVisible();
  await expect(moreOptions).toBeFocused();

  await moreOptions.click();
  menu = page.getByRole("dialog", { name: "More options", exact: true });
  await menu
    .getByRole("link", { name: "Add order manually", exact: true })
    .click();

  const fields = page.locator(".account-form > .form-field");
  await expect(fields).toHaveCount(3);
  const fieldGeometry = await fields.evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      };
    }),
  );
  for (const field of fieldGeometry) {
    expect(field.left).toBeGreaterThanOrEqual(15);
    expect(field.right).toBeLessThanOrEqual(378);
    expect(field.height).toBeGreaterThanOrEqual(57);
    expect(field.height).toBeLessThanOrEqual(59);
  }
  expect(
    Math.max(...fieldGeometry.map((field) => field.width)) -
      Math.min(...fieldGeometry.map((field) => field.width)),
  ).toBeLessThanOrEqual(1);

  const addOrder = page.getByRole("button", { name: "Add order", exact: true });
  await expect(addOrder).toBeDisabled();
  const forwardingGeometry = await page
    .locator(".forward-orders button, .forward-orders a")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      }),
    );
  for (const control of forwardingGeometry) {
    expect(control.left).toBeGreaterThanOrEqual(0);
    expect(control.right).toBeLessThanOrEqual(393);
  }

  const openEmail = page.getByRole("button", {
    name: "Open email app",
    exact: true,
  });
  await openEmail.click();
  const boundary = page.getByRole("dialog", {
    name: "Email forwarding unavailable",
    exact: true,
  });
  await expect(boundary).toContainText("No request was sent");
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  await boundary
    .getByRole("button", { name: "Back to preview", exact: true })
    .click();
  await expect(boundary).not.toBeVisible();
  await expect(openEmail).toBeFocused();

  await page.getByLabel("Tracking number", { exact: true }).fill("68448512123");
  await page
    .getByLabel("Package name", { exact: true })
    .fill("Loose Fit Printed T-Shirt");
  await page.getByLabel("Carrier", { exact: true }).fill("DHL");
  await expect(
    page.getByRole("heading", { name: "Recommended carriers", exact: true }),
  ).toBeVisible();
  await expect(addOrder).not.toBeVisible();

  const carrierRows = page.locator(".carrier-search .account-row");
  expect(await carrierRows.count()).toBeGreaterThanOrEqual(6);
  const carrierGeometry = await carrierRows.evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        height: rect.height,
      };
    }),
  );
  for (const row of carrierGeometry) {
    expect(row.left).toBeGreaterThanOrEqual(15);
    expect(row.right).toBeLessThanOrEqual(378);
    expect(row.height).toBeGreaterThanOrEqual(66);
    expect(row.height).toBeLessThanOrEqual(68);
  }
  expect(
    Math.max(...carrierGeometry.map((row) => row.height)) -
      Math.min(...carrierGeometry.map((row) => row.height)),
  ).toBeLessThanOrEqual(1);

  const carrierArtwork = carrierRows.locator("img.dhl-mark");
  expect(await carrierArtwork.count()).toBeGreaterThanOrEqual(5);
  for (let index = 0; index < (await carrierArtwork.count()); index += 1) {
    const artwork = carrierArtwork.nth(index);
    await expect(artwork).toHaveAttribute(
      "src",
      `/api/reference-media/order-carrier-${["active-tracing", "benelux", "two-man", "ecommerce", "spain"][index]}`,
    );
    await expect
      .poll(() =>
        artwork.evaluate((image) =>
          image instanceof HTMLImageElement ? image.naturalWidth : 0,
        ),
      )
      .toBeGreaterThan(0);
  }
  await expect(
    page
      .getByRole("button", { name: "DHL eCommerce Vietnam", exact: true })
      .locator("img"),
  ).toHaveCount(0);

  await page
    .getByRole("button", { name: "DHL eCommerce", exact: true })
    .click();
  await expect(page.getByLabel("Carrier", { exact: true })).toHaveValue(
    "DHL eCommerce",
  );
  await expect(addOrder).toBeEnabled();
  const enabledStyle = await addOrder.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
    };
  });
  expect(enabledStyle.backgroundColor).toBe("rgb(85, 50, 235)");
  expect(enabledStyle.color).toBe("rgb(255, 255, 255)");

  await addOrder.click();
  await expect(page).toHaveURL(/\/orders\?view=manual$/);
  const first = page.locator(".tracking-card").first();
  await expect(first).toContainText("Loose Fit Printed T-Shirt");
  await expect(first).toContainText("Label created");
  const manualCard = await first.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { height: rect.height };
  });
  expect(manualCard.height).toBeGreaterThanOrEqual(107);
  expect(manualCard.height).toBeLessThanOrEqual(109);
  await expect(
    first.locator('img[src="/api/reference-media/order-manual-parcel"]'),
  ).toBeVisible();
  await expect(first.locator('[data-order-phase="label"] svg')).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Go back", exact: true }),
  ).toBeVisible();

  const buyAgain = page.locator(".orders-buy-again > a");
  const buyAgainGeometry = await buyAgain.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  expect(buyAgainGeometry.width).toBeGreaterThanOrEqual(111);
  expect(buyAgainGeometry.width).toBeLessThanOrEqual(113);
  expect(buyAgainGeometry.height).toBeGreaterThanOrEqual(111);
  expect(buyAgainGeometry.height).toBeLessThanOrEqual(113);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(394);

  await first.click();
  await expect(page.locator(".tracking-carrier")).toContainText(
    "DHL eCommerce",
  );
  await expect(page.locator(".tracking-carrier")).toContainText("68448512123");
  await page
    .getByRole("button", { name: "Mark as delivered", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Delivered today", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Unmark as delivered", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Label created", exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([]);
});

test("archive action removes the active card and the archived order can be restored through navigation", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-waiting");
  await page.goto("/orders/REF-1001?state=waiting");
  await page
    .getByRole("button", { name: "Order options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Archive order", exact: true })
    .click();
  await page.getByRole("link", { name: "Orders", exact: true }).click();
  await expect(page.locator(".tracking-card")).toHaveCount(0);
  await page
    .getByRole("button", { name: "More order options", exact: true })
    .click();
  await page
    .getByRole("link", { name: "View order archive", exact: true })
    .click();
  const archived = page.locator(".archive-order-row");
  await expect(archived).toContainText("Ordered Jul 27");
  await expect(archived).toContainText("KITSCH · 1 item · $10.82");
  await archived.click();
  await page
    .getByRole("button", { name: "Order options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Unarchive order", exact: true })
    .click();
  await page.getByRole("link", { name: "Orders", exact: true }).click();
  await expect(page.locator(".tracking-card")).toHaveCount(1);
});

test("delivered card opens the review editor, retains local edits and supports deletion without publication", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-delivered");
  const writes: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url());
  });
  await page.goto("/orders");
  await page.locator(".tracking-card").click();
  await expect(page).toHaveURL(/\/orders\/REF-1001\/review$/);
  await expect(
    page.getByRole("button", { name: "5 stars", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByLabel("Tell us about the product", { exact: true })
    .fill("Love it");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Edit your review", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "It has not been published",
  );

  await page.getByRole("link", { name: "Close review", exact: true }).click();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.locator(".tracking-card")).toBeFocused();
  await page.locator(".tracking-card").click();
  await expect(
    page.getByLabel("Tell us about the product", { exact: true }),
  ).toHaveValue("Love it");
  await expect(
    page.getByRole("button", { name: "5 stars", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  const reviewOptions = page.getByRole("button", {
    name: "Review options",
    exact: true,
  });
  await reviewOptions.click();
  let reviewMenu = page.getByRole("dialog", {
    name: "Your review",
    exact: true,
  });
  await reviewMenu
    .getByRole("button", { name: "Close Your review", exact: true })
    .click();
  await expect(reviewMenu).not.toBeVisible();
  await expect(reviewOptions).toBeFocused();

  await reviewOptions.click();
  reviewMenu = page.getByRole("dialog", {
    name: "Your review",
    exact: true,
  });
  await reviewMenu.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Review your order", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Tell us about the product", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Submit", exact: true }),
  ).toBeDisabled();
  expect(writes).toEqual([]);
});

test("delivery history keeps all recorded events in order and closes with browser Back", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-delivered");
  await page.goto("/orders/REF-1001?view=tracking&map=1");
  await page
    .getByRole("button", { name: "View all activity", exact: true })
    .click();
  const activity = page.getByRole("dialog", {
    name: "Delivery progress",
    exact: true,
  });
  await activity.evaluate(async (node) => {
    await Promise.all(
      node
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  const activityGeometry = await activity.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  });
  expect(activityGeometry.x).toBeGreaterThanOrEqual(15);
  expect(activityGeometry.x).toBeLessThanOrEqual(17);
  expect(activityGeometry.y).toBeGreaterThanOrEqual(245);
  expect(activityGeometry.y).toBeLessThanOrEqual(249);
  expect(activityGeometry.width).toBeGreaterThanOrEqual(360);
  expect(activityGeometry.width).toBeLessThanOrEqual(362);
  expect(activityGeometry.height).toBeGreaterThanOrEqual(510);
  expect(activityGeometry.height).toBeLessThanOrEqual(514);
  await expect(
    activity.locator('[aria-label="Close Delivery progress"]'),
  ).toBeHidden();
  await expect(
    page.locator(".delivery-preview .delivery-destination"),
  ).toHaveCount(0);
  const activityRows = activity.locator(".source-activity > div");
  await expect(activityRows).toHaveCount(9);
  await expect(activity.locator(".source-activity strong").first()).toHaveText(
    "Successfully delivered",
  );
  await expect(activity.locator(".source-activity strong").last()).toHaveText(
    "Parcel data submitted to carrier",
  );
  const timelineGeometry = await activity.evaluate((node) => {
    const sheetRect = node.getBoundingClientRect();
    const title = node.querySelector<HTMLElement>(".sheet-header h2");
    const rows = [
      ...node.querySelectorAll<HTMLElement>(".source-activity > div"),
    ];
    if (!title || rows.length !== 9)
      throw new Error("Delivery activity timeline is incomplete");
    const textTop = (row: HTMLElement) =>
      row.querySelector<HTMLElement>(":scope > span")!.getBoundingClientRect()
        .top;
    return {
      titleTop: title.getBoundingClientRect().top - sheetRect.top,
      firstTextTop: textTop(rows[0]) - sheetRect.top,
      firstStep: textTop(rows[1]) - textTop(rows[0]),
      regularStep: textTop(rows[2]) - textTop(rows[1]),
      maxScroll: node.scrollHeight - node.clientHeight,
    };
  });
  expect(timelineGeometry.titleTop).toBeGreaterThanOrEqual(27);
  expect(timelineGeometry.titleTop).toBeLessThanOrEqual(30);
  expect(timelineGeometry.firstTextTop).toBeGreaterThanOrEqual(66);
  expect(timelineGeometry.firstTextTop).toBeLessThanOrEqual(68);
  expect(timelineGeometry.firstStep).toBeGreaterThanOrEqual(57);
  expect(timelineGeometry.firstStep).toBeLessThanOrEqual(59);
  expect(timelineGeometry.regularStep).toBeGreaterThanOrEqual(59);
  expect(timelineGeometry.regularStep).toBeLessThanOrEqual(61);
  expect(timelineGeometry.maxScroll).toBeGreaterThanOrEqual(82);
  expect(timelineGeometry.maxScroll).toBeLessThanOrEqual(84);

  await activity.evaluate((node) => node.scrollTo(0, 460));
  const earliestGeometry = await activity.evaluate((node) => {
    const labels = [
      ...node.querySelectorAll<HTMLElement>(".source-activity strong"),
    ];
    return {
      scrollTop: node.scrollTop,
      thirdLabelTop: labels[2].getBoundingClientRect().top,
      lastLabelTop: labels.at(-1)!.getBoundingClientRect().top,
    };
  });
  expect(earliestGeometry.scrollTop).toBeGreaterThanOrEqual(82);
  expect(earliestGeometry.scrollTop).toBeLessThanOrEqual(84);
  expect(earliestGeometry.thirdLabelTop).toBeGreaterThanOrEqual(364);
  expect(earliestGeometry.thirdLabelTop).toBeLessThanOrEqual(366);
  expect(earliestGeometry.lastLabelTop).toBeGreaterThanOrEqual(724);
  expect(earliestGeometry.lastLabelTop).toBeLessThanOrEqual(726);
  await expect(
    activity.getByText("Parcel data submitted to carrier", { exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(activity).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "View all activity", exact: true }),
  ).toBeFocused();
});

test("the short-height manual form keeps every required control reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await useReferenceScenario(page, "orders-waiting");
  await page.goto("/orders/new");

  const requiredControls = [
    page.getByLabel("Tracking number", { exact: true }),
    page.getByLabel("Package name", { exact: true }),
    page.getByLabel("Carrier", { exact: true }),
    page.getByRole("button", { name: "Open email app", exact: true }),
    page.getByRole("link", {
      name: "Track orders automatically instead",
      exact: true,
    }),
  ];
  for (const control of requiredControls) {
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeVisible();
    const rect = await control.evaluate((node) => {
      const box = node.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom };
    });
    expect(rect.top).toBeGreaterThanOrEqual(-1);
    expect(rect.bottom).toBeLessThanOrEqual(569);
  }

  await page.getByLabel("Tracking number", { exact: true }).fill("68448512123");
  await page
    .getByLabel("Package name", { exact: true })
    .fill("Loose Fit Printed T-Shirt");
  await page.getByLabel("Carrier", { exact: true }).fill("DHL");
  await page
    .getByRole("button", { name: "DHL eCommerce", exact: true })
    .click();
  const submit = page.getByRole("button", { name: "Add order", exact: true });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeEnabled();
  const submitRect = await submit.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom };
  });
  expect(submitRect.top).toBeGreaterThanOrEqual(-1);
  expect(submitRect.bottom).toBeLessThanOrEqual(569);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(321);
});

test("manual carrier search can recover, dismiss and retain an existing carrier", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-transit");
  await page.goto("/orders/REF-1001?view=tracking");
  const editor = await openTrackingEditor(page);
  const carrier = editor.getByLabel("Carrier", { exact: true });
  await carrier.fill("unlisted-carrier");
  await expect(editor.getByRole("status")).toHaveText("No matching carriers");
  await editor.getByRole("button", { name: "Show all carriers" }).click();
  await editor
    .getByRole("button", { name: "Amazon Logistics", exact: true })
    .click();
  await expect(carrier).toHaveValue("Amazon Logistics");
  await carrier.fill("DHL");
  await carrier.press("Escape");
  await expect(editor).toBeVisible();
  await expect(carrier).toBeFocused();
  await expect(carrier).toHaveValue("Amazon Logistics");
  await expect(editor.locator(".carrier-search")).toHaveCount(0);
  await expect(
    editor.getByRole("button", { name: "Update tracking details" }),
  ).toBeDisabled();
  await carrier.press("Escape");
  await expect(editor).not.toBeVisible();
  await page.goto("/orders/new");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByRole("button", { name: "track-q6uoeuhu57@my.shop.app", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Email address copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "track-q6uoeuhu57@my.shop.app",
  );
});

test("deleting a reference order supports cancellation and undo from Orders", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-waiting");
  await page.goto("/orders/REF-1001");
  await page
    .getByRole("button", { name: "Order options", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Delete this order?",
    exact: true,
  });
  await dialog.getByRole("button", { name: "Keep order", exact: true }).click();
  await expect(page.locator(".order-hero")).toBeVisible();
  await page
    .getByRole("button", { name: "Order options", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Delete order", exact: true })
    .click();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.locator('.tracking-card[href*="REF-1001"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator('.tracking-card[href*="REF-1001"]')).toBeVisible();
});

test("manual packages do not expose unrelated geography and review help returns focus", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-manual");
  await page.goto("/orders/REF-manual-shirt?map=1");
  await expect(
    page.getByRole("heading", { name: "Label created", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".tracking-map")).toHaveCount(0);
  await expect(page.locator("button.tracking-status-card")).toHaveCount(0);
  await page.goto("/orders/REF-1001/review");
  const help = page.getByRole("button", { name: "About your review name" });
  await help.click();
  const dialog = page.getByRole("dialog", {
    name: "Your review name",
    exact: true,
  });
  await expect(dialog).toContainText("does not publish");
  await page.goBack();
  await expect(dialog).not.toBeVisible();
  await expect(help).toBeFocused();
});

test("Orders typography keeps source-specific faces scoped to their owning surfaces", async ({
  page,
}) => {
  const fontFamily = async (selector: string) => {
    await page.evaluate(() => document.fonts.ready);
    return page
      .locator(selector)
      .first()
      .evaluate((element) => getComputedStyle(element).fontFamily);
  };

  await useReferenceScenario(page, "orders-transit");
  await page.goto("/orders");
  await expect(page.locator(".tracking-card")).toBeVisible();
  expect(await fontFamily(".source-orders-page")).not.toContain(
    "ShopOrdersGeist",
  );

  await page.goto("/orders/REF-1001?state=in-transit");
  await expect(page.locator(".order-status")).toBeVisible();
  expect(await fontFamily(".order-status")).toContain("ShopOrdersGeist");
  await page
    .getByRole("button", { name: "Order options", exact: true })
    .click();
  await expect(page.locator(".source-order-menu")).toBeVisible();
  expect(await fontFamily(".source-order-menu")).not.toContain(
    "ShopOrdersGeist",
  );

  await useReferenceScenario(page, "orders-empty");
  await page.goto("/orders");
  await expect(page.locator(".order-empty-source")).toBeVisible();
  expect(await fontFamily(".source-orders-page")).toContain("ShopOrdersGeist");
  await page.goto("/orders/new");
  await expect(page.locator(".account-form")).toBeVisible();
  expect(await fontFamily(".account-form")).toContain("ShopOrdersGeist");

  await useReferenceScenario(page, "orders-archived");
  await page.goto("/orders/archived");
  await expect(page.locator(".archive-page")).toBeVisible();
  expect(await fontFamily(".archive-page")).toContain("ShopOrdersGeist");

  await useReferenceScenario(page, "orders-delivered");
  await page.goto("/orders/REF-1001/review");
  await expect(page.locator(".order-review-page")).toBeVisible();
  expect(await fontFamily(".order-review-page")).not.toContain(
    "ShopOrdersGeist",
  );
});
for (const width of [320, 393, 430]) {
  test(`order and manual-entry surfaces stay within ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 793 });
    await useReferenceScenario(page, "orders-transit");
    for (const route of [
      "/orders/REF-1001?state=in-transit",
      "/orders/new",
      "/orders?view=manual",
    ]) {
      await page.goto(route);
      await expect(
        page.locator('[data-shop-interactive="true"]').first(),
      ).toBeAttached();
      const sizes = await page.evaluate(() => ({
        width: window.innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1);
    }
  });
}
