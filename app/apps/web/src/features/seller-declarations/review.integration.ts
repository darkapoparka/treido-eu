import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { startLaunchCluster } from "../../../../../tests/t72/native-fixture.mjs";
import { createDatabase } from "../../server/db/database";
import {
  createBusinessSeller,
  ensurePersonalSeller,
} from "../sellers/persistence.server";
import { readSellerSetup, saveSellerSetup } from "../sellers/setup.server";
import {
  readDeclarationQueue,
  readDeclarationReview,
  readOwnDeclarationDecision,
  reviewSellerDeclaration,
} from "./persistence.server";
import { applySellerDeclarationReviewGrants } from "./runtime-grants.mjs";
import type { ReviewDeclarationInput } from "./model";

let native: Awaited<ReturnType<typeof startLaunchCluster>>;
let database: ReturnType<typeof createDatabase>;
const declaredFacts = {
  country: "BG",
  legalName: "Isolated test trader",
  registrationNumber: "TEST ONLY 123",
  contactEmail: "controlled@example.invalid",
  contactAddress: "TEST ONLY address",
  accurate: true,
};
beforeAll(async () => {
  vi.stubGlobal("fetch", () => {
    throw Error("No provider transport in declaration review acceptance");
  });
  native = await startLaunchCluster();
  const client = await native.admin.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      await readFile(
        new URL(
          "../../../migrations/0054_seller_declaration_reviews.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await applySellerDeclarationReviewGrants(client, "treido_runtime");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  database = createDatabase(native.runtime);
});
afterAll(async () => {
  await native?.stop();
  vi.unstubAllGlobals();
});
async function human() {
  const identity = {
    subject: "user_declreview_" + randomUUID().replaceAll("-", ""),
  };
  await ensurePersonalSeller(database, identity);
  const id = (
    await native.admin.query(
      "SELECT id FROM treido.users WHERE clerk_subject=$1",
      [identity.subject],
    )
  ).rows[0].id as string;
  return { identity, id };
}
async function operator(write = true) {
  const actor = await human();
  await native.admin.query(
    "INSERT INTO treido.operator_grants(user_id,capability) VALUES($1,'reports.read')",
    [actor.id],
  );
  if (write)
    await native.admin.query(
      "INSERT INTO treido.operator_grants(user_id,capability) VALUES($1,'moderation.write')",
      [actor.id],
    );
  return actor;
}
async function submission(submit = true) {
  const owner = await human(),
    sellerId = await createBusinessSeller(database, owner.identity, {
      name: "TEST ONLY declaration business",
      requestId: randomUUID(),
    });
  await saveSellerSetup(database, owner.identity, {
    sellerId,
    expectedRevision: 0,
    requestId: randomUUID(),
    section: "declaration",
    submit,
    payload: declaredFacts,
  });
  const declarationId = (
    await native.admin.query(
      "SELECT id FROM treido.seller_declarations WHERE seller_id=$1 ORDER BY revision DESC LIMIT 1",
      [sellerId],
    )
  ).rows[0].id as string;
  const input: ReviewDeclarationInput = {
    sellerId,
    declarationId,
    expectedDeclarationRevision: 1,
    expectedSetupRevision: 1,
    expectedRequirementVersion: 1,
    decision: "accepted",
    reason: "TEST ONLY actual isolated decision",
    requestId: randomUUID(),
  };
  return { owner, sellerId, declarationId, input };
}

it("accepts current submitted facts once, retains the immutable source and persists current readiness", async () => {
  const own = await submission(),
    actor = await operator();
  const [first, duplicate] = await Promise.all([
    reviewSellerDeclaration(database, actor.identity, own.input),
    reviewSellerDeclaration(database, actor.identity, own.input),
  ]);
  expect(first).toEqual(duplicate);
  expect(first.revision).toBe(2);
  expect(
    (await readSellerSetup(database, own.owner.identity, own.sellerId))
      .declarationStatus,
  ).toBe("current");
  const rows = (
    await native.admin.query(
      "SELECT id,revision,status,legal_name,registration_number,contact_email,contact_address,accurate,submitted_by,submitted_at FROM treido.seller_declarations WHERE seller_id=$1 ORDER BY revision",
      [own.sellerId],
    )
  ).rows;
  expect(rows).toHaveLength(2);
  expect(rows[0].status).toBe("review_required");
  expect(rows[1].status).toBe("accepted");
  for (const field of [
    "legal_name",
    "registration_number",
    "contact_email",
    "contact_address",
    "accurate",
    "submitted_by",
    "submitted_at",
  ])
    expect(rows[1][field]).toEqual(rows[0][field]);
  const independent = await native.runtime.connect();
  try {
    expect(
      (
        await independent.query(
          "SELECT input_hash,decision,source_revision,reviewed_revision FROM treido.seller_declaration_reviews WHERE id=$1",
          [first.id],
        )
      ).rows[0],
    ).toMatchObject({
      decision: "accepted",
      source_revision: 1,
      reviewed_revision: 2,
    });
  } finally {
    independent.release();
  }
  expect(
    await readOwnDeclarationDecision(
      database,
      own.owner.identity,
      own.sellerId,
    ),
  ).toMatchObject({
    decision: "accepted",
    revision: 2,
    reason: own.input.reason,
  });
});
it("rejection records a correction; seller resubmission reopens review without reviving an old decision", async () => {
  const own = await submission(),
    actor = await operator(),
    input = {
      ...own.input,
      decision: "rejected" as const,
      reason: "Correct the private address",
    };
  await reviewSellerDeclaration(database, actor.identity, input);
  expect(
    (await readSellerSetup(database, own.owner.identity, own.sellerId))
      .declarationStatus,
  ).toBe("rejected");
  await saveSellerSetup(database, own.owner.identity, {
    sellerId: own.sellerId,
    expectedRevision: 2,
    requestId: randomUUID(),
    section: "declaration",
    submit: true,
    payload: {
      ...declaredFacts,
      contactAddress: "Corrected TEST ONLY address",
    },
  });
  expect(
    (await readSellerSetup(database, own.owner.identity, own.sellerId))
      .declarationStatus,
  ).toBe("review_required");
  await expect(
    reviewSellerDeclaration(database, actor.identity, input),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(
    (await readDeclarationReview(database, actor.identity, own.declarationId))
      .canReview,
  ).toBe(false);
  expect(
    await readOwnDeclarationDecision(
      database,
      own.owner.identity,
      own.sellerId,
    ),
  ).toBeNull();
});
it("rejects foreign humans, seller role trust and a revoked operator on fresh commands and receipt replays", async () => {
  const own = await submission(),
    foreign = await human(),
    actor = await operator();
  await expect(
    readDeclarationReview(database, foreign.identity, own.declarationId),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    reviewSellerDeclaration(database, own.owner.identity, own.input),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await reviewSellerDeclaration(database, actor.identity, own.input);
  await native.admin.query(
    "UPDATE treido.operator_grants SET active=false,revision=revision+1 WHERE user_id=$1 AND capability='moderation.write'",
    [actor.id],
  );
  await expect(
    reviewSellerDeclaration(database, actor.identity, own.input),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await native.admin.query(
    "UPDATE treido.operator_grants SET active=false,revision=revision+1 WHERE user_id=$1 AND capability='reports.read'",
    [actor.id],
  );
  await expect(
    readDeclarationQueue(database, actor.identity),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("read-only operators cannot decide and restricted humans cannot read or replay", async () => {
  const own = await submission(),
    readOnly = await operator(false),
    actor = await operator();
  expect(
    (
      await readDeclarationReview(
        database,
        readOnly.identity,
        own.declarationId,
      )
    ).canReview,
  ).toBe(false);
  await expect(
    reviewSellerDeclaration(database, readOnly.identity, own.input),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await native.admin.query(
    "UPDATE treido.users SET status='restricted' WHERE id=$1",
    [actor.id],
  );
  await expect(
    reviewSellerDeclaration(database, actor.identity, own.input),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    readDeclarationReview(database, actor.identity, own.declarationId),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("current business members cannot review their own declaration even with operator grants", async () => {
  const own = await submission();
  await native.admin.query(
    "INSERT INTO treido.operator_grants(user_id,capability) VALUES($1,'reports.read'),($1,'moderation.write')",
    [own.owner.id],
  );
  expect(
    (
      await readDeclarationReview(
        database,
        own.owner.identity,
        own.declarationId,
      )
    ).canReview,
  ).toBe(false);
  await expect(
    reviewSellerDeclaration(database, own.owner.identity, own.input),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("stale setup, foreign declaration IDs, changed retry terms and already decided submissions cannot advance history", async () => {
  const own = await submission(),
    other = await submission(),
    actor = await operator();
  await expect(
    reviewSellerDeclaration(database, actor.identity, {
      ...own.input,
      declarationId: other.declarationId,
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  await saveSellerSetup(database, own.owner.identity, {
    sellerId: own.sellerId,
    expectedRevision: 1,
    requestId: randomUUID(),
    section: "details",
    submit: false,
    payload: {
      name: "Changed TEST ONLY business",
      description: "",
      locality: "Sofia",
    },
  });
  await expect(
    reviewSellerDeclaration(database, actor.identity, own.input),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  const input = { ...own.input, expectedSetupRevision: 2 };
  const receipt = await reviewSellerDeclaration(
    database,
    actor.identity,
    input,
  );
  expect(receipt.revision).toBe(3);
  await expect(
    reviewSellerDeclaration(database, actor.identity, {
      ...input,
      reason: "Different retry reason",
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  await expect(
    reviewSellerDeclaration(database, actor.identity, {
      ...input,
      requestId: randomUUID(),
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(
    (
      await native.admin.query(
        "SELECT count(*)::int AS count FROM treido.seller_declaration_reviews WHERE seller_id=$1",
        [own.sellerId],
      )
    ).rows[0].count,
  ).toBe(1);
});
it("drafts and obsolete requirement snapshots stay unreviewable; country and nonbusiness constraints stay enforced", async () => {
  const draft = await submission(false),
    old = await submission(),
    actor = await operator();
  await expect(
    reviewSellerDeclaration(database, actor.identity, draft.input),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  await native.admin.query(
    "UPDATE treido.seller_declarations SET requirement_version=2 WHERE id=$1",
    [old.declarationId],
  );
  expect(
    (await readDeclarationReview(database, actor.identity, old.declarationId))
      .canReview,
  ).toBe(false);
  await expect(
    reviewSellerDeclaration(database, actor.identity, old.input),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  await expect(
    native.admin.query(
      "UPDATE treido.seller_declarations SET country='FR' WHERE id=$1",
      [old.declarationId],
    ),
  ).rejects.toMatchObject({ code: "23514" });
  const personal = await ensurePersonalSeller(database, actor.identity);
  await expect(
    reviewSellerDeclaration(database, actor.identity, {
      ...old.input,
      sellerId: personal,
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("database guards keep the new review audit and accepted declaration immutable", async () => {
  const own = await submission(),
    actor = await operator(),
    receipt = await reviewSellerDeclaration(
      database,
      actor.identity,
      own.input,
    );
  await expect(
    native.runtime.query(
      "UPDATE treido.seller_declarations SET status='rejected' WHERE id=$1",
      [receipt.reviewedDeclarationId],
    ),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    native.runtime.query(
      "UPDATE treido.seller_declaration_reviews SET reason='Changed' WHERE id=$1",
      [receipt.id],
    ),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    native.admin.query(
      "DELETE FROM treido.seller_declaration_reviews WHERE id=$1",
      [receipt.id],
    ),
  ).rejects.toMatchObject({ code: "42501" });
});
it("seller decision reasons remain scoped to the current declared business authority", async () => {
  const own = await submission(),
    other = await submission(),
    actor = await operator();
  await reviewSellerDeclaration(database, actor.identity, own.input);
  await expect(
    readOwnDeclarationDecision(database, other.owner.identity, own.sellerId),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
