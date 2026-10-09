import "server-only";
import type { Metadata } from "next";
import { readLocaleRequest } from "../locale/request.server";
import { validateBackendBindings } from "../../server/config/backend-bindings";
import { getDatabase } from "../../server/db/database";
import { readBuyerReferenceMode } from "./buyer-data-mode.server";
import { readPublishedListing } from "./published.server";
import { readPublicSeller } from "./public-discovery.server";
import type { DiscoveryParams } from "./discovery-input";
import {
  buyerPageMetadata,
  explorePageMetadata,
  listingMetadata,
  sellerMetadata,
  siteMetadata,
  type PublicMetadataContext,
} from "./public-metadata";

export async function readPublicMetadataContext(): Promise<PublicMetadataContext> {
  const { locale } = await readLocaleRequest();
  let origin: string | null = null;
  const configured = validateBackendBindings(process.env);
  if (
    configured.ok &&
    process.env.TREIDO_ENV === "production" &&
    process.env.VERCEL_ENV !== "preview"
  ) {
    try {
      const url = new URL(process.env.TREIDO_APP_ORIGIN ?? "");
      if (
        url.protocol === "https:" &&
        url.origin === process.env.TREIDO_APP_ORIGIN &&
        !url.username &&
        !url.password &&
        url.hostname.includes(".") &&
        !/^(?:\d+\.){3}\d+$/.test(url.hostname) &&
        !url.hostname.endsWith(".localhost")
      )
        origin = url.origin;
    } catch {
      /* An unqualified origin never becomes a canonical/share host. */
    }
  }
  return {
    locale,
    origin,
    indexable: !!origin && process.env.NODE_ENV === "production",
  };
}
const referenceMetadata: Metadata = {
  title: "Shop reference preview",
  description:
    "Isolated discovery reference preview. No live commerce services.",
  robots: { index: false, follow: false },
  icons: { icon: "data:," },
};
export async function readSiteMetadata(): Promise<Metadata> {
  return (await readBuyerReferenceMode())
    ? referenceMetadata
    : siteMetadata(await readPublicMetadataContext());
}
export async function readBuyerPageMetadata(
  kind: "home" | "search" | "saved" | "following",
): Promise<Metadata> {
  return (await readBuyerReferenceMode())
    ? { robots: { index: false, follow: false } }
    : buyerPageMetadata(await readPublicMetadataContext(), kind);
}
export async function readExploreMetadata(
  source: DiscoveryParams,
  available: boolean,
): Promise<Metadata> {
  return (await readBuyerReferenceMode())
    ? { robots: { index: false, follow: false } }
    : explorePageMetadata(await readPublicMetadataContext(), source, available);
}
export async function readListingMetadata(id: string): Promise<Metadata> {
  if (await readBuyerReferenceMode())
    return { robots: { index: false, follow: false } };
  const context = await readPublicMetadataContext();
  try {
    return listingMetadata(
      context,
      await readPublishedListing(getDatabase(), id),
    );
  } catch {
    return listingMetadata(context, null);
  }
}
export async function readSellerMetadata(
  id: string,
  section: "store" | "info" | "search" = "store",
): Promise<Metadata> {
  if (await readBuyerReferenceMode())
    return { robots: { index: false, follow: false } };
  const context = await readPublicMetadataContext();
  try {
    return sellerMetadata(
      context,
      await readPublicSeller(getDatabase(), id),
      section,
    );
  } catch {
    return sellerMetadata(context, null, section);
  }
}
