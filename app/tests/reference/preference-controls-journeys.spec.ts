import { test, expect } from "@playwright/test";

for (const width of [320, 393, 430]) {
  test(`preference controls remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 793 });
    await page.goto("/account");
    const addSkin = page.getByRole("button", {
      name: "+ Skin care",
      exact: true,
    });
    await addSkin.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await addSkin.click();
    const skin = page.locator(".field-panel:has(.preference-skinType)");
    const chip = page.getByRole("button", { name: "Combination", exact: true });
    await expect(chip).toBeVisible();
    await expect(chip).toHaveCSS("height", "36px");
    await expect(chip).toHaveCSS("font-size", "12px");
    await expect(skin.locator(".preference-chips")).toHaveCSS("gap", "6px");
    for (const name of ["Combination", "With redness", "Sensitive"]) {
      await page.getByRole("button", { name, exact: true }).click();
      await expect(
        page.getByRole("button", { name, exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
    }
    const before = (await skin.boundingBox())!;
    await page.getByRole("button", { name: /^Skin undertone/ }).click();
    const after = (await skin.boundingBox())!;
    expect(
      Math.abs(after.y + after.height - before.y - before.height),
    ).toBeLessThanOrEqual(2);
    const firstPaintBottom = await skin.evaluate(
      (element) =>
        new Promise<number>((resolve) => {
          requestAnimationFrame(() =>
            resolve(element.getBoundingClientRect().bottom),
          );
        }),
    );
    expect(
      Math.abs(firstPaintBottom - before.y - before.height),
    ).toBeLessThanOrEqual(2);
    await page
      .getByRole("button", { name: "Pink/Yellow", exact: true })
      .click();
    await page.getByRole("button", { name: /^Skin tone/ }).click();
    await page.getByRole("button", { name: "Fair skin", exact: true }).click();
    await page.getByRole("button", { name: /^Skin tone/ }).click();
    const badge = skin.locator(".preference-undertone .selected-preferences i");
    await expect(badge).toHaveCSS("background-color", "rgb(251, 229, 186)");
    const layout = await page.evaluate(() => ({
      viewport: innerWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(layout.content).toBeLessThanOrEqual(layout.viewport);
    const addSomeone = page.getByRole("link", { name: /Add someone/ });
    await expect(addSomeone).toHaveCSS("font-size", "16px");
    await expect(addSomeone).toHaveCSS("height", "66px");
    // Account data is intentionally memory-only in this frontend preview.
    // Route navigation must preserve it without persisting personal entries.
    await page.getByRole("link", { name: "View public profile" }).click();
    await expect(page).toHaveURL(/\/account\/public$/);
    await page.goBack();
    await expect(
      page.getByRole("button", {
        name: /^Skin type Combination With redness Sensitive/,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Skin undertone Pink\/Yellow/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Skin tone Fair skin/ }),
    ).toBeVisible();
  });
}
