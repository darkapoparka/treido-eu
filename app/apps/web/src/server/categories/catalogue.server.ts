import "server-only";
import {
  CATEGORY_REGISTRY_VERSION,
  getCategory,
  type CategoryLeafId,
} from "@treido/contracts/categories";
import type { SellerDatabase, SellerTransaction } from "../db/database";
import { SellerError } from "../../features/sellers/errors";

export async function requirePersistedDraftCategory(
  tx: SellerTransaction,
  id: CategoryLeafId | null,
) {
  if (!id) return null;
  const result = await tx.client.query<{ version: number | null }>(
    `SELECT (SELECT max(version) FROM treido.category_policies p
      WHERE p.registry_version=c.registry_version AND p.category_id=c.id AND p.country='BG') AS version
     FROM treido.categories c WHERE c.registry_version=$1 AND c.id=$2 AND c.kind='leaf'`,
    [CATEGORY_REGISTRY_VERSION, id],
  );
  const version = result.rows[0]?.version;
  if (!Number.isSafeInteger(version) || !version || version < 1)
    throw new SellerError("NOT_AVAILABLE");
  // Binding the current persisted version does not approve its policy. Pending
  // drafts remain editable; publication independently checks current review.
  return version;
}

export async function readCategoryPublicationPolicy(
  tx: SellerTransaction,
  id: string,
  registryVersion: number,
  policyVersion: number,
) {
  const category = getCategory(id);
  if (
    category?.kind !== "leaf" ||
    registryVersion !== CATEGORY_REGISTRY_VERSION ||
    !Number.isSafeInteger(policyVersion) ||
    policyVersion < 1
  )
    throw new SellerError("INVALID_INPUT");
  const result = await tx.client.query<{
    state: string;
    enabled: boolean;
    rules: Record<string, unknown>;
    reviewReference: string | null;
  }>(
    `SELECT state,enabled_for_publish AS enabled,rules,review_reference AS "reviewReference"
     FROM treido.category_policies WHERE registry_version=$1 AND category_id=$2 AND country='BG' AND version=$3
     AND version=(SELECT max(version) FROM treido.category_policies WHERE registry_version=$1 AND category_id=$2 AND country='BG')`,
    [registryVersion, id, policyVersion],
  );
  const policy = result.rows[0];
  if (!policy) throw new SellerError("NOT_AVAILABLE");
  return {
    categoryId: category.id,
    registryVersion,
    policyVersion,
    ...policy,
    allowed:
      policy.state === "reviewed" &&
      policy.enabled &&
      Boolean(policy.reviewReference),
  };
}

/** No unreviewed leaf or private review evidence enters public navigation. */
export async function listPublishedCategoryLeaves(
  database: SellerDatabase,
  locale: "bg" | "en",
) {
  const rows = await database.pool.query<{
    id: string;
    labels: { bg: string; en: string };
  }>(
    `SELECT DISTINCT c.id,c.labels FROM treido.categories c JOIN treido.category_policies p
     ON p.registry_version=c.registry_version AND p.category_id=c.id
     WHERE c.registry_version=$1 AND c.kind='leaf' AND p.country='BG'
     AND p.state='reviewed' AND p.enabled_for_publish AND p.review_reference IS NOT NULL
     AND p.version=(SELECT max(latest.version) FROM treido.category_policies latest
       WHERE latest.registry_version=p.registry_version AND latest.category_id=p.category_id AND latest.country=p.country)
     ORDER BY c.id LIMIT 200`,
    [CATEGORY_REGISTRY_VERSION],
  );
  return rows.rows.flatMap((row) =>
    getCategory(row.id)?.kind === "leaf"
      ? [
          {
            id: row.id as CategoryLeafId,
            label: row.labels[locale] || row.labels.bg,
          },
        ]
      : [],
  );
}
