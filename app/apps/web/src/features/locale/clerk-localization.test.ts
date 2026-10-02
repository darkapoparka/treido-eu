import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { clerkLocalization } from "./clerk-localization.server";
describe("embedded Clerk interface language", () => {
  it("loads the shipped Bulgarian sign-in and sign-up translations", async () => {
    const language = await clerkLocalization("bg");
    expect(language.locale).toBe("bg-BG");
    expect(language.formFieldLabel__emailAddress).toBe("Имейл адрес");
    expect(language.signIn?.start?.title).toMatch(/[А-Яа-я]/);
    expect(language.signUp?.start?.title).toMatch(/[А-Яа-я]/);
  });
  it("loads English independently", async () => {
    const language = await clerkLocalization("en");
    expect(language.locale).toBe("en-US");
    expect(language.formFieldLabel__emailAddress).toBe("Email address");
  });
});
