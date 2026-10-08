import { describe, expect, it } from "vitest";
import type { PublicListingCard } from "../catalog/public-discovery-model";
import { placeSponsored } from "../promotions/placement";
import { publicHomeSections } from "./public-home-model";

const listing = (
  id: string,
  sellerId: string,
  kind: "personal" | "business",
): PublicListingCard => ({
  id,
  title: `Listing ${id}`,
  images: [],
  price: { amount: 1250, currency: "EUR" },
  ratingCount: "",
  seller: { id: sellerId, name: sellerId, kind },
  categoryId: "cat:electronics/phones",
  condition: kind === "business" ? "good" : "new",
  locality: "София",
  publishedAt: "2026-10-06T00:00:00.000Z",
});

describe("public Home presentation ordering", () => {
  it("groups adjacent business supply while keeping every organic position and listing once", () => {
    const items = [
      listing("1", "shop-a", "business"),
      listing("2", "shop-a", "business"),
      listing("3", "person-a", "personal"),
      listing("4", "shop-b", "business"),
      listing("5", "shop-a", "business"),
    ];
    const sections = publicHomeSections({ items });
    expect(sections.map((section) => section.kind)).toEqual([
      "business",
      "personal",
      "business",
      "business",
    ]);
    expect(
      sections.flatMap((section) =>
        section.placements.map((placement) => placement.listing),
      ),
    ).toEqual(items);
    expect(sections[0].placements).toHaveLength(2);
    expect(sections.at(-1)?.placements[0].listing.id).toBe("5");
  });

  it("preserves server sponsored positions, labels and observation tokens without slicing a shelf", () => {
    const items = Array.from({ length: 24 }, (_, index) =>
      listing(String(index), "shop-a", "business"),
    );
    const placements = placeSponsored(items, [
      {
        campaignId: "campaign",
        listingId: "20",
        token: "observation-token",
        productId: "home_spotlight_7d_v1",
      },
    ]);
    const sections = publicHomeSections({ items, placements });
    expect(sections).toHaveLength(1);
    const display = sections.flatMap((section) => section.placements);
    expect(display).toEqual(placements);
    expect(display).toHaveLength(items.length);
    expect(new Set(display.map((placement) => placement.listing.id)).size).toBe(
      items.length,
    );
    expect(display[7]).toBe(placements[7]);
    expect(display[7].sponsored).toMatchObject({
      token: "observation-token",
      label: "Sponsored",
      labelBg: "Спонсорирано",
    });
  });

  it("keeps separate real seller containers for personal supply without inventing branding or inferring kind", () => {
    const items = [
      listing("1", "person-a", "personal"),
      listing("2", "person-b", "personal"),
      listing("3", "shop-a", "business"),
    ];
    const sections = publicHomeSections({ items });
    expect(sections[0].kind).toBe("personal");
    expect(sections.map((section) => section.seller.id)).toEqual([
      "person-a",
      "person-b",
      "shop-a",
    ]);
    expect(sections[0].seller).toBe(items[0].seller);
    expect(sections[0].seller).not.toHaveProperty("logo");
    expect(sections[0].placements).toHaveLength(1);
    expect(sections[0].placements[0].listing.condition).toBe("new");
    expect(sections[2].kind).toBe("business");
    expect(sections[2].placements[0].listing.condition).toBe("good");
  });

  it("does not mutate the authoritative page or invent seller/listing facts", () => {
    const item = listing("1", "shop-a", "business");
    const placement = Object.freeze({ listing: item, sponsored: null });
    const page = { items: [item], placements: [placement] };
    const before = structuredClone(page);
    const sections = publicHomeSections(page);
    expect(page).toEqual(before);
    expect(sections[0].placements[0]).toBe(placement);
    expect(sections[0].placements[0].listing).toBe(item);
    expect(sections[0].placements[0].listing).not.toHaveProperty("rating");
    expect(sections[0].placements[0].listing).not.toHaveProperty("stockState");
    expect(sections[0].placements[0].sponsored).toBeNull();
  });

  it("renders no supply when the server page is empty", () => {
    expect(publicHomeSections({ items: [] })).toEqual([]);
  });
});
