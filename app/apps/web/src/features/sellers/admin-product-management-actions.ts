"use server";

import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import type { DraftAcknowledgement } from "../selling/draft-model";
import { SellerError, type SellerResult } from "./errors";
import {
  duplicateSellerProduct,
  withdrawSellerProducts,
} from "./admin-product-management.server";
import type { ProductWithdrawalResult } from "./admin-product-management-model";

function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido product management unavailable.");
  return {
    ok: false,
    code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
  } as const;
}
export async function duplicateProductAction(
  input: unknown,
): Promise<SellerResult<DraftAcknowledgement>> {
  try {
    const identity = await requireVerifiedIdentity();
    return {
      ok: true,
      data: await duplicateSellerProduct(getDatabase(), identity, input),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function withdrawProductsAction(
  input: unknown,
): Promise<SellerResult<ProductWithdrawalResult[]>> {
  try {
    const identity = await requireVerifiedIdentity();
    return {
      ok: true,
      data: await withdrawSellerProducts(getDatabase(), identity, input),
    };
  } catch (error) {
    return failure(error);
  }
}
