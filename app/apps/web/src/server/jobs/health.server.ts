import "server-only";
import type { SellerDatabase } from "../db/database";
import { emitJobHealth, type JobHealth } from "./health";
import { jobObservationDuration, jobObservationTime } from "./observations";

// One statement/snapshot, no resource IDs or contents. Due means available time
// elapsed; leases and running effects remain the original dispatcher's authority.
export const JOB_HEALTH_SQL = `WITH observed AS MATERIALIZED (SELECT clock_timestamp() AS now)
SELECT count(*) FILTER(WHERE j.state='pending')::text AS pending,
 count(*) FILTER(WHERE j.state='accepted')::text AS accepted,
 count(*) FILTER(WHERE j.state IN('pending','accepted') AND j.available_at<=o.now)::text AS due,
 count(*) FILTER(WHERE j.state IN('pending','accepted') AND j.dispatch_until>=o.now)::text AS leased,
 count(*) FILTER(WHERE j.state IN('pending','accepted') AND j.attempts>0)::text AS retrying,
 count(*) FILTER(WHERE j.state='dead')::text AS dead,
 count(*) FILTER(WHERE j.state IN('pending','accepted') AND e.state='running' AND e.execution_until>o.now)::text AS running,
 CASE WHEN count(*) FILTER(WHERE j.state IN('pending','accepted'))=0 THEN NULL
 ELSE greatest(0,floor(extract(epoch FROM ((SELECT now FROM observed)-min(j.created_at) FILTER(WHERE j.state IN('pending','accepted'))))*1000))::text END AS "oldestActiveMs",
 CASE WHEN count(*) FILTER(WHERE j.state IN('pending','accepted') AND j.available_at<=o.now)=0 THEN NULL
 ELSE greatest(0,floor(extract(epoch FROM ((SELECT now FROM observed)-min(j.available_at) FILTER(WHERE j.state IN('pending','accepted') AND j.available_at<=o.now)))*1000))::text END AS "oldestDueMs"
FROM treido.outbox_jobs j CROSS JOIN observed o
LEFT JOIN treido.job_effects e ON e.job_id=j.id
WHERE j.state IN('pending','accepted','dead')`;

/** Internal repair observation only. Runtime factory, read and sink failures never stop repair. */
export async function observeJobHealth(
  database: () => SellerDatabase,
  sink: (event: JobHealth) => unknown = (event) =>
    console.info(JSON.stringify(event)),
): Promise<void> {
  const started = jobObservationTime();
  let row: unknown;
  try {
    const result = await database().pool.query(JOB_HEALTH_SQL);
    if (result.rows.length === 1) row = result.rows[0];
  } catch {
    // Missing schema/grants/connectivity is unavailable, never sample success.
  }
  emitJobHealth(() => row, sink, jobObservationDuration(started));
}
