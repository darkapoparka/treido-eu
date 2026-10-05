import "server-only";
import type { PoolClient } from "pg";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import {
  CLOSURE_LIMITS,
  ClosureError,
  canCancel,
  obligationNames,
  type ClosureView,
} from "./model";
import {
  actorKey,
  approvedBinding,
  approvedPolicy,
  ownLifecycleUser,
  planColumns,
  requireRecent,
  storageReady,
  type PlanRow,
} from "./storage.server";
import { readObligations } from "./obligations.server";
import { ownSessions } from "./clerk-adapter.server";
/** A current own summary only; no effect targets/provider identifiers/foreign resources. */
export async function readOwnAccountLifecycleExport(
  client: Pick<PoolClient, "query">,
  userId: string,
) {
  const ready = (
    await client.query<{ ready: boolean }>(
      `SELECT to_regclass('treido.account_lifecycle_workspaces') IS NOT NULL AND to_regclass('treido.account_execution_plans') IS NOT NULL AS ready`,
    )
  ).rows[0]?.ready;
  if (!ready) return [];
  const preference = (
    await client.query<{ locale: string | null; browseScope: string | null }>(
      `SELECT locale,browse_scope AS "browseScope" FROM treido.account_lifecycle_workspaces WHERE user_id=$1`,
      [userId],
    )
  ).rows[0];
  const plan = (
    await client.query<{
      state: string;
      policyVersion: string;
      acceptedAt: Date | null;
    }>(
      `SELECT state,payload->'policy'->>'version' AS "policyVersion",accepted_at AS "acceptedAt" FROM treido.account_execution_plans WHERE user_id=$1 AND accepted_at IS NOT NULL ORDER BY accepted_at DESC,id DESC LIMIT 1`,
      [userId],
    )
  ).rows[0];
  const rows: Record<string, string | null>[] = [];
  if (preference?.locale && preference.browseScope)
    rows.push({
      kind: "accountPreferences",
      locale: preference.locale,
      browseScope: preference.browseScope,
    });
  if (plan)
    rows.push({
      kind: "accountClosure",
      state: plan.state,
      policyVersion: plan.policyVersion,
      acceptedAt: plan.acceptedAt?.toISOString() ?? null,
    });
  return rows;
}
export async function readClosure(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  withSessions = false,
): Promise<ClosureView> {
  requireRecent(identity);
  const { view, binding } = await inTransaction(database, async (tx) => {
    await storageReady(tx);
    const user = await ownLifecycleUser(tx, identity, false);
    const preference = (
      await tx.client.query<{
        revision: number;
        locale: "bg" | "en" | null;
        browseScope: "all" | "personal" | "business" | null;
      }>(
        `SELECT revision,locale,browse_scope AS "browseScope" FROM treido.account_lifecycle_workspaces WHERE user_id=$1`,
        [user.id],
      )
    ).rows[0];
    let binding = null,
      policy = null;
    try {
      binding = await approvedBinding(tx);
    } catch (error) {
      if (!(error instanceof ClosureError) || error.code !== "BINDING_REQUIRED")
        throw error;
    }
    try {
      policy = await approvedPolicy(tx);
    } catch (error) {
      if (!(error instanceof ClosureError) || error.code !== "POLICY_REQUIRED")
        throw error;
    }
    const plans = (
      await tx.client.query<PlanRow & { expired: boolean }>(
        `SELECT ${planColumns},expires_at<=clock_timestamp() AS expired FROM treido.account_execution_plans WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2`,
        [user.id, CLOSURE_LIMITS.history + 1],
      )
    ).rows;
    const summaries: ClosureView["plans"] = [];
    for (const plan of plans.slice(0, CLOSURE_LIMITS.history)) {
      const effects = (
        await tx.client.query<ClosureView["plans"][number]["effects"][number]>(
          `SELECT kind,state,count(*)::int AS count FROM treido.account_lifecycle_effects WHERE user_id=$1 AND plan_id=$2 GROUP BY kind,state ORDER BY kind,state`,
          [user.id, plan.id],
        )
      ).rows;
      const latest = (
        await tx.client.query<{ planId: string | null; cause: string }>(
          `SELECT plan_id AS "planId",cause FROM treido.account_lifecycle_status_events WHERE user_id=$1 ORDER BY id DESC LIMIT 1`,
          [user.id],
        )
      ).rows[0];
      summaries.push({
        messageImages: plan.payload.messageImages
          ? {
              version: plan.payload.messageImages.version,
              description: plan.payload.messageImages.rule.description,
              handling: plan.payload.messageImages.rule.handling,
              delaySeconds: plan.payload.messageImages.rule.delay_seconds,
              removedObjects: plan.payload.messageImages.resources.filter(
                (resource) =>
                  resource.retentionReason === null &&
                  plan.payload.messageImages?.rule.handling === "remove",
              ).length,
              retainedObjects: plan.payload.messageImages.resources.filter(
                (resource) =>
                  resource.retentionReason !== null ||
                  plan.payload.messageImages?.rule.handling === "retain",
              ).length,
            }
          : null,
        id: plan.id,
        hash: plan.hash,
        state: plan.state,
        createdAt: plan.createdAt.toISOString(),
        expiresAt: plan.expiresAt.toISOString(),
        reviewExpired: plan.expired,
        policy: plan.payload.policy,
        obligations: plan.payload.obligations,
        effects,
        cancellable:
          canCancel(plan.state, plan.firstEffectAt !== null) &&
          (user.status === "active" || plan.acceptedAt !== null) &&
          (!plan.acceptedAt ||
            (latest?.planId === plan.id && latest.cause === "closure_claim")),
      });
    }
    const requestedClosures = (
      await tx.client.query<{ id: string }>(
        `SELECT id FROM treido.account_closure_requests WHERE user_id=$1 AND state='requested' ORDER BY created_at DESC,id LIMIT 2`,
        [user.id],
      )
    ).rows.map((row) => row.id);
    const obligations = null;
    const securityEffects = (
      await tx.client.query<ClosureView["securityEffects"][number]>(
        `SELECT id,state FROM treido.account_lifecycle_effects WHERE user_id=$1 AND plan_id IS NULL ORDER BY created_at DESC,id DESC LIMIT $2`,
        [user.id, CLOSURE_LIMITS.history],
      )
    ).rows;
    const imageExtension = (
      await tx.client.query<{ ready: boolean }>(
        "SELECT to_regprocedure('treido.account_message_image_available(uuid,uuid,uuid)') IS NOT NULL AS ready",
      )
    ).rows[0]?.ready;
    const imageAvailable =
      imageExtension && binding && policy
        ? (
            await tx.client.query<{ available: boolean }>(
              "SELECT treido.account_message_image_available($1,$2,$3) AS available",
              [user.id, policy.id, binding.id],
            )
          ).rows[0]?.available
        : !(
            await tx.client.query(
              "SELECT id FROM treido.message_attachments WHERE created_by=$1 LIMIT 1",
              [user.id],
            )
          ).rowCount;
    const view: ClosureView = {
      actorKey: actorKey(identity),
      revision: preference?.revision ?? 0,
      lifecycle: user.status,
      preferences:
        preference?.locale && preference.browseScope
          ? { locale: preference.locale, browseScope: preference.browseScope }
          : null,
      policy,
      requestedClosures,
      obligations,
      plans: summaries,
      sessions: [],
      securityEffects,
      sessionsLimited: false,
      sessionReadUnavailable: false,
      securityAvailable:
        user.status === "active" && binding?.securityEnabled === true,
      executionAvailable:
        user.status === "active" &&
        binding?.closureEnabled === true &&
        binding.securityEnabled &&
        policy !== null &&
        imageAvailable === true,
      historyLimited: plans.length > CLOSURE_LIMITS.history,
    };
    requireRecent(identity);
    return { view, binding };
  });
  // A failed current obligation source never becomes zero and never enables a
  // review. Already accepted immutable status remains available for recovery.
  let restoration = false;
  if (view.lifecycle !== "closed") {
    try {
      const current = await inTransaction(database, async (tx) => {
        const user = await ownLifecycleUser(tx, identity, false);
        const facts = await readObligations(tx, user.id);
        const extension = (
          await tx.client.query<{
            facts: { mayRestoreClosureRestriction?: boolean };
          }>(
            `SELECT treido.account_closure_extension_facts($1::uuid) AS facts`,
            [user.id],
          )
        ).rows[0]?.facts;
        return {
          facts,
          restore: extension?.mayRestoreClosureRestriction === true,
        };
      });
      view.obligations = current.facts;
      restoration =
        current.restore &&
        obligationNames.every((name) => current.facts[name] === 0);
      if (obligationNames.some((name) => current.facts[name] !== 0))
        view.executionAvailable = false;
    } catch {
      view.executionAvailable = false;
    }
  }
  for (const plan of view.plans)
    if (plan.state !== "reviewed" && !restoration) plan.cancellable = false;
  if (withSessions && view.securityAvailable && binding) {
    try {
      const current = await ownSessions(identity, binding);
      view.sessions = current.summaries;
      view.sessionsLimited = current.limited;
    } catch (error) {
      if (
        error instanceof ClosureError &&
        ["FORBIDDEN", "RECENT_AUTH_REQUIRED", "UNAUTHENTICATED"].includes(
          error.code,
        )
      )
        throw error;
      view.securityAvailable = false;
      view.sessionReadUnavailable = true;
    }
  }
  requireRecent(identity);
  return view;
}
