import "server-only";
import { backendConfigured } from "../sellers/backend-status.server";
import { readVerifiedIdentity } from "../../server/identity/clerk.server";
import { getDatabase } from "../../server/db/database";
import { readAccountPreferences } from "../account-closure/preferences.server";
import type { PublicProfileView } from "./public-profile-model";

export async function readPublicProfile(): Promise<PublicProfileView> {
  if (!backendConfigured()) return { state: "unavailable" };
  let identity;
  try {
    identity = await readVerifiedIdentity();
  } catch {
    console.error("Buyer profile identity unavailable.");
    return { state: "unavailable" };
  }
  if (!identity) return { state: "guest" };
  try {
    const preferences = await readAccountPreferences(getDatabase(), identity);
    return {
      state: "member",
      subject: identity.subject,
      preferences: {
        registrationNeeded: preferences.registrationNeeded,
        preferences: preferences.preferences,
      },
      preferencesUnavailable: false,
    };
  } catch {
    console.error("Buyer profile preferences unavailable.");
    return {
      state: "member",
      subject: identity.subject,
      preferences: null,
      preferencesUnavailable: true,
    };
  }
}
