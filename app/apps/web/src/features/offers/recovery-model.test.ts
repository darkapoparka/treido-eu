import { describe, expect, it } from "vitest";
import {
  offerRecoveryState,
  parseOfferMutation,
  restoreOfferMutation,
} from "./recovery-model";
const id = (last: number) =>
  `00000000-0000-4000-8000-${String(last).padStart(12, "0")}`;
const mutation = {
  actorKey: "a".repeat(64),
  command: {
    sellerId: null,
    threadId: id(1),
    requestId: id(2),
    expectedRevision: 7,
    operation: {
      kind: "propose",
      parentId: null,
      skuId: id(3),
      publicationRevision: 2,
      quantity: 2,
      unitPriceMinor: 150,
      expiresHours: 24,
    },
  },
};
const scope = {
  actorKey: mutation.actorKey,
  threadId: mutation.command.threadId,
  sellerId: null,
};
describe("offer financial request recovery", () => {
  it("binds an exact immutable command to the human without changing its receipt hash input", () => {
    expect(parseOfferMutation(mutation)).toEqual(mutation);
    expect(restoreOfferMutation(JSON.stringify(mutation), scope)).toEqual(
      mutation,
    );
  });
  it.each([
    null,
    [],
    {},
    { ...mutation, actorKey: "foreign" },
    { ...mutation, price: 1 },
    mutation.command,
  ])("rejects unbound or malformed action input %j", (raw) => {
    expect(() => parseOfferMutation(raw)).toThrow();
  });
  it("never recovers another actor, seller or thread's browser journal", () => {
    expect(
      restoreOfferMutation(mutation, { ...scope, actorKey: "b".repeat(64) }),
    ).toBeNull();
    expect(
      restoreOfferMutation(mutation, { ...scope, threadId: id(4) }),
    ).toBeNull();
    expect(
      restoreOfferMutation(mutation, { ...scope, sellerId: id(5) }),
    ).toBeNull();
    expect(restoreOfferMutation("{invalid", scope)).toBeNull();
  });
  it("distinguishes durable acceptance from absence and from a superseded revision", () => {
    expect(offerRecoveryState(7, 10, true)).toBe("recorded");
    expect(offerRecoveryState(7, 7, false)).toBe("unrecorded");
    expect(offerRecoveryState(7, 8, false)).toBe("not_applied");
  });
});
