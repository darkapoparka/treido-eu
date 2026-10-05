import { describe, it, expect } from "vitest";
import type { Pool } from "pg";

const tables = [
  "order_service_policies",
  "order_financial_policies",
  "order_aftercare_operator_grants",
  "order_feedback_policies",
  "order_aftercare_lifecycle_policies",
  "order_aftercare_legal_holds",
] as const;
export type AftercareRegistryFixture = {
  admin: Pool;
  /** Each row is a fresh explicitly synthetic approval in the disposable native database. */
  rows: Record<
    Exclude<(typeof tables)[number], "order_aftercare_operator_grants">,
    string
  > & {
    order_aftercare_operator_grants: {
      userId: string;
      capability: "cases.read" | "cases.decide" | "feedback.moderate";
      environment: string;
      applicationId: string;
    };
  };
};
/** No fixture, approval, provider binding or shared database is created here. */
export function defineAftercareRegistryCases(
  get: () => Promise<AftercareRegistryFixture>,
) {
  describe("T64 immutable native approval/legal-hold history", () => {
    for (const table of tables)
      it(
        table + " cannot be deleted before or after one immutable revocation",
        async () => {
          const f = await get();
          let where: string;
          let parameters: unknown[];
          if (table === "order_aftercare_operator_grants") {
            const key = f.rows[table];
            if (
              !/^[0-9a-f-]{36}$/i.test(key.userId) ||
              !["cases.read", "cases.decide", "feedback.moderate"].includes(
                key.capability,
              ) ||
              !key.environment.trim() ||
              !key.applicationId.trim()
            )
              throw new Error("Missing synthetic registry fixture");
            where =
              "user_id=$1 AND capability=$2 AND environment=$3 AND application_id=$4";
            parameters = [
              key.userId,
              key.capability,
              key.environment,
              key.applicationId,
            ];
          } else {
            const id = f.rows[table];
            if (!/^[0-9a-f-]{36}$/i.test(id))
              throw new Error("Missing synthetic registry fixture");
            where = "id=$1";
            parameters = [id];
          }
          const read = async () =>
            (
              await f.admin.query(
                "SELECT to_jsonb(r) AS value FROM treido." +
                  table +
                  " r WHERE " +
                  where,
                parameters,
              )
            ).rows[0]?.value;
          const before = await read();
          expect(before).toBeDefined();
          expect(before.revoked_at).toBeNull();
          await expect(
            f.admin.query(
              "DELETE FROM treido." + table + " WHERE " + where,
              parameters,
            ),
          ).rejects.toMatchObject({ code: "23514" });
          expect(await read()).toEqual(before);
          await f.admin.query(
            "UPDATE treido." +
              table +
              " SET revoked_at=clock_timestamp() WHERE " +
              where,
            parameters,
          );
          const revoked = await read();
          expect(revoked.revoked_at).not.toBeNull();
          expect({ ...revoked, revoked_at: null }).toEqual(before);
          await expect(
            f.admin.query(
              "UPDATE treido." + table + " SET revoked_at=NULL WHERE " + where,
              parameters,
            ),
          ).rejects.toMatchObject({ code: "23514" });
          await expect(
            f.admin.query(
              "UPDATE treido." +
                table +
                " SET revoked_at=clock_timestamp() WHERE " +
                where,
              parameters,
            ),
          ).rejects.toMatchObject({ code: "23514" });
          await expect(
            f.admin.query(
              "DELETE FROM treido." + table + " WHERE " + where,
              parameters,
            ),
          ).rejects.toMatchObject({ code: "23514" });
          expect(await read()).toEqual(revoked);
        },
      );
  });
}
