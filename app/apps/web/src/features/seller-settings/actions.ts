"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import { readServiceSettings, saveServiceSettings } from "./persistence.server";
import type { ServiceCommand, ServiceSection, ServiceView } from "./model";
function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido seller service settings unavailable.");
  return {
    ok: false,
    code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
  } as const;
}
export async function readServiceSettingsAction(
  sellerId: string,
  section: ServiceSection,
): Promise<SellerResult<ServiceView>> {
  try {
    return {
      ok: true,
      data: await readServiceSettings(
        getDatabase(),
        await requireVerifiedIdentity(),
        sellerId,
        section,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function saveServiceSettingsAction(
  input: ServiceCommand,
): Promise<SellerResult<ServiceView>> {
  try {
    return {
      ok: true,
      data: await saveServiceSettings(
        getDatabase(),
        await requireVerifiedIdentity(),
        input,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
