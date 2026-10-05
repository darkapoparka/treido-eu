import "server-only";
import type { SellerTransaction } from "../db/database";
import { requireBackendBindings } from "../config/backend-bindings.server";
import { inputHash } from "../../features/sellers/persistence.server";
import {
  approvedBinding,
  approvedPolicy,
  planColumns,
  type PlanRow,
} from "../../features/account-closure/storage.server";
import { authorizeClosureJob } from "../../features/account-closure/jobs.server";
import { authorizeAssistantMaintenance } from "../../features/assistant-runs/maintenance-authority.server";
import { requireInputStorage } from "../../features/assistant-runs/storage.server";
import { JobError, validateJobIntent } from "./model";
import type { AssistantJobRow, ClosureJobRow } from "./outbox.server";

/** This is accepted-artifact authority, never ordinary inactive-human access.
 * The original feature authorizers additionally validate the actual running lease. */
export async function authorizeLifecycleArtifact(
  tx: SellerTransaction,
  job: AssistantJobRow | ClosureJobRow,
  executionToken?: string,
) {
  validateJobIntent(job);
  const backend = requireBackendBindings();
  if (job.kind === "account.closure") {
    const owner = (
      await tx.client.query<{ subject: string; status: string }>(
        "SELECT clerk_subject AS subject,status FROM treido.users WHERE id=$1 FOR UPDATE",
        [job.buyerId],
      )
    ).rows[0];
    const plan = (
      await tx.client.query<PlanRow>(
        "SELECT " +
          planColumns +
          " FROM treido.account_read_closure_plan($1::uuid,$2::uuid,false)",
        [job.buyerId, job.resourceId],
      )
    ).rows[0];
    if (
      !owner ||
      !["restricted", "closed"].includes(owner.status) ||
      !plan ||
      !plan.acceptedAt ||
      plan.acceptanceKey !== job.operationKey ||
      plan.payload.userId !== job.buyerId ||
      plan.payload.subject !== owner.subject ||
      ![
        "accepted",
        "processing",
        "blocked",
        "reconciling",
        "completed",
      ].includes(plan.state) ||
      inputHash(plan.payload) !== plan.hash
    )
      throw new JobError("FORBIDDEN");
    const binding = await approvedBinding(tx, plan.payload.bindingId),
      policy = await approvedPolicy(tx, plan.payload.policyId);
    if (
      !binding.closureEnabled ||
      binding.environment !== backend.environment ||
      binding.applicationId !== backend.identity.applicationId ||
      binding.clerkMode !== backend.identity.mode ||
      inputHash(policy.value) !== inputHash(plan.payload.policy)
    )
      throw new JobError("FORBIDDEN");
    const extension = (
      await tx.client.query<{
        facts: {
          assistantLifecycleVersion?: unknown;
          aftercareLifecycleVersion?: unknown;
        };
      }>("SELECT treido.account_closure_extension_facts($1::uuid) AS facts", [
        job.buyerId,
      ])
    ).rows[0]?.facts;
    if (
      !extension ||
      extension.assistantLifecycleVersion !==
        binding.assistantLifecycleVersion ||
      extension.aftercareLifecycleVersion !== binding.aftercareLifecycleVersion
    )
      throw new JobError("NOT_AVAILABLE");
    if (executionToken)
      await authorizeClosureJob(tx, { ...job, executionToken });
  } else {
    await requireInputStorage(tx);
    const owner = await tx.client.query(
      "SELECT id FROM treido.users WHERE id=$1 FOR UPDATE",
      [job.buyerId],
    );
    if (owner.rowCount !== 1) throw new JobError("FORBIDDEN");
    let present;
    if (job.kind === "assistant.media-expiry")
      present = (
        await tx.client.query(
          "SELECT a.id FROM treido.assistant_media_assets a JOIN treido.assistant_runtime_policies p ON p.id=a.policy_id WHERE a.id=$1 AND a.user_id=$2 AND (a.expires_at<=clock_timestamp() OR a.state='cancelled') AND p.application_id=$3 AND p.environment=$4 AND p.approved_at<=clock_timestamp() FOR UPDATE OF a",
          [
            job.resourceId,
            job.buyerId,
            backend.identity.applicationId,
            backend.environment,
          ],
        )
      ).rows[0];
    else
      present = (
        await tx.client.query(
          "SELECT r.id FROM treido.assistant_runs r JOIN treido.assistant_run_reservations b ON b.run_id=r.id AND b.user_id=r.user_id WHERE r.id=$1 AND r.user_id=$2 AND b.application_id=$3 AND b.environment=$4 AND " +
            (job.kind === "assistant.run-expiry"
              ? "r.expires_at<=clock_timestamp()"
              : "r.emission_started_at IS NOT NULL AND r.provider_id IS NOT NULL") +
            " FOR UPDATE OF r",
          [
            job.resourceId,
            job.buyerId,
            backend.identity.applicationId,
            backend.environment,
          ],
        )
      ).rows[0];
    if (!present) throw new JobError("FORBIDDEN");
    if (executionToken)
      await authorizeAssistantMaintenance(
        tx,
        { ...job, executionToken },
        job.kind,
      );
  }
}
