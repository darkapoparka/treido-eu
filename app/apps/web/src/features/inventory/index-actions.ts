"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError } from "../sellers/errors";
import { readInventoryIndex } from "./index.server";
import { changeStockBatch } from "./batch.server";
import { exportInventoryPage } from "./export.server";
export async function readInventoryIndexAction(
  sellerId: string,
  query: unknown,
) {
  try {
    return {
      ok: true as const,
      data: await readInventoryIndex(
        getDatabase(),
        await requireVerifiedIdentity(),
        sellerId,
        query,
      ),
    };
  } catch (error) {
    if (!(error instanceof SellerError))
      console.error("Inventory unavailable.");
    return {
      ok: false as const,
      code:
        error instanceof SellerError ? error.code : ("NOT_AVAILABLE" as const),
    };
  }
}

export async function changeStockBatchAction(input: unknown) {
  try {
    const actor = await requireVerifiedIdentity();
    return {
      ok: true as const,
      data: await changeStockBatch(getDatabase(), actor, input),
    };
  } catch (error) {
    if (!(error instanceof SellerError))
      console.error("Stock adjustment unavailable.");
    return {
      ok: false as const,
      code:
        error instanceof SellerError ? error.code : ("NOT_AVAILABLE" as const),
    };
  }
}
export async function exportInventoryPageAction(
  sellerId: string,
  query: unknown,
) {
  try {
    const actor = await requireVerifiedIdentity();
    return {
      ok: true as const,
      data: await exportInventoryPage(getDatabase(), actor, sellerId, query),
    };
  } catch (error) {
    if (!(error instanceof SellerError))
      console.error("Inventory export unavailable.");
    return {
      ok: false as const,
      code:
        error instanceof SellerError ? error.code : ("NOT_AVAILABLE" as const),
    };
  }
}
