"use server";
import { getDatabase, inTransaction } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { backendConfigured } from "../sellers/backend-status.server";
import { referencePreviewEnabled } from "../catalog/queries.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import { authorizeHuman } from "../sellers/persistence.server";
import { readCompatibility, changeCompatibility } from "./compatibility.server";
import { readSellHelper, changeSellHelper } from "./sell-helper.server";
import {
  helperSellerChoices,
  helperDraftChoices,
  helperDraftSelection,
} from "./draft-selection.server";
import { assistantId } from "./compatibility-model";
import { readAssistantFacts } from "./storage.server";
import type {
  CompatibilityView,
  CompatibilityChange,
} from "./compatibility-model";
import type { HelperView, HelperChange } from "./sell-helper-model";
export type AssistantResult<T> = SellerResult<{ subject: string; value: T }>;
async function identity() {
  if (referencePreviewEnabled() || !backendConfigured())
    throw new SellerError("NOT_AVAILABLE");
  return requireVerifiedIdentity();
}
function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido F22 assistant request unavailable.");
  return {
    ok: false as const,
    code:
      error instanceof SellerError ? error.code : ("NOT_AVAILABLE" as const),
  };
}
export async function readCompatibilityAction(): Promise<
  AssistantResult<CompatibilityView>
> {
  try {
    const actor = await identity();
    return {
      ok: true,
      data: {
        subject: actor.subject,
        value: await readCompatibility(getDatabase(), actor),
      },
    };
  } catch (error) {
    return failure(error);
  }
}
export async function changeCompatibilityAction(
  raw: unknown,
): Promise<AssistantResult<CompatibilityChange>> {
  try {
    const actor = await identity();
    return {
      ok: true,
      data: {
        subject: actor.subject,
        value: await changeCompatibility(getDatabase(), actor, raw),
      },
    };
  } catch (error) {
    return failure(error);
  }
}
export async function readAssistantListingAction(raw: unknown) {
  try {
    const id = assistantId(raw),
      actor = await identity();
    const value = await inTransaction(getDatabase(), async (tx) => {
      let userId: string | null = null;
      try {
        userId = (await authorizeHuman(tx, actor, false)).id;
      } catch (error) {
        if (!(error instanceof SellerError && error.code === "NOT_FOUND"))
          throw error;
      }
      return (await readAssistantFacts(tx, userId, [id])).get(id);
    });
    if (!value) throw new SellerError("NOT_FOUND");
    return { ok: true as const, data: { subject: actor.subject, value } };
  } catch (error) {
    return failure(error);
  }
}
export async function readHelperSellersAction() {
  try {
    const actor = await identity();
    return {
      ok: true as const,
      data: {
        subject: actor.subject,
        value: await helperSellerChoices(getDatabase(), actor),
      },
    };
  } catch (error) {
    return failure(error);
  }
}
export async function readHelperDraftsAction(raw: unknown) {
  try {
    const sellerId = assistantId(raw),
      actor = await identity();
    return {
      ok: true as const,
      data: {
        subject: actor.subject,
        value: await helperDraftChoices(getDatabase(), actor, sellerId),
      },
    };
  } catch (error) {
    return failure(error);
  }
}
export async function readHelperDraftAction(seller: unknown, draft: unknown) {
  try {
    const sellerId = assistantId(seller),
      draftId = assistantId(draft),
      actor = await identity();
    return {
      ok: true as const,
      data: {
        subject: actor.subject,
        value: await helperDraftSelection(
          getDatabase(),
          actor,
          sellerId,
          draftId,
        ),
      },
    };
  } catch (error) {
    return failure(error);
  }
}
export async function readSellHelperAction(
  raw: unknown,
): Promise<AssistantResult<HelperView>> {
  try {
    const sellerId = assistantId(raw),
      actor = await identity();
    return {
      ok: true,
      data: {
        subject: actor.subject,
        value: await readSellHelper(getDatabase(), actor, sellerId),
      },
    };
  } catch (error) {
    return failure(error);
  }
}
export async function changeSellHelperAction(
  raw: unknown,
): Promise<AssistantResult<HelperChange>> {
  try {
    const actor = await identity();
    return {
      ok: true,
      data: {
        subject: actor.subject,
        value: await changeSellHelper(getDatabase(), actor, raw),
      },
    };
  } catch (error) {
    return failure(error);
  }
}
