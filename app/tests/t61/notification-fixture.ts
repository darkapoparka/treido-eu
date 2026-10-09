import { randomUUID } from "node:crypto";
import { vi } from "vitest";
import { createPublicationFixture } from "../../apps/web/tests/fixtures/publication-flow";
import { publishListing } from "../../apps/web/src/features/selling/publish.server";
import {
  openListingConversation,
  sendConversationMessage,
} from "../../apps/web/src/features/messaging/participants.server";
import {
  readConversation,
  setContactBlocked,
} from "../../apps/web/src/features/messaging/inbox.server";
import { readSavedSearches } from "../../apps/web/src/features/saved-searches/queries.server";
import { changeSavedSearch } from "../../apps/web/src/features/saved-searches/commands.server";
import { parseToolIntent } from "../../apps/web/src/features/shopping-tools/intent";
import { reviewedCriteria } from "../../apps/web/src/features/saved-searches/model";
import { processSavedSearchJob } from "../../apps/web/src/features/saved-searches/jobs.server";
import {
  jobColumns,
  type JobRow,
} from "../../apps/web/src/server/jobs/outbox.server";
import {
  executeJob,
  type EffectResult,
} from "../../apps/web/src/server/jobs/execution.server";
import type { JobEvent } from "../../apps/web/src/server/jobs/model";
import { libraryActorKey } from "../../apps/web/src/features/library/cursor.server";
import { changeNotificationPreferences } from "../../apps/web/src/features/notification-delivery/commands.server";
import { scheduleNotificationEmails } from "../../apps/web/src/features/notification-delivery/scheduler.server";
import { processNotificationEmail } from "../../apps/web/src/features/notification-delivery/jobs.server";
import {
  NOTIFICATION_CONSENT_VERSION,
  type NotificationMailState,
} from "../../apps/web/src/features/notification-delivery/model";
import {
  NotificationMailProviderError,
  type NotificationMailProvider,
} from "../../apps/web/src/features/notification-delivery/mail-provider.server";
import type { NotificationMailPayload } from "../../apps/web/src/features/notification-delivery/mail-model";
import * as config from "../../apps/web/src/features/notification-delivery/config.server";
import * as recipient from "../../apps/web/src/features/notification-delivery/recipient.server";
import {
  createLifecycleActor,
  createLifecycleRegistry,
  createLifecyclePlan,
  type LifecycleNativeContext,
} from "./lifecycle-fixture";
import { changeClosure } from "../../apps/web/src/features/account-closure/commands.server";
import { actorKey } from "../../apps/web/src/features/account-closure/storage.server";
import { processClosureJob } from "../../apps/web/src/features/account-closure/jobs.server";

export type NotificationFixtureContext = LifecycleNativeContext & {
  registerCleanup: (cleanup: () => void | Promise<void>) => void;
  recordAdapterCounters?: (
    label: string,
    read: () => Record<string, number>,
  ) => void;
};
/** Synthetic recipient/mail boundaries only. The fixture runs original commands,
 * authority, SQL, shared executor, callbacks and accepted lifecycle removal.
 * It is callable only by T61's owned isolated PostgreSQL harness. */
export async function createNotificationFixture(
  context: NotificationFixtureContext,
  kind: "message" | "saved-search" = "message",
  schedule = true,
) {
  const { database, admin } = context,
    owner = await createLifecycleActor(context),
    buyer = await createLifecycleActor(context),
    foreign = await createLifecycleActor(context);
  const mail: config.NotificationMailConfig = {
    purpose: "buyer.notification-email",
    environment: "test",
    applicationId: "treido-t61-isolated",
    jobEnvironment: "test",
    origin: "http://127.0.0.1",
    sender: "notice@example.test",
    domain: "example.test",
    domainId: randomUUID(),
    accountBinding: "SYNTHETIC-T61-NOTIFICATION",
    recipients: ["buyer@example.test"],
    apiKey: "SYNTHETIC-LOCAL-NO-PROVIDER",
  };
  const configured = vi
      .spyOn(config, "notificationMailConfig")
      .mockReturnValue(mail),
    projected = vi
      .spyOn(recipient, "readNotificationRecipient")
      .mockResolvedValue("buyer@example.test");
  context.registerCleanup(() => {
    configured.mockRestore();
    projected.mockRestore();
  });
  const command = (
    savedSearchEmail: boolean,
    messageEmail: boolean,
    expectedRevision = 1,
  ) => ({
    actorKey: libraryActorKey(buyer.identity),
    requestId: randomUUID(),
    expectedRevision,
    language: "en" as const,
    consentVersion: NOTIFICATION_CONSENT_VERSION,
    savedSearchEmail,
    messageEmail,
  });
  const originalCommand = command(true, true, 0),
    originalAck = await changeNotificationPreferences(
      database,
      buyer.identity,
      originalCommand,
    );
  const client = await admin.connect();
  let publication: Awaited<ReturnType<typeof createPublicationFixture>>;
  try {
    publication = await createPublicationFixture(
      { database, admin: client, owner: owner.identity },
      "personal",
    );
  } finally {
    client.release();
  }
  await publishListing(database, owner.identity, publication.input);
  let sourceId: string,
    threadId: string | null = null,
    searchId: string | null = null;
  const binding = {
    applicationId: mail.applicationId,
    environment: mail.jobEnvironment,
  };
  const eventFor = async (jobId: string): Promise<JobEvent> => {
    const job = (
      await admin.query<JobRow>(
        `SELECT ${jobColumns} FROM treido.outbox_jobs WHERE id=$1`,
        [jobId],
      )
    ).rows[0];
    if (!job) throw Error("Missing original native notification job");
    return {
      jobId: job.id,
      sellerId: job.sellerId,
      ...(job.buyerId ? { buyerId: job.buyerId } : {}),
      generation: job.generation,
      schemaVersion: 1,
      ...binding,
    };
  };
  if (kind === "message") {
    threadId = (
      await openListingConversation(
        database,
        buyer.identity,
        publication.draft.id,
      )
    ).id;
    sourceId = (
      await sendConversationMessage(
        database,
        owner.identity,
        {
          threadId,
          requestId: randomUUID(),
          body: "PRIVATE synthetic original message never included in email",
        },
        { sellerId: publication.sellerId },
      )
    ).id;
  } else {
    const view = await readSavedSearches(database, buyer.identity);
    const saved = await changeSavedSearch(database, buyer.identity, {
      actorKey: view.actorKey,
      expectedRevision: view.revision,
      requestId: randomUUID(),
      operation: {
        kind: "save",
        name: "Private original synthetic search",
        criteria: reviewedCriteria(
          parseToolIntent(
            "category=cat%3Aelectronics%2Fphones&currency=EUR&minPrice=129&maxPrice=129",
            "find-for-me",
          ),
          "find-for-me",
        ),
        enable: true,
        frequency: 60,
      },
    });
    searchId = saved.searchId!;
    const original = (
      await admin.query<{ id: string }>(
        `SELECT j.id FROM treido.outbox_jobs j JOIN treido.buyer_saved_search_runs r ON r.id=j.resource_id WHERE j.kind='buyer.saved-search' AND r.user_id=$1 AND r.search_id=$2 ORDER BY j.id LIMIT 1`,
        [buyer.userId, searchId],
      )
    ).rows[0];
    await executeJob(
      database,
      await eventFor(original.id),
      binding,
      randomUUID(),
      { "buyer.saved-search": (job) => processSavedSearchJob(database, job) },
    );
    const notification = (
      await admin.query<{ id: string }>(
        `SELECT id FROM treido.buyer_search_notifications WHERE user_id=$1 AND search_id=$2 AND listing_id=$3 AND kind='new_publication'`,
        [buyer.userId, searchId, publication.draft.id],
      )
    ).rows[0];
    if (!notification)
      throw Error(
        "Original saved-search consumer did not observe fixture publication",
      );
    sourceId = notification.id;
  }
  let deliveryId: string | null = null,
    event: JobEvent | null = null;
  const dispatch = async () => {
    await scheduleNotificationEmails(database);
    const delivered = (
      await admin.query<{ id: string; jobId: string }>(
        `SELECT d.id,j.id AS "jobId" FROM treido.notification_email_deliveries d JOIN treido.outbox_jobs j ON j.kind='buyer.notification-email' AND j.resource_id=d.id WHERE d.user_id=$1 AND d.kind=$2 AND d.source_id=$3`,
        [buyer.userId, kind, sourceId],
      )
    ).rows[0];
    if (!delivered)
      throw Error(
        "Original notification scheduler did not enqueue current source",
      );
    deliveryId = delivered.id;
    event = await eventFor(delivered.jobId);
  };
  if (schedule) await dispatch();
  const sent: { key: string; payload: NotificationMailPayload }[] = [],
    ids = new Map<string, string>();
  let verified = 0,
    reads = 0,
    loseAcknowledgement = false,
    observation: NotificationMailState = "delivered",
    beforeSend: (() => Promise<void>) | null = null;
  const provider: NotificationMailProvider = {
    verifySender: async () => {
      verified++;
    },
    send: async (payload, key) => {
      sent.push({ key, payload: JSON.parse(JSON.stringify(payload)) });
      if (beforeSend) await beforeSend();
      const id = ids.get(key) ?? randomUUID();
      ids.set(key, id);
      if (loseAcknowledgement)
        throw new NotificationMailProviderError("uncertain");
      return id;
    },
    retrieve: async (id) => {
      reads++;
      if (![...ids.values()].includes(id))
        throw Error("Unknown synthetic local provider ID");
      return observation;
    },
  };
  context.recordAdapterCounters?.(
    "notification: SYNTHETIC verified-recipient/mail boundary; no external calls",
    () => ({ verify: verified, posts: sent.length, reads }),
  );
  const options = () => ({
    config: configured.getMockImplementation()?.() ?? null,
    provider,
    recipient: async (subject: string) =>
      recipient.readNotificationRecipient(subject),
  });
  const run = async (
    instrument: (result: EffectResult) => Promise<EffectResult> = async (
      result,
    ) => result,
  ) => {
    if (!event) throw Error("Unscheduled native notification");
    return executeJob(database, event, binding, randomUUID(), {
      "buyer.notification-email": async (job) =>
        instrument(await processNotificationEmail(database, job, options())),
    });
  };
  const snapshot = async () => {
    if (!deliveryId) return null;
    return (
      await admin.query(
        `SELECT to_jsonb(d) AS delivery,j.state AS "jobState",e.state AS "effectState",e.provider_object_id AS "effectProviderId" FROM treido.notification_email_deliveries d JOIN treido.outbox_jobs j ON j.kind='buyer.notification-email' AND j.resource_id=d.id JOIN treido.job_effects e ON e.job_id=j.id WHERE d.id=$1`,
        [deliveryId],
      )
    ).rows[0];
  };
  const cancelSource = async () => {
    if (threadId) {
      const view = await readConversation(database, buyer.identity, {
        sellerId: null,
        threadId,
      });
      await setContactBlocked(database, buyer.identity, {
        sellerId: null,
        threadId,
        expectedRevision: view.contactRevision,
        requestId: randomUUID(),
        blocked: true,
      });
    } else {
      const view = await readSavedSearches(database, buyer.identity);
      await changeSavedSearch(database, buyer.identity, {
        actorKey: view.actorKey,
        expectedRevision: view.revision,
        requestId: randomUUID(),
        operation: { kind: "pause", searchId },
      });
    }
  };
  const ageUnknownAcknowledgement = async () => {
    // Explicit historical-unknown snapshot fault in this isolated fixture only.
    // Never disables or replaces the production freeze trigger/function.
    const client = await admin.connect();
    try {
      await client.query("BEGIN");
      const row = (
        await client.query(
          `DELETE FROM treido.notification_email_deliveries WHERE id=$1 AND user_id=$2 AND state='uncertain' AND provider_id IS NULL RETURNING *`,
          [deliveryId, buyer.userId],
        )
      ).rows[0];
      if (!row) throw Error("Missing original synthetic unknown-ack row");
      await client.query(
        `INSERT INTO treido.notification_email_deliveries(id,user_id,kind,source_id,source_revision,seller_id,consent_generation,language,state,first_attempt_at,request_payload,mail_binding,provider_key,retry_at,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'uncertain',clock_timestamp()-interval '23 hours',$9::jsonb,$10::jsonb,$11,clock_timestamp(),$12,$13)`,
        [
          row.id,
          row.user_id,
          row.kind,
          row.source_id,
          row.source_revision,
          row.seller_id,
          row.consent_generation,
          row.language,
          JSON.stringify(row.request_payload),
          JSON.stringify(row.mail_binding),
          row.provider_key,
          row.created_at,
          row.updated_at,
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };
  const close = async (category: "profile" | "searches") => {
    const rules = await createLifecycleRegistry(context),
      policyId = randomUUID(),
      value = {
        ...rules.value,
        version: "t61-notification-" + policyId,
        rules: rules.value.rules.map((rule) =>
          rule.category === category
            ? {
                ...rule,
                handling: "remove" as const,
                trigger: "closure" as const,
                delaySeconds: 0,
              }
            : rule,
        ),
      };
    await admin.query(
      `INSERT INTO treido.account_closure_policies(id,version,payload,approved_at) VALUES($1,$2,$3::jsonb,clock_timestamp())`,
      [policyId, value.version, JSON.stringify(value)],
    );
    const plan = await createLifecyclePlan(context, buyer, {
      ...rules,
      policyId,
      value,
    });
    await changeClosure(database, buyer.identity, {
      version: 1,
      actorKey: actorKey(buyer.identity),
      requestId: randomUUID(),
      expectedRevision: 0,
      operation: {
        kind: "confirm",
        planId: plan.id,
        planHash: plan.hash,
        acknowledged: true,
      },
    });
    const job = (
      await admin.query<{ id: string }>(
        `SELECT id FROM treido.outbox_jobs WHERE kind='account.closure' AND resource_id=$1`,
        [plan.id],
      )
    ).rows[0];
    const closureEvent = await eventFor(job.id);
    const execute = () =>
      executeJob(database, closureEvent, binding, randomUUID(), {
        "account.closure": (ctx) => processClosureJob(database, ctx),
      });
    return { plan, execute };
  };
  return {
    database,
    admin,
    buyer,
    foreign,
    owner,
    sourceId,
    kind,
    threadId,
    searchId,
    listingId: publication.draft.id,
    sellerId: publication.sellerId,
    get deliveryId() {
      return deliveryId;
    },
    get event() {
      return event;
    },
    binding,
    mail,
    provider,
    options,
    command,
    originalCommand,
    originalAck,
    configured,
    projected,
    dispatch,
    run,
    snapshot,
    cancelSource,
    ageUnknownAcknowledgement,
    close,
    sent,
    lost: (value: boolean) => {
      loseAcknowledgement = value;
    },
    observe: (value: NotificationMailState) => {
      observation = value;
    },
    onSend: (work: () => Promise<void>) => {
      beforeSend = work;
    },
    counts: () => ({ verified, reads, posts: sent.length }),
  };
}
