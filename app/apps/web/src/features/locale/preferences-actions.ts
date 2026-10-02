"use server";
import { cookies } from "next/headers";
import { localeCookie } from "./locale";
import { parseLocalizationPreference, regionCookie } from "./preferences-model";
export async function saveLocalizationPreferences(input: unknown) {
  const value = parseLocalizationPreference(input);
  if (!value) return { ok: false as const, error: "invalid" as const };
  const store = await cookies();
  const options = {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax" as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
  const { locale, ...region } = value;
  store.set(localeCookie, locale, options);
  store.set(regionCookie, encodeURIComponent(JSON.stringify(region)), options);
  return { ok: true as const, preference: value };
}
