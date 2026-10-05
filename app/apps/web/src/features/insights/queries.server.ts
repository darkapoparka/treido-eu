import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { readFreeCatalogueLimits } from "../sellers/free-catalogue.server";
import type { Limits } from "../seller-billing/model";
import { authorizeSeller } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { libraryActorKey } from "../library/cursor.server";
import { authorizeOperator } from "../trust/reports.server";
import { caseStorageReady } from "../trust/case-storage.server";
import { readInquiryInsightRows } from "../merchant-inquiries/queries.server";
import {
  sellerInsightCapability,
  sellerInsightSource,
} from "./seller-source.server";
import { operatorInsightSource } from "./operator-source.server";
import { readInsightSource } from "./sql.server";
import {
  DATASETS,
  SELLER_DATASETS,
  OPERATOR_DATASETS,
  INSIGHT_LIMITS,
  InsightError,
  parseInsightQuery,
  insightRange,
  scopeBase,
  type InsightScope,
  type InsightRow,
  type InsightQuery,
  type Dataset,
  type SellerDataset,
  type OperatorDataset,
} from "./model";
import {
  summarizeInsights,
  type InsightContext,
  type InsightView,
} from "./summary";

/** One current authority/consistent-data transaction for each page or export.
 * No shared cache, operator grant insertion, paid metric or database mutation. */
export async function readInsights(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  scope: InsightScope,
  raw: Record<string, unknown>,
  exportActor?: string,
): Promise<InsightView> {
  scopeBase(scope);
  const exporting = exportActor !== undefined;
  const actorKey = libraryActorKey(identity);
  if (
    exporting &&
    (!/^[a-f0-9]{64}$/.test(exportActor) || exportActor !== actorKey)
  )
    throw new SellerError("FORBIDDEN");
  return inTransaction(database, async (tx) => {
    await tx.client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await tx.client.query("SET LOCAL statement_timeout = '2500ms'");
    await tx.client.query("SET LOCAL lock_timeout = '1500ms'");
    const now = (
      await tx.client.query<{ now: Date }>(
        "SELECT transaction_timestamp() AS now",
      )
    ).rows[0].now;
    let planLimits: Limits | null = null;
    let availableDatasets: Dataset[],
      sellerName: string | null = null,
      formalStorage = false;
    if (scope.kind === "seller") {
      const access = await authorizeSeller(
        tx,
        identity,
        scope.sellerId,
        "analytics.read",
      );
      sellerName = access.seller.name;
      planLimits = await readFreeCatalogueLimits(tx, scope.sellerId, access.seller.kind);
      if (exporting && !planLimits.commercialExport) throw new SellerError("FORBIDDEN");
      availableDatasets = (
        Object.keys(SELLER_DATASETS) as SellerDataset[]
      ).filter(
        (dataset) =>
          access.context.capabilities.includes(
            sellerInsightCapability[dataset],
          ) &&
          (dataset !== "imports" || access.seller.kind === "business"),
      );
      if (!availableDatasets.length) throw new SellerError("FORBIDDEN");
    } else {
      await authorizeOperator(tx, identity, "reports.read");
      availableDatasets = Object.keys(OPERATOR_DATASETS) as OperatorDataset[];
      formalStorage = await caseStorageReady(tx);
    }
    let query: InsightQuery;
    let invalid = false;
    try {
      query = parseInsightQuery(raw, scope, now, availableDatasets[0]);
    } catch (error) {
      if (!(error instanceof InsightError) || error.code !== "INVALID_INPUT")
        throw error;
      query = parseInsightQuery({}, scope, now, availableDatasets[0]);
      invalid = true;
    }
    if (!availableDatasets.includes(query.dataset))
      throw new SellerError("FORBIDDEN");
    const context: InsightContext = {
      scope,
      sellerName,
      actorKey,
      query,
      observedAt: now.toISOString(),
      basis: DATASETS[query.dataset].basis,
      availableDatasets,
      formalStorage,
    };
    if (planLimits && Date.parse(query.from + "T00:00:00.000Z") < Date.parse(now.toISOString().slice(0,10) + "T00:00:00.000Z") - (planLimits.historyDays - 1) * 86400000) invalid = true;
    if (invalid) return { context, report: null, problem: "INVALID_INPUT" };
    if (
      scope.kind === "operator" &&
      !formalStorage &&
      (query.dataset === "appeal_backlog" ||
        query.dataset === "case_outcomes" ||
        (query.dataset === "appeals" &&
          !["all", "unknown"].includes(query.status)))
    )
      return { context, report: null, problem: "NOT_AVAILABLE" };
    try {
      const limit = exporting ? INSIGHT_LIMITS.exportRows : INSIGHT_LIMITS.rows;
      let rows: InsightRow[];
      if (scope.kind === "seller") {
        const dataset = query.dataset as SellerDataset;
        await authorizeSeller(
          tx,
          identity,
          scope.sellerId,
          sellerInsightCapability[dataset],
        );
        if (dataset === "inquiries") {
          const range = insightRange(query);
          const sent = await readInquiryInsightRows(tx, scope.sellerId, {
            ...range,
            status: query.status,
            q: query.q,
            limit,
          });
          if (sent.overflow)
            throw new InsightError(
              exporting ? "EXPORT_TOO_LARGE" : "SCOPE_TOO_LARGE",
            );
          rows = sent.items.map((item) => ({
            id: item.id,
            resourceId: item.id,
            label: item.title,
            status: item.status,
            kind: "",
            at: item.at,
            href: "/app/sellers/" + scope.sellerId + "/inquiries/" + item.id,
            reason: "",
            values: {},
          }));
        } else
          rows = await readInsightSource(
            tx,
            sellerInsightSource(scope.sellerId, dataset),
            query,
            limit,
          );
      } else
        rows = await readInsightSource(
          tx,
          operatorInsightSource(
            query.dataset as OperatorDataset,
            formalStorage,
          ),
          query,
          limit,
        );
      return {
        context,
        report: summarizeInsights(context, rows, exporting),
        problem: null,
      };
    } catch (error) {
      // SQL/permission/transport errors abort the transaction and remain errors,
      // never manufactured empty dashboards. Only explicit bounded states render.
      if (!(error instanceof InsightError)) throw error;
      return { context, report: null, problem: error.code };
    }
  });
}
