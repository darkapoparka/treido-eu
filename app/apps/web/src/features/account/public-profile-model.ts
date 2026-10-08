import type { PreferenceView } from "../account-closure/preferences.server";

/** Server identity owns the read; no snapshot contact or order facts. */
export type PublicProfileView =
  | { state: "guest" | "unavailable" }
  | {
      state: "member";
      subject: string;
      preferences: Pick<
        PreferenceView,
        "registrationNeeded" | "preferences"
      > | null;
      preferencesUnavailable: boolean;
    };
