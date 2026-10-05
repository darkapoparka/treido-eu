import "server-only";
import type { PoolClient } from "pg";
import { uuid, criteria, type InputMode } from "./model";
export type AssistantOwnExport = {
  kind: "assistant-input";
  mode: InputMode;
  state: string;
  criteria: string | null;
  consent: boolean;
  consentGeneration: number | null;
  consentUpdatedAt: string | null;
  consentExpiresAt: string | null;
  createdAt: string | null;
};
/** Root derives current human/recent authority and applies existing seven
 * category/50-row/32KiB/256KiB caps. No raw prompt/transcript/media/provider ID. */
export async function ownAssistantInputExport(
  tx: { client: Pick<PoolClient, "query"> },
  userId: string,
): Promise<AssistantOwnExport[]> {
  uuid(userId);
  const ready = (
    await tx.client.query<{ ready: boolean }>(
      `SELECT to_regclass('treido.buyer_assistant_workspaces') IS NOT NULL AND to_regclass('treido.buyer_assistant_consents') IS NOT NULL AND to_regclass('treido.assistant_runs') IS NOT NULL AS ready`,
    )
  ).rows[0];
  if (!ready?.ready) return [];
  const rows = (
    await tx.client.query<{
      mode: InputMode;
      state: string | null;
      criteria: string | null;
      consent: boolean;
      generation: number | null;
      consentUpdatedAt: Date | null;
      consentExpiresAt: Date | null;
      createdAt: Date | null;
    }>(
      `SELECT w.mode,r.state,
    CASE WHEN r.expires_at>clock_timestamp() AND r.state<>'cancelled' THEN coalesce(r.accepted_criteria,r.input_json->>'criteria') ELSE NULL END AS criteria,
    coalesce(c.granted AND c.expires_at>clock_timestamp(),false) AS consent,c.revision AS generation,c.updated_at AS "consentUpdatedAt",c.expires_at AS "consentExpiresAt",r.created_at AS "createdAt"
    FROM treido.buyer_assistant_workspaces w LEFT JOIN treido.buyer_assistant_consents c ON c.user_id=w.user_id AND c.mode=w.mode
    LEFT JOIN treido.assistant_runs r ON r.id=w.current_run_id AND r.user_id=w.user_id AND r.mode=w.mode WHERE w.user_id=$1 ORDER BY w.mode LIMIT 3`,
      [userId],
    )
  ).rows;
  return rows.map((row) => ({
    kind: "assistant-input",
    mode: row.mode,
    state: row.state ?? "empty",
    criteria: row.criteria ? criteria(row.criteria) : null,
    consent: row.consent,
    consentGeneration: row.generation,
    consentUpdatedAt: row.consentUpdatedAt?.toISOString() ?? null,
    consentExpiresAt: row.consentExpiresAt?.toISOString() ?? null,
    createdAt: row.createdAt?.toISOString() ?? null,
  }));
}
