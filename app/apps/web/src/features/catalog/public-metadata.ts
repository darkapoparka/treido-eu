import type { Metadata } from "next";
import type { Locale } from "../locale/locale";
import type { PublishedListing } from "./published-model";
import type { PublicSeller } from "./public-discovery-model";
import type { DiscoveryParams } from "./discovery-input";

export type PublicMetadataContext = {
  locale: Locale;
  origin: string | null;
  indexable: boolean;
};
const brand = "Treido";
const copy = {
  bg: {
    home: "Обяви от хора и бизнеси",
    search: "Търсене на обяви",
    explore: "Разгледай категории",
    saved: "Запазени",
    following: "Следвани продавачи",
    description:
      "Разглеждай обяви от хора и бизнеси. Свържи се директно с продавач и публикувай своя обява в Treido.",
    privateDescription:
      "Твоите запазени обяви, лични колекции и следвани продавачи.",
    unavailableListing: "Обявата не е достъпна",
    unavailableSeller: "Продавачът не е достъпен",
    sellerDescription:
      "Разгледай публичните обяви на продавача и се свържи с него чрез Treido.",
    info: "Информация за продавача",
  },
  en: {
    home: "Listings from people and businesses",
    search: "Search listings",
    explore: "Explore categories",
    saved: "Saved",
    following: "Followed sellers",
    description:
      "Discover listings from people and businesses. Contact sellers directly and publish your own listing on Treido.",
    privateDescription:
      "Your saved listings, private collections and followed sellers.",
    unavailableListing: "Listing unavailable",
    unavailableSeller: "Seller unavailable",
    sellerDescription:
      "Explore this seller's public listings and contact them through Treido.",
    info: "Seller information",
  },
} as const;
const summary = (value: string) =>
  Array.from(value.replace(/\s+/g, " ").trim()).slice(0, 180).join("");
function links(
  context: PublicMetadataContext,
  path: string | null,
): Metadata["alternates"] {
  if (!context.origin || !path) return undefined;
  const localized = (locale: Locale) =>
    context.origin + path + "?lang=" + locale;
  return {
    canonical: localized(context.locale),
    languages: { bg: localized("bg"), en: localized("en") },
  };
}
function pageMetadata(
  context: PublicMetadataContext,
  title: string,
  description: string,
  path: string | null,
  canIndex: boolean,
): Metadata {
  const alternatives = links(context, path);
  const canonical = alternatives?.canonical;
  return {
    title: title === brand ? brand : title + " | " + brand,
    description: summary(description),
    applicationName: brand,
    robots: {
      index: canIndex && context.indexable,
      follow: canIndex && context.indexable,
    },
    ...(context.origin ? { metadataBase: new URL(context.origin) } : {}),
    ...(alternatives ? { alternates: alternatives } : {}),
    openGraph: {
      type: "website",
      siteName: brand,
      title,
      description: summary(description),
      locale: context.locale === "bg" ? "bg_BG" : "en_GB",
      alternateLocale: [context.locale === "bg" ? "en_GB" : "bg_BG"],
      ...(typeof canonical === "string" ? { url: canonical } : {}),
    },
    twitter: { card: "summary", title, description: summary(description) },
  };
}
/** Root defaults stay private. Only a current eligible public route opts into production indexing. */
export function siteMetadata(context: PublicMetadataContext): Metadata {
  return {
    ...pageMetadata(
      context,
      brand,
      copy[context.locale].description,
      null,
      false,
    ),
    icons: { icon: "data:," },
  };
}
export function buyerPageMetadata(
  context: PublicMetadataContext,
  kind: "home" | "search" | "saved" | "following",
): Metadata {
  const privatePage = kind === "saved" || kind === "following";
  return pageMetadata(
    context,
    copy[context.locale][kind],
    copy[context.locale][privatePage ? "privateDescription" : "description"],
    kind === "home" ? "/" : null,
    kind === "home",
  );
}
/** Only the available public root is a landing page. Criteria and private or
 * unrecognized URL parameters never create indexable Explore variants. */
export function explorePageMetadata(
  context: PublicMetadataContext,
  source: DiscoveryParams,
  available: boolean,
): Metadata {
  const parameters =
    typeof source === "string" ? new URLSearchParams(source) : source;
  const entries =
    parameters instanceof URLSearchParams
      ? parameters.entries()
      : Object.entries(parameters);
  let root = available;
  let localeCount = 0;
  for (const [key, value] of entries) {
    if (
      key !== "lang" ||
      typeof value !== "string" ||
      !["bg", "en"].includes(value) ||
      ++localeCount > 1
    ) {
      root = false;
      break;
    }
  }
  return pageMetadata(
    context,
    copy[context.locale].explore,
    copy[context.locale].description,
    root ? "/explore" : null,
    root,
  );
}
/** The input is the accepted public projection, never a draft/saved-card fallback. */
export function listingMetadata(
  context: PublicMetadataContext,
  listing: PublishedListing | null,
): Metadata {
  if (!listing)
    return pageMetadata(
      context,
      copy[context.locale].unavailableListing,
      copy[context.locale].description,
      null,
      false,
    );
  const result = pageMetadata(
    context,
    listing.title,
    listing.description,
    "/products/" + listing.id,
    true,
  );
  const photo = listing.photos[0];
  if (
    context.origin &&
    photo &&
    photo.url.startsWith("/api/listing-media/" + listing.id + "/") &&
    !/[\\\s]/.test(photo.url)
  ) {
    const image = {
      url: context.origin + photo.url,
      width: photo.width,
      height: photo.height,
      alt: listing.title,
    };
    result.openGraph = { ...result.openGraph, images: [image] };
    result.twitter = {
      card: "summary_large_image",
      title: listing.title,
      description: summary(listing.description),
      images: [image.url],
    };
  }
  // Contact-only publications do not claim checkout, inventory quantities, discounts or ratings.
  return result;
}
export function sellerMetadata(
  context: PublicMetadataContext,
  seller: PublicSeller | null,
  section: "store" | "info" | "search" = "store",
): Metadata {
  if (!seller)
    return pageMetadata(
      context,
      copy[context.locale].unavailableSeller,
      copy[context.locale].description,
      null,
      false,
    );
  const title =
    section === "store"
      ? seller.name
      : seller.name +
        " — " +
        copy[context.locale][section === "info" ? "info" : "search"];
  return pageMetadata(
    context,
    title,
    seller.description || copy[context.locale].sellerDescription,
    section === "search"
      ? null
      : "/stores/" + seller.id + (section === "info" ? "/info" : ""),
    section !== "search",
  );
}
