import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { and, eq, or, inArray, sql } from "drizzle-orm";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import {
  users,
  sellers,
  personalOwners,
  memberships,
  sellerUsage,
} from "../../server/db/schema";
import {
  hasVerifiedRecentAuthentication,
  type VerifiedIdentity,
} from "../../server/identity/clerk.server";
import {
  checkSellerCapability,
  resolveSellerCapabilities,
  type SellerAuthorityFacts,
  type SellerCapability,
} from "./capabilities";
import { SellerError } from "./errors";
import { canManageTeamMember } from "../team/policy.server";
import { validId } from "../selling/draft-model";

export type SellerContext = {
  sellerId: string;
  kind: "personal" | "business";
  name: string;
  revision: number;
  capabilities: readonly SellerCapability[];
};
type User = typeof users.$inferSelect;
type Seller = Pick<
  typeof sellers.$inferSelect,
  "id" | "kind" | "name" | "status" | "revision"
>;
type Membership = Pick<
  typeof memberships.$inferSelect,
  "userId" | "sellerId" | "role" | "status" | "grants"
>;

export function inputHash(value: unknown) {
  const canonical = (input: unknown): unknown =>
    Array.isArray(input)
      ? input.map(canonical)
      : input && typeof input === "object"
        ? Object.fromEntries(
            Object.entries(input)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([key, item]) => [key, canonical(item)]),
          )
        : input;
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}

export async function authorizeHuman(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  create: boolean,
): Promise<User> {
  if (!/^user_[A-Za-z0-9_-]{1,120}$/.test(identity.subject))
    throw new SellerError("UNAUTHENTICATED");
  if (create)
    await tx.db
      .insert(users)
      .values({ id: randomUUID(), clerkSubject: identity.subject })
      .onConflictDoNothing({ target: users.clerkSubject });
  const result = await tx.client.query<User>(
    `SELECT id, clerk_subject AS "clerkSubject", status, created_at AS "createdAt" FROM treido.users WHERE clerk_subject = $1 FOR ${create ? "UPDATE" : "SHARE"}`,
    [identity.subject],
  );
  const user = result.rows[0];
  if (!user) throw new SellerError("NOT_FOUND");
  if (user.status !== "active") throw new SellerError("FORBIDDEN");
  return user;
}

export async function authorizeSeller(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  sellerId: string,
  capability: SellerCapability,
  exclusive = false,
) {
  if (!validId(sellerId)) throw new SellerError("INVALID_INPUT");
  const user = await authorizeHuman(tx, identity, false);
  const result = await tx.client.query<Seller>(
    `SELECT id, kind, name, status, revision FROM treido.seller_accounts WHERE id = $1 FOR ${exclusive ? "UPDATE" : "SHARE"}`,
    [sellerId],
  );
  const seller = result.rows[0];
  if (!seller) throw new SellerError("FORBIDDEN");
  let ownerUserId = "";
  let membership: Membership | null = null;
  if (seller.kind === "personal") {
    const owners = await tx.client.query<{ userId: string }>(
      'SELECT user_id AS "userId" FROM treido.personal_seller_owners WHERE seller_id = $1 FOR SHARE',
      [sellerId],
    );
    ownerUserId = owners.rows[0]?.userId ?? "";
  } else {
    const members = await tx.client.query<Membership>(
      'SELECT user_id AS "userId", seller_id AS "sellerId", role, status, grants FROM treido.seller_memberships WHERE seller_id = $1 AND user_id = $2 FOR SHARE',
      [sellerId, user.id],
    );
    membership = members.rows[0] ?? null;
  }
  const authority: SellerAuthorityFacts = {
    actor: {
      userId: user.id,
      status: "active",
      session: "verified",
      recentlyAuthenticated: hasVerifiedRecentAuthentication(identity),
    },
    sellerId,
    seller:
      seller.kind === "personal"
        ? { ...seller, kind: "personal", ownerUserId }
        : { ...seller, kind: "business" },
    membership,
  };
  if (!checkSellerCapability(authority, capability).allowed)
    throw new SellerError("FORBIDDEN");
  const projection = resolveSellerCapabilities(authority);
  if (!projection.authorized) throw new SellerError("FORBIDDEN");
  return {
    user,
    seller,
    authority,
    context: {
      sellerId,
      kind: seller.kind,
      name: seller.name,
      revision: seller.revision,
      capabilities: projection.capabilities,
    } satisfies SellerContext,
  };
}

export async function ensurePersonalInTransaction(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
): Promise<string> {
  const user = await authorizeHuman(tx, identity, true);
  // actor(create) holds the human's update lock, including concurrent first saves.
  const [existing] = await tx.db
    .select()
    .from(personalOwners)
    .where(eq(personalOwners.userId, user.id));
  if (existing) {
    await authorizeSeller(tx, identity, existing.sellerId, "listing.write");
    return existing.sellerId;
  }
  const sellerId = randomUUID();
  await tx.db.insert(sellers).values({
    id: sellerId,
    kind: "personal",
    name: "My items",
    createdBy: user.id,
  });
  await tx.db.insert(personalOwners).values({ sellerId, userId: user.id });
  await tx.db.insert(sellerUsage).values({ sellerId, planId: "personal_free" });
  return sellerId;
}

export function ensurePersonalSeller(
  database: SellerDatabase,
  identity: VerifiedIdentity,
) {
  return inTransaction(database, (tx) =>
    ensurePersonalInTransaction(tx, identity),
  );
}

export async function createBusinessSeller(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: { name: string; requestId: string },
) {
  if (
    typeof input.name !== "string" ||
    input.name.trim().length < 2 ||
    input.name.trim().length > 80 ||
    !validId(input.requestId)
  )
    throw new SellerError("INVALID_INPUT");
  const name = input.name.trim();
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, true);
    const hash = inputHash({ name });
    const [existing] = await tx.db
      .select()
      .from(sellers)
      .where(
        and(
          eq(sellers.createdBy, user.id),
          eq(sellers.creationKey, input.requestId),
        ),
      );
    if (existing) {
      if (existing.creationHash !== hash) throw new SellerError("CONFLICT");
      await authorizeSeller(tx, identity, existing.id, "seller.read");
      return existing.id;
    }
    const sellerId = randomUUID();
    await tx.db.insert(sellers).values({
      id: sellerId,
      kind: "business",
      name,
      createdBy: user.id,
      creationKey: input.requestId,
      creationHash: hash,
    });
    await tx.db
      .insert(memberships)
      .values({ sellerId, userId: user.id, role: "owner", grants: [] });
    await tx.db
      .insert(sellerUsage)
      .values({ sellerId, planId: "business_free" });
    return sellerId;
  });
}

export async function listOwnedSellers(
  database: SellerDatabase,
  identity: VerifiedIdentity,
): Promise<SellerContext[]> {
  return inTransaction(database, async (tx) => {
    let user: User;
    try {
      user = await authorizeHuman(tx, identity, false);
    } catch (error) {
      if (error instanceof SellerError && error.code === "NOT_FOUND") return [];
      throw error;
    }
    const owned = await tx.db
      .select({ id: personalOwners.sellerId })
      .from(personalOwners)
      .where(eq(personalOwners.userId, user.id));
    const joined = await tx.db
      .select({ id: memberships.sellerId })
      .from(memberships)
      .where(
        and(eq(memberships.userId, user.id), eq(memberships.status, "active")),
      )
      .limit(100);
    const ids = [...owned, ...joined].map((row) => row.id);
    if (!ids.length) return [];
    const available = await tx.db
      .select({ id: sellers.id })
      .from(sellers)
      .where(
        and(
          inArray(sellers.id, ids),
          or(eq(sellers.status, "active"), eq(sellers.status, "restricted")),
        ),
      );
    const contexts: SellerContext[] = [];
    for (const { id } of available.sort((a, b) => a.id.localeCompare(b.id))) {
      try {
        contexts.push(
          (await authorizeSeller(tx, identity, id, "seller.read")).context,
        );
      } catch (error) {
        if (!(error instanceof SellerError && error.code === "FORBIDDEN"))
          throw error;
      }
    }
    return contexts;
  });
}

export function readSellerContext(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
  capability: SellerCapability = "seller.read",
) {
  return inTransaction(
    database,
    async (tx) =>
      (await authorizeSeller(tx, identity, sellerId, capability)).context,
  );
}

export function revokeSellerMembership(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: { sellerId: string; userId: string },
) {
  if (!validId(input.userId)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const authorized = await authorizeSeller(
      tx,
      identity,
      input.sellerId,
      "team.manage",
      true,
    );
    const rows = await tx.client.query<{
      userId: string;
      role: "owner" | "manager" | "member";
      grants: string[];
      status: string;
    }>(
      'SELECT user_id AS "userId", role, grants, status FROM treido.seller_memberships WHERE seller_id = $1 ORDER BY user_id FOR UPDATE',
      [input.sellerId],
    );
    const target = rows.rows.find((row) => row.userId === input.userId);
    if (!target) throw new SellerError("NOT_FOUND");
    if (target.status === "revoked") return;
    if (
      target.role === "owner" &&
      target.status === "active" &&
      rows.rows.filter((row) => row.role === "owner" && row.status === "active")
        .length <= 1
    )
      throw new SellerError("CONFLICT");
    if (
      target.userId !== authorized.user.id &&
      !canManageTeamMember(authorized.authority, target)
    )
      throw new SellerError("FORBIDDEN");
    await tx.client.query(
      "UPDATE treido.seller_invitations SET status='cancelled',revision=revision+1 WHERE seller_id=$1 AND created_by=$2 AND status='pending'",
      [input.sellerId, input.userId],
    );
    await tx.client.query(
      "INSERT INTO treido.seller_team_state(seller_id,revision) VALUES($1,1) ON CONFLICT(seller_id) DO UPDATE SET revision=treido.seller_team_state.revision+1",
      [input.sellerId],
    );
    await tx.db
      .update(memberships)
      .set({ status: "revoked", revision: sql`${memberships.revision} + 1` })
      .where(
        and(
          eq(memberships.sellerId, input.sellerId),
          eq(memberships.userId, input.userId),
        ),
      );
  });
}
