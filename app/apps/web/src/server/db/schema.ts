import "server-only";
import { sql } from "drizzle-orm";
import {
  pgSchema,
  uuid,
  varchar,
  text,
  integer,
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
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    createdAt: time("created_at"),
  },
  (table) => [
    unique("message_sequence").on(table.threadId, table.sequence),
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
  (table) => [unique("report_retry").on(table.reporterId, table.requestId)],
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
  (table) => [unique("appeal_retry").on(table.actorId, table.requestId)],
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
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellers.id),
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
      "outbox_authority",
      sql`(${table.authority}='member' and ${table.actorId} is not null) or (${table.authority}='service' and ${table.actorId} is null)`,
    ),
    check(
      "outbox_media_authority",
      sql`${table.kind}<>'media.process' or ${table.authority}='member'`,
    ),
    check(
      "outbox_state",
      sql`${table.state} in ('pending','accepted','completed','cancelled','dead')`,
    ),
    check(
      "outbox_kind",
      sql`${table.kind} in ('media.process','system.probe')`,
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
