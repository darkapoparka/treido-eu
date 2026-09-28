import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test("Jeans results open the captured answer over their exact query and return through Back and Forward", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/search?q=Jeans");
  const queryInput = page.locator('input[aria-label="Search products"]');
  await expect(queryInput).toHaveValue("Jeans");
  const results = page.locator("[data-result-id]");
  await expect(results.nth(0)).toHaveAttribute(
    "data-result-id",
    "carpenter-jeans",
  );
  await expect(results.nth(1)).toHaveAttribute(
    "data-result-id",
    "heritage-jeans",
  );
  const trigger = page.getByRole("button", {
    name: "View answer for Jeans",
    exact: true,
  });
  await trigger.click();
  const answer = page.getByRole("dialog", {
    name: "Jeans answer",
    exact: true,
  });
  await expect(answer).toBeVisible();
  await expect(page).toHaveURL(/q=Jeans&answer=jeans/);
  await expect(queryInput).toHaveValue("");
  await expect(queryInput).toHaveAttribute("placeholder", "Search");
  await expect(
    answer.getByRole("heading", { name: "Jeans", exact: true }),
  ).toBeFocused();
  await page.goBack();
  await expect(answer).not.toBeVisible();
  await expect(page).toHaveURL(/\/search\?q=Jeans$/);
  await expect(queryInput).toHaveValue("Jeans");
  await expect(trigger).toBeFocused();
  await page.goForward();
  await expect(answer).toBeVisible();
  await expect(queryInput).toHaveValue("");
  await page.reload();
  await expect(answer).toBeVisible();
  await expect(queryInput).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(answer).not.toBeVisible();
  await expect(page).toHaveURL(/\/search\?q=Jeans$/);
  await expect(queryInput).toHaveValue("Jeans");
  await expect(trigger).toBeFocused();
});

test("answer feedback submits locally and closes only its child sheet", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/search?q=Jeans");
  await page
    .getByRole("button", { name: "View answer for Jeans", exact: true })
    .click();
  const answer = page.getByRole("dialog", {
    name: "Jeans answer",
    exact: true,
  });
  const positive = answer.getByRole("button", {
    name: "Give positive feedback",
    exact: true,
  });
  await positive.click();
  const feedback = page.getByRole("dialog", { name: "Feedback", exact: true });
  await expect(feedback).toBeVisible();
  const second = feedback.getByRole("button", { name: /^Like URBAN STRAIGHT/ });
  await second.click();
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await feedback
    .getByRole("textbox", {
      name: "Share any thoughts about the entire response",
      exact: true,
    })
    .fill("Nice response");
  await feedback.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(feedback).not.toBeVisible();
  await expect(answer).toBeVisible();
  await expect(positive).toHaveAttribute("aria-pressed", "true");
  await expect(positive).toBeFocused();
  await expect(
    answer.getByText("Thanks for your feedback", { exact: true }),
  ).toBeVisible();
  await answer
    .getByRole("button", { name: "Close assistant", exact: true })
    .click();
  await expect(answer).not.toBeVisible();
  await expect(page).toHaveURL(/\/search\?q=Jeans$/);
});

test("nested filter choices retain the results underlay until the root filter closes", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/search?q=Jeans");
  const first = page.locator("[data-result-id]").first();
  await expect(first).toHaveAttribute("data-result-id", "carpenter-jeans");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  const filter = page.getByRole("dialog", { name: "Filter", exact: true });
  await filter
    .getByRole("checkbox", { name: "Your deals", exact: true })
    .check();
  await expect(first).toHaveAttribute("data-result-id", "carpenter-jeans");
  await filter.getByRole("button", { name: /Sort by/ }).click();
  const sort = page.getByRole("dialog", { name: "Sort by", exact: true });
  await sort
    .getByRole("button", { name: "Highest → Lowest Price", exact: true })
    .click();
  await sort.getByRole("button", { name: "Done", exact: true }).click();
  await expect(filter).toBeVisible();
  await expect(first).toHaveAttribute("data-result-id", "carpenter-jeans");
  await filter.getByRole("button", { name: "Category", exact: true }).click();
  const category = page.getByRole("dialog", { name: "Category", exact: true });
  await category.getByRole("button", { name: "Women", exact: true }).click();
  const women = page.getByRole("dialog", { name: "Women", exact: true });
  const pants = women.getByRole("button", { name: "Pants", exact: true });
  await pants.click();
  await expect(pants).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/category=Pants/);
  const selectedUrl = page.url();
  for (const name of ["Shirts & tops", "Shoes", "Intimates", "Activewear"]) {
    const branch = women.getByRole("button", { name, exact: true });
    await expect(branch).toHaveAttribute("aria-haspopup", "dialog");
    await expect(branch.locator(".radio-outline")).toHaveCount(0);
  }
  const shirts = women.getByRole("button", {
    name: "Shirts & tops",
    exact: true,
  });
  await shirts.click();
  const unavailable = page.getByRole("dialog", {
    name: "Shirts & tops",
    exact: true,
  });
  await expect(unavailable).toContainText(
    "These subcategories are not included in the captured reference.",
  );
  await expect(page).toHaveURL(selectedUrl);
  await page.goBack();
  await expect(unavailable).not.toBeVisible();
  await expect(women).toBeVisible();
  await expect(shirts).toBeFocused();
  await expect(pants).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(selectedUrl);
  await women.getByRole("button", { name: "Done", exact: true }).click();
  await category.getByRole("button", { name: "Done", exact: true }).click();
  await expect(first).toHaveAttribute("data-result-id", "carpenter-jeans");
  await filter.getByRole("button", { name: "Done", exact: true }).click();
  await expect(filter).not.toBeVisible();
  await expect(page).toHaveURL(/deals=true/);
  await expect(page).toHaveURL(/category=Pants/);
  await expect(first).not.toHaveAttribute("data-result-id", "carpenter-jeans");
});

test("the final Jeans facets render the captured merchants and leading products", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto(
    "/search?q=Jeans&deals=true&sort=Highest+%E2%86%92+Lowest+Price&category=Pants",
  );

  const stores = page.locator(".search-stores");
  await expect(
    stores.getByRole("link", { name: /Arrow Twenty Two/ }),
  ).toContainText("Save $5");
  await expect(
    stores.getByRole("link", { name: /American Blues/ }),
  ).toContainText("Save $15");
  await expect(
    stores.locator(
      'img[src="/api/reference-media/search-filter-store-continuation"]',
    ),
  ).toHaveCount(1);

  const results = page.locator("[data-result-id]");
  await expect(results.nth(0)).toHaveAttribute(
    "data-result-id",
    "valentino-blue-denim",
  );
  await expect(results.nth(1)).toHaveAttribute(
    "data-result-id",
    "givenchy-wide-leg-denim",
  );
  await expect(
    results
      .nth(0)
      .locator('img[src="/api/reference-media/search-filter-valentino"]'),
  ).toHaveCount(1);
  await expect(
    results.nth(0).getByRole("link", { name: "See related products" }),
  ).toBeVisible();
  await expect(
    results.nth(0).getByText("Save $130", { exact: true }),
  ).toBeVisible();

  const filterIcon = page
    .getByRole("button", { name: "Filter", exact: true })
    .locator("svg");
  await expect(filterIcon.locator("circle")).toHaveCount(2);
  await expect(filterIcon.locator('path[fill="none"]')).toHaveCount(1);

  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});

test("Jeans typography stays source-scoped across result and filter stages", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/search?q=Jeans");
  await expect(page.locator(".search-results").first()).toHaveCSS(
    "font-family",
    /ShopSearchGeist/,
  );
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  const root = page.getByRole("dialog", { name: "Filter", exact: true });
  expect(
    await root.evaluate((node) => getComputedStyle(node).fontFamily),
  ).not.toContain("ShopSearchGeist");
  await root.getByRole("button", { name: /Sort by/ }).click();
  const sort = page.getByRole("dialog", { name: "Sort by", exact: true });
  await expect(sort).toHaveCSS("font-family", /ShopSearchGeist/);
  await sort.getByRole("button", { name: "Done", exact: true }).click();
  await root.getByRole("button", { name: "Category", exact: true }).click();
  const category = page.getByRole("dialog", { name: "Category", exact: true });
  expect(
    await category.evaluate((node) => getComputedStyle(node).fontFamily),
  ).not.toContain("ShopSearchGeist");
});

test("Your deals toggles immediately and stays committed through quick filter reopen", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/search?q=Jeans");
  for (const selected of [true, false, true, false]) {
    await page.getByRole("button", { name: "Filter", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Filter", exact: true });
    const deals = sheet.getByRole("checkbox", {
      name: "Your deals",
      exact: true,
    });
    await deals.setChecked(selected);
    if (selected) await expect(deals).toBeChecked();
    else await expect(deals).not.toBeChecked();
    await sheet.getByRole("button", { name: "Done", exact: true }).click();
    await expect(sheet).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Your deals", exact: true }),
    ).toHaveAttribute("aria-pressed", String(selected));
    expect(new URL(page.url()).searchParams.has("deals")).toBe(selected);
  }
});
test("saving an answer recommendation updates the shared Saved library", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/search?q=Jeans");
  await page
    .getByRole("button", { name: "View answer for Jeans", exact: true })
    .click();
  const answer = page.getByRole("dialog", {
    name: "Jeans answer",
    exact: true,
  });
  const card = answer.locator('[data-answer-product="city-duaa-denim"]');
  await card
    .getByRole("button", { name: /^Save Men’s Duaa Neptune Denim/ })
    .click();
  await expect(
    card.getByRole("button", { name: /^Unsave Men’s Duaa Neptune Denim/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await answer
    .getByRole("button", { name: "Close assistant", exact: true })
    .click();
  await expect(answer).not.toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("link", { name: "Saved", exact: true }).click();
  await expect(page).toHaveURL(/\/saved$/, { timeout: 12000 });
  await expect(
    page.locator('.saved-grid [data-product-id="city-duaa-denim"]'),
  ).toBeVisible();
});

test("captured answer rails preserve their source continuations without replacing live controls", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/search?q=Jeans");
  await page
    .getByRole("button", { name: "View answer for Jeans", exact: true })
    .click();
  const answer = page.getByRole("dialog", {
    name: "Jeans answer",
    exact: true,
  });
  const cityIndicators = answer.locator(
    '[data-answer-product="city-duaa-denim"] .product-media > span[aria-hidden="true"]',
  );
  const signatureIndicators = answer.locator(
    '[data-answer-product="assistant-signature-straight"] .product-media > span[aria-hidden="true"]',
  );
  await expect(cityIndicators.locator("i")).toHaveCount(4);
  await expect(signatureIndicators.locator("i")).toHaveCount(2);
  await expect(signatureIndicators.locator("i").nth(1)).toHaveAttribute(
    "data-current",
    "true",
  );
  await expect(cityIndicators.locator("button,a")).toHaveCount(0);
  await expect(
    answer.locator(".assistant-partial-product img"),
  ).toHaveAttribute("src", "/api/reference-media/assistant-blue-partial");
  await expect(answer.locator(".assistant-wide-partial img")).toHaveAttribute(
    "src",
    "/api/reference-media/assistant-wide-partial",
  );
  await expect(
    answer.locator(".assistant-wide-rail article > span"),
  ).toHaveCount(2);
  // f046-002 retains the pale merchant captions below the lower photo rail.
  // The composer fade may cover them; the captions themselves stay visible.
  const wideMerchantLabels = answer.locator(
    ".assistant-wide-rail article > span",
  );
  await expect(wideMerchantLabels).toHaveText([
    "Jeans Warehouse",
    "Jeans Warehouse",
  ]);
  for (const label of await wideMerchantLabels.all()) {
    await expect(label).toHaveCSS("visibility", "visible");
    await expect(label).toHaveCSS("color", "rgb(189, 189, 189)");
  }
  await answer.locator(".assistant-page").evaluate((element) => {
    element.scrollTo({ top: element.scrollHeight });
  });
  await expect(
    answer.getByText("keep you comfortable through a long day.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    answer
      .getByRole("link", { name: "Edit search", exact: true })
      .locator("path"),
  ).toHaveCount(2);
  expect(
    await answer
      .getByRole("button", { name: "Close assistant", exact: true })
      .evaluate((element) => getComputedStyle(element).boxShadow),
  ).not.toBe("none");
});

test("feedback keeps source geometry, white vote glyphs and nested focus at mobile widths", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/search?q=Jeans");
  await page
    .getByRole("button", { name: "View answer for Jeans", exact: true })
    .click();
  const positive = page.getByRole("button", {
    name: "Give positive feedback",
    exact: true,
  });
  await positive.click();
  const feedback = page.getByRole("dialog", { name: "Feedback", exact: true });
  const vote = feedback.getByRole("button", { name: /^Like URBAN STRAIGHT/ });
  const note = feedback.getByRole("textbox", {
    name: "Share any thoughts about the entire response",
    exact: true,
  });
  await vote.focus();
  await page.keyboard.press("Enter");
  await expect(vote).toHaveAttribute("aria-pressed", "true");
  await expect(vote).toHaveCSS("color", "rgb(255, 255, 255)");
  await note.fill("Nice response");
  await expect(note).toHaveCSS("outline-style", "none");
  await expect(note).toHaveCSS("border-top-color", "rgb(221, 221, 221)");
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await expect(
      feedback.getByRole("button", { name: "Submit", exact: true }),
    ).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await expect
      .poll(async () => {
        const sheet = (await feedback.boundingBox())!;
        return sheet.y + sheet.height;
      })
      .toBeCloseTo(759, 0);
  }
  await page.keyboard.press("Escape");
  await expect(feedback).not.toBeVisible();
  await expect(positive).toBeFocused();
  await positive.click();
  await expect(vote).toHaveAttribute("aria-pressed", "true");
  await expect(note).toHaveValue("Nice response");
  await expect(
    feedback.locator(".feedback-products img").nth(0),
  ).toHaveAttribute("src", "/api/reference-media/assistant-feedback-signature");
  await expect(
    feedback.locator(".feedback-products img").nth(1),
  ).toHaveAttribute("src", "/api/reference-media/assistant-feedback-urban");
  const fragment = feedback.locator(
    '.feedback-products img[src="/api/reference-media/assistant-feedback-third-fragment"]',
  );
  await expect(fragment).toHaveCSS("width", "37px");
  await expect(fragment.locator("..").locator("button")).toHaveCount(0);
  await feedback.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(feedback).not.toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Jeans answer", exact: true }),
  ).toBeVisible();
  await expect(positive).toBeFocused();
});

test("answer captions keep the source rail rhythm without wrapping or moving the composer", async ({
  page,
}) => {
  await useReferenceScenario(page, "search-entry");
  await page.goto("/search?q=Jeans");
  await page
    .getByRole("button", { name: "View answer for Jeans", exact: true })
    .click();
  const answer = page.getByRole("dialog", {
    name: "Jeans answer",
    exact: true,
  });
  const body = answer.locator(".assistant-page");
  const headings = body.locator(":scope > h2");
  const captions = body.locator(":scope > .form-note");
  const caption = captions.first();
  const rail = body.locator(":scope > .assistant-product-rail").first();
  const wideRail = body.locator(":scope > .assistant-wide-rail");
  await expect(headings.first()).toHaveCSS("font-size", "19px");
  await expect(headings).toHaveCount(2);
  await expect(captions).toHaveCount(2);
  for (const heading of [headings.first(), headings.nth(1)]) {
    await expect(heading).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, -2)");
  }
  for (const note of [captions.first(), captions.nth(1)]) {
    await expect(note).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, -1)");
  }
  await expect(rail).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 1)");
  await expect(wideRail).toHaveCSS("transform", "none");
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await expect(caption).toHaveCSS("white-space", "nowrap");
    expect((await caption.boundingBox())!.height).toBe(16);
    await expect(rail.locator("article > b").first()).toHaveCSS(
      "line-height",
      "16px",
    );
    await expect
      .poll(async () => {
        const composer = (await answer
          .locator(".assistant-composer")
          .boundingBox())!;
        return composer.y + composer.height;
      })
      .toBeCloseTo(757, 0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
  await answer
    .getByRole("button", { name: "Close assistant", exact: true })
    .click();
  await expect(answer).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "View answer for Jeans", exact: true }),
  ).toBeFocused();
});

test("answer grabber drags the real sheet, cancels short pulls and restores query and focus", async ({
  page,
}) => {
  await useReferenceScenario(page, "search-entry");
  await page.goto("/search?q=Jeans");
  const trigger = page.getByRole("button", {
    name: "View answer for Jeans",
    exact: true,
  });
  await trigger.click();
  const answer = page.getByRole("dialog", {
    name: "Jeans answer",
    exact: true,
  });
  const handle = answer.locator(".sheet-drag-handle");
  await expect(answer).toHaveCSS("transform", "none");
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 20, { steps: 4 });
  await expect(answer).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 20)");
  await page.mouse.up();
  await expect(answer).toBeVisible();
  await expect(answer).toHaveCSS("transform", "none");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 110, { steps: 8 });
  await page.mouse.up();
  await expect(answer).not.toBeVisible();
  await expect(page).toHaveURL(/\/search\?q=Jeans$/);
  await expect(trigger).toBeFocused();
  await page.goForward();
  await expect(answer).toBeVisible();
  await expect(answer).toHaveCSS("transform", "none");
  const positive = answer.getByRole("button", {
    name: "Give positive feedback",
    exact: true,
  });
  await positive.click();
  const feedback = page.getByRole("dialog", { name: "Feedback", exact: true });
  await expect(feedback).toHaveCSS("transform", "none");
  const header = (await feedback.locator(".sheet-header h2").boundingBox())!;
  await page.mouse.move(header.x + 10, header.y + 10);
  await page.mouse.down();
  await page.mouse.move(header.x + 10, header.y + 120, { steps: 8 });
  await page.mouse.up();
  await expect(feedback).not.toBeVisible();
  await expect(answer).toBeVisible();
  await expect(positive).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(answer).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("touch cancellation releases the answer grabber before the next mobile swipe", async ({
  page,
}) => {
  await useReferenceScenario(page, "search-entry");
  await page.goto("/search?q=Jeans");
  const trigger = page.getByRole("button", {
    name: "View answer for Jeans",
    exact: true,
  });
  await trigger.click();
  const answer = page.getByRole("dialog", {
    name: "Jeans answer",
    exact: true,
  });
  await expect(answer).toHaveCSS("transform", "none");
  const box = (await answer.locator(".sheet-drag-handle").boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  const touch = await page.context().newCDPSession(page);
  try {
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y + 45, id: 1 }],
    });
    await expect(answer).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 45)");
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await expect(answer).toBeVisible();
    await expect(answer).toHaveCSS("transform", "none");
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 2 }],
    });
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y + 110, id: 2 }],
    });
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(answer).not.toBeVisible();
    await expect(page).toHaveURL(/\/search\?q=Jeans$/);
    await expect(trigger).toBeFocused();
  } finally {
    await touch.detach();
  }
});
