import "server-only";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { ClosureError, type Locale, type BrowseScope } from "./model";
import { actorKey } from "./storage.server";
export type PreferenceView = {
  actorKey: string;
  revision: number;
  registrationNeeded: boolean;
  preferences: { locale: Locale; browseScope: BrowseScope } | null;
};
export async function preferenceStorageReady(tx: SellerTransaction) {
  if (
    !(
      await tx.client.query<{ ready: boolean }>(
        `SELECT to_regclass('treido.account_lifecycle_workspaces') IS NOT NULL AND to_regclass('treido.account_lifecycle_receipts') IS NOT NULL AS ready`,
      )
    ).rows[0]?.ready
  )
    throw new ClosureError("NOT_AVAILABLE");
}
/** Caller already owns a verified current human; this narrow result grants no supply/consent. */
export async function readAccountPreferenceDefaults(
  tx: SellerTransaction,
  userId: string,
) {
  const present = (
    await tx.client.query<{ ready: boolean }>(
      `SELECT to_regclass('treido.account_lifecycle_workspaces') IS NOT NULL AS ready`,
    )
  ).rows[0]?.ready;
  if (!present) return null;
  const row = (
    await tx.client.query<{
      locale: Locale | null;
      browseScope: BrowseScope | null;
    }>(
      `SELECT w.locale,w.browse_scope AS "browseScope" FROM treido.account_lifecycle_workspaces w JOIN treido.users u ON u.id=w.user_id WHERE w.user_id=$1 AND u.status='active'`,
      [userId],
    )
  ).rows[0];
  return row?.locale && row.browseScope
    ? { locale: row.locale, browseScope: row.browseScope }
    : null;
}
export function readAccountPreferences(
  database: SellerDatabase,
  identity: VerifiedIdentity,
): Promise<PreferenceView> {
  return inTransaction(database, async (tx) => {
    await preferenceStorageReady(tx);
    let user;
    try {
      user = await authorizeHuman(tx, identity, false);
    } catch (error) {
      if (error instanceof SellerError && error.code === "NOT_FOUND")
        return {
          actorKey: actorKey(identity),
          revision: 0,
          registrationNeeded: true,
          preferences: null,
        };
      throw error;
    }
    const revision =
      (
        await tx.client.query<{ revision: number }>(
          `SELECT revision FROM treido.account_lifecycle_workspaces WHERE user_id=$1`,
          [user.id],
        )
      ).rows[0]?.revision ?? 0;
    return {
      actorKey: actorKey(identity),
      revision,
      registrationNeeded: false,
      preferences: await readAccountPreferenceDefaults(tx, user.id),
    };
  });
}
