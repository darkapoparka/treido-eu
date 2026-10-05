import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ query: vi.fn(), active: false }));
vi.mock("../../server/db/database", () => ({
  inTransaction: async (
    _database: unknown,
    work: (tx: unknown) => Promise<unknown>,
  ) => {
    mocks.active = true;
    try {
      return await work({ client: { query: mocks.query }, db: {} });
    } finally {
      mocks.active = false;
    }
  },
}));
// authorizeSeller and its current capability policy are intentionally real.
import { readSavedBusinessStorePreview } from "./store-preview.server";
import type { SellerDatabase } from "../../server/db/database";
import {
  publishedEligibility,
  publishedJoins,
} from "../catalog/publication-eligibility.server";

const a = "10000000-0000-4000-8000-000000000001";
const b = "10000000-0000-4000-8000-000000000002";
const alice = "10000000-0000-4000-8000-000000000003";
const bob = "10000000-0000-4000-8000-000000000004";
const identity = { subject: "user_alice" };
const database = {} as SellerDatabase;
type Seller = {
  id: string;
  kind: "business" | "personal";
  name: string;
  status: string;
  revision: number;
};
type Member = {
  userId: string;
  sellerId: string;
  role: string;
  status: string;
  grants: string[];
};
let sellers: Seller[];
let members: Member[];
let humanStatus: string;
let unavailable: boolean;
let missing: boolean;
let available: boolean;

function previewQueries() {
  return mocks.query.mock.calls.filter(([sql]) =>
    sql.includes("FROM treido.seller_accounts sa"),
  );
}

beforeEach(() => {
  mocks.query.mockReset();
  sellers = [
    {
      id: a,
      kind: "business",
      name: "Saved business A",
      status: "active",
      revision: 1,
    },
    {
      id: b,
      kind: "business",
      name: "Saved business B",
      status: "active",
      revision: 2,
    },
  ];
  members = [
    { sellerId: a, userId: alice, role: "owner", status: "active", grants: [] },
    { sellerId: b, userId: bob, role: "owner", status: "active", grants: [] },
  ];
  humanStatus = "active";
  unavailable = missing = available = false;
  mocks.query.mockImplementation(async (sql: string, parameters: string[]) => {
    expect(mocks.active).toBe(true);
    if (sql.includes("FROM treido.users WHERE clerk_subject")) {
      const userId =
        parameters[0] === "user_alice"
          ? alice
          : parameters[0] === "user_bob"
            ? bob
            : null;
      return { rows: userId ? [{ id: userId, status: humanStatus }] : [] };
    }
    if (sql.includes("FROM treido.seller_accounts WHERE id = $1"))
      return { rows: sellers.filter((seller) => seller.id === parameters[0]) };
    if (sql.includes("FROM treido.seller_memberships WHERE seller_id = $1"))
      return {
        rows: members.filter(
          (member) =>
            member.sellerId === parameters[0] &&
            member.userId === parameters[1],
        ),
      };
    if (sql.includes("FROM treido.personal_seller_owners"))
      return { rows: [{ userId: alice }] };
    if (sql.includes("FROM treido.seller_accounts sa")) {
      if (unavailable) throw new Error("PRIVATE_DATABASE_DIAGNOSTIC");
      return {
        rows: missing
          ? []
          : [
              {
                description:
                  parameters[0] === a
                    ? "Saved A description"
                    : "Saved B description",
                locality: parameters[0] === a ? "София" : "Пловдив",
                rawContact: null,
                rawDelivery: null,
                publicStoreAvailable: available,
                declaration: "PRIVATE_DECLARATION",
                draft: "PRIVATE_DRAFT",
              },
            ],
      };
    }
    throw new Error("Unexpected query in read-only preview fixture");
  });
});

describe("saved business preview current authority", () => {
  it("allows a current owner with no public inventory to read only the saved profile", async () => {
    const view = await readSavedBusinessStorePreview(database, identity, a);
    expect(view.name).toBe("Saved business A");
    expect(view.description).toBe("Saved A description");
    expect(view.publicStoreAvailable).toBe(false);
    expect(JSON.stringify(view)).not.toContain("PRIVATE_");
    const [[sql, parameters]] = previewQueries();
    expect(parameters).toEqual([a]);
    expect(sql).toContain(publishedJoins);
    expect(sql).toContain(publishedEligibility);
    expect(sql).toContain("WHERE s.id=sa.id");
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
  });

  it("denies another business and allows only a separately current grant", async () => {
    await expect(
      readSavedBusinessStorePreview(database, identity, b),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(previewQueries()).toHaveLength(0);
    await expect(
      readSavedBusinessStorePreview(database, { subject: "user_bob" }, b),
    ).resolves.toMatchObject({ sellerId: b, name: "Saved business B" });
    await expect(
      readSavedBusinessStorePreview(database, { subject: "user_bob" }, a),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    members.push({
      sellerId: b,
      userId: alice,
      role: "member",
      status: "active",
      grants: ["profile.manage"],
    });
    const view = await readSavedBusinessStorePreview(database, identity, b);
    expect(view.sellerId).toBe(b);
    expect(view.name).toBe("Saved business B");
    expect(view.description).toBe("Saved B description");
    expect(JSON.stringify(view)).not.toContain("Saved A");
  });

  it("reloads membership and denies the next request after revocation", async () => {
    await readSavedBusinessStorePreview(database, identity, a);
    members[0].status = "revoked";
    await expect(
      readSavedBusinessStorePreview(database, identity, a),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(previewQueries()).toHaveLength(1);
  });

  it("requires profile.manage even for an active manager", async () => {
    members[0].role = "manager";
    members[0].grants = ["listing.write"];
    await expect(
      readSavedBusinessStorePreview(database, identity, a),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(previewQueries()).toHaveLength(0);
    members[0].grants.push("profile.manage");
    await expect(
      readSavedBusinessStorePreview(database, identity, a),
    ).resolves.toMatchObject({ sellerId: a });
  });

  it("denies personal accounts, closed businesses and restricted humans before profile reads", async () => {
    sellers[0].kind = "personal";
    await expect(
      readSavedBusinessStorePreview(database, identity, a),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    sellers[0].kind = "business";
    sellers[0].status = "closed";
    await expect(
      readSavedBusinessStorePreview(database, identity, a),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    sellers[0].status = "active";
    humanStatus = "restricted";
    await expect(
      readSavedBusinessStorePreview(database, identity, a),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(previewQueries()).toHaveLength(0);
  });

  it("rejects unbounded or malformed IDs before any database access", async () => {
    for (const id of ["", "//other.example", a + "/preview", "x".repeat(1000)])
      await expect(
        readSavedBusinessStorePreview(database, identity, id),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("keeps database failure and missing rows distinct from real zero eligible inventory", async () => {
    unavailable = true;
    await expect(
      readSavedBusinessStorePreview(database, identity, a),
    ).rejects.toThrow("PRIVATE_DATABASE_DIAGNOSTIC");
    unavailable = false;
    missing = true;
    await expect(
      readSavedBusinessStorePreview(database, identity, a),
    ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    missing = false;
    await expect(
      readSavedBusinessStorePreview(database, identity, a),
    ).resolves.toMatchObject({ publicStoreAvailable: false });
    available = true;
    await expect(
      readSavedBusinessStorePreview(database, identity, a),
    ).resolves.toMatchObject({ publicStoreAvailable: true });
  });
});
