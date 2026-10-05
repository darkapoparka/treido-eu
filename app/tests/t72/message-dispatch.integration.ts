import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { startLaunchCluster } from "./native-fixture.mjs";
import { imageLifecycleFixture } from "./message-lifecycle-fixture";
import { prepareImageCommerce } from "./message-dispatch-commerce-fixture";
import { createDatabase } from "../../apps/web/src/server/db/database";
import type { LifecycleNativeContext } from "../t61/lifecycle-fixture";
import { applyReviewedMigration } from "../../apps/web/scripts/identity-draft-migration.mjs";
import { applyRuntimeGrants } from "../../apps/web/scripts/runtime-grants.mjs";
import { performLifecycleEffect } from "../../apps/web/src/features/account-closure/effects.server";
import { createResourceReport } from "../../apps/web/src/features/trust/reports.server";

vi.mock("../../apps/web/src/server/config/backend-bindings.server", () => ({
  requireBackendBindings: () => ({
    environment: "test",
    identity: {
      provider: "clerk",
      applicationId: "app_T61Native",
      mode: "test",
    },
  }),
}));
const auth = vi.hoisted(() => ({ recent: new Set<string>() }));
vi.mock("../../apps/web/src/server/identity/clerk.server", () => ({
  hasVerifiedRecentAuthentication: (identity: { subject: string }) =>
    auth.recent.has(identity.subject),
}));
const adapters = vi.hoisted(
  () =>
    new Map<
      string,
      {
        observe: () => Promise<{
          state: "confirmed" | "unknown";
          evidence: object;
        }>;
        execute: () => Promise<{
          state: "confirmed" | "unknown";
          evidence: object;
        }>;
      }
    >(),
);
vi.mock(
  "../../apps/web/src/features/account-closure/media-adapter.server",
  () => ({
    mediaEffectAdapter: (_binding: unknown, effect: { id: string }) =>
      adapters.get(effect.id),
  }),
);
let native: Awaited<ReturnType<typeof startLaunchCluster>>;
let context: LifecycleNativeContext;
const fixture = () => imageLifecycleFixture(context);
type Fixture = Awaited<ReturnType<typeof fixture>>;
type Proof = Awaited<ReturnType<Fixture["accept"]>>;
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function claim(proof: Proof, index = 0) {
  const token = randomUUID();
  const result = (
    await native.runtime.query(
      "SELECT treido.account_claim_effect($1,$2,$3,$4) AS claim",
      [proof.effects[index].id, token, proof.jobId, proof.executionToken],
    )
  ).rows[0].claim;
  expect(result.claimed).toBe(true);
  return token;
}
const legalHold = (imageId: string) =>
  native.admin.query(
    "INSERT INTO treido.message_image_legal_holds(id,attachment_id,approved_at,approval_reference) VALUES($1,$2,clock_timestamp(),'SYNTHETIC LOCAL DISPATCH HOLD')",
    [randomUUID(), imageId],
  );
async function setup() {
  const f = await fixture();
  const image = await f.image();
  await f.approve();
  const proof = await f.accept(await f.review());
  const effect = proof.effects[0];
  return { f, image, proof, effect };
}
beforeAll(async () => {
  vi.stubGlobal("fetch", async () => {
    throw Error("External IO forbidden");
  });
  native = await startLaunchCluster({
    messageLifecycle: true,
    privacyEvidence: true,
  });
  context = {
    database: createDatabase(native.runtime),
    admin: native.admin,
    registerRecent: (identity) => {
      auth.recent.add(identity.subject);
    },
  };
});
afterAll(async () => {
  await native?.stop();
  vi.unstubAllGlobals();
});

it("reproduces committed-hold/irreversible-DELETE on unchanged0049 with independent connections, then applies additive0050", async () => {
  const { f, image, proof, effect } = await setup();
  const token = await claim(proof);
  await native.runtime.query("SELECT treido.account_message_image_io($1,$2)", [
    effect.id,
    token,
  ]);
  const entered = deferred(),
    release = deferred();
  const deletion = (async () => {
    entered.resolve();
    await release.promise;
    await f.storage.remove(effect.target.objectKey as string);
  })();
  await entered.promise;
  try {
    // Admin and runtime pools are genuine independent PostgreSQL connections.
    await legalHold(image.id);
    expect(
      (
        await native.admin.query(
          "SELECT count(*)::int AS n FROM treido.message_image_legal_holds WHERE attachment_id=$1",
          [image.id],
        )
      ).rows[0].n,
    ).toBe(1);
  } finally {
    release.resolve();
  }
  await deletion;
  expect(f.objects.has(effect.target.objectKey as string)).toBe(false);
  await expect(
    native.runtime.query(
      "SELECT treido.account_record_effect($1,$2,'confirmed',$3,'provider')",
      [effect.id, token, "a".repeat(64)],
    ),
  ).rejects.toThrow("hold");
  const admin = await native.admin.connect();
  try {
    await applyReviewedMigration(
      admin,
      "0050_message_image_dispatch_barrier",
      await readFile(
        new URL(
          "../../apps/web/migrations/0050_message_image_dispatch_barrier.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await applyRuntimeGrants(admin, "treido_runtime");
    native.state.migrations.push("0050_message_image_dispatch_barrier.sql");
  } finally {
    admin.release();
  }
});

it.each(["acceptedOffer", "acceptedEvent", "attempt"] as const)(
  "commerce %s conflicts with dispatched deletion and rolls back the retention write",
  async (transition) => {
    const f = await fixture();
    await f.image();
    const commerce = await prepareImageCommerce(f);
    await f.approve();
    const proof = await f.accept(await f.review());
    const token = await claim(proof);
    await native.runtime.query(
      "SELECT treido.account_message_image_io($1,$2)",
      [proof.effects[0].id, token],
    );
    await expect(commerce[transition]()).rejects.toThrow("already dispatched");
    expect(
      (
        await native.admin.query(
          "SELECT state FROM treido.listing_offers WHERE id=$1",
          [commerce.offer],
        )
      ).rows[0].state,
    ).toBe("cancelled");
    expect(
      (
        await native.admin.query(
          "SELECT count(*)::int AS n FROM treido.payment_attempts WHERE quote_id=$1",
          [commerce.quote],
        )
      ).rows[0].n,
    ).toBe(0);
  },
);

it.each(["acceptedEvent", "attempt"] as const)(
  "commerce %s committed first prevents dispatch without removing bytes",
  async (transition) => {
    const f = await fixture();
    await f.image();
    const commerce = await prepareImageCommerce(f);
    await f.approve();
    const proof = await f.accept(await f.review());
    const token = await claim(proof);
    await commerce[transition]();
    await expect(
      native.runtime.query("SELECT treido.account_message_image_io($1,$2)", [
        proof.effects[0].id,
        token,
      ]),
    ).rejects.toThrow("hold");
    expect(f.objects.has(proof.effects[0].target.objectKey as string)).toBe(
      true,
    );
  },
);

it("user/message legal holds and aftercare user holds cover the full dispatched image scope", async () => {
  const { f, image, proof, effect } = await setup();
  const token = await claim(proof);
  await native.runtime.query("SELECT treido.account_message_image_io($1,$2)", [
    effect.id,
    token,
  ]);
  for (const column of ["user_id", "message_id"] as const) {
    await expect(
      native.admin.query(
        `INSERT INTO treido.message_image_legal_holds(id,${column},approved_at,approval_reference) VALUES($1,$2,clock_timestamp(),'SYNTHETIC DISPATCH HOLD')`,
        [randomUUID(), column === "user_id" ? f.buyer.userId : image.messageId],
      ),
    ).rejects.toThrow("already dispatched");
  }
  await expect(
    native.admin.query(
      "INSERT INTO treido.order_aftercare_legal_holds(id,user_id,environment,application_id,approved_at,approval_reference) VALUES($1,$2,'test','dispatch-native',clock_timestamp(),'SYNTHETIC DISPATCH HOLD')",
      [randomUUID(), f.buyer.userId],
    ),
  ).rejects.toThrow("already dispatched");
  // A different human's hold is independent; dispatch is not a global lock.
  await native.admin.query(
    "INSERT INTO treido.order_aftercare_legal_holds(id,user_id,environment,application_id,approved_at,approval_reference) VALUES($1,$2,'test','dispatch-native',clock_timestamp(),'SYNTHETIC UNRELATED HOLD')",
    [randomUUID(), f.counterpart.userId],
  );
});

it("a hold committed after claim but before IO preserves bytes and denies dispatch", async () => {
  const { f, image, proof, effect } = await setup();
  const token = await claim(proof);
  await legalHold(image.id);
  await expect(
    native.runtime.query(
      "SELECT treido.account_dispatch_message_image($1,$2)",
      [effect.id, token],
    ),
  ).rejects.toThrow("hold");
  expect(f.objects.has(effect.target.objectKey as string)).toBe(true);
  expect(
    (
      await native.admin.query(
        "SELECT count(*)::int AS n FROM treido.message_image_deletion_dispatches WHERE effect_id=$1",
        [effect.id],
      )
    ).rows[0].n,
  ).toBe(0);
});

it("the durable dispatch denies a concurrent legal hold while the actual executor waits on storage DELETE", async () => {
  const { f, image, proof, effect } = await setup();
  const entered = deferred(),
    release = deferred();
  adapters.set(effect.id, {
    observe: async () => ({
      state: "unknown",
      evidence: { status: "present" },
    }),
    execute: async () => {
      entered.resolve();
      await release.promise;
      await f.storage.remove(effect.target.objectKey as string);
      return { state: "confirmed", evidence: { status: "deleted" } };
    },
  });
  const running = performLifecycleEffect(context.database, effect, proof);
  await entered.promise;
  try {
    await expect(legalHold(image.id)).rejects.toThrow("already dispatched");
    expect(f.objects.has(effect.target.objectKey as string)).toBe(true);
  } finally {
    release.resolve();
  }
  expect(await running).toBe("confirmed");
  expect(f.objects.has(effect.target.objectKey as string)).toBe(false);
  expect(
    (
      await native.admin.query(
        "SELECT count(*)::int AS n FROM treido.message_image_legal_holds WHERE attachment_id=$1",
        [image.id],
      )
    ).rows[0].n,
  ).toBe(0);
  // A later legal record may retain remaining/history data, with this object
  // already truthfully marked deleted, rather than retroactively preserved.
  await legalHold(image.id);
});

it.each(["message", "listing"] as const)(
  "%s reports cannot commit retention during dispatched IO",
  async (kind) => {
    const { f, image, proof, effect } = await setup();
    const token = await claim(proof);
    await native.runtime.query(
      "SELECT treido.account_message_image_io($1,$2)",
      [effect.id, token],
    );
    await expect(
      createResourceReport(context.database, f.counterpart.identity, {
        resourceKind: kind,
        resourceId: kind === "message" ? image.messageId! : f.listingId,
        requestId: randomUUID(),
        reason: "unsafe",
        details: "Synthetic dispatched evidence",
      }),
    ).rejects.toThrow("already dispatched");
    expect(
      (
        await native.admin.query(
          "SELECT count(*)::int AS n FROM treido.reports WHERE resource_id=$1",
          [kind === "message" ? image.messageId : f.listingId],
        )
      ).rows[0].n,
    ).toBe(0);
  },
);

it("expired and lost leases retain provider facts and forbid holds until a fresh exact-object recovery", async () => {
  const { f, image, proof, effect } = await setup();
  const entered = deferred(),
    release = deferred();
  adapters.set(effect.id, {
    observe: async () => ({
      state: "unknown",
      evidence: { status: "present" },
    }),
    execute: async () => {
      entered.resolve();
      await release.promise;
      await f.storage.remove(effect.target.objectKey as string);
      return { state: "confirmed", evidence: { status: "deleted" } };
    },
  });
  const running = performLifecycleEffect(context.database, effect, proof);
  // Attach rejection handling immediately to avoid an unhandled test promise.
  const rejected = expect(running).rejects.toThrow("lease");
  await entered.promise;
  try {
    await native.admin.query(
      "UPDATE treido.account_lifecycle_effects SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
      [effect.id],
    );
    await native.admin.query(
      "UPDATE treido.job_effects SET execution_until=clock_timestamp()-interval '1 second' WHERE job_id=$1",
      [proof.jobId],
    );
    await expect(legalHold(image.id)).rejects.toThrow("already dispatched");
  } finally {
    release.resolve();
  }
  await rejected;
  expect(f.objects.has(effect.target.objectKey as string)).toBe(false);
  expect(
    (
      await native.admin.query(
        "SELECT state FROM treido.message_image_deletion_observations WHERE effect_id=$1",
        [effect.id],
      )
    ).rows[0].state,
  ).toBe("confirmed");
  expect(
    (
      await native.admin.query(
        "SELECT state FROM treido.account_lifecycle_effects WHERE id=$1",
        [effect.id],
      )
    ).rows[0].state,
  ).toBe("attempting");
  await expect(legalHold(image.id)).rejects.toThrow("already dispatched");
  await native.admin.query(
    "UPDATE treido.message_attachment_objects SET deletion_until=clock_timestamp()-interval '1 second' WHERE attachment_id=$1 AND state='deleting'",
    [image.id],
  );
  const replacement = { ...proof, executionToken: randomUUID() };
  await native.admin.query(
    "UPDATE treido.job_effects SET execution_token=$2,execution_until=clock_timestamp()+interval '5 minutes' WHERE job_id=$1",
    [proof.jobId, replacement.executionToken],
  );
  const execute = vi.fn(async () => {
    throw Error("Recovery must only observe absence");
  });
  adapters.set(effect.id, {
    observe: async () => ({
      state: "confirmed",
      evidence: { status: "absent" },
    }),
    execute,
  });
  expect(
    await performLifecycleEffect(context.database, effect, replacement),
  ).toBe("confirmed");
  expect(execute).not.toHaveBeenCalled();
  expect(
    (
      await native.admin.query(
        "SELECT count(*)::int AS n FROM treido.message_image_deletion_dispatches WHERE effect_id=$1",
        [effect.id],
      )
    ).rows[0].n,
  ).toBe(1);
  expect(
    (
      await native.admin.query(
        "SELECT state FROM treido.message_attachment_objects WHERE object_key=$1",
        [effect.target.objectKey],
      )
    ).rows[0].state,
  ).toBe("deleted");
  await legalHold(image.id);
});

it("dispatch and provider observations have no runtime write authority and reject foreign tokens", async () => {
  const { proof, effect } = await setup();
  const token = await claim(proof);
  await native.runtime.query(
    "SELECT treido.account_dispatch_message_image($1,$2)",
    [effect.id, token],
  );
  await expect(
    native.runtime.query(
      "SELECT * FROM treido.message_image_deletion_dispatches",
    ),
  ).rejects.toThrow("permission");
  await expect(
    native.runtime.query(
      "SELECT treido.account_observe_message_image($1,$2,'confirmed',$3)",
      [effect.id, randomUUID(), "b".repeat(64)],
    ),
  ).rejects.toThrow("denied");
  await expect(
    native.admin.query(
      "DELETE FROM treido.message_image_deletion_dispatches WHERE effect_id=$1",
      [effect.id],
    ),
  ).rejects.toThrow("Immutable");
});

it("a lost storage acknowledgement keeps the durable barrier until read-only absence recovery", async () => {
  const { f, image, proof, effect } = await setup();
  adapters.set(effect.id, {
    observe: async () => ({
      state: "unknown",
      evidence: { status: "present" },
    }),
    execute: async () => {
      await f.storage.remove(effect.target.objectKey as string);
      throw Error("Synthetic DELETE response lost");
    },
  });
  expect(await performLifecycleEffect(context.database, effect, proof)).toBe(
    "unknown",
  );
  expect(
    (
      await native.admin.query(
        "SELECT state FROM treido.message_image_deletion_observations WHERE effect_id=$1",
        [effect.id],
      )
    ).rows[0].state,
  ).toBe("unknown");
  await expect(legalHold(image.id)).rejects.toThrow("already dispatched");
  await native.admin.query(
    "UPDATE treido.message_attachment_objects SET deletion_until=clock_timestamp()-interval '1 second' WHERE attachment_id=$1 AND state='deleting'",
    [image.id],
  );
  const execute = vi.fn(async () => {
    throw Error("Do not repeat DELETE after observed absence");
  });
  adapters.set(effect.id, {
    observe: async () => ({
      state: "confirmed",
      evidence: { status: "absent" },
    }),
    execute,
  });
  expect(await performLifecycleEffect(context.database, effect, proof)).toBe(
    "confirmed",
  );
  expect(execute).not.toHaveBeenCalled();
});
