import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { startLaunchCluster } from "./native-fixture.mjs";
import { createDatabase } from "../../apps/web/src/server/db/database";
import { createBusinessSeller } from "../../apps/web/src/features/sellers/persistence.server";
import {
  createListingDraft,
  saveListingDraft,
} from "../../apps/web/src/features/selling/drafts.server";
import { emptyDraft } from "../../apps/web/src/features/selling/draft-model";

let native: Awaited<ReturnType<typeof startLaunchCluster>>;
let database: ReturnType<typeof createDatabase>;
beforeAll(async () => {
  vi.stubGlobal("fetch", () => {
    throw Error("No provider transport in draft acceptance");
  });
  native = await startLaunchCluster();
  database = createDatabase(native.runtime);
});
afterAll(async () => {
  await native?.stop();
  vi.unstubAllGlobals();
});
async function seller() {
  const identity = {
    subject: "user_draftreview_" + randomUUID().replaceAll("-", ""),
  };
  const sellerId = await createBusinessSeller(database, identity, {
    name: "Isolated draft acceptance",
    requestId: randomUUID(),
  });
  return { identity, sellerId };
}

it("T06a persists owned drafts and exact retries; stale or changed requests cannot overwrite accepted edits", async () => {
  const own = await seller();
  const create = {
    sellerId: own.sellerId,
    requestId: randomUUID(),
    payload: { ...emptyDraft, title: "Original draft" },
  };
  const first = await createListingDraft(database, own.identity, create);
  expect(await createListingDraft(database, own.identity, create)).toEqual(
    first,
  );
  await expect(
    createListingDraft(database, own.identity, {
      ...create,
      payload: { ...create.payload, title: "Conflicting replay" },
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  const save = {
    sellerId: own.sellerId,
    draftId: first.id,
    expectedRevision: first.revision,
    requestId: randomUUID(),
    payload: { ...create.payload, title: "Accepted edit" },
  };
  const edited = await saveListingDraft(database, own.identity, save);
  expect(edited.revision).toBe(first.revision + 1);
  expect(await saveListingDraft(database, own.identity, save)).toEqual(edited);
  await expect(
    saveListingDraft(database, own.identity, {
      ...save,
      requestId: randomUUID(),
      payload: create.payload,
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  const independent = await native.runtime.connect();
  try {
    const persisted = (
      await independent.query(
        "SELECT revision,payload FROM treido.listing_drafts WHERE listing_id=$1 AND seller_id=$2",
        [first.id, own.sellerId],
      )
    ).rows[0];
    expect(persisted.revision).toBe(edited.revision);
    expect(persisted.payload.title).toBe("Accepted edit");
  } finally {
    independent.release();
  }
});

it("T06a rejects a different human and revoked membership on create, save and retry", async () => {
  const own = await seller(),
    foreign = await seller();
  const create = {
    sellerId: own.sellerId,
    requestId: randomUUID(),
    payload: { ...emptyDraft, title: "Private draft" },
  };
  const first = await createListingDraft(database, own.identity, create);
  await expect(
    createListingDraft(database, foreign.identity, create),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  const save = {
    sellerId: own.sellerId,
    draftId: first.id,
    requestId: randomUUID(),
    expectedRevision: first.revision,
    payload: create.payload,
  };
  await expect(
    saveListingDraft(database, foreign.identity, save),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await native.admin.query(
    "UPDATE treido.seller_memberships SET status='revoked',revision=revision+1 WHERE seller_id=$1",
    [own.sellerId],
  );
  await expect(
    createListingDraft(database, own.identity, create),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    saveListingDraft(database, own.identity, save),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("T06a serializes the final Free draft slot and rejects unknown category IDs", async () => {
  const own = await seller();
  await expect(
    createListingDraft(database, own.identity, {
      sellerId: own.sellerId,
      requestId: randomUUID(),
      payload: { ...emptyDraft, categoryId: "cat:unknown/missing" },
    }),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  // Isolated admin arranges the version-one 200-draft Free boundary; no live counters are changed.
  await native.admin.query(
    "UPDATE treido.seller_usage SET draft_count=199 WHERE seller_id=$1",
    [own.sellerId],
  );
  const results = await Promise.allSettled(
    [1, 2].map((n) =>
      createListingDraft(database, own.identity, {
        sellerId: own.sellerId,
        requestId: randomUUID(),
        payload: { ...emptyDraft, title: "Last slot " + n },
      }),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const rejected = results.find((r) => r.status === "rejected");
  expect(rejected).toMatchObject({
    status: "rejected",
    reason: { code: "QUOTA_EXCEEDED" },
  });
  expect(
    (
      await native.runtime.query(
        "SELECT draft_count FROM treido.seller_usage WHERE seller_id=$1",
        [own.sellerId],
      )
    ).rows[0].draft_count,
  ).toBe(200);
});
