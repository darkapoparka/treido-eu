import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import type { SellerDatabase } from "../../server/db/database";
import {
  createBusinessSeller,
  ensurePersonalSeller,
  revokeSellerMembership,
} from "./persistence.server";
import { createListingDraft } from "../selling/drafts.server";
import { emptyDraft } from "../selling/draft-model";
import { readAdminProducts } from "./admin-products.server";
import { readStudioSearch } from "./studio-search.server";
import { readSellerOperations } from "./operations.server";
import { readSellerBilling } from "../seller-billing/queries.server";

export function defineAdminProductIntegrationCases(
  get: () => {
    database: SellerDatabase;
    admin: Client;
    owner: { subject: string };
    other: { subject: string };
  },
) {
  describe("authorized merchant product index", () => {
    let sellerId: string, emptySeller: string, memberId: string;
    beforeAll(async () => {
      const { database, admin, owner, other } = get();
      sellerId = await createBusinessSeller(database, owner, {
        name: "Admin product index",
        requestId: randomUUID(),
      });
      emptySeller = await createBusinessSeller(database, owner, {
        name: "Empty admin catalog",
        requestId: randomUUID(),
      });
      await ensurePersonalSeller(database, other);
      memberId = (
        await admin.query(
          "SELECT id FROM treido.users WHERE clerk_subject=$1",
          [other.subject],
        )
      ).rows[0].id;
      for (let index = 0; index < 34; index++) {
        const draft = await createListingDraft(database, owner, {
          sellerId,
          requestId: randomUUID(),
          payload: {
            ...emptyDraft,
            title:
              index === 0
                ? "100%_ Телефон"
                : `Product ${index.toString().padStart(2, "0")}`,
            priceMinor: index === 0 ? 12345 : null,
          },
        });
        await admin.query(
          "UPDATE treido.listing_drafts SET updated_at='2026-10-02T10:00:00.123456Z' WHERE listing_id=$1",
          [draft.id],
        );
        if (index === 1)
          await admin.query(
            "UPDATE treido.listings SET publication='published' WHERE id=$1",
            [draft.id],
          );
        if (index === 2)
          await admin.query(
            "UPDATE treido.listings SET publication='withdrawn' WHERE id=$1",
            [draft.id],
          );
        if (index === 3)
          await admin.query(
            "UPDATE treido.listings SET moderation_state='restricted' WHERE id=$1",
            [draft.id],
          );
      }
    });
    it("isolates seller data, literal search, publication and restriction projections", async () => {
      const { database, owner, other } = get();
      const result = await readAdminProducts(database, owner, sellerId, {
        q: "%_",
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        title: "100%_ Телефон",
        priceMinor: 12345,
        currency: "EUR",
        mediaId: null,
      });
      expect(result.counts).toEqual({
        all: 34,
        draft: 31,
        published: 1,
        withdrawn: 1,
        restricted: 1,
      });
      for (const status of ["published", "withdrawn", "restricted"])
        expect(
          (await readAdminProducts(database, owner, sellerId, { status }))
            .items,
        ).toHaveLength(1);
      expect(
        (
          await readAdminProducts(database, owner, sellerId, {
            q: "' OR 1=1 --",
          })
        ).items,
      ).toHaveLength(0);
      expect(
        (await readAdminProducts(database, owner, emptySeller)).counts.all,
      ).toBe(0);
      await expect(
        readAdminProducts(database, other, sellerId),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("searches actual seller products, bounds results, composes empty financial groups and rejects foreign scope", async () => {
      const { database, owner, other } = get();
      const input = {
        sellerId,
        actorSubject: owner.subject,
        q: "%_",
        group: "products",
        language: "bg",
      };
      const literal = await readStudioSearch(database, owner, input);
      expect(literal.items).toHaveLength(1);
      expect(literal.items[0]).toMatchObject({
        title: "100%_ Телефон",
        group: "products",
        description: "Чернова",
      });
      expect(literal.items[0].href).toContain("/edit?lang=bg");
      const all = await readStudioSearch(database, owner, {
        ...input,
        q: "",
        group: "all",
      });
      expect(
        all.items.filter((item) => item.group === "products"),
      ).toHaveLength(8);
      expect(
        all.items.filter(
          (item) => item.group === "orders" || item.group === "customers",
        ),
      ).toHaveLength(0);
      expect(all.groups).toContain("orders");
      expect(all.customerScope).toBe("recent_30");
      expect(
        (
          await readStudioSearch(database, owner, {
            ...input,
            q: "",
            sellerId: emptySeller,
          })
        ).items,
      ).toHaveLength(0);
      await expect(
        readStudioSearch(database, other, input),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        readStudioSearch(database, other, {
          ...input,
          actorSubject: other.subject,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("derives merchant operating work and billing seat reservations from current persisted facts only", async () => {
      const { database, admin, owner } = get();
      const operations = await readSellerOperations(database, owner, sellerId);
      expect(operations.sellerId).toBe(sellerId);
      expect(
        operations.counts.find((item) => item.kind === "drafts")?.count,
      ).toBe(33);
      expect(
        operations.counts.find((item) => item.kind === "orders")?.count,
      ).toBe(0);
      expect(
        operations.milestones.find((item) => item.kind === "product")?.complete,
      ).toBe(true);
      expect(
        operations.milestones.find((item) => item.kind === "publication")
          ?.complete,
      ).toBe(false);
      const before = await readSellerBilling(database, owner, emptySeller);
      expect(before.usage).toMatchObject({
        seats: 1,
        occupiedSeats: 1,
        pendingSeats: 0,
        active: 0,
      });
      const actorId = (
        await admin.query(
          "SELECT id FROM treido.users WHERE clerk_subject=$1",
          [owner.subject],
        )
      ).rows[0].id;
      const active = randomUUID(),
        expired = randomUUID();
      await admin.query(
        "INSERT INTO treido.seller_invitations(id,seller_id,recipient,role,grants,language,created_by,expires_at) VALUES($1,$3,'pending@example.invalid','member','[]'::jsonb,'bg',$4,clock_timestamp()+interval '1 hour'),($2,$3,'expired@example.invalid','member','[]'::jsonb,'bg',$4,clock_timestamp()-interval '1 second')",
        [active, expired, emptySeller, actorId],
      );
      const pending = await readSellerBilling(database, owner, emptySeller);
      expect(pending.usage).toMatchObject({
        seats: 2,
        occupiedSeats: 1,
        pendingSeats: 1,
      });
      expect(pending.available).toBe(false);
      expect(pending.financialHistoryAvailable).toBe(false);
      expect(pending.recoveryRequests).toEqual([]);
      await admin.query(
        "UPDATE treido.seller_invitations SET status='cancelled' WHERE id=$1",
        [active],
      );
      expect(
        (await readSellerBilling(database, owner, emptySeller)).usage.seats,
      ).toBe(1);
    });
    it("paginates tied microsecond timestamps without duplicate or skipped records", async () => {
      const { database, owner } = get();
      for (const sort of ["newest", "oldest"]) {
        const first = await readAdminProducts(database, owner, sellerId, {
          sort,
        });
        expect(first.items).toHaveLength(30);
        expect(first.nextCursor).not.toBeNull();
        const second = await readAdminProducts(database, owner, sellerId, {
          sort,
          cursor: first.nextCursor,
        });
        expect(second.items).toHaveLength(4);
        expect(second.nextCursor).toBeNull();
        expect(
          new Set([...first.items, ...second.items].map((item) => item.id))
            .size,
        ).toBe(34);
        await expect(
          readAdminProducts(database, owner, sellerId, {
            sort,
            q: "different",
            cursor: first.nextCursor,
          }),
        ).rejects.toMatchObject({ code: "INVALID_INPUT" });
        await expect(
          readAdminProducts(database, owner, emptySeller, {
            sort,
            cursor: first.nextCursor,
          }),
        ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      }
    });
    it("rechecks membership for every index read and never falls back after failure", async () => {
      const { database, admin, owner, other } = get();
      await admin.query(
        "INSERT INTO treido.seller_memberships(seller_id,user_id,role,grants) VALUES($1,$2,'manager','[\"listing.read\"]')",
        [sellerId, memberId],
      );
      expect(
        (await readAdminProducts(database, other, sellerId)).items,
      ).toHaveLength(30);
      // The manager baseline includes catalog editing. Exercise a genuinely
      // read-only current member before asserting review-only destinations.
      await admin.query(
        "UPDATE treido.seller_memberships SET role='member',grants='[\"seller.read\",\"listing.read\"]'::jsonb WHERE seller_id=$1 AND user_id=$2",
        [sellerId, memberId],
      );
      const scoped = {
        sellerId,
        actorSubject: other.subject,
        q: "",
        group: "all",
        language: "en",
      };
      const search = await readStudioSearch(database, other, scoped);
      expect(search.groups).not.toContain("orders");
      expect(
        search.items
          .filter((item) => item.group === "products")
          .every((item) => item.href.includes("/review?")),
      ).toBe(true);
      await expect(
        readStudioSearch(database, other, { ...scoped, group: "orders" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        readSellerBilling(database, other, sellerId),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await revokeSellerMembership(database, owner, {
        sellerId,
        userId: memberId,
      });
      await expect(
        readAdminProducts(database, other, sellerId),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        readStudioSearch(database, other, scoped),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        readSellerOperations(database, other, sellerId),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        readAdminProducts(database, owner, sellerId, { cursor: "invalid" }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });
  });
}
