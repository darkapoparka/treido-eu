import "server-only";
import { sql } from "drizzle-orm";
import {
  pgSchema,
  bigint,
  uniqueIndex,
  uuid,
  varchar,
  text,
  integer,
  smallint,
  timestamp,
  jsonb,
  primaryKey,
  unique,
  check,
  foreignKey,
  index,
} from "drizzle-orm/pg-core";
import type { DraftPayload } from "@/features/selling/draft-model";
import type {
  SignupIntent,
  SetupStep,
  DeclarationStatus,
} from "@/features/sellers/setup-model";
import { boolean } from "drizzle-orm/pg-core";

const treido = pgSchema("treido");
const time = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" }).notNull().defaultNow();

export const listingWithdrawalReceipts = treido.table(
  "listing_withdrawal_receipts",
  {
    sellerId: uuid("seller_id").notNull(),
    listingId: uuid("listing_id").notNull(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    createdAt: time("created_at"),
  },
  (table) => [
    primaryKey({
      columns: [
        table.sellerId,
        table.listingId,
        table.actorId,
        table.requestId,
      ],
    }),
    foreignKey({
      columns: [table.sellerId, table.listingId],
      foreignColumns: [listings.sellerId, listings.id],
    }),
  ],
);

export const categoryRegistryVersions = treido.table(
  "category_registry_versions",
  {
    version: integer("version").primaryKey(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    createdAt: time("created_at"),
  },
);
export const categoryRecords = treido.table(
  "categories",
  {
    registryVersion: integer("registry_version")
      .notNull()
      .references(() => categoryRegistryVersions.version),
    id: varchar("id", { length: 120 }).notNull(),
    kind: text("kind").$type<"root" | "leaf">().notNull(),
    parentId: varchar("parent_id", { length: 120 }),
    parentKind: text("parent_kind").$type<"root">(),
    slug: varchar("slug", { length: 100 }).notNull(),
    labels: jsonb("labels").$type<{ bg: string; en: string }>().notNull(),
    profile: jsonb("profile"),
  },
  (table) => [
    primaryKey({ columns: [table.registryVersion, table.id] }),
    unique("category_version_kind").on(
      table.registryVersion,
      table.id,
      table.kind,
    ),
    unique("category_sibling_slug")
      .on(table.registryVersion, table.parentId, table.slug)
      .nullsNotDistinct(),
    foreignKey({
      columns: [table.registryVersion, table.parentId, table.parentKind],
      foreignColumns: [table.registryVersion, table.id, table.kind],
    }),
  ],
);
export const categoryPolicies = treido.table(
  "category_policies",
  {
    registryVersion: integer("registry_version").notNull(),
    categoryId: varchar("category_id", { length: 120 }).notNull(),
    categoryKind: text("category_kind").notNull().default("leaf"),
    country: varchar("country", { length: 2 }).notNull(),
    version: integer("version").notNull(),
    state: text("state")
      .$type<"pending" | "reviewed" | "withdrawn">()
      .notNull()
      .default("pending"),
    enabledForPublish: boolean("enabled_for_publish").notNull().default(false),
    rules: jsonb("rules").notNull(),
    reviewReference: varchar("review_reference", { length: 500 }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    primaryKey({
      columns: [
        table.registryVersion,
        table.categoryId,
        table.country,
        table.version,
      ],
    }),
    foreignKey({
      columns: [table.registryVersion, table.categoryId, table.categoryKind],
      foreignColumns: [
        categoryRecords.registryVersion,
        categoryRecords.id,
        categoryRecords.kind,
      ],
    }),
  ],
);

export const conversationThreads = treido.table(
  "conversation_threads",
  {
    id: uuid("id").primaryKey(),
    listingId: uuid("listing_id").notNull(),
    sellerId: uuid("seller_id").notNull(),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id),
    state: text("state").$type<"open" | "closed">().notNull().default("open"),
    nextSequence: integer("next_sequence").notNull().default(1),
    offerRevision: integer("offer_revision").notNull().default(0),
    lastMessageAt: time("last_message_at"),
    createdAt: time("created_at"),
  },
  (table) => [
    foreignKey({
      columns: [table.sellerId, table.buyerId],
      foreignColumns: [contactPreferences.sellerId, contactPreferences.buyerId],
    }),
    index("conversation_buyer_activity").on(
      table.buyerId,
      table.lastMessageAt,
      table.id,
    ),
    index("conversation_seller_activity").on(
      table.sellerId,
      table.lastMessageAt,
      table.id,
    ),
    unique("conversation_offer_owner").on(
      table.id,
      table.sellerId,
      table.listingId,
      table.buyerId,
    ),
    unique("conversation_identity").on(
      table.listingId,
      table.sellerId,
      table.buyerId,
    ),
    foreignKey({
      columns: [table.sellerId, table.listingId],
      foreignColumns: [listings.sellerId, listings.id],
    }),
  ],
);
export const messageAttachments = treido.table(
  "message_attachments",
  {
    id: uuid("id").primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => conversationThreads.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    state: text("state").$type<"staged" | "ready" | "removed">().notNull(),
    contentType: text("content_type").notNull(),
    bytes: integer("bytes").notNull(),
    objectKey: varchar("object_key", { length: 300 }).notNull().unique(),
    createdAt: time("created_at"),
  },
  (table) => [
    unique("attachment_thread_identity").on(table.threadId, table.id),
  ],
);
export const messages = treido.table(
  "messages",
  {
    id: uuid("id").primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => conversationThreads.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    sequence: integer("sequence").notNull(),
    body: varchar("body", { length: 4000 }).notNull(),
    offerEventId: uuid("offer_event_id"),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    createdAt: time("created_at"),
  },
  (table) => [
    unique("message_sequence").on(table.threadId, table.sequence),
    foreignKey({
      columns: [table.threadId, table.offerEventId],
      foreignColumns: [offerEvents.threadId, offerEvents.id],
    }),
    uniqueIndex("offer_message_once")
      .on(table.offerEventId)
      .where(sql`${table.offerEventId} IS NOT NULL`),
    unique("message_retry").on(table.threadId, table.authorId, table.requestId),
    unique("message_thread_identity").on(table.threadId, table.id),
  ],
);
export const messageAttachmentLinks = treido.table(
  "message_attachment_links",
  {
    threadId: uuid("thread_id").notNull(),
    messageId: uuid("message_id").notNull(),
    attachmentId: uuid("attachment_id").notNull().unique(),
  },
  (table) => [
    primaryKey({ columns: [table.messageId, table.attachmentId] }),
    foreignKey({
      columns: [table.threadId, table.messageId],
      foreignColumns: [messages.threadId, messages.id],
    }),
    foreignKey({
      columns: [table.threadId, table.attachmentId],
      foreignColumns: [messageAttachments.threadId, messageAttachments.id],
    }),
  ],
);
export const operatorGrants = treido.table(
  "operator_grants",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    capability: text("capability")
      .$type<"reports.read" | "moderation.write">()
      .notNull(),
    active: boolean("active").notNull().default(true),
    revision: integer("revision").notNull().default(1),
  },
  (table) => [primaryKey({ columns: [table.userId, table.capability] })],
);
export const reports = treido.table(
  "reports",
  {
    id: uuid("id").primaryKey(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id),
    resourceKind: text("resource_kind")
      .$type<"listing" | "message">()
      .notNull(),
    resourceId: uuid("resource_id").notNull(),
    reason: text("reason").notNull(),
    details: varchar("details", { length: 2000 }).notNull(),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    state: text("state").$type<"open" | "reviewed">().notNull().default("open"),
    revision: integer("revision").notNull().default(1),
    createdAt: time("created_at"),
  },
  (table) => [
    unique("report_retry").on(table.reporterId, table.requestId),
    uniqueIndex("reports_exact_resource").on(
      table.id,
      table.resourceKind,
      table.resourceId,
    ),
  ],
);

export const moderationActions = treido.table(
  "moderation_actions",
  {
    id: uuid("id").primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    reportId: uuid("report_id").references(() => reports.id),
    priorState: text("prior_state").notNull(),
    nextState: text("next_state").notNull(),
    priorRevision: integer("prior_revision").notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    reason: varchar("reason", { length: 2000 }).notNull(),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    createdAt: time("created_at"),
  },
  (table) => [
    unique("moderation_retry").on(table.actorId, table.requestId),
    unique("moderation_listing_revision").on(
      table.listingId,
      table.acceptedRevision,
    ),
    uniqueIndex("moderation_actions_exact_resource").on(
      table.id,
      table.listingId,
      table.acceptedRevision,
    ),
    uniqueIndex("moderation_actions_exact_listing").on(
      table.id,
      table.listingId,
    ),
  ],
);
export const moderationAppeals = treido.table(
  "moderation_appeals",
  {
    id: uuid("id").primaryKey(),
    actionId: uuid("action_id")
      .notNull()
      .references(() => moderationActions.id),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    details: varchar("details", { length: 2000 }).notNull(),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    createdAt: time("created_at"),
  },
  (table) => [
    unique("appeal_retry").on(table.actorId, table.requestId),
    uniqueIndex("moderation_appeals_exact_original").on(
      table.id,
      table.actionId,
    ),
  ],
);

export const users = treido.table(
  "users",
  {
    id: uuid("id").primaryKey(),
    clerkSubject: varchar("clerk_subject", { length: 128 }).notNull().unique(),
    status: text("status")
      .$type<"active" | "restricted" | "closed">()
      .notNull()
      .default("active"),
    createdAt: time("created_at"),
  },
  (table) => [
    check(
      "users_status",
      sql`${table.status} in ('active','restricted','closed')`,
    ),
  ],
);

export const sellers = treido.table(
  "seller_accounts",
  {
    id: uuid("id").primaryKey(),
    kind: text("kind").$type<"personal" | "business">().notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    status: text("status")
      .$type<"active" | "restricted" | "closed">()
      .notNull()
      .default("active"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    creationKey: uuid("creation_key"),
    creationHash: varchar("creation_hash", { length: 64 }),
    revision: integer("revision").notNull().default(1),
    createdAt: time("created_at"),
  },
  (table) => [
    unique("seller_kind_identity").on(table.id, table.kind),
    unique("seller_create_retry").on(table.createdBy, table.creationKey),
    check("seller_kind", sql`${table.kind} in ('personal','business')`),
    check(
      "seller_status",
      sql`${table.status} in ('active','restricted','closed')`,
    ),
    check("seller_revision", sql`${table.revision} > 0`),
  ],
);

export const personalOwners = treido.table(
  "personal_seller_owners",
  {
    sellerId: uuid("seller_id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id),
    sellerKind: text("seller_kind").notNull().default("personal"),
  },
  (table) => [
    check("personal_owner_kind", sql`${table.sellerKind} = 'personal'`),
    foreignKey({
      columns: [table.sellerId, table.sellerKind],
      foreignColumns: [sellers.id, sellers.kind],
    }),
  ],
);

export const memberships = treido.table(
  "seller_memberships",
  {
    sellerId: uuid("seller_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    sellerKind: text("seller_kind").notNull().default("business"),
    role: text("role").$type<"owner" | "manager" | "member">().notNull(),
    status: text("status")
      .$type<"active" | "revoked">()
      .notNull()
      .default("active"),
    grants: jsonb("grants").$type<string[]>().notNull().default([]),
    revision: integer("revision").notNull().default(1),
  },
  (table) => [
    primaryKey({ columns: [table.sellerId, table.userId] }),
    check("membership_kind", sql`${table.sellerKind} = 'business'`),
    check(
      "membership_role",
      sql`${table.role} in ('owner','manager','member')`,
    ),
    check("membership_status", sql`${table.status} in ('active','revoked')`),
    check("membership_grants", sql`jsonb_typeof(${table.grants}) = 'array'`),
    foreignKey({
      columns: [table.sellerId, table.sellerKind],
      foreignColumns: [sellers.id, sellers.kind],
    }),
    index("membership_user").on(table.userId, table.status),
  ],
);

export const sellerUsage = treido.table(
  "seller_usage",
  {
    sellerId: uuid("seller_id")
      .primaryKey()
      .references(() => sellers.id),
    planId: text("plan_id")
      .$type<"personal_free" | "business_free">()
      .notNull(),
    planVersion: integer("plan_version").notNull().default(1),
    draftCount: integer("draft_count").notNull().default(0),
  },
  (table) => [
    check(
      "usage_plan",
      sql`${table.planId} in ('personal_free','business_free') and ${table.planVersion} = 1`,
    ),
    check("usage_count", sql`${table.draftCount} >= 0`),
  ],
);

export const listings = treido.table(
  "listings",
  {
    id: uuid("id").primaryKey(),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellers.id),
    publication: text("publication")
      .$type<"draft" | "published" | "withdrawn">()
      .notNull()
      .default("draft"),
    moderationState: text("moderation_state")
      .$type<"clear" | "restricted" | "removed">()
      .notNull()
      .default("clear"),
    moderationRevision: integer("moderation_revision").notNull().default(1),
    currentPublicationRevision: integer("current_publication_revision"),
    revision: integer("revision").notNull().default(1),
    createdAt: time("created_at"),
  },
  (table) => [
    unique("listing_owned_identity").on(table.sellerId, table.id),
    check(
      "listing_publication",
      sql`${table.publication} in ('draft','published','withdrawn')`,
    ),
    check("listing_revision", sql`${table.revision} > 0`),
  ],
);

export const drafts = treido.table(
  "listing_drafts",
  {
    listingId: uuid("listing_id").primaryKey(),
    sellerId: uuid("seller_id").notNull(),
    payload: jsonb("payload").$type<DraftPayload>().notNull(),
    revision: integer("revision").notNull().default(1),
    categoryPolicyVersion: integer("category_policy_version"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    creationKey: uuid("creation_key").notNull(),
    creationHash: varchar("creation_hash", { length: 64 }).notNull(),
    updatedAt: time("updated_at"),
  },
  (table) => [
    unique("draft_create_retry").on(
      table.sellerId,
      table.createdBy,
      table.creationKey,
    ),
    check("draft_revision", sql`${table.revision} > 0`),
    foreignKey({
      columns: [table.sellerId, table.listingId],
      foreignColumns: [listings.sellerId, listings.id],
    }),
    index("draft_seller_updated").on(
      table.sellerId,
      table.updatedAt,
      table.listingId,
    ),
  ],
);

export const draftSaves = treido.table(
  "draft_save_receipts",
  {
    sellerId: uuid("seller_id").notNull(),
    listingId: uuid("listing_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    acceptedAt: time("accepted_at"),
  },
  (table) => [
    primaryKey({
      columns: [table.sellerId, table.listingId, table.userId, table.requestId],
    }),
    foreignKey({
      columns: [table.sellerId, table.listingId],
      foreignColumns: [listings.sellerId, listings.id],
    }),
  ],
);

export const signupIntents = treido.table(
  "signup_intents",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id),
    intent: text("intent").$type<SignupIntent>(),
    revision: integer("revision").notNull(),
    lastRequestId: uuid("last_request_id").notNull(),
    lastInputHash: varchar("last_input_hash", { length: 64 }).notNull(),
    updatedAt: time("updated_at"),
  },
  (table) => [
    check(
      "intent_value",
      sql`${table.intent} in ('buy','personal','business')`,
    ),
    check("intent_revision", sql`${table.revision} > 0`),
  ],
);
export const sellerProfiles = treido.table("seller_profiles", {
  sellerId: uuid("seller_id")
    .primaryKey()
    .references(() => sellers.id),
  description: varchar("description", { length: 1200 }).notNull().default(""),
  locality: varchar("locality", { length: 100 }).notNull().default(""),
});
export const sellerOnboarding = treido.table(
  "seller_onboarding_progress",
  {
    sellerId: uuid("seller_id").primaryKey(),
    sellerKind: text("seller_kind").notNull().default("business"),
    revision: integer("revision").notNull(),
    lastStep: text("last_step").$type<SetupStep>().notNull(),
    updatedAt: time("updated_at"),
  },
  (table) => [
    check("setup_kind", sql`${table.sellerKind} = 'business'`),
    check("setup_revision", sql`${table.revision} > 0`),
    check(
      "setup_step",
      sql`${table.lastStep} in ('details','declaration','review')`,
    ),
    foreignKey({
      columns: [table.sellerId, table.sellerKind],
      foreignColumns: [sellers.id, sellers.kind],
    }),
  ],
);
export const sellerDeclarations = treido.table(
  "seller_declarations",
  {
    id: uuid("id").primaryKey(),
    sellerId: uuid("seller_id").notNull(),
    sellerKind: text("seller_kind").notNull().default("business"),
    revision: integer("revision").notNull(),
    requirementVersion: integer("requirement_version").notNull(),
    country: varchar("country", { length: 2 }).notNull(),
    legalName: varchar("legal_name", { length: 160 }).notNull(),
    registrationNumber: varchar("registration_number", {
      length: 40,
    }).notNull(),
    contactEmail: varchar("contact_email", { length: 254 }).notNull(),
    contactAddress: varchar("contact_address", { length: 500 }).notNull(),
    accurate: boolean("accurate").notNull(),
    status: text("status").$type<DeclarationStatus>().notNull(),
    submittedBy: uuid("submitted_by")
      .notNull()
      .references(() => users.id),
    createdAt: time("created_at"),
    submittedAt: timestamp("submitted_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    unique("declaration_revision").on(table.sellerId, table.revision),
    unique("declaration_owned_identity").on(table.sellerId, table.id),
    check("declaration_kind", sql`${table.sellerKind} = 'business'`),
    check(
      "declaration_version",
      sql`${table.revision} > 0 and ${table.requirementVersion} > 0`,
    ),
    check("declaration_country", sql`${table.country} = 'BG'`),
    check(
      "declaration_status",
      sql`${table.status} in ('draft','review_required','accepted','rejected')`,
    ),
    check(
      "declaration_submission",
      sql`${table.status} = 'draft' or (${table.accurate} and length(${table.legalName}) >= 2 and length(${table.registrationNumber}) >= 2 and length(${table.contactEmail}) > 0 and length(${table.contactAddress}) >= 5 and ${table.submittedAt} is not null)`,
    ),
    foreignKey({
      columns: [table.sellerId, table.sellerKind],
      foreignColumns: [sellers.id, sellers.kind],
    }),
  ],
);
export const sellerSetupReceipts = treido.table(
  "seller_setup_receipts",
  {
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellerOnboarding.sellerId),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    acceptedAt: time("accepted_at"),
  },
  (table) => [
    primaryKey({ columns: [table.sellerId, table.userId, table.requestId] }),
    check("setup_receipt_revision", sql`${table.acceptedRevision} > 0`),
  ],
);

export const outboxJobs = treido.table(
  "outbox_jobs",
  {
    id: uuid("id").primaryKey(),
    kind: text("kind").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    sellerId: uuid("seller_id").references(() => sellers.id),
    buyerId: uuid("buyer_id").references(() => users.id),
    resourceId: uuid("resource_id").notNull(),
    operationKey: uuid("operation_key").notNull(),
    intentHash: varchar("intent_hash", { length: 64 }).notNull(),
    actorId: uuid("actor_id").references(() => users.id),
    authority: text("authority").notNull(),
    state: text("state").notNull().default("pending"),
    generation: integer("generation").notNull().default(1),
    attempts: integer("attempts").notNull().default(0),
    availableAt: time("available_at"),
    dispatchToken: uuid("dispatch_token"),
    dispatchUntil: timestamp("dispatch_until", {
      withTimezone: true,
      mode: "date",
    }),
    executorEventId: varchar("executor_event_id", { length: 160 }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
    progressAt: time("progress_at"),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastError: text("last_error"),
    createdAt: time("created_at"),
  },
  (table) => [
    unique("outbox_effect_identity").on(table.kind, table.operationKey),
    unique("outbox_owned_identity").on(table.sellerId, table.id),
    unique("outbox_receipt_identity").on(
      table.id,
      table.kind,
      table.operationKey,
    ),
    check(
      "outbox_actor_authority",
      sql`(${table.authority}='member' and ${table.actorId} is not null) or (${table.authority}='service' and ${table.actorId} is null) or (${table.authority}='buyer' and ${table.actorId} is not null and ${table.actorId}=${table.buyerId}) or (${table.authority} in ('assistant','closure','shipping') and ${table.actorId} is null)`,
    ),
    check(
      "outbox_jobs_authority_check",
      sql`${table.authority} in ('member','service','buyer','assistant','closure','shipping')`,
    ),
    check(
      "outbox_owner_scope",
      sql`(${table.kind}='buyer.saved-search' and ${table.sellerId} is null and ${table.buyerId} is not null and ${table.actorId}=${table.buyerId} and ${table.authority}='buyer') or (${table.kind} in ('assistant.media-expiry','assistant.run-expiry','assistant.usage') and ${table.sellerId} is null and ${table.buyerId} is not null and ${table.actorId} is null and ${table.authority}='assistant' and ${table.operationKey}=${table.resourceId}) or (${table.kind} in ('shipping.input-expiry','shipping.recipient-expiry') and ${table.sellerId} is null and ${table.buyerId} is not null and ${table.actorId} is null and ${table.authority}='shipping' and ${table.operationKey}=${table.resourceId}) or (${table.kind}='account.closure' and ${table.sellerId} is null and ${table.buyerId} is not null and ${table.actorId} is null and ${table.authority}='closure') or (${table.kind} not in ('buyer.saved-search','assistant.media-expiry','assistant.run-expiry','assistant.usage','account.closure','shipping.input-expiry','shipping.recipient-expiry') and ${table.sellerId} is not null and ${table.buyerId} is null and ${table.authority} in ('member','service'))`,
    ),
    check(
      "invitation_job_member",
      sql`${table.kind}<>'team.invitation' or ${table.authority}='member'`,
    ),
    check(
      "payment_job_service",
      sql`${table.kind} not in ('payment.reconcile','payment.refund') or ${table.authority}='service'`,
    ),
    check(
      "outbox_media_authority",
      sql`${table.kind} not in ('media.process','catalogue.import') or ${table.authority}='member'`,
    ),
    check(
      "outbox_state",
      sql`${table.state} in ('pending','accepted','completed','cancelled','dead')`,
    ),
    check(
      "outbox_jobs_kind_check",
      sql`${table.kind} in ('media.process','system.probe','catalogue.import','team.invitation','payment.reconcile','payment.refund','buyer.saved-search','billing.reconcile','promotion.reconcile','payment.aftercare','assistant.media-expiry','assistant.run-expiry','assistant.usage','account.closure','shipping.input-expiry','shipping.recipient-expiry')`,
    ),
    check(
      "aftercare_service_only",
      sql`${table.kind}<>'payment.aftercare' or (${table.authority}='service' and ${table.actorId} is null and ${table.buyerId} is null and ${table.sellerId} is not null)`,
    ),
    check(
      "outbox_version",
      sql`${table.schemaVersion}=1 and ${table.generation}>0 and ${table.attempts}>=0`,
    ),
    check(
      "outbox_lease",
      sql`(${table.dispatchToken} is null)=(${table.dispatchUntil} is null)`,
    ),
    check(
      "outbox_completion",
      sql`(${table.state}='completed')=(${table.completedAt} is not null)`,
    ),
  ],
);
export const jobEffects = treido.table(
  "job_effects",
  {
    jobId: uuid("job_id")
      .primaryKey()
      .references(() => outboxJobs.id),
    kind: text("kind").notNull(),
    operationKey: uuid("operation_key").notNull(),
    state: text("state").notNull().default("pending"),
    executionToken: uuid("execution_token"),
    executionUntil: timestamp("execution_until", {
      withTimezone: true,
      mode: "date",
    }),
    executorRunId: varchar("executor_run_id", { length: 160 }),
    providerObjectId: varchar("provider_object_id", { length: 160 }),
    resultId: uuid("result_id"),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    unique("effect_identity").on(table.kind, table.operationKey),
    foreignKey({
      columns: [table.jobId, table.kind, table.operationKey],
      foreignColumns: [outboxJobs.id, outboxJobs.kind, outboxJobs.operationKey],
    }),
    check(
      "effect_state",
      sql`${table.state} in ('pending','running','completed','cancelled')`,
    ),
    check(
      "effect_lease",
      sql`(${table.executionToken} is null)=(${table.executionUntil} is null)`,
    ),
    check(
      "effect_completion",
      sql`(${table.state}='completed')=(${table.completedAt} is not null)`,
    ),
  ],
);
export const jobRedrives = treido.table(
  "job_redrives",
  {
    id: uuid("id").primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => outboxJobs.id),
    serviceId: varchar("service_id", { length: 80 }).notNull(),
    reason: varchar("reason", { length: 500 }).notNull(),
    fromGeneration: integer("from_generation").notNull(),
    toGeneration: integer("to_generation").notNull(),
    createdAt: time("created_at"),
  },
  (table) => [
    unique("job_redrive_generation").on(table.jobId, table.toGeneration),
    check(
      "redrive_generation",
      sql`${table.fromGeneration}>0 and ${table.toGeneration}=${table.fromGeneration}+1`,
    ),
    check("redrive_reason", sql`length(${table.reason}) between 10 and 500`),
  ],
);
export const mediaAssets = treido.table(
  "media_assets",
  {
    id: uuid("id").primaryKey(),
    sellerId: uuid("seller_id").notNull(),
    listingId: uuid("listing_id").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    state: text("state").notNull().default("staged"),
    expectedBytes: integer("expected_bytes").notNull(),
    contentType: text("content_type").notNull(),
    expectedChecksum: varchar("expected_checksum", { length: 64 }).notNull(),
    stagingKey: varchar("staging_key", { length: 300 }).notNull().unique(),
    immutableKey: varchar("immutable_key", { length: 300 }).unique(),
    sourceEtag: varchar("source_etag", { length: 160 }),
    derivativeKey: varchar("derivative_key", { length: 300 }).unique(),
    derivativeChecksum: varchar("derivative_checksum", { length: 64 }),
    width: integer("width"),
    height: integer("height"),
    position: integer("position").notNull(),
    revision: integer("revision").notNull().default(1),
    jobId: uuid("job_id"),
    errorCode: text("error_code"),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    createdAt: time("created_at"),
  },
  (table) => [
    unique("media_retry").on(table.sellerId, table.createdBy, table.requestId),
    unique("media_owned_identity").on(table.sellerId, table.id),
    foreignKey({
      columns: [table.sellerId, table.listingId],
      foreignColumns: [listings.sellerId, listings.id],
    }),
    foreignKey({
      columns: [table.sellerId, table.jobId],
      foreignColumns: [outboxJobs.sellerId, outboxJobs.id],
    }),
    check("media_bytes", sql`${table.expectedBytes} between 1 and 12582912`),
    check(
      "media_position",
      sql`${table.position} between 0 and 11 and ${table.revision}>0`,
    ),
    check(
      "media_state",
      sql`${table.state} in ('staged','processing','ready','failed','detached')`,
    ),
  ],
);

export const listingDuplicateReceipts = treido.table(
  "listing_duplicate_receipts",
  {
    sellerId: uuid("seller_id").notNull(),
    sourceListingId: uuid("source_listing_id").notNull(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    newListingId: uuid("new_listing_id").notNull(),
    createdAt: time("created_at"),
  },
  (table) => [
    primaryKey({ columns: [table.sellerId, table.actorId, table.requestId] }),
    unique("duplicate_created_listing").on(table.sellerId, table.newListingId),
    check(
      "duplicate_distinct_listing",
      sql`${table.sourceListingId} <> ${table.newListingId}`,
    ),
    check("duplicate_hash", sql`${table.inputHash} ~ '^[0-9a-f]{64}$'`),
    foreignKey({
      columns: [table.sellerId, table.sourceListingId],
      foreignColumns: [listings.sellerId, listings.id],
    }),
    foreignKey({
      columns: [table.sellerId, table.newListingId],
      foreignColumns: [listings.sellerId, listings.id],
    }),
  ],
);

export const contactPreferences = treido.table(
  "contact_preferences",
  {
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellers.id),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id),
    buyerBlocked: boolean("buyer_blocked").notNull().default(false),
    sellerBlocked: boolean("seller_blocked").notNull().default(false),
    revision: integer("revision").notNull().default(1),
    updatedAt: time("updated_at"),
  },
  (table) => [primaryKey({ columns: [table.sellerId, table.buyerId] })],
);
export const conversationReadCursors = treido.table(
  "conversation_read_cursors",
  {
    threadId: uuid("thread_id")
      .notNull()
      .references(() => conversationThreads.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    lastSequence: integer("last_sequence").notNull(),
    updatedAt: time("updated_at"),
  },
  (table) => [primaryKey({ columns: [table.threadId, table.userId] })],
);
export const contactPreferenceReceipts = treido.table(
  "contact_preference_receipts",
  {
    sellerId: uuid("seller_id").notNull(),
    buyerId: uuid("buyer_id").notNull(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    createdAt: time("created_at"),
  },
  (table) => [
    primaryKey({
      columns: [table.sellerId, table.buyerId, table.actorId, table.requestId],
    }),
    foreignKey({
      columns: [table.sellerId, table.buyerId],
      foreignColumns: [contactPreferences.sellerId, contactPreferences.buyerId],
    }),
  ],
);
export const messageNotificationIntents = treido.table(
  "message_notification_intents",
  {
    threadId: uuid("thread_id").notNull(),
    messageId: uuid("message_id").primaryKey(),
    recipientSide: text("recipient_side").$type<"buyer" | "seller">().notNull(),
    createdAt: time("created_at"),
  },
  (table) => [
    foreignKey({
      columns: [table.threadId, table.messageId],
      foreignColumns: [messages.threadId, messages.id],
    }),
  ],
);

export const listingPublications = treido.table(
  "listing_publications",
  {
    sellerId: uuid("seller_id").notNull(),
    listingId: uuid("listing_id").notNull(),
    revision: integer("revision").notNull(),
    draftRevision: integer("draft_revision").notNull(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    payload: jsonb("payload").$type<DraftPayload>().notNull(),
    terms: jsonb("terms")
      .$type<import("@/features/selling/publish-model").PublicationTerms>()
      .notNull(),
    sellerKind: text("seller_kind").$type<"personal" | "business">().notNull(),
    registryVersion: integer("registry_version").notNull(),
    categoryId: varchar("category_id", { length: 120 }).notNull(),
    categoryPolicyVersion: integer("category_policy_version").notNull(),
    country: varchar("country", { length: 2 }).notNull(),
    declarationRevision: integer("declaration_revision"),
    createdAt: time("created_at"),
  },
  (t) => [
    primaryKey({ columns: [t.sellerId, t.listingId, t.revision] }),
    unique("publication_retry_identity").on(
      t.sellerId,
      t.listingId,
      t.actorId,
      t.requestId,
    ),
    foreignKey({
      columns: [t.sellerId, t.listingId],
      foreignColumns: [listings.sellerId, listings.id],
    }),
    foreignKey({
      columns: [t.sellerId, t.declarationRevision],
      foreignColumns: [
        sellerDeclarations.sellerId,
        sellerDeclarations.revision,
      ],
    }),
    foreignKey({
      columns: [
        t.registryVersion,
        t.categoryId,
        t.country,
        t.categoryPolicyVersion,
      ],
      foreignColumns: [
        categoryPolicies.registryVersion,
        categoryPolicies.categoryId,
        categoryPolicies.country,
        categoryPolicies.version,
      ],
    }),
  ],
);
export const listingPublicationMedia = treido.table(
  "listing_publication_media",
  {
    sellerId: uuid("seller_id").notNull(),
    listingId: uuid("listing_id").notNull(),
    publicationRevision: integer("publication_revision").notNull(),
    assetId: uuid("asset_id").notNull(),
    assetRevision: integer("asset_revision").notNull(),
    position: integer("position").notNull(),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.sellerId, t.listingId, t.publicationRevision, t.assetId],
    }),
    unique("publication_photo_position").on(
      t.sellerId,
      t.listingId,
      t.publicationRevision,
      t.position,
    ),
    foreignKey({
      columns: [t.sellerId, t.listingId, t.publicationRevision],
      foreignColumns: [
        listingPublications.sellerId,
        listingPublications.listingId,
        listingPublications.revision,
      ],
    }),
    foreignKey({
      columns: [t.sellerId, t.listingId, t.assetId],
      foreignColumns: [
        mediaAssets.sellerId,
        mediaAssets.listingId,
        mediaAssets.id,
      ],
    }),
  ],
);

export const buyerLibraries = treido.table(
  "buyer_libraries",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id),
    revision: integer("revision").notNull().default(0),
  },
  () => [check("buyer_libraries_revision_check", sql.raw("revision >= 0"))],
);
export const savedListings = treido.table(
  "saved_listings",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id),
    saved: boolean("saved").notNull().default(true),
    savedAt: time("saved_at"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.listingId] }),
    index("saved_listing_page")
      .on(table.userId, table.savedAt.desc(), table.listingId.desc())
      .where(sql.raw("saved")),
  ],
);
export const buyerCollections = treido.table(
  "buyer_collections",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    id: uuid("id").notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: time("created_at"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.id] }),
    check(
      "buyer_collections_name_check",
      sql.raw("char_length(btrim(name)) BETWEEN 1 AND 80"),
    ),
    index("buyer_collection_page")
      .on(table.userId, table.createdAt.desc(), table.id.desc())
      .where(sql.raw("active")),
  ],
);
export const buyerCollectionItems = treido.table(
  "buyer_collection_items",
  {
    userId: uuid("user_id").notNull(),
    collectionId: uuid("collection_id").notNull(),
    listingId: uuid("listing_id").notNull(),
    included: boolean("included").notNull().default(true),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.collectionId, table.listingId],
    }),
    foreignKey({
      columns: [table.userId, table.collectionId],
      foreignColumns: [buyerCollections.userId, buyerCollections.id],
    }),
    foreignKey({
      columns: [table.userId, table.listingId],
      foreignColumns: [savedListings.userId, savedListings.listingId],
    }),
    index("buyer_collection_listing")
      .on(table.userId, table.listingId)
      .where(sql.raw("included")),
  ],
);
export const sellerFollows = treido.table(
  "seller_follows",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellers.id),
    followed: boolean("followed").notNull().default(true),
    followedAt: time("followed_at"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.sellerId] }),
    index("seller_follow_page")
      .on(table.userId, table.followedAt.desc(), table.sellerId.desc())
      .where(sql.raw("followed")),
  ],
);
export const buyerLibraryReceipts = treido.table(
  "buyer_library_receipts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    resultId: uuid("result_id"),
    createdAt: time("created_at"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.requestId] }),
    check(
      "buyer_library_receipts_input_hash_check",
      sql.raw("input_hash ~ '^[0-9a-f]{64}$'"),
    ),
    check(
      "buyer_library_receipts_accepted_revision_check",
      sql.raw("accepted_revision > 0"),
    ),
    index("buyer_library_receipt_rate").on(
      table.userId,
      table.createdAt.desc(),
    ),
  ],
);

// T42: opt-in stock, immutable accepted variants, shared allocations and account carts.
export const inventoryCatalogues = treido.table(
  "inventory_catalogues",
  {
    sellerId: uuid("seller_id").notNull(),
    listingId: uuid("listing_id").primaryKey(),
    sellerKind: text("seller_kind").notNull(),
    mode: text("mode").notNull(),
    revision: integer("revision").notNull().default(1),
    createdAt: time("created_at"),
  },
  (t) => [
    unique().on(t.sellerId, t.listingId),
    unique().on(t.sellerId, t.listingId, t.mode),
    foreignKey({
      columns: [t.sellerId, t.listingId],
      foreignColumns: [listings.sellerId, listings.id],
    }),
    foreignKey({
      columns: [t.sellerId, t.sellerKind],
      foreignColumns: [sellers.id, sellers.kind],
    }),
    check(
      "inventory_mode_kind",
      sql`${t.mode} IN ('unique','stocked') AND (${t.mode}='unique' OR ${t.sellerKind}='business')`,
    ),
    check("inventory_revision", sql`${t.revision}>0`),
  ],
);
export const inventorySkus = treido.table(
  "inventory_skus",
  {
    id: uuid("id").primaryKey(),
    sellerId: uuid("seller_id").notNull(),
    listingId: uuid("listing_id").notNull(),
    mode: text("mode").notNull(),
    sellerSku: varchar("seller_sku", { length: 64 }).notNull().default(""),
    options: jsonb("options")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    optionKey: varchar("option_key", { length: 64 }).notNull(),
    priceMinor: integer("price_minor"),
    currency: text("currency").notNull().default("EUR"),
    onHand: integer("on_hand").notNull(),
    sold: integer("sold").notNull().default(0),
    active: boolean("active").notNull().default(true),
    revision: integer("revision").notNull().default(1),
    createdAt: time("created_at"),
  },
  (t) => [
    unique().on(t.sellerId, t.listingId, t.id),
    foreignKey({
      columns: [t.sellerId, t.listingId, t.mode],
      foreignColumns: [
        inventoryCatalogues.sellerId,
        inventoryCatalogues.listingId,
        inventoryCatalogues.mode,
      ],
    }),
    uniqueIndex("inventory_option_unique")
      .on(t.sellerId, t.listingId, t.optionKey)
      .where(sql`${t.active}`),
    uniqueIndex("inventory_single_unique")
      .on(t.listingId)
      .where(sql`${t.active} AND ${t.mode}='unique'`),
    uniqueIndex("inventory_seller_code")
      .on(t.sellerId, sql`lower(btrim(${t.sellerSku}))`)
      .where(sql`${t.active} AND ${t.sellerSku}<>''`),
    index("inventory_seller_listing").on(t.sellerId, t.listingId, t.id),
    check(
      "inventory_quantity_bounds",
      sql`${t.onHand} BETWEEN 0 AND 1000000 AND ${t.sold}>=0 AND (${t.mode}<>'unique' OR (${t.onHand}<=1 AND ${t.options}='{}'::jsonb))`,
    ),
    check(
      "inventory_price_bounds",
      sql`${t.priceMinor} BETWEEN 0 AND 1000000000 AND ${t.currency}='EUR'`,
    ),
    check("inventory_sku_revision", sql`${t.revision}>0`),
  ],
);
export const inventoryPublications = treido.table(
  "inventory_publications",
  {
    sellerId: uuid("seller_id").notNull(),
    listingId: uuid("listing_id").notNull(),
    publicationRevision: integer("publication_revision").notNull(),
    mode: text("mode").notNull(),
    inventoryRevision: integer("inventory_revision").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sellerId, t.listingId, t.publicationRevision] }),
    foreignKey({
      columns: [t.sellerId, t.listingId, t.publicationRevision],
      foreignColumns: [
        listingPublications.sellerId,
        listingPublications.listingId,
        listingPublications.revision,
      ],
    }),
    check("inventory_publication_revision", sql`${t.inventoryRevision}>0`),
  ],
);
export const inventoryPublicationSkus = treido.table(
  "inventory_publication_skus",
  {
    sellerId: uuid("seller_id").notNull(),
    listingId: uuid("listing_id").notNull(),
    publicationRevision: integer("publication_revision").notNull(),
    skuId: uuid("sku_id").notNull(),
    options: jsonb("options").$type<Record<string, string>>().notNull(),
    priceMinor: integer("price_minor").notNull(),
    currency: text("currency").notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.sellerId, t.listingId, t.publicationRevision, t.skuId],
    }),
    foreignKey({
      columns: [t.sellerId, t.listingId, t.publicationRevision],
      foreignColumns: [
        inventoryPublications.sellerId,
        inventoryPublications.listingId,
        inventoryPublications.publicationRevision,
      ],
    }),
    foreignKey({
      columns: [t.sellerId, t.listingId, t.skuId],
      foreignColumns: [
        inventorySkus.sellerId,
        inventorySkus.listingId,
        inventorySkus.id,
      ],
    }),
    check(
      "inventory_snapshot_price",
      sql`${t.priceMinor} BETWEEN 0 AND 1000000000 AND ${t.currency}='EUR'`,
    ),
  ],
);
export const inventoryAllocations = treido.table(
  "inventory_allocations",
  {
    id: uuid("id").primaryKey(),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellers.id),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id),
    purpose: text("purpose").notNull(),
    sourceId: uuid("source_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    state: text("state").notNull().default("active"),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    revision: integer("revision").notNull().default(1),
    resolutionReference: varchar("resolution_reference", { length: 200 }),
    createdAt: time("created_at"),
    updatedAt: time("updated_at"),
  },
  (t) => [
    unique().on(t.purpose, t.sourceId),
    unique().on(t.sellerId, t.id),
    unique("allocation_source_owner").on(
      t.id,
      t.sellerId,
      t.buyerId,
      t.sourceId,
      t.purpose,
    ),
    index("allocation_expiry")
      .on(t.expiresAt, t.id)
      .where(sql`${t.state}='active'`),
    index("allocation_buyer").on(t.buyerId, t.createdAt.desc(), t.id),
    check(
      "allocation_states",
      sql`${t.state} IN ('active','released','expired','consumed','reconciliation') AND ${t.purpose} IN ('offer','checkout')`,
    ),
    check(
      "allocation_time",
      sql`${t.expiresAt}>${t.createdAt} AND ${t.revision}>0`,
    ),
  ],
);
export const inventoryAllocationLines = treido.table(
  "inventory_allocation_lines",
  {
    allocationId: uuid("allocation_id").notNull(),
    sellerId: uuid("seller_id").notNull(),
    listingId: uuid("listing_id").notNull(),
    skuId: uuid("sku_id").notNull(),
    publicationRevision: integer("publication_revision").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceMinor: integer("unit_price_minor").notNull(),
    currency: text("currency").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.allocationId, t.skuId] }),
    foreignKey({
      columns: [t.sellerId, t.allocationId],
      foreignColumns: [inventoryAllocations.sellerId, inventoryAllocations.id],
    }),
    foreignKey({
      columns: [t.sellerId, t.listingId, t.publicationRevision, t.skuId],
      foreignColumns: [
        inventoryPublicationSkus.sellerId,
        inventoryPublicationSkus.listingId,
        inventoryPublicationSkus.publicationRevision,
        inventoryPublicationSkus.skuId,
      ],
    }),
    index("allocation_sku").on(t.skuId, t.allocationId),
    check(
      "allocation_line_bounds",
      sql`${t.quantity} BETWEEN 1 AND 99 AND ${t.unitPriceMinor} BETWEEN 0 AND 1000000000 AND ${t.currency}='EUR'`,
    ),
  ],
);
export const inventoryEvents = treido.table(
  "inventory_events",
  {
    id: uuid("id").primaryKey(),
    sellerId: uuid("seller_id").notNull(),
    listingId: uuid("listing_id").notNull(),
    skuId: uuid("sku_id").notNull(),
    actorId: uuid("actor_id").references(() => users.id),
    allocationId: uuid("allocation_id"),
    kind: text("kind").notNull(),
    quantity: integer("quantity").notNull(),
    onHandAfter: integer("on_hand_after").notNull(),
    reason: varchar("reason", { length: 300 }).notNull(),
    createdAt: time("created_at"),
  },
  (t) => [
    foreignKey({
      columns: [t.sellerId, t.listingId, t.skuId],
      foreignColumns: [
        inventorySkus.sellerId,
        inventorySkus.listingId,
        inventorySkus.id,
      ],
    }),
    foreignKey({
      columns: [t.sellerId, t.allocationId],
      foreignColumns: [inventoryAllocations.sellerId, inventoryAllocations.id],
    }),
    index("inventory_history").on(
      t.sellerId,
      t.listingId,
      t.createdAt.desc(),
      t.id.desc(),
    ),
    check(
      "inventory_event_bounds",
      sql`${t.quantity} BETWEEN -1000000 AND 1000000 AND ${t.onHandAfter} BETWEEN 0 AND 1000000`,
    ),
  ],
);
export const inventoryCommandReceipts = treido.table(
  "inventory_command_receipts",
  {
    sellerId: uuid("seller_id").notNull(),
    listingId: uuid("listing_id").notNull(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    result: jsonb("result").notNull(),
    createdAt: time("created_at"),
  },
  (t) => [
    primaryKey({ columns: [t.sellerId, t.listingId, t.actorId, t.requestId] }),
    foreignKey({
      columns: [t.sellerId, t.listingId],
      foreignColumns: [listings.sellerId, listings.id],
    }),
  ],
);
export const buyerCarts = treido.table(
  "buyer_carts",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id),
    revision: integer("revision").notNull().default(0),
  },
  (t) => [check("buyer_cart_revision", sql`${t.revision}>=0`)],
);
export const buyerCartLines = treido.table(
  "buyer_cart_lines",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => buyerCarts.userId),
    sellerId: uuid("seller_id").notNull(),
    listingId: uuid("listing_id").notNull(),
    skuId: uuid("sku_id").notNull(),
    publicationRevision: integer("publication_revision").notNull(),
    quantity: integer("quantity").notNull(),
    seenPriceMinor: integer("seen_price_minor").notNull(),
    active: boolean("active").notNull().default(true),
    addedAt: time("added_at"),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.skuId] }),
    foreignKey({
      columns: [t.sellerId, t.listingId, t.publicationRevision, t.skuId],
      foreignColumns: [
        inventoryPublicationSkus.sellerId,
        inventoryPublicationSkus.listingId,
        inventoryPublicationSkus.publicationRevision,
        inventoryPublicationSkus.skuId,
      ],
    }),
    index("buyer_cart_active")
      .on(t.userId, t.addedAt.desc(), t.skuId)
      .where(sql`${t.active}`),
    check(
      "buyer_cart_line_bounds",
      sql`${t.quantity} BETWEEN 1 AND 99 AND ${t.seenPriceMinor} BETWEEN 0 AND 1000000000`,
    ),
  ],
);
export const buyerCartReceipts = treido.table(
  "buyer_cart_receipts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => buyerCarts.userId),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    createdAt: time("created_at"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.requestId] })],
);
export const listingOffers = treido.table(
  "listing_offers",
  {
    id: uuid("id").primaryKey(),
    threadId: uuid("thread_id").notNull(),
    sellerId: uuid("seller_id").notNull(),
    listingId: uuid("listing_id").notNull(),
    buyerId: uuid("buyer_id").notNull(),
    proposerId: uuid("proposer_id")
      .notNull()
      .references(() => users.id),
    proposerSide: text("proposer_side").notNull(),
    publicationRevision: integer("publication_revision").notNull(),
    skuId: uuid("sku_id").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceMinor: integer("unit_price_minor").notNull(),
    currency: text("currency").notNull().default("EUR"),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    state: text("state").notNull().default("pending"),
    revision: integer("revision").notNull().default(1),
    sequence: integer("sequence").notNull(),
    parentOfferId: uuid("parent_offer_id"),
    allocationId: uuid("allocation_id"),
    allocationPurpose: text("allocation_purpose").notNull().default("offer"),
    createdAt: time("created_at"),
  },
  (t) => [
    unique().on(t.threadId, t.id),
    unique().on(t.threadId, t.sequence),
    foreignKey({
      columns: [t.threadId, t.sellerId, t.listingId, t.buyerId],
      foreignColumns: [
        conversationThreads.id,
        conversationThreads.sellerId,
        conversationThreads.listingId,
        conversationThreads.buyerId,
      ],
    }),
    foreignKey({
      columns: [t.sellerId, t.listingId, t.publicationRevision, t.skuId],
      foreignColumns: [
        inventoryPublicationSkus.sellerId,
        inventoryPublicationSkus.listingId,
        inventoryPublicationSkus.publicationRevision,
        inventoryPublicationSkus.skuId,
      ],
    }),
    foreignKey({
      columns: [t.threadId, t.parentOfferId],
      foreignColumns: [t.threadId, t.id],
    }),
    foreignKey({
      columns: [
        t.allocationId,
        t.sellerId,
        t.buyerId,
        t.id,
        t.allocationPurpose,
      ],
      foreignColumns: [
        inventoryAllocations.id,
        inventoryAllocations.sellerId,
        inventoryAllocations.buyerId,
        inventoryAllocations.sourceId,
        inventoryAllocations.purpose,
      ],
    }),
    uniqueIndex("offer_one_pending")
      .on(t.threadId)
      .where(sql`${t.state}='pending'`),
    index("offer_history").on(t.threadId, t.sequence.desc()),
    check(
      "offer_amount_quantity",
      sql`${t.quantity} BETWEEN 1 AND 99 AND ${t.unitPriceMinor} BETWEEN 1 AND 1000000000 AND ${t.currency}='EUR'`,
    ),
    check(
      "offer_acceptance_allocation",
      sql`(${t.state} IN ('accepted','cancelled'))=(${t.allocationId} IS NOT NULL)`,
    ),
    check("offer_expiry", sql`${t.expiresAt}>${t.createdAt}`),
  ],
);
export const offerEvents = treido.table(
  "offer_events",
  {
    id: uuid("id").primaryKey(),
    threadId: uuid("thread_id").notNull(),
    offerId: uuid("offer_id").notNull(),
    actorId: uuid("actor_id").references(() => users.id),
    kind: text("kind").notNull(),
    createdAt: time("created_at"),
  },
  (t) => [
    unique().on(t.threadId, t.id),
    foreignKey({
      columns: [t.threadId, t.offerId],
      foreignColumns: [listingOffers.threadId, listingOffers.id],
    }),
  ],
);
export const offerCommandReceipts = treido.table(
  "offer_command_receipts",
  {
    threadId: uuid("thread_id").notNull(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    offerId: uuid("offer_id").notNull(),
    createdAt: time("created_at"),
  },
  (t) => [
    primaryKey({ columns: [t.threadId, t.actorId, t.requestId] }),
    foreignKey({
      columns: [t.threadId, t.offerId],
      foreignColumns: [listingOffers.threadId, listingOffers.id],
    }),
  ],
);

export const catalogueImports = treido.table(
  "catalogue_imports",
  {
    id: uuid("id").primaryKey(),
    sellerId: uuid("seller_id").notNull(),
    sellerKind: text("seller_kind")
      .$type<"business">()
      .notNull()
      .default("business"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    requestId: uuid("request_id").notNull(),
    sourceName: varchar("source_name", { length: 180 }).notNull(),
    sourceHash: varchar("source_hash", { length: 64 }).notNull(),
    sourceBytes: integer("source_bytes").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    state: text("state")
      .$type<import("@/features/catalogue-import/model").ImportState>()
      .notNull()
      .default("uploading"),
    revision: integer("revision").notNull().default(1),
    totalRows: integer("total_rows").notNull().default(0),
    jobId: uuid("job_id"),
    errorCode: varchar("error_code", { length: 60 }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()+interval '24 hours'")),
    createdAt: time("created_at"),
    updatedAt: time("updated_at"),
  },
  (t) => [
    unique("catalogue_import_owner").on(t.sellerId, t.id),
    unique("catalogue_import_retry").on(t.sellerId, t.createdBy, t.requestId),
    foreignKey({
      columns: [t.sellerId, t.sellerKind],
      foreignColumns: [sellers.id, sellers.kind],
    }),
    foreignKey({
      columns: [t.sellerId, t.jobId],
      foreignColumns: [outboxJobs.sellerId, outboxJobs.id],
    }),
    check("catalogue_import_business", sql.raw("seller_kind='business'")),
    check(
      "catalogue_import_source_size",
      sql.raw("source_bytes BETWEEN 1 AND 10485760"),
    ),
    check(
      "catalogue_import_version",
      sql.raw(
        "schema_version=1 AND revision>0 AND total_rows BETWEEN 0 AND 1000",
      ),
    ),
    check("catalogue_import_hash", sql.raw("source_hash ~ '^[0-9a-f]{64}$'")),
    check(
      "catalogue_import_state",
      sql.raw(
        "state IN ('uploading','review','queued','processing','paused','completed','cancelled')",
      ),
    ),
    index("catalogue_import_history").on(
      t.sellerId,
      t.createdAt.desc(),
      t.id.desc(),
    ),
  ],
);
export const catalogueImportChunks = treido.table(
  "catalogue_import_chunks",
  {
    sellerId: uuid("seller_id").notNull(),
    importId: uuid("import_id").notNull(),
    position: integer("position").notNull(),
    bytes: integer("bytes").notNull(),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    encoded: text("encoded").notNull(),
    createdAt: time("created_at"),
  },
  (t) => [
    primaryKey({ columns: [t.importId, t.position] }),
    foreignKey({
      columns: [t.sellerId, t.importId],
      foreignColumns: [catalogueImports.sellerId, catalogueImports.id],
    }),
    check(
      "import_chunk_bounds",
      sql.raw(
        "position BETWEEN 0 AND 79 AND bytes BETWEEN 1 AND 131072 AND length(encoded) BETWEEN 4 AND 174764",
      ),
    ),
    check("import_chunk_hash", sql.raw("checksum ~ '^[0-9a-f]{64}$'")),
  ],
);
export const catalogueImportRows = treido.table(
  "catalogue_import_rows",
  {
    sellerId: uuid("seller_id").notNull(),
    importId: uuid("import_id").notNull(),
    rowNumber: integer("row_number").notNull(),
    externalId: varchar("external_id", { length: 128 }),
    raw: jsonb("raw")
      .$type<import("@/features/catalogue-import/csv").CsvRow>()
      .notNull(),
    payload: jsonb("payload").$type<DraftPayload>(),
    inventory:
      jsonb("inventory").$type<
        import("@/features/catalogue-import/model").ImportedInventory
      >(),
    errors: jsonb("errors")
      .$type<import("@/features/catalogue-import/model").ImportIssue[]>()
      .notNull()
      .default([]),
    selected: boolean("selected").notNull().default(false),
    state: text("state")
      .$type<"ready" | "invalid" | "created" | "failed">()
      .notNull(),
    draftRequestId: uuid("draft_request_id").notNull().unique(),
    listingId: uuid("listing_id"),
    createdAt: time("created_at"),
  },
  (t) => [
    primaryKey({ columns: [t.importId, t.rowNumber] }),
    foreignKey({
      columns: [t.sellerId, t.importId],
      foreignColumns: [catalogueImports.sellerId, catalogueImports.id],
    }),
    foreignKey({
      columns: [t.sellerId, t.listingId],
      foreignColumns: [listings.sellerId, listings.id],
    }),
    check("import_row_bounds", sql.raw("row_number BETWEEN 1 AND 1000")),
    check(
      "import_row_state",
      sql.raw(
        "state IN ('ready','invalid','created','failed') AND (state='created')=(listing_id IS NOT NULL)",
      ),
    ),
    check(
      "import_row_json",
      sql.raw(
        "jsonb_typeof(raw)='object' AND (payload IS NULL OR jsonb_typeof(payload)='object') AND (inventory IS NULL OR jsonb_typeof(inventory)='object') AND jsonb_typeof(errors)='array'",
      ),
    ),
    index("catalogue_import_pending")
      .on(t.importId, t.rowNumber)
      .where(sql.raw("selected AND state='ready'")),
  ],
);
export const catalogueExternalIds = treido.table(
  "catalogue_external_ids",
  {
    sellerId: uuid("seller_id").notNull(),
    externalId: varchar("external_id", { length: 128 }).notNull(),
    listingId: uuid("listing_id").notNull(),
    importId: uuid("import_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sellerId, t.externalId] }),
    foreignKey({
      columns: [t.sellerId, t.listingId],
      foreignColumns: [listings.sellerId, listings.id],
    }),
    foreignKey({
      columns: [t.sellerId, t.importId],
      foreignColumns: [catalogueImports.sellerId, catalogueImports.id],
    }),
  ],
);
export const catalogueImportReceipts = treido.table(
  "catalogue_import_receipts",
  {
    sellerId: uuid("seller_id").notNull(),
    importId: uuid("import_id").notNull(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    createdAt: time("created_at"),
  },
  (t) => [
    primaryKey({ columns: [t.importId, t.actorId, t.requestId] }),
    foreignKey({
      columns: [t.sellerId, t.importId],
      foreignColumns: [catalogueImports.sellerId, catalogueImports.id],
    }),
    check("import_receipt_revision", sql.raw("accepted_revision>0")),
    check("import_receipt_hash", sql.raw("input_hash ~ '^[0-9a-f]{64}$'")),
  ],
);

export const inventoryBatchReceipts = treido.table(
  "inventory_batch_receipts",
  {
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellers.id),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    result: jsonb("result").notNull(),
    createdAt: time("created_at"),
  },
  (table) => [
    primaryKey({ columns: [table.sellerId, table.actorId, table.requestId] }),
  ],
);

// T45: immutable contact review snapshots; SQL migration is authoritative for cross-table constraints.
export const purchaseReviews = treido.table(
  "purchase_reviews",
  {
    id: uuid("id").primaryKey(),
    buyerId: uuid("buyer_id").notNull(),
    sellerId: uuid("seller_id").notNull(),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    source: text("source").$type<"cart" | "offer">().notNull(),
    cartRevision: integer("cart_revision"),
    threadId: uuid("thread_id"),
    offerId: uuid("offer_id"),
    allocationId: uuid("allocation_id"),
    sellerName: varchar("seller_name", { length: 80 }).notNull(),
    currency: text("currency").notNull(),
    merchandiseMinor: bigint("merchandise_minor", { mode: "number" }).notNull(),
    language: text("language").notNull(),
    handover: text("handover").notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    createdAt: time("created_at"),
  },
  (t) => [
    unique().on(t.buyerId, t.requestId),
    unique().on(t.sellerId, t.id),
    unique("purchase_review_buyer_identity").on(t.buyerId, t.id),
  ],
);
export const purchaseReviewLines = treido.table(
  "purchase_review_lines",
  {
    reviewId: uuid("review_id").notNull(),
    sellerId: uuid("seller_id").notNull(),
    listingId: uuid("listing_id").notNull(),
    skuId: uuid("sku_id").notNull(),
    publicationRevision: integer("publication_revision").notNull(),
    position: integer("position").notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    options: jsonb("options").$type<Record<string, string>>().notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceMinor: integer("unit_price_minor").notNull(),
    deliveryDetails: varchar("delivery_details", { length: 1000 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.reviewId, t.skuId] }),
    unique().on(t.reviewId, t.position),
  ],
);
export const purchaseReviewPreferences = treido.table(
  "purchase_review_preferences",
  {
    reviewId: uuid("review_id").primaryKey(),
    revision: integer("revision").notNull().default(0),
    note: varchar("note", { length: 1000 }).notNull().default(""),
    archived: boolean("archived").notNull().default(false),
    updatedAt: time("updated_at"),
  },
);
export const purchaseReviewReceipts = treido.table(
  "purchase_review_receipts",
  {
    reviewId: uuid("review_id").notNull(),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    createdAt: time("created_at"),
  },
  (t) => [primaryKey({ columns: [t.reviewId, t.requestId] })],
);

// T46: additive contact-operation records. Reviewed SQL owns full cross-table checks.
export const purchaseReviewRenewals = treido.table(
  "purchase_review_renewals",
  {
    previousReviewId: uuid("previous_review_id").primaryKey(),
    nextReviewId: uuid("next_review_id").notNull().unique(),
    buyerId: uuid("buyer_id").notNull(),
    sellerId: uuid("seller_id").notNull(),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    createdAt: time("created_at"),
  },
  (t) => [unique().on(t.buyerId, t.requestId)],
);
export const merchantInquiryState = treido.table(
  "merchant_inquiry_state",
  {
    reviewId: uuid("review_id").primaryKey(),
    sellerId: uuid("seller_id").notNull(),
    threadId: uuid("thread_id").notNull(),
    messageId: uuid("message_id").notNull(),
    status: text("status")
      .$type<import("@/features/merchant-inquiries/model").InquiryStatus>()
      .notNull()
      .default("new"),
    revision: integer("revision").notNull().default(0),
    updatedBy: uuid("updated_by").notNull(),
    updatedAt: time("updated_at"),
  },
  (t) => [
    unique().on(t.sellerId, t.reviewId),
    index("merchant_inquiry_status").on(t.sellerId, t.status, t.reviewId),
  ],
);
export const merchantInquiryReceipts = treido.table(
  "merchant_inquiry_receipts",
  {
    reviewId: uuid("review_id").notNull(),
    sellerId: uuid("seller_id").notNull(),
    actorId: uuid("actor_id").notNull(),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    kind: text("kind").$type<"status" | "reply">().notNull(),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    replyMessageId: uuid("reply_message_id"),
    createdAt: time("created_at"),
  },
  (t) => [
    primaryKey({ columns: [t.reviewId, t.actorId, t.requestId] }),
    unique().on(t.reviewId, t.acceptedRevision),
  ],
);
export const reservationCancellationReceipts = treido.table(
  "reservation_cancellation_receipts",
  {
    actorId: uuid("actor_id").notNull(),
    requestId: uuid("request_id").notNull(),
    sellerId: uuid("seller_id").notNull(),
    operatingSellerId: uuid("operating_seller_id"),
    allocationId: uuid("allocation_id").notNull(),
    threadId: uuid("thread_id").notNull(),
    offerId: uuid("offer_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    createdAt: time("created_at"),
  },
  (t) => [
    primaryKey({ columns: [t.actorId, t.requestId] }),
    index("reservation_cancellation_resource").on(t.allocationId, t.actorId),
  ],
);

// T50: append-only exact-message actions and formal case outcomes. The reviewed
// 0025 SQL remains the physical authority; schema declarations do not seed grants.
export const messageModerationActions = treido.table(
  "message_moderation_actions",
  {
    id: uuid("id").primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id),
    resourceKind: text("resource_kind")
      .$type<"message">()
      .notNull()
      .default("message"),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    priorRevision: integer("prior_revision").notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    state: text("state").$type<"visible" | "hidden">().notNull(),
    reason: varchar("reason", { length: 2000 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    unique().on(t.messageId, t.acceptedRevision),
    unique().on(t.id, t.messageId, t.acceptedRevision),
    foreignKey({
      columns: [t.reportId, t.resourceKind, t.messageId],
      foreignColumns: [reports.id, reports.resourceKind, reports.resourceId],
    }),
    check("message_action_resource", sql.raw("resource_kind='message'")),
    check(
      "message_action_revision",
      sql.raw("prior_revision>0 AND accepted_revision=prior_revision+1"),
    ),
    check("message_action_state", sql.raw("state IN ('visible','hidden')")),
    check("message_action_reason", sql.raw("btrim(reason)<>''")),
    index("message_moderation_latest").on(
      t.messageId,
      t.acceptedRevision.desc(),
    ),
  ],
);
export const trustCaseDecisions = treido.table(
  "trust_case_decisions",
  {
    id: uuid("id").primaryKey(),
    kind: text("kind").$type<"message_report" | "appeal">().notNull(),
    caseId: uuid("case_id").notNull(),
    reportId: uuid("report_id")
      .unique()
      .references(() => reports.id),
    appealId: uuid("appeal_id")
      .unique()
      .references(() => moderationAppeals.id),
    resourceId: uuid("resource_id").notNull(),
    messageId: uuid("message_id").references(() => messages.id),
    listingId: uuid("listing_id").references(() => listings.id),
    resourceKind: text("resource_kind")
      .$type<"message" | "listing">()
      .notNull(),
    originalActionId: uuid("original_action_id").references(
      () => moderationActions.id,
    ),
    messageActionId: uuid("message_action_id").references(
      () => messageModerationActions.id,
    ),
    listingActionId: uuid("listing_action_id").references(
      () => moderationActions.id,
    ),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    priorRevision: integer("prior_revision").notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    observedResourceRevision: integer("observed_resource_revision").notNull(),
    resourceRevision: integer("resource_revision").notNull(),
    outcome: text("outcome")
      .$type<import("@/features/trust/case-model").CaseOutcome>()
      .notNull(),
    reason: varchar("reason", { length: 2000 }).notNull(),
    resultingState: text("resulting_state")
      .$type<"visible" | "hidden" | "clear" | "restricted" | "removed">()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    unique().on(t.kind, t.caseId),
    unique().on(t.actorId, t.requestId),
    foreignKey({
      columns: [t.reportId, t.resourceKind, t.resourceId],
      foreignColumns: [reports.id, reports.resourceKind, reports.resourceId],
    }),
    foreignKey({
      columns: [t.appealId, t.originalActionId],
      foreignColumns: [moderationAppeals.id, moderationAppeals.actionId],
    }),
    foreignKey({
      columns: [t.originalActionId, t.listingId],
      foreignColumns: [moderationActions.id, moderationActions.listingId],
    }),
    foreignKey({
      columns: [t.messageActionId, t.messageId, t.resourceRevision],
      foreignColumns: [
        messageModerationActions.id,
        messageModerationActions.messageId,
        messageModerationActions.acceptedRevision,
      ],
    }),
    foreignKey({
      columns: [t.listingActionId, t.listingId, t.resourceRevision],
      foreignColumns: [
        moderationActions.id,
        moderationActions.listingId,
        moderationActions.acceptedRevision,
      ],
    }),
    check("trust_case_kind", sql.raw("kind IN ('message_report','appeal')")),
    check(
      "trust_case_resource",
      sql.raw("resource_kind IN ('message','listing')"),
    ),
    check("trust_case_hash", sql.raw("length(input_hash)=64")),
    check(
      "trust_case_revision",
      sql.raw(
        "prior_revision>0 AND accepted_revision=prior_revision+1 AND observed_resource_revision>0 AND resource_revision>0",
      ),
    ),
    check("trust_case_reason", sql.raw("btrim(reason)<>''")),
    check(
      "trust_case_scope",
      sql.raw(`
      (kind='message_report' AND report_id IS NOT NULL AND report_id=case_id AND appeal_id IS NULL
        AND message_id IS NOT NULL AND message_id=resource_id AND listing_id IS NULL AND resource_kind='message'
        AND original_action_id IS NULL AND listing_action_id IS NULL
        AND outcome IN ('no_violation','violation_recorded','message_hidden') AND resulting_state IN ('visible','hidden')
        AND ((outcome='message_hidden' AND message_action_id IS NOT NULL AND resulting_state='hidden'
            AND resource_revision=observed_resource_revision+1)
          OR (outcome<>'message_hidden' AND message_action_id IS NULL AND resource_revision=observed_resource_revision)))
      OR
      (kind='appeal' AND appeal_id IS NOT NULL AND appeal_id=case_id AND report_id IS NULL
        AND listing_id IS NOT NULL AND listing_id=resource_id AND message_id IS NULL AND resource_kind='listing'
        AND original_action_id IS NOT NULL AND message_action_id IS NULL AND prior_revision=1
        AND outcome IN ('upheld','revised','dismissed') AND resulting_state IN ('clear','restricted','removed')
        AND ((outcome='revised' AND listing_action_id IS NOT NULL AND resource_revision=observed_resource_revision+1)
          OR (outcome<>'revised' AND listing_action_id IS NULL AND resource_revision=observed_resource_revision)))
    `),
    ),
    index("trust_case_decisions_time").on(t.createdAt.desc(), t.id.desc()),
    index("trust_case_decisions_actor").on(t.actorId, t.createdAt.desc()),
  ],
);

// T52: human-owned ordered comparisons retain observations independently of current facts.
export const buyerComparisonWorkspaces = treido.table(
  "buyer_comparison_workspaces",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id),
    revision: integer("revision").notNull().default(0),
  },
  () => [
    check(
      "buyer_comparison_workspaces_revision_check",
      sql.raw("revision >= 0"),
    ),
  ],
);
export const buyerComparisonSelections = treido.table(
  "buyer_comparison_selections",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => buyerComparisonWorkspaces.userId),
    id: uuid("id").notNull(),
    position: smallint("position").notNull(),
    sellerId: uuid("seller_id").notNull(),
    listingId: uuid("listing_id").notNull(),
    publicationRevision: integer("publication_revision").notNull(),
    skuId: uuid("sku_id"),
    priceMinor: integer("price_minor").notNull(),
    currency: text("currency").$type<"EUR">().notNull().default("EUR"),
    stockState: text("stock_state")
      .$type<"unknown" | "available" | "reserved" | "out_of_stock">()
      .notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("statement_timestamp()")),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    unique("buyer_comparison_selections_user_id_listing_id_key").on(
      t.userId,
      t.listingId,
    ),
    // Migration 0026 makes this unique constraint DEFERRABLE INITIALLY DEFERRED.
    unique("buyer_comparison_position").on(t.userId, t.position),
    foreignKey({
      columns: [t.sellerId, t.listingId, t.publicationRevision],
      foreignColumns: [
        listingPublications.sellerId,
        listingPublications.listingId,
        listingPublications.revision,
      ],
    }),
    foreignKey({
      columns: [t.sellerId, t.listingId, t.publicationRevision, t.skuId],
      foreignColumns: [
        inventoryPublicationSkus.sellerId,
        inventoryPublicationSkus.listingId,
        inventoryPublicationSkus.publicationRevision,
        inventoryPublicationSkus.skuId,
      ],
    }),
    check(
      "buyer_comparison_selections_position_check",
      sql.raw("position BETWEEN 1 AND 4"),
    ),
    check(
      "buyer_comparison_selections_price_minor_check",
      sql.raw("price_minor BETWEEN 0 AND 1000000000"),
    ),
    check(
      "buyer_comparison_selections_currency_check",
      sql.raw("currency = 'EUR'"),
    ),
    check(
      "buyer_comparison_selections_stock_state_check",
      sql.raw(
        "stock_state IN ('unknown','available','reserved','out_of_stock')",
      ),
    ),
  ],
);
export const buyerComparisonReceipts = treido.table(
  "buyer_comparison_receipts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => buyerComparisonWorkspaces.userId),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    operation: text("operation")
      .$type<"add" | "remove" | "reorder" | "clear" | "refresh">()
      .notNull(),
    selectionId: uuid("selection_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.requestId] }),
    check(
      "buyer_comparison_receipts_input_hash_check",
      sql.raw("input_hash ~ '^[0-9a-f]{64}$'"),
    ),
    check(
      "buyer_comparison_receipts_accepted_revision_check",
      sql.raw("accepted_revision > 0"),
    ),
    check(
      "buyer_comparison_receipts_operation_check",
      sql.raw("operation IN ('add','remove','reorder','clear','refresh')"),
    ),
    index("buyer_comparison_receipt_rate").on(t.userId, t.createdAt.desc()),
  ],
);

// T53: buyer-owned consent, bounded matching and durable in-app observations.
export const buyerSavedSearchWorkspaces = treido.table(
  "buyer_saved_search_workspaces",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id),
    revision: integer("revision").notNull().default(0),
  },
  () => [
    check(
      "buyer_saved_search_workspaces_revision_check",
      sql.raw("revision >= 0"),
    ),
  ],
);
export const buyerSavedSearches = treido.table(
  "buyer_saved_searches",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 80 }),
    status: text("status").$type<"paused" | "enabled" | "removed">().notNull(),
    criteriaVersion: integer("criteria_version").notNull(),
    consentGeneration: integer("consent_generation").notNull().default(1),
    frequencyMinutes: integer("frequency_minutes").$type<60 | 1440>().notNull(),
    consentAt: timestamp("consent_at", { withTimezone: true, mode: "date" }),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    lastCheckAt: timestamp("last_check_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (t) => [
    unique("buyer_saved_searches_user_id_id_key").on(t.userId, t.id),
    check(
      "buyer_saved_searches_status_check",
      sql.raw("status IN ('paused','enabled','removed')"),
    ),
    check(
      "buyer_saved_searches_criteria_version_check",
      sql.raw("criteria_version > 0"),
    ),
    check(
      "buyer_saved_searches_consent_generation_check",
      sql.raw("consent_generation > 0"),
    ),
    check(
      "buyer_saved_searches_frequency_minutes_check",
      sql.raw("frequency_minutes IN (60,1440)"),
    ),
    check(
      "buyer_saved_searches_check",
      sql.raw("(status='enabled')=(consent_at IS NOT NULL)"),
    ),
    check(
      "buyer_saved_searches_check1",
      sql.raw(
        "(status='removed' AND name IS NULL) OR (status<>'removed' AND name IS NOT NULL AND length(btrim(name)) BETWEEN 1 AND 80)",
      ),
    ),
    check(
      "buyer_saved_searches_check2",
      sql.raw("status='enabled' OR due_at IS NULL"),
    ),
    index("buyer_search_due")
      .on(t.dueAt, t.id)
      .where(sql.raw("status='enabled'")),
  ],
);
export const buyerSavedSearchVersions = treido.table(
  "buyer_saved_search_versions",
  {
    userId: uuid("user_id").notNull(),
    searchId: uuid("search_id").notNull(),
    version: integer("version").notNull(),
    criteria: jsonb("criteria").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.searchId, t.version] }),
    foreignKey({
      columns: [t.userId, t.searchId],
      foreignColumns: [buyerSavedSearches.userId, buyerSavedSearches.id],
    }),
    check("buyer_saved_search_versions_version_check", sql.raw("version > 0")),
    check(
      "buyer_saved_search_versions_criteria_check",
      sql.raw(
        "jsonb_typeof(criteria)='object' AND octet_length(criteria::text)<=8000",
      ),
    ),
  ],
);
export const buyerSavedSearchReceipts = treido.table(
  "buyer_saved_search_receipts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    searchId: uuid("search_id"),
    criteriaVersion: integer("criteria_version"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.requestId] }),
    foreignKey({
      columns: [t.userId, t.searchId],
      foreignColumns: [buyerSavedSearches.userId, buyerSavedSearches.id],
    }),
    check(
      "buyer_saved_search_receipts_input_hash_check",
      sql.raw("input_hash ~ '^[a-f0-9]{64}$'"),
    ),
    check(
      "buyer_saved_search_receipts_accepted_revision_check",
      sql.raw("accepted_revision > 0"),
    ),
    index("buyer_search_receipt_rate").on(t.userId, t.createdAt),
  ],
);
export const buyerSavedSearchRuns = treido.table(
  "buyer_saved_search_runs",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    searchId: uuid("search_id").notNull(),
    criteriaVersion: integer("criteria_version").notNull(),
    consentGeneration: integer("consent_generation").notNull(),
    state: text("state")
      .$type<"running" | "bounded" | "finished" | "cancelled">()
      .notNull()
      .default("running"),
    phase: text("phase")
      .$type<"catalogue" | "observed">()
      .notNull()
      .default("catalogue"),
    position: jsonb("position"),
    afterListingId: uuid("after_listing_id"),
    step: integer("step").notNull().default(0),
    cataloguePages: integer("catalogue_pages").notNull().default(0),
    checked: integer("checked").notNull().default(0),
    observed: integer("observed").notNull().default(0),
    ceiling: timestamp("ceiling", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (t) => [
    unique("buyer_saved_search_runs_user_id_id_key").on(t.userId, t.id),
    foreignKey({
      columns: [t.userId, t.searchId],
      foreignColumns: [buyerSavedSearches.userId, buyerSavedSearches.id],
    }),
    check(
      "buyer_saved_search_runs_criteria_version_check",
      sql.raw("criteria_version > 0"),
    ),
    check(
      "buyer_saved_search_runs_consent_generation_check",
      sql.raw("consent_generation > 0"),
    ),
    check(
      "buyer_saved_search_runs_state_check",
      sql.raw("state IN ('running','bounded','finished','cancelled')"),
    ),
    check(
      "buyer_saved_search_runs_phase_check",
      sql.raw("phase IN ('catalogue','observed')"),
    ),
    check(
      "buyer_saved_search_runs_step_check",
      sql.raw("step >= 0 AND step <= 100"),
    ),
    check(
      "buyer_saved_search_runs_catalogue_pages_check",
      sql.raw("catalogue_pages BETWEEN 0 AND 10"),
    ),
    check("buyer_saved_search_runs_checked_check", sql.raw("checked >= 0")),
    check("buyer_saved_search_runs_observed_check", sql.raw("observed >= 0")),
    check(
      "buyer_saved_search_runs_position_check",
      sql.raw(
        "position IS NULL OR (jsonb_typeof(position)='object' AND octet_length(position::text)<=1000)",
      ),
    ),
    uniqueIndex("buyer_search_one_run")
      .on(t.searchId)
      .where(sql.raw("state='running'")),
  ],
);
export const buyerSearchObservations = treido.table(
  "buyer_search_observations",
  {
    userId: uuid("user_id").notNull(),
    searchId: uuid("search_id").notNull(),
    criteriaVersion: integer("criteria_version").notNull(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id),
    publicationRevision: integer("publication_revision").notNull(),
    skuId: uuid("sku_id"),
    priceMinor: integer("price_minor").notNull(),
    stockState: text("stock_state")
      .$type<"unknown" | "available" | "reserved" | "out_of_stock">()
      .notNull(),
    eligible: boolean("eligible").notNull().default(true),
    changeNumber: integer("change_number").notNull().default(1),
    observedAt: timestamp("observed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (t) => [
    primaryKey({
      columns: [t.userId, t.searchId, t.criteriaVersion, t.listingId],
    }),
    foreignKey({
      columns: [t.userId, t.searchId],
      foreignColumns: [buyerSavedSearches.userId, buyerSavedSearches.id],
    }),
    check(
      "buyer_search_observations_criteria_version_check",
      sql.raw("criteria_version > 0"),
    ),
    check(
      "buyer_search_observations_publication_revision_check",
      sql.raw("publication_revision > 0"),
    ),
    check(
      "buyer_search_observations_price_minor_check",
      sql.raw("price_minor BETWEEN 0 AND 1000000000"),
    ),
    check(
      "buyer_search_observations_stock_state_check",
      sql.raw(
        "stock_state IN ('unknown','available','reserved','out_of_stock')",
      ),
    ),
    check(
      "buyer_search_observations_change_number_check",
      sql.raw("change_number > 0"),
    ),
  ],
);
export const buyerSearchNotifications = treido.table(
  "buyer_search_notifications",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    searchId: uuid("search_id").notNull(),
    criteriaVersion: integer("criteria_version").notNull(),
    consentGeneration: integer("consent_generation").notNull(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id),
    changeNumber: integer("change_number").notNull(),
    kind: text("kind")
      .$type<
        "new_publication" | "price_changed" | "stock_changed" | "unavailable"
      >()
      .notNull(),
    previousFact: jsonb("previous_fact"),
    observedFact: jsonb("observed_fact"),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (t) => [
    unique("buyer_search_notification_change").on(
      t.userId,
      t.searchId,
      t.criteriaVersion,
      t.listingId,
      t.changeNumber,
      t.kind,
    ),
    foreignKey({
      columns: [t.userId, t.searchId],
      foreignColumns: [buyerSavedSearches.userId, buyerSavedSearches.id],
    }),
    check(
      "buyer_search_notifications_criteria_version_check",
      sql.raw("criteria_version > 0"),
    ),
    check(
      "buyer_search_notifications_consent_generation_check",
      sql.raw("consent_generation > 0"),
    ),
    check(
      "buyer_search_notifications_change_number_check",
      sql.raw("change_number > 0"),
    ),
    check(
      "buyer_search_notifications_kind_check",
      sql.raw(
        "kind IN ('new_publication','price_changed','stock_changed','unavailable')",
      ),
    ),
    check(
      "buyer_search_notifications_previous_fact_check",
      sql.raw(
        "previous_fact IS NULL OR (jsonb_typeof(previous_fact)='object' AND octet_length(previous_fact::text)<=1000)",
      ),
    ),
    check(
      "buyer_search_notifications_observed_fact_check",
      sql.raw(
        "observed_fact IS NULL OR (jsonb_typeof(observed_fact)='object' AND octet_length(observed_fact::text)<=1000)",
      ),
    ),
    index("buyer_search_feed").on(t.userId, t.createdAt.desc(), t.id),
    index("buyer_search_unread").on(t.userId).where(sql.raw("read_at IS NULL")),
  ],
);

// T54: bounded buyer compatibility evidence and explicit seller draft-helper intents.
export const buyerCompatibilityWorkspaces = treido.table(
  "buyer_compatibility_workspaces",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id),
    revision: integer("revision").notNull().default(0),
    requirements: jsonb("requirements"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  () => [
    check(
      "buyer_compatibility_workspaces_revision_check",
      sql.raw("revision BETWEEN 0 AND 2147483646"),
    ),
    check(
      "buyer_compatibility_workspaces_requirements_check",
      sql.raw(
        "requirements IS NULL OR (jsonb_typeof(requirements)='object' AND octet_length(requirements::text)<=16000)",
      ),
    ),
  ],
);
export const buyerCompatibilityObservations = treido.table(
  "buyer_compatibility_observations",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => buyerCompatibilityWorkspaces.userId),
    position: smallint("position").notNull(),
    sellerId: uuid("seller_id").notNull(),
    listingId: uuid("listing_id").notNull(),
    publicationRevision: integer("publication_revision").notNull(),
    skuId: uuid("sku_id"),
    snapshot: jsonb("snapshot").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.position] }),
    unique("buyer_compatibility_observations_user_id_listing_id_key").on(
      t.userId,
      t.listingId,
    ),
    foreignKey({
      columns: [t.sellerId, t.listingId, t.publicationRevision],
      foreignColumns: [
        listingPublications.sellerId,
        listingPublications.listingId,
        listingPublications.revision,
      ],
    }),
    foreignKey({
      columns: [t.sellerId, t.listingId, t.publicationRevision, t.skuId],
      foreignColumns: [
        inventoryPublicationSkus.sellerId,
        inventoryPublicationSkus.listingId,
        inventoryPublicationSkus.publicationRevision,
        inventoryPublicationSkus.skuId,
      ],
    }),
    check(
      "buyer_compatibility_observations_position_check",
      sql.raw("position BETWEEN 1 AND 4"),
    ),
    check(
      "buyer_compatibility_observations_snapshot_check",
      sql.raw(
        "jsonb_typeof(snapshot)='object' AND octet_length(snapshot::text)<=16000",
      ),
    ),
  ],
);
export const buyerCompatibilityReceipts = treido.table(
  "buyer_compatibility_receipts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => buyerCompatibilityWorkspaces.userId),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    operation: text("operation")
      .$type<"check" | "refresh" | "clear">()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.requestId] }),
    check(
      "buyer_compatibility_receipts_input_hash_check",
      sql.raw("input_hash ~ '^[0-9a-f]{64}$'"),
    ),
    check(
      "buyer_compatibility_receipts_accepted_revision_check",
      sql.raw("accepted_revision>0"),
    ),
    check(
      "buyer_compatibility_receipts_operation_check",
      sql.raw("operation IN ('check','refresh','clear')"),
    ),
    index("buyer_compatibility_receipt_rate").on(t.userId, t.createdAt.desc()),
  ],
);
export const sellerHelperWorkspaces = treido.table(
  "seller_helper_workspaces",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellers.id),
    revision: integer("revision").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.sellerId] }),
    check(
      "seller_helper_workspaces_revision_check",
      sql.raw("revision BETWEEN 0 AND 2147483646"),
    ),
  ],
);
export const sellerHelperProposals = treido.table(
  "seller_helper_proposals",
  {
    userId: uuid("user_id").notNull(),
    sellerId: uuid("seller_id").notNull(),
    id: uuid("id").notNull(),
    slot: smallint("slot").notNull(),
    listingId: uuid("listing_id").notNull(),
    draftRevision: integer("draft_revision").notNull(),
    baseHash: varchar("base_hash", { length: 64 }).notNull(),
    proposalHash: varchar("proposal_hash", { length: 64 }).notNull(),
    originalEdit: jsonb("original_edit").notNull(),
    proposedPayload: jsonb("proposed_payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.sellerId, t.id] }),
    unique("seller_helper_proposals_user_id_seller_id_slot_key").on(
      t.userId,
      t.sellerId,
      t.slot,
    ),
    unique("seller_helper_proposals_user_id_seller_id_listing_id_key").on(
      t.userId,
      t.sellerId,
      t.listingId,
    ),
    foreignKey({
      columns: [t.userId, t.sellerId],
      foreignColumns: [
        sellerHelperWorkspaces.userId,
        sellerHelperWorkspaces.sellerId,
      ],
    }),
    foreignKey({
      columns: [t.sellerId, t.listingId],
      foreignColumns: [listings.sellerId, listings.id],
    }),
    check(
      "seller_helper_proposals_slot_check",
      sql.raw("slot BETWEEN 1 AND 5"),
    ),
    check(
      "seller_helper_proposals_draft_revision_check",
      sql.raw("draft_revision>0"),
    ),
    check(
      "seller_helper_proposals_base_hash_check",
      sql.raw("base_hash ~ '^[0-9a-f]{64}$'"),
    ),
    check(
      "seller_helper_proposals_proposal_hash_check",
      sql.raw("proposal_hash ~ '^[0-9a-f]{64}$'"),
    ),
    check(
      "seller_helper_proposals_original_edit_check",
      sql.raw(
        "jsonb_typeof(original_edit)='object' AND octet_length(original_edit::text)<=48000",
      ),
    ),
    check(
      "seller_helper_proposals_proposed_payload_check",
      sql.raw(
        "jsonb_typeof(proposed_payload)='object' AND octet_length(proposed_payload::text)<=48000",
      ),
    ),
  ],
);
export const sellerHelperAcceptanceIntents = treido.table(
  "seller_helper_acceptance_intents",
  {
    userId: uuid("user_id").notNull(),
    sellerId: uuid("seller_id").notNull(),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    proposalId: uuid("proposal_id").notNull(),
    listingId: uuid("listing_id").notNull(),
    draftRevision: integer("draft_revision").notNull(),
    payload: jsonb("payload").notNull(),
    originalCommand: jsonb("original_command").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.sellerId, t.requestId] }),
    unique("seller_helper_acceptance_intents_user_id_seller_id_key").on(
      t.userId,
      t.sellerId,
    ),
    foreignKey({
      columns: [t.userId, t.sellerId],
      foreignColumns: [
        sellerHelperWorkspaces.userId,
        sellerHelperWorkspaces.sellerId,
      ],
    }),
    foreignKey({
      columns: [t.sellerId, t.listingId],
      foreignColumns: [listings.sellerId, listings.id],
    }),
    check(
      "seller_helper_acceptance_intents_input_hash_check",
      sql.raw("input_hash ~ '^[0-9a-f]{64}$'"),
    ),
    check(
      "seller_helper_acceptance_intents_accepted_revision_check",
      sql.raw("accepted_revision>0"),
    ),
    check(
      "seller_helper_acceptance_intents_draft_revision_check",
      sql.raw("draft_revision>0"),
    ),
    check(
      "seller_helper_acceptance_intents_payload_check",
      sql.raw(
        "jsonb_typeof(payload)='object' AND octet_length(payload::text)<=48000",
      ),
    ),
    check(
      "seller_helper_acceptance_intents_original_command_check",
      sql.raw(
        "jsonb_typeof(original_command)='object' AND octet_length(original_command::text)<=4096",
      ),
    ),
  ],
);
export const sellerHelperReceipts = treido.table(
  "seller_helper_receipts",
  {
    userId: uuid("user_id").notNull(),
    sellerId: uuid("seller_id").notNull(),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    operation: text("operation")
      .$type<"prepare" | "accept" | "discard">()
      .notNull(),
    result: jsonb("result").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.sellerId, t.requestId] }),
    foreignKey({
      columns: [t.userId, t.sellerId],
      foreignColumns: [
        sellerHelperWorkspaces.userId,
        sellerHelperWorkspaces.sellerId,
      ],
    }),
    check(
      "seller_helper_receipts_input_hash_check",
      sql.raw("input_hash ~ '^[0-9a-f]{64}$'"),
    ),
    check(
      "seller_helper_receipts_accepted_revision_check",
      sql.raw("accepted_revision>0"),
    ),
    check(
      "seller_helper_receipts_operation_check",
      sql.raw("operation IN ('prepare','accept','discard')"),
    ),
    check(
      "seller_helper_receipts_result_check",
      sql.raw(
        "jsonb_typeof(result)='object' AND octet_length(result::text)<=4096",
      ),
    ),
    index("seller_helper_receipt_rate").on(t.userId, t.createdAt.desc()),
  ],
);

// T55: human-owned bounded private exports and non-destructive closure requests.
export const accountPrivacyWorkspaces = treido.table(
  "account_privacy_workspaces",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id),
    revision: integer("revision").notNull().default(0),
  },
  () => [
    check(
      "account_privacy_workspaces_revision_check",
      sql.raw("revision >= 0"),
    ),
  ],
);
export const accountPrivacyExports = treido.table(
  "account_privacy_exports",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => accountPrivacyWorkspaces.userId),
    id: uuid("id").notNull(),
    categories: jsonb("categories").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    check(
      "account_privacy_exports_categories_check",
      sql.raw(
        'jsonb_typeof(categories)=\'array\' AND jsonb_array_length(categories) BETWEEN 1 AND 7 AND categories <@ \'["account","personalProfile","memberships","library","cart","searches","purchases"]\'::jsonb',
      ),
    ),
    check(
      "account_privacy_exports_snapshot_check",
      sql.raw(
        "(jsonb_typeof(snapshot)='object' AND snapshot->>'format'='treido-personal-data-v1' AND snapshot->>'accountId'=user_id::text AND jsonb_typeof(snapshot->'sections')='array' AND jsonb_array_length(snapshot->'sections') BETWEEN 1 AND 7 AND octet_length(snapshot::text)<=262144) IS TRUE",
      ),
    ),
    check(
      "account_privacy_exports_check",
      sql.raw(
        "expires_at>created_at AND expires_at<=created_at+interval '16 minutes'",
      ),
    ),
    index("account_privacy_export_page").on(t.userId, t.createdAt.desc(), t.id),
  ],
);
export const accountPrivacyReviews = treido.table(
  "account_privacy_reviews",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => accountPrivacyWorkspaces.userId),
    id: uuid("id").notNull(),
    facts: jsonb("facts").notNull(),
    factsHash: varchar("facts_hash", { length: 64 }).notNull(),
    policyVersion: text("policy_version").$type<"request-only-v1">().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    check(
      "account_privacy_reviews_facts_check",
      sql.raw(
        "jsonb_typeof(facts)='object' AND octet_length(facts::text)<=4096",
      ),
    ),
    check(
      "account_privacy_reviews_facts_hash_check",
      sql.raw("facts_hash ~ '^[0-9a-f]{64}$'"),
    ),
    check(
      "account_privacy_reviews_policy_version_check",
      sql.raw("policy_version='request-only-v1'"),
    ),
    check(
      "account_privacy_reviews_check",
      sql.raw(
        "expires_at>created_at AND expires_at<=created_at+interval '16 minutes'",
      ),
    ),
    index("account_privacy_review_page").on(t.userId, t.createdAt.desc(), t.id),
  ],
);
export const accountClosureRequests = treido.table(
  "account_closure_requests",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => accountPrivacyWorkspaces.userId),
    id: uuid("id").notNull(),
    reviewId: uuid("review_id").notNull(),
    state: text("state").$type<"requested" | "withdrawn">().notNull(),
    revision: integer("revision").notNull().default(1),
    acknowledgedAt: timestamp("acknowledged_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    foreignKey({
      columns: [t.userId, t.reviewId],
      foreignColumns: [accountPrivacyReviews.userId, accountPrivacyReviews.id],
    }),
    unique("account_closure_requests_user_id_review_id_key").on(
      t.userId,
      t.reviewId,
    ),
    check(
      "account_closure_requests_state_check",
      sql.raw("state IN ('requested','withdrawn')"),
    ),
    check("account_closure_requests_revision_check", sql.raw("revision > 0")),
    uniqueIndex("account_closure_one_pending")
      .on(t.userId)
      .where(sql.raw("state='requested'")),
  ],
);
export const accountPrivacyReceipts = treido.table(
  "account_privacy_receipts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => accountPrivacyWorkspaces.userId),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    acknowledgment: jsonb("acknowledgment").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.requestId] }),
    unique("account_privacy_receipts_user_id_accepted_revision_key").on(
      t.userId,
      t.acceptedRevision,
    ),
    check(
      "account_privacy_receipts_input_hash_check",
      sql.raw("input_hash ~ '^[0-9a-f]{64}$'"),
    ),
    check(
      "account_privacy_receipts_accepted_revision_check",
      sql.raw("accepted_revision > 0"),
    ),
    check(
      "account_privacy_receipts_acknowledgment_check",
      sql.raw(
        "jsonb_typeof(acknowledgment)='object' AND octet_length(acknowledgment::text)<=2048",
      ),
    ),
    index("account_privacy_receipt_rate").on(t.userId, t.createdAt.desc()),
  ],
);

// Additive Gift Finder and seller billing projections; canonical SQL owns checks/locks/immutable grants.
export const buyerGiftWorkspaces = treido.table("buyer_gift_workspaces", {
  userId: uuid("user_id").notNull().primaryKey(),
  revision: integer("revision").notNull(),
  brief: jsonb("brief"),
  selectedIds: uuid("selected_ids").array().notNull(),
  nextCursor: text("next_cursor"),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});
export const buyerGiftObservations = treido.table("buyer_gift_observations", {
  userId: uuid("user_id").notNull(),
  position: smallint("position").notNull(),
  sellerId: uuid("seller_id").notNull(),
  listingId: uuid("listing_id").notNull(),
  publicationRevision: integer("publication_revision").notNull(),
  skuId: uuid("sku_id"),
  snapshot: jsonb("snapshot").notNull(),
  observedAt: timestamp("observed_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});
export const buyerGiftReceipts = treido.table("buyer_gift_receipts", {
  userId: uuid("user_id").notNull(),
  requestId: uuid("request_id").notNull(),
  inputHash: text("input_hash").notNull(),
  acceptedRevision: integer("accepted_revision").notNull(),
  operation: text("operation").notNull(),
  resultCount: smallint("result_count").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});
export const billingCatalogue = treido.table("billing_catalogue", {
  terms: jsonb("terms").notNull(),
  id: uuid("id").notNull().primaryKey(),
  planId: text("plan_id").notNull(),
  version: integer("version").notNull(),
  sellerKind: text("seller_kind").notNull(),
  platformAccount: text("platform_account").notNull(),
  livemode: boolean("livemode").notNull(),
  environment: text("environment").notNull(),
  applicationId: text("application_id").notNull(),
  purpose: text("purpose").notNull(),
  productId: text("product_id").notNull(),
  priceId: text("price_id").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull(),
  limits: jsonb("limits").notNull(),
  termsVersion: text("terms_version").notNull(),
  taxPolicy: text("tax_policy").notNull(),
  portalConfiguration: text("portal_configuration").notNull(),
  changeConfiguration: text("change_configuration").notNull(),
  approvedAt: timestamp("approved_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
});
export const billingCustomers = treido.table("billing_customers", {
  id: uuid("id").notNull().primaryKey(),
  sellerId: uuid("seller_id").notNull(),
  platformAccount: text("platform_account").notNull(),
  livemode: boolean("livemode").notNull(),
  environment: text("environment").notNull(),
  applicationId: text("application_id").notNull(),
  purpose: text("purpose").notNull(),
  providerId: text("provider_id").notNull(),
  approvedAt: timestamp("approved_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
});
export const billingIntents = treido.table("billing_intents", {
  id: uuid("id").notNull().primaryKey(),
  sellerId: uuid("seller_id").notNull(),
  actorId: uuid("actor_id").notNull(),
  requestId: uuid("request_id").notNull(),
  inputHash: text("input_hash").notNull(),
  operation: text("operation").notNull(),
  catalogueId: uuid("catalogue_id").notNull(),
  customerBindingId: uuid("customer_binding_id").notNull(),
  subscriptionId: text("subscription_id"),
  previewId: uuid("preview_id"),
  expectedPriceId: text("expected_price_id").notNull(),
  parameters: jsonb("parameters").notNull(),
  parameterHash: text("parameter_hash").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  apiVersion: text("api_version").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  state: text("state").notNull(),
  providerId: text("provider_id"),
  hostedUrl: text("hosted_url"),
  result: jsonb("result"),
  firstAttemptAt: timestamp("first_attempt_at", {
    withTimezone: true,
    mode: "date",
  }),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});
export const billingSubscriptions = treido.table("billing_subscriptions", {
  id: uuid("id").notNull().primaryKey(),
  sellerId: uuid("seller_id").notNull(),
  customerBindingId: uuid("customer_binding_id").notNull(),
  providerId: text("provider_id").notNull(),
  originIntentId: uuid("origin_intent_id").notNull(),
  catalogueId: uuid("catalogue_id").notNull(),
  itemId: text("item_id").notNull(),
  state: text("state").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true, mode: "date" }),
  generation: integer("generation").notNull(),
  observedAt: timestamp("observed_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  retiredAt: timestamp("retired_at", { withTimezone: true, mode: "date" }),
});
export const billingInvoiceObservations = treido.table(
  "billing_invoice_observations",
  {
    id: uuid("id").notNull().primaryKey(),
    subscriptionId: uuid("subscription_id"),
    providerId: text("provider_id"),
    factHash: text("fact_hash").notNull(),
    status: text("status").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    hostedUrl: text("hosted_url"),
    paid: boolean("paid").notNull(),
    observedAt: timestamp("observed_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
);
export const billingPaidIntervals = treido.table("billing_paid_intervals", {
  id: uuid("id").notNull().primaryKey(),
  subscriptionId: uuid("subscription_id"),
  catalogueId: uuid("catalogue_id").notNull(),
  invoiceId: text("invoice_id").notNull(),
  lineId: text("line_id").notNull(),
  startsAt: timestamp("starts_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }).notNull(),
  evidenceHash: text("evidence_hash").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});
export const billingRevocations = treido.table("billing_revocations", {
  subscriptionId: uuid("subscription_id"),
  invoiceId: text("invoice_id").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});
export const billingSync = treido.table("billing_sync", {
  customerBindingId: uuid("customer_binding_id").notNull().primaryKey(),
  sellerId: uuid("seller_id").notNull(),
  generation: integer("generation").notNull(),
});

export const billingPaymentLinks = treido.table("billing_payment_links", {
  subscriptionId: uuid("subscription_id").notNull(),
  invoiceId: text("invoice_id").notNull(),
  chargeId: text("charge_id").notNull(),
  paymentIntentId: text("payment_intent_id"),
});

// Purpose-specific promotion provider bindings and original Checkout execution receipt.
export const promotionPaymentBindings = treido.table(
  "promotion_payment_bindings",
  {
    id: uuid("id").notNull().primaryKey(),
    productPolicyId: uuid("product_policy_id").notNull(),
    platformAccount: text("platform_account").notNull(),
    livemode: boolean("livemode").notNull(),
    environment: text("environment").notNull(),
    applicationId: text("application_id").notNull(),
    purpose: text("purpose").notNull(),
    productId: text("product_id").notNull(),
    priceId: text("price_id").notNull(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
);
export const promotionCustomerBindings = treido.table(
  "promotion_customer_bindings",
  {
    id: uuid("id").notNull().primaryKey(),
    sellerId: uuid("seller_id").notNull(),
    platformAccount: text("platform_account").notNull(),
    livemode: boolean("livemode").notNull(),
    environment: text("environment").notNull(),
    applicationId: text("application_id").notNull(),
    purpose: text("purpose").notNull(),
    providerId: text("provider_id").notNull(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
);
export const promotionCheckoutIntents = treido.table(
  "promotion_checkout_intents",
  {
    attemptId: uuid("attempt_id").notNull().primaryKey(),
    paymentBindingId: uuid("payment_binding_id").notNull(),
    customerBindingId: uuid("customer_binding_id").notNull(),
    parameters: jsonb("parameters").notNull(),
    parameterHash: varchar("parameter_hash", { length: 64 }).notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    apiVersion: text("api_version").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    firstAttemptAt: timestamp("first_attempt_at", {
      withTimezone: true,
      mode: "date",
    }),
    checkoutSessionId: text("checkout_session_id"),
  },
);

// Additive promotion projections; reviewed canonical SQL owns authority constraints, locks and immutable grants.
export const promotionProducts = treido.table("promotion_products", {
  id: uuid("id").notNull().primaryKey(),
  productId: text("product_id").notNull(),
  version: integer("version").notNull(),
  terms: jsonb("terms").notNull(),
  platformAccount: text("platform_account").notNull(),
  environment: text("environment").notNull(),
  applicationId: text("application_id").notNull(),
  livemode: boolean("livemode").notNull(),
  approvedAt: timestamp("approved_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
});
export const promotionCapacity = treido.table("promotion_capacity", {
  id: uuid("id").notNull().primaryKey(),
  productPolicyId: uuid("product_policy_id").notNull(),
  country: text("country").notNull(),
  categoryId: text("category_id").notNull(),
  sellerKind: text("seller_kind").notNull(),
  slots: integer("slots").notNull(),
  waitlistLimit: integer("waitlist_limit").notNull(),
  approvedAt: timestamp("approved_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
});
export const promotionCampaigns = treido.table("promotion_campaigns", {
  id: uuid("id").notNull().primaryKey(),
  sellerId: uuid("seller_id").notNull(),
  listingId: uuid("listing_id").notNull(),
  productId: text("product_id").notNull(),
  revision: integer("revision").notNull(),
  state: text("state").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql.raw("clock_timestamp()")),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql.raw("clock_timestamp()")),
});
export const promotionReviews = treido.table("promotion_reviews", {
  id: uuid("id").notNull().primaryKey(),
  sellerId: uuid("seller_id").notNull(),
  campaignId: uuid("campaign_id").notNull(),
  campaignRevision: integer("campaign_revision").notNull(),
  listingRevision: integer("listing_revision").notNull(),
  categoryId: text("category_id").notNull(),
  country: text("country").notNull(),
  productPolicyId: uuid("product_policy_id"),
  capacityId: uuid("capacity_id"),
  terms: jsonb("terms"),
  termsHash: varchar("terms_hash", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql.raw("clock_timestamp()")),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});
export const promotionAttempts = treido.table("promotion_attempts", {
  id: uuid("id").notNull().primaryKey(),
  sellerId: uuid("seller_id").notNull(),
  campaignId: uuid("campaign_id").notNull(),
  reviewId: uuid("review_id").notNull(),
  intent: jsonb("intent").notNull(),
  state: text("state").notNull(),
  providerId: text("provider_id"),
  checkoutSessionId: text("checkout_session_id"),
  checkoutUrl: text("checkout_url"),
  platformAccount: text("platform_account").notNull(),
  livemode: boolean("livemode").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql.raw("clock_timestamp()")),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql.raw("clock_timestamp()")),
});
export const promotionPurchases = treido.table("promotion_purchases", {
  campaignId: uuid("campaign_id").notNull().primaryKey(),
  sellerId: uuid("seller_id").notNull(),
  attemptId: uuid("attempt_id").notNull(),
  reviewId: uuid("review_id").notNull(),
  terms: jsonb("terms").notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql.raw("clock_timestamp()")),
});
export const promotionIntervals = treido.table("promotion_intervals", {
  campaignId: uuid("campaign_id").notNull().primaryKey(),
  startsAt: timestamp("starts_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }).notNull(),
});
export const promotionBumpSignals = treido.table("promotion_bump_signals", {
  campaignId: uuid("campaign_id").notNull().primaryKey(),
  sellerId: uuid("seller_id").notNull(),
  listingId: uuid("listing_id").notNull(),
  publicationRevision: integer("publication_revision").notNull(),
  promotedAt: timestamp("promoted_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql.raw("clock_timestamp()")),
});
export const promotionReservations = treido.table("promotion_reservations", {
  campaignId: uuid("campaign_id").notNull().primaryKey(),
  capacityId: uuid("capacity_id").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql.raw("clock_timestamp()")),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});
export const promotionEvents = treido.table("promotion_events", {
  id: uuid("id").notNull().primaryKey(),
  campaignId: uuid("campaign_id").notNull(),
  actorId: uuid("actor_id"),
  source: text("source").notNull(),
  action: text("action").notNull(),
  reason: text("reason").notNull(),
  state: text("state").notNull(),
  revision: integer("revision").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql.raw("clock_timestamp()")),
});
export const promotionReceipts = treido.table("promotion_receipts", {
  actorId: uuid("actor_id").notNull(),
  sellerId: uuid("seller_id").notNull(),
  requestId: uuid("request_id").notNull(),
  inputHash: varchar("input_hash", { length: 64 }).notNull(),
  acknowledgment: jsonb("acknowledgment").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql.raw("clock_timestamp()")),
});
export const promotionProviderEvents = treido.table(
  "promotion_provider_events",
  {
    platformAccount: text("platform_account").notNull(),
    livemode: boolean("livemode").notNull(),
    eventId: text("event_id").notNull(),
    attemptId: uuid("attempt_id").notNull(),
    evidenceHash: varchar("evidence_hash", { length: 64 }).notNull(),
    authoritativeAt: timestamp("authoritative_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    state: text("state").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
);
export const promotionProviderSignals = treido.table(
  "promotion_provider_signals",
  {
    platformAccount: text("platform_account").notNull(),
    livemode: boolean("livemode").notNull(),
    eventId: text("event_id").notNull(),
    attemptId: uuid("attempt_id").notNull(),
    providerId: text("provider_id").notNull(),
    providerCreatedAt: timestamp("provider_created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
);
export const promotionMetrics = treido.table("promotion_metrics", {
  campaignId: uuid("campaign_id").notNull(),
  placementId: uuid("placement_id").notNull(),
  kind: text("kind").notNull(),
  policyVersion: text("policy_version").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql.raw("clock_timestamp()")),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});
export const promotionRemedyReviews = treido.table("promotion_remedy_reviews", {
  campaignId: uuid("campaign_id").notNull().primaryKey(),
  kind: text("kind").notNull(),
  maximumMinor: integer("maximum_minor").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql.raw("clock_timestamp()")),
});
export const promotionMeasurementPolicies = treido.table(
  "promotion_measurement_policies",
  {
    id: uuid("id").notNull().primaryKey(),
    version: integer("version").notNull(),
    policyVersion: text("policy_version").notNull(),
    environment: text("environment").notNull(),
    applicationId: text("application_id").notNull(),
    retentionDays: integer("retention_days").notNull(),
    consentRule: text("consent_rule").notNull(),
    eventDefinition: jsonb("event_definition").notNull(),
    text: jsonb("text").notNull(),
    approvalReference: text("approval_reference").notNull(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
);
export const promotionMeasurementChoices = treido.table(
  "promotion_measurement_choices",
  {
    userId: uuid("user_id").notNull(),
    policyId: uuid("policy_id").notNull(),
    requestId: uuid("request_id").notNull(),
    allowed: boolean("allowed").notNull(),
    revision: integer("revision").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
);

export * from "./assistant-input-schema";
export * from "./order-aftercare-schema";
export * from "./order-feedback-schema";
export * from "./account-lifecycle-schema";

export * from "./shipping-registry-schema";
export * from "./shipping-recipient-schema";
export * from "./shipping-lifecycle-schema";
export * from "./shipping-refund-schema";
