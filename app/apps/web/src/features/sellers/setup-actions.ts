"use server";

import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { readSellerContext } from "./persistence.server";
import { SellerError, type SellerResult } from "./errors";
import {
  completeSignupIntent,
  readSignupIntent,
  readSellerSetup,
  saveSellerSetup,
  type SaveSellerSetupInput,
} from "./setup.server";
import type {
  BusinessSetupView,
  SetupAcknowledgement,
  SignupIntentView,
} from "./setup-model";

function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido seller setup unavailable.");
  return {
    ok: false,
    code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
  } as const;
}
export async function saveSellerSetupAction(
  input: SaveSellerSetupInput,
): Promise<SellerResult<SetupAcknowledgement>> {
  try {
    const identity = await requireVerifiedIdentity();
    return {
      ok: true,
      data: await saveSellerSetup(getDatabase(), identity, input),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function readSellerSetupAction(
  sellerId: string,
): Promise<SellerResult<BusinessSetupView>> {
  try {
    const identity = await requireVerifiedIdentity();
    return {
      ok: true,
      data: await readSellerSetup(getDatabase(), identity, sellerId),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function refreshSellerAccessAction(
  sellerId: string | null,
): Promise<SellerResult<null>> {
  try {
    const identity = await requireVerifiedIdentity();
    if (sellerId !== null)
      await readSellerContext(getDatabase(), identity, sellerId);
    else await readSignupIntent(getDatabase(), identity);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}
export async function completeSignupIntentAction(
  _previous: SellerResult<SignupIntentView> | null,
  form: FormData,
): Promise<SellerResult<SignupIntentView>> {
  try {
    const identity = await requireVerifiedIdentity();
    if (
      typeof form.get("revision") !== "string" ||
      !/^\d+$/.test(String(form.get("revision")))
    )
      throw new SellerError("INVALID_INPUT");
    return {
      ok: true,
      data: await completeSignupIntent(getDatabase(), identity, {
        intent: form.get("skip") === "yes" ? null : form.get("intent"),
        expectedRevision: Number(form.get("revision")),
        requestId: String(form.get("requestId")),
      }),
    };
  } catch (error) {
    return failure(error);
  }
}
