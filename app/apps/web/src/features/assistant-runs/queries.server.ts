import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { assistantActorKey } from "../assistant-tools/storage.server";
import { mode, type InputView } from "./model";
import { runtimePolicy } from "./policy.server";
import {
  requireInputStorage,
  inputLifecycleReady,
  inputWorkspace,
  ownedInputRun,
  ownedInputMedia,
} from "./storage.server";
import { inputCatalogue } from "./catalogue.server";
export async function readAssistantInput(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  rawMode: unknown,
): Promise<InputView> {
  const inputMode = mode(rawMode);
  return inTransaction(database, async (tx) => {
    await requireInputStorage(tx);
    const policy = await runtimePolicy(tx),
      lifecycle = await inputLifecycleReady(tx);
    const view: InputView = {
      actorKey: assistantActorKey(identity),
      revision: 0,
      mode: inputMode,
      policy: policy
        ? {
            id: policy.id,
            noticeBg: policy.config.noticeBg,
            noticeEn: policy.config.noticeEn,
            expiresSeconds: policy.config.mediaSeconds,
            audioSeconds: policy.config.audioSeconds,
            modes:
              lifecycle &&
              policy.config.providerEnabled &&
              policy.config.retentionEnabled
                ? (["text", "photo", "voice"] as const).filter(
                    (m) =>
                      Boolean(policy.config.models[m]) &&
                      (m === "text" || policy.config.mediaEnabled),
                  )
                : [],
            mediaReady:
              lifecycle &&
              policy.config.mediaEnabled &&
              policy.config.retentionEnabled,
          }
        : null,
      consent: false,
      consentChoice: null,
      asset: null,
      run: null,
      results: null,
    };
    let user;
    try {
      user = await authorizeHuman(tx, identity, false);
    } catch (error) {
      if (error instanceof SellerError && error.code === "NOT_FOUND")
        return view;
      throw error;
    }
    const ws = await inputWorkspace(tx, user.id, inputMode);
    if (!ws) return view;
    view.revision = ws.revision;
    const consent = (
      await tx.client.query<{
        allowed: boolean;
        policyId: string;
        granted: boolean;
      }>(
        'SELECT policy_id AS "policyId",granted,granted AND expires_at>clock_timestamp() AND policy_id=$3 AS allowed FROM treido.buyer_assistant_consents WHERE user_id=$1 AND mode=$2',
        [user.id, inputMode, policy?.id ?? null],
      )
    ).rows[0];
    view.consent = Boolean(consent?.allowed);
    view.consentChoice = consent
      ? { policyId: consent.policyId, granted: consent.granted }
      : null;
    if (ws.assetId) {
      const asset = await ownedInputMedia(tx, user.id, ws.assetId);
      view.asset = {
        id: asset.id,
        state: asset.expired ? "expired" : asset.state,
        expiresAt: asset.expiresAt.toISOString(),
        cleanupAfter: asset.writeUntil.toISOString(),
        bytes: view.consent ? asset.bytes : 0,
        contentType: view.consent ? asset.contentType : "",
        checksum: view.consent ? asset.checksum : "",
        preview:
          view.consent && !asset.expired && asset.state === "ready"
            ? "/api/assistants/media/" + asset.id
            : null,
      };
    }
    if (ws.runId) {
      const run = await ownedInputRun(tx, user.id, inputMode, ws.runId);
      const visible =
        view.consent &&
        !run.expired &&
        policy?.id === run.policyId &&
        run.state !== "cancelled";
      const budget = (
        await tx.client.query<{ status: string }>(
          "SELECT status FROM treido.assistant_run_reservations WHERE run_id=$1 AND user_id=$2",
          [run.id, user.id],
        )
      ).rows[0];
      view.run = {
        id: run.id,
        state: run.state,
        criteria: visible ? (run.input?.criteria ?? null) : null,
        reviewedCriteria: visible ? run.accepted : null,
        prompt: visible ? (run.input?.prompt ?? null) : null,
        proposal: visible ? run.proposal : null,
        budgetPending: ["reserved", "calling", "unknown"].includes(
          budget?.status ?? "unknown",
        ),
        expiresAt: run.expiresAt.toISOString(),
      };
      if (visible && run.state === "accepted" && run.accepted)
        view.results = await inputCatalogue(tx, user.id, run.accepted);
    }
    return view;
  });
}
