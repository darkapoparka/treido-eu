import { test, expect, type Page } from "@playwright/test";

const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nVQAAAAASUVORK5CYII=",
  "base64",
);

async function expectNoHorizontalOverflow(page: Page) {
  const { innerWidth, scrollWidth } = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

test("flows 69-75 preserve profile, photo, public-profile and inline account edits", async ({
  page,
}) => {
  await page.goto("/profile");
  await expect(
    page.getByRole("link", { name: /alexsmith\.mobbin\+3@gmail\.com/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Order history" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: /alexsmith\.mobbin\+3@gmail\.com/ })
    .click();
  await expect(page).toHaveURL(/\/account$/);

  const editPhoto = page.getByRole("button", { name: "Edit profile picture" });
  await editPhoto.click();
  const photoMenu = page.getByRole("dialog", { name: "Profile picture" });
  await expect(
    photoMenu.getByRole("button", { name: "Choose from library" }),
  ).toBeVisible();
  await expect(
    photoMenu.getByRole("button", { name: "Take a photo" }),
  ).toBeVisible();
  await page.getByLabel("Choose profile photo").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: pixel,
  });
  await expect(photoMenu).not.toBeVisible();
  await expect(page.getByAltText("Selected profile picture")).toBeVisible();
  await expect(editPhoto).toBeFocused();

  await page.getByRole("link", { name: "View public profile" }).click();
  await expect(
    page.getByText(
      "Your profile is hidden until you create your first public collection.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create public collection" }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/account$/);

  await page.getByRole("button", { name: "First name" }).click();
  await page.getByRole("textbox", { name: "First name" }).fill("Alex");
  await page.getByRole("textbox", { name: "Last name" }).fill("Smith");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("button", { name: "Alex", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Smith", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Select gender" }).click();
  await page.getByRole("radio", { name: "Female" }).click();
  await expect(page.getByRole("button", { name: "Female" })).toBeVisible();

  await page.getByRole("button", { name: "MM/DD/YYYY" }).click();
  await page.getByRole("textbox", { name: "Month" }).fill("02");
  await page.getByRole("textbox", { name: "Day" }).fill("18");
  await page.getByRole("textbox", { name: "Year" }).fill("1995");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "02/18/1995" })).toBeVisible();
});

test("flows 76-77 align expanded preference panels and contain them at mobile widths", async ({
  page,
}) => {
  await page.goto("/account");
  await page.getByRole("button", { name: /^Shoe size/ }).click();
  const sizePanel = page.locator(".profile-editor .field-panel").nth(1);
  const sizeBox = await sizePanel.boundingBox();
  expect(sizeBox?.y ?? 0).toBeGreaterThanOrEqual(145);
  expect(sizeBox?.y ?? 999).toBeLessThanOrEqual(165);
  await expect(page.getByRole("button", { name: "8.5" })).toBeVisible();
  await page.getByRole("button", { name: "8.5" }).click();
  await expect(
    page.getByRole("button", { name: /^Shoe size 8\.5/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: "+ Skin care" }).click();
  const skinPanel = page.locator(".profile-editor .field-panel").nth(2);
  const skinBox = await skinPanel.boundingBox();
  expect(skinBox?.y ?? 0).toBeGreaterThanOrEqual(104);
  expect(skinBox?.y ?? 999).toBeLessThanOrEqual(124);
  await expect(page.getByRole("button", { name: "Aging" })).toBeVisible();
  await page.getByRole("button", { name: "Combination", exact: true }).click();
  await page.getByRole("button", { name: "Sensitive", exact: true }).click();
  await page.getByRole("button", { name: "With redness", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Combination", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Sensitive", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "With redness", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: /^Skin undertone/ }).click();
  await page.getByRole("button", { name: "Pink/Yellow", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^Skin undertone Pink\/Yellow/ }),
  ).toBeVisible();

  for (const width of [320, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await expectNoHorizontalOverflow(page);
    const panel = await skinPanel.boundingBox();
    expect(panel?.x ?? -1).toBeGreaterThanOrEqual(15);
    expect((panel?.x ?? 0) + (panel?.width ?? width + 1)).toBeLessThanOrEqual(
      width - 15,
    );
  }
});

test("flow 78 keeps Account behind the person editor and returns once with the saved person", async ({
  page,
}) => {
  await page.goto("/account");
  const addPerson = page.getByRole("link", { name: /Add someone/ });
  await addPerson.scrollIntoViewIfNeeded();
  await addPerson.click();
  await expect(page).toHaveURL(/\/account\/people\?view=nickname/);
  const nickname = page.getByRole("dialog", { name: "Add a nickname" });
  await expect(nickname).toBeVisible();
  await expect(page.locator("main.profile-editor")).toBeVisible();
  await expect(nickname.locator(".sheet-header")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Nickname" })).toBeFocused();
  await nickname.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(addPerson).toBeFocused();
  await addPerson.click();
  await expect(page.getByRole("textbox", { name: "Nickname" })).toBeFocused();

  await page.getByRole("textbox", { name: "Nickname" }).fill("Sam");
  await nickname.getByRole("button", { name: "Friend" }).click();
  await nickname.getByRole("button", { name: "Save" }).click();
  const birthday = page.getByRole("dialog", { name: "Add Sam's birthday" });
  await expect(birthday).toBeVisible();
  await expect(birthday.locator(".sheet-header")).toBeVisible();
  await birthday.getByRole("textbox", { name: "Month" }).fill("02");
  await birthday.getByRole("textbox", { name: "Day" }).fill("18");
  await birthday.getByRole("textbox", { name: "Year" }).fill("1995");
  await expect(birthday.getByRole("textbox", { name: "Year" })).toHaveValue(
    "1995",
  );
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 485 });
    const fields = await birthday.getByRole("textbox").evaluateAll((inputs) =>
      inputs.map((element) => {
        const input = element as HTMLInputElement;
        const style = getComputedStyle(input);
        const context = document.createElement("canvas").getContext("2d")!;
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const rect = input.getBoundingClientRect();
        return {
          label: input.getAttribute("aria-label"),
          textWidth: context.measureText(input.value).width,
          availableWidth:
            input.clientWidth -
            parseFloat(style.paddingLeft) -
            parseFloat(style.paddingRight),
          left: rect.left,
          right: rect.right,
        };
      }),
    );
    expect(fields).toHaveLength(3);
    for (const field of fields) {
      expect(
        field.availableWidth,
        `${field.label} must show its complete value at ${width}px`,
      ).toBeGreaterThanOrEqual(field.textWidth);
      expect(field.left).toBeGreaterThanOrEqual(0);
      expect(field.right).toBeLessThanOrEqual(width);
    }
    await expectNoHorizontalOverflow(page);
  }
  await page.setViewportSize({ width: 393, height: 793 });
  await birthday.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("textbox", { name: "Nickname" })).toHaveValue(
    "Sam",
  );
  await expect(page.getByRole("textbox", { name: "Nickname" })).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Relation Friend" }),
  ).toBeVisible();
  await expect(page.getByText("02/18/1995", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Go back" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("link", { name: "Sam" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Add someone new/ }),
  ).toBeFocused();
  const savedPerson = page.locator(".person-chip").filter({ hasText: "Sam" });
  await savedPerson.click();
  await expect(page.getByRole("textbox", { name: "Nickname" })).toHaveValue(
    "Sam",
  );
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(savedPerson).toBeFocused();

  await page.getByRole("link", { name: /Add someone new/ }).click();
  await nickname.getByRole("textbox", { name: "Nickname" }).fill("Robin");
  await nickname.getByRole("button", { name: "Friend" }).click();
  await nickname.getByRole("button", { name: "Save" }).click();
  await page
    .getByRole("dialog", { name: "Add Robin's birthday" })
    .getByRole("button", { name: "Skip" })
    .click();
  await expect(page.getByRole("textbox", { name: "Nickname" })).toHaveValue(
    "Robin",
  );
  await expect(page.getByRole("textbox", { name: "Nickname" })).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/\/account$/);
  await expect(
    page.getByRole("link", { name: /Add someone new/ }),
  ).toBeFocused();
});
