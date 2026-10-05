"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import {
  readPersonalProfile,
  savePersonalProfile,
} from "./personal-profile.server";
import type {
  PersonalProfileCommand,
  PersonalProfileView,
} from "./personal-profile-model";

function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido personal profile unavailable.");
  return {
    ok: false,
    code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
  } as const;
}
export async function readPersonalProfileAction(
  sellerId: string,
): Promise<SellerResult<PersonalProfileView>> {
  try {
    return {
      ok: true,
      data: await readPersonalProfile(
        getDatabase(),
        await requireVerifiedIdentity(),
        sellerId,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function savePersonalProfileAction(
  input: PersonalProfileCommand,
): Promise<SellerResult<PersonalProfileView>> {
  try {
    return {
      ok: true,
      data: await savePersonalProfile(
        getDatabase(),
        await requireVerifiedIdentity(),
        input,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
