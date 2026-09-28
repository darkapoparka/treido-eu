import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test("long account values stay inside their controls without losing their editable text", async ({
  page,
}) => {
  await page.goto("/account");
  const name = "Alexandria Montgomery Wellington";
  await page.getByRole("button", { name: "First name", exact: true }).click();
  await page
    .getByRole("textbox", { name: "First name", exact: true })
    .fill(name);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const value = page.getByRole("button", { name, exact: true });
  const email = page.locator('[data-account-field="email"] > button');
  const emailText = await email.textContent();
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await expect(value).toHaveAccessibleName(name);
    await expect(email).toHaveAccessibleName(emailText!);
    const bounds = await page
      .locator(".profile-contact-fields")
      .evaluate((panel) =>
        [...panel.querySelectorAll<HTMLElement>(".profile-field > button")].map(
          (button) => {
            const row = button.parentElement!;
            const trailing = row.lastElementChild!.getBoundingClientRect();
            const rect = button.getBoundingClientRect();
            return {
              right: rect.right,
              trailingLeft: trailing.left,
              height: rect.height,
              rowHeight: row.getBoundingClientRect().height,
            };
          },
        ),
      );
    for (const control of bounds) {
      expect(control.right).toBeLessThanOrEqual(control.trailingLeft);
      expect(control.height).toBeLessThanOrEqual(control.rowHeight);
    }
    await expect(value).toHaveCSS("text-overflow", "ellipsis");
    await expect(email).toBeDisabled();
  }
  await value.click();
  const editor = page.getByRole("textbox", { name: "First name", exact: true });
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue(name);
  await editor.fill("Alexandria");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Alexandria", exact: true }),
  ).toBeFocused();
});

test("inline account editors focus their own field and return to its saved value", async ({
  page,
}) => {
  await page.goto("/account");
  for (const [field, initial, value] of [
    ["First name", "First name", "Jamie"],
    ["Last name", "Last name", "Rivera"],
  ]) {
    await page.getByRole("button", { name: initial, exact: true }).click();
    const input = page.getByRole("textbox", { name: field, exact: true });
    await expect(input).toBeFocused();
    await input.fill(value);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByRole("button", { name: value, exact: true }),
    ).toBeFocused();
  }
  await page.getByRole("button", { name: "MM/DD/YYYY", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Month", exact: true }),
  ).toBeFocused();
  await page.getByRole("textbox", { name: "Month", exact: true }).fill("02");
  await page.getByRole("textbox", { name: "Day", exact: true }).fill("18");
  await page.getByRole("textbox", { name: "Year", exact: true }).fill("1995");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "02/18/1995", exact: true }),
  ).toBeFocused();
});

test("profile content routes restore their actual opener after edits and nested returns", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/profile");
  for (const label of ["Saved", "Following", "Connect accounts"]) {
    const opener = page.getByRole("link", { name: label, exact: true });
    await opener.click();
    await expect(page).not.toHaveURL(/\/profile$/);
    await page.locator(".dock-back").click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(opener).toBeFocused();
  }
  const identity = page.locator('[data-source-return="profile-identity"]');
  await identity.click();
  await page.getByRole("button", { name: "First name", exact: true }).click();
  await page
    .getByRole("textbox", { name: "First name", exact: true })
    .fill("Jamie");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const publicProfile = page.getByRole("link", {
    name: "View public profile",
    exact: true,
  });
  await publicProfile.click();
  const help = page.getByRole("link", { name: "Learn more", exact: true });
  await help.click();
  await expect(page).toHaveURL(/\/support\/help$/);
  await page.goBack();
  await expect(help).toBeFocused();
  const editProfile = page.getByRole("link", {
    name: "Edit profile",
    exact: true,
  });
  await editProfile.click();
  await page.getByRole("button", { name: "Last name", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Last name", exact: true })
    .fill("Rivera");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.locator(".dock-back").click();
  await expect(editProfile).toBeFocused();
  await page.locator(".dock-back").click();
  await expect(publicProfile).toBeFocused();
  await page.locator(".dock-back").click();
  await expect(identity).toBeFocused();
  await expect(identity).toContainText("Jamie");
});
