import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  buyerPageMetadata,
  listingMetadata,
  sellerMetadata,
  siteMetadata,
  type PublicMetadataContext,
} from "./public-metadata";
import type { PublishedListing } from "./published-model";
const context: PublicMetadataContext = {
  locale: "bg",
  origin: "https://treido.example",
  indexable: true,
};
const id = randomUUID(),
  sellerId = randomUUID(),
  photoId = randomUUID();
const listing: PublishedListing = {
  id,
  revision: 2,
  publishedAt: "2026-10-03T00:00:00.000Z",
  seller: { id: sellerId, name: "Public seller", kind: "business" },
  title: "Публичен телефон",
  description: "Публикувано описание",
  categoryId: "cat:electronics/phones",
  condition: "good",
  fields: {},
  price: { amount: 12900, currency: "EUR" },
  locality: "София",
  country: "BG",
  handover: ["pickup"],
  deliveryDetails: "",
  defects: "",
  purchaseMode: "contact",
  photos: [
    {
      id: photoId,
      url: "/api/listing-media/" + id + "/" + photoId + "?v=2",
      width: 640,
      height: 480,
    },
  ],
};
describe("Treido public metadata", () => {
  it("keeps root and private destinations non-indexable without leaking collection or account information", () => {
    expect(siteMetadata(context)).toMatchObject({
      title: "Treido",
      robots: { index: false, follow: false },
    });
    expect(siteMetadata(context).alternates).toBeUndefined();
    for (const kind of ["search", "saved", "following"] as const) {
      const result = buyerPageMetadata(context, kind);
      expect(result.robots).toEqual({ index: false, follow: false });
      expect(result.alternates).toBeUndefined();
      expect(JSON.stringify(result)).not.toContain("Shop reference");
    }
  });
  it("publishes localized canonical and sharing data only from accepted public fields", () => {
    const result = listingMetadata(context, listing);
    expect(result.title).toBe("Публичен телефон | Treido");
    expect(result.robots).toEqual({ index: true, follow: true });
    expect(result.alternates).toEqual({
      canonical: context.origin + "/products/" + id + "?lang=bg",
      languages: {
        bg: context.origin + "/products/" + id + "?lang=bg",
        en: context.origin + "/products/" + id + "?lang=en",
      },
    });
    expect(result.openGraph).toMatchObject({
      images: [
        {
          url: context.origin + listing.photos[0].url,
          width: 640,
          height: 480,
        },
      ],
      locale: "bg_BG",
    });
    expect(result.twitter).toMatchObject({ card: "summary_large_image" });
    expect(JSON.stringify(result)).not.toMatch(
      /rating|reviewCount|InStock|checkout|priceCurrency/,
    );
    expect(
      listingMetadata({ ...context, locale: "en" }, listing).openGraph,
    ).toMatchObject({ locale: "en_GB" });
  });
  it("never generates a guessed localhost/share image or indexes development metadata", () => {
    const development = { ...context, origin: null, indexable: false };
    const result = listingMetadata(development, listing);
    expect(result.metadataBase).toBeUndefined();
    expect(result.alternates).toBeUndefined();
    expect(result.openGraph).not.toHaveProperty("images");
    expect(result.robots).toEqual({ index: false, follow: false });
    expect(
      listingMetadata(context, {
        ...listing,
        photos: [
          { ...listing.photos[0], url: "https://foreign.example/photo.jpg" },
        ],
      }).openGraph,
    ).not.toHaveProperty("images");
  });
  it("drops unavailable content and supports both public seller details and private seller search", () => {
    const removed = listingMetadata(context, null);
    expect(removed.title).toBe("Обявата не е достъпна | Treido");
    expect(removed.robots).toEqual({ index: false, follow: false });
    expect(removed.alternates).toBeUndefined();
    expect(removed.openGraph).not.toHaveProperty("images");
    const seller = {
      id: sellerId,
      name: "A real seller",
      kind: "business" as const,
      description: "Public description",
      locality: "София",
      country: "BG" as const,
    };
    expect(sellerMetadata(context, seller).title).toBe(
      "A real seller | Treido",
    );
    expect(sellerMetadata(context, seller, "info").alternates?.canonical).toBe(
      context.origin + "/stores/" + sellerId + "/info?lang=bg",
    );
    expect(sellerMetadata(context, seller, "search").robots).toEqual({
      index: false,
      follow: false,
    });
    expect(sellerMetadata(context, null).title).toBe(
      "Продавачът не е достъпен | Treido",
    );
    expect(buyerPageMetadata(context, "home").robots).toEqual({
      index: true,
      follow: true,
    });
  });
});
