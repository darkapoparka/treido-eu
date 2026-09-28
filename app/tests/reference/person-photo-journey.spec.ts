import { test, expect } from "@playwright/test";

const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nVQAAAAASUVORK5CYII=",
  "base64",
);

test("person photo edits stay with that person across Account navigation", async ({
  page,
}) => {
  await page.goto("/account");
  const add = page.getByRole("link", { name: /Add someone/ });
  await add.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await add.click();
  await page.getByRole("textbox", { name: "Nickname" }).fill("Sam");
  await page.getByRole("button", { name: "Friend", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("textbox", { name: "Month" }).fill("02");
  await page.getByRole("textbox", { name: "Day" }).fill("18");
  await page.getByRole("textbox", { name: "Year" }).fill("1995");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const avatar = page.locator(".person-avatar-wrap > .source-profile-avatar");
  await expect(avatar).toHaveCSS("width", "100px");
  await expect.poll(async () => (await avatar.boundingBox())?.y).toBe(8);
  const edit = page.getByRole("button", {
    name: "Edit person profile picture",
  });
  await edit.click();
  const menu = page.getByRole("dialog", { name: "Profile picture" });
  await expect(menu).toBeVisible();
  await page.getByLabel("Choose profile photo").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: pixel,
  });
  await expect(menu).not.toBeVisible();
  await expect(edit).toBeFocused();
  await expect(avatar.getByRole("img")).toHaveAttribute(
    "src",
    /^data:image\/png/,
  );
  await page.getByRole("button", { name: "Go back" }).click();
  await expect(page).toHaveURL(/\/account$/);
  const personLink = page.getByRole("link", {
    name: /Selected profile picture Sam/,
  });
  await expect(personLink.getByRole("img")).toBeVisible();
  await personLink.click();
  await expect(page.locator(".person-avatar-wrap img")).toHaveAttribute(
    "src",
    /^data:image\/png/,
  );
  await page.getByRole("button", { name: "Delete Sam", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.locator(".person-chip")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Add someone/ })).toBeVisible();
});
