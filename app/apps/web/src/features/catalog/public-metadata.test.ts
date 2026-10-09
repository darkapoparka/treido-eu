import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  buyerPageMetadata,
  explorePageMetadata,
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
  it.each(["bg", "en"] as const)(
    "publishes the available %s Explore root with qualified localized links",
    (locale) => {
      const result = explorePageMetadata(
        { ...context, locale },
        new URLSearchParams({ lang: locale }),
        true,
      );
      expect(result.title).toBe(
        (locale === "bg" ? "Разгледай категории" : "Explore categories") +
          " | Treido",
      );
      expect(result.robots).toEqual({ index: true, follow: true });
      expect(result.alternates).toEqual({
        canonical: context.origin + "/explore?lang=" + locale,
        languages: {
          bg: context.origin + "/explore?lang=bg",
          en: context.origin + "/explore?lang=en",
        },
      });
      expect(result.openGraph).toMatchObject({
        url: context.origin + "/explore?lang=" + locale,
        locale: locale === "bg" ? "bg_BG" : "en_GB",
      });
      expect(explorePageMetadata(context, {}, true).robots).toEqual({
        index: true,
        follow: true,
      });
    },
  );
  it("keeps Explore criteria, private parameters, adjusted URLs and unavailable supply non-indexable", () => {
    for (const source of [
      "q=phone",
      "q=",
      "category=cat%3Aelectronics%2Fphones",
      "seller=personal",
      "seller=all",
      "condition=good",
      "location=Sofia",
      "minPrice=10",
      "maxPrice=20",
      "currency=EUR",
      "sort=newest",
      "sort=relevance",
      "attr.brand=example",
      "cursor=invalid",
      "sellerId=" + sellerId,
      "collectionId=private",
      "reference=1",
      "platform=android",
      "unknown=value",
      "lang=invalid",
      "lang=bg&lang=en",
    ]) {
      const result = explorePageMetadata(context, source, true);
      expect(result.robots, source).toEqual({ index: false, follow: false });
      expect(result.alternates, source).toBeUndefined();
      expect(result.openGraph, source).not.toHaveProperty("url");
    }
    expect(
      explorePageMetadata(context, { lang: ["bg", "en"] }, true).robots,
    ).toEqual({ index: false, follow: false });
    const unavailable = explorePageMetadata(context, { lang: "bg" }, false);
    expect(unavailable.robots).toEqual({ index: false, follow: false });
    expect(unavailable.alternates).toBeUndefined();
    const development = explorePageMetadata(
      { ...context, origin: null, indexable: false },
      {},
      true,
    );
    expect(development.robots).toEqual({ index: false, follow: false });
    expect(development.alternates).toBeUndefined();
    expect(development.metadataBase).toBeUndefined();
  });
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
