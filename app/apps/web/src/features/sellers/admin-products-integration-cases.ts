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
      await revokeSellerMembership(database, owner, {
        sellerId,
        userId: memberId,
      });
      await expect(
        readAdminProducts(database, other, sellerId),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        readAdminProducts(database, owner, sellerId, { cursor: "invalid" }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });
  });
}
