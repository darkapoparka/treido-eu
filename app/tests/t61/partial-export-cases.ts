import { describe, expect, it } from "vitest";
import { PRIVACY_LIMITS } from "../../apps/web/src/features/account-privacy/model";
import type { createPartialExportFixture, OptionalExportNamespace } from "./partial-export-fixture";

/** Eight new executable definitions, UNREGISTERED/UNRUN until the combined gate.
 * Both original public paths run native SQL as the restricted runtime role.
 */
export function definePartialExportCases(get: (namespace: OptionalExportNamespace, present: 0 | 1 | 2 | 3) => ReturnType<typeof createPartialExportFixture>) {
  describe("T61 optional search namespace completeness through original runtime privacy command", () => {
    for (const namespace of ["gift", "compatibility"] as const) {
      for (const present of [0, 1, 2, 3] as const) {
        it(`${namespace} with ${present} actual relations preserves absence/completeness and rejects partial exports`, async () => {
          const fixture = await get(namespace, present), result = await fixture.run();
          expect(result.runtime).toEqual({ name: "treido_runtime", superuser: false, bypass: false });
          expect(result.hidden).toHaveLength(3 - present);
          expect(result.restored).toEqual(result.originalRelations);
          expect(result.after).toEqual(result.before);
          expect(result.after.exports).toBe(0);
          expect(result.after.receipts).toBe(0);
          if (present === 1 || present === 2) {
            expect(result.projectionFailure).toMatchObject({ code: "NOT_AVAILABLE" });
            expect(result.commandFailure).toMatchObject({ code: "NOT_AVAILABLE" });
            expect(result.projection).toBeUndefined();
            expect(result.snapshot).toBeUndefined();
            expect(result.acknowledgment).toBeUndefined();
          } else {
            expect(result.projectionFailure).toBeUndefined();
            expect(result.commandFailure).toBeUndefined();
            expect(result.acknowledgment).toMatchObject({ replayed: false, acknowledgment: { kind: "export", acceptedState: "ready", revision: 1 } });
            expect(result.snapshot?.accountId).toBe(fixture.ownerId);
            const section = result.snapshot?.sections.find(row => row.category === "searches");
            expect(section?.limited).toBe(false);
            expect(section?.records.length).toBeLessThanOrEqual(PRIVACY_LIMITS.rows);
            expect(Buffer.byteLength(JSON.stringify(result.snapshot))).toBeLessThanOrEqual(PRIVACY_LIMITS.bytes);
            const expectedKind = namespace === "gift" ? "giftWorkspace" : "compatibilityWorkspace";
            expect(section?.records.some(row => row.kind === expectedKind)).toBe(present === 3);
            expect(JSON.stringify(result.snapshot)).not.toContain(fixture.foreignId);
          }
        });
      }
    }
  });
}
