"use server";
import { getDatabase, type SellerDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError } from "../sellers/errors";
import type { PrivateResult } from "../library/private-session";
import {
  changeSupport,
  readSupport,
  markSupportRead,
} from "./persistence.server";
import { requireSupportStorage } from "./storage.server";
import type { SupportReceipt, SupportView } from "./model";

async function execute<T>(
  work: (
    database: SellerDatabase,
    identity: Awaited<ReturnType<typeof requireVerifiedIdentity>>,
  ) => Promise<T>,
): Promise<PrivateResult<T>> {
  let subject: string | null = null;
  try {
    const identity = await requireVerifiedIdentity();
    subject = identity.subject;
    const database = getDatabase();
    await requireSupportStorage(database);
    return { ok: true, subject, data: await work(database, identity) };
  } catch (error) {
    if (!(error instanceof SellerError))
      console.error("Treido private support unavailable.");
    return {
      ok: false,
      subject,
      code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
    };
  }
}
export async function createOrReplySupportAction(
  raw: unknown,
): Promise<PrivateResult<SupportReceipt>> {
  return execute((database, identity) =>
    changeSupport(database, identity, raw),
  );
}
export async function operateSupportAction(
  raw: unknown,
): Promise<PrivateResult<SupportReceipt>> {
  return execute((database, identity) =>
    changeSupport(database, identity, raw, true),
  );
}
export async function readOwnSupportAction(
  raw: Parameters<typeof readSupport>[2],
): Promise<PrivateResult<SupportView>> {
  return execute((database, identity) => readSupport(database, identity, raw));
}
export async function readOperatorSupportAction(
  raw: Parameters<typeof readSupport>[2],
): Promise<PrivateResult<SupportView>> {
  return execute((database, identity) =>
    readSupport(database, identity, raw, true),
  );
}
export async function markSupportReadAction(
  raw: Parameters<typeof markSupportRead>[2],
) {
  return execute((database, identity) =>
    markSupportRead(database, identity, raw),
  );
}
