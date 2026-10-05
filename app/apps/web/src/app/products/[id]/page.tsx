import { readPublicInventory } from "@/features/inventory/queries.server";
import type { PublicInventory } from "@/features/inventory/model";
import { readListingMetadata } from "@/features/catalog/public-metadata.server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readProductDetail } from "@/features/catalog/product-detail.server";
import { referencePreviewEnabled } from "@/features/catalog/queries.server";
import { ProductDetail } from "@/features/discovery/product";
import { readPublishedListing } from "@/features/catalog/published.server";
import { PublishedProductDetail } from "@/features/discovery/published-detail";
import { validId } from "@/features/selling/draft-model";
import { getDatabase } from "@/server/db/database";
import {
  publicDiscoveryKey,
  readPublicDiscovery,
} from "@/features/catalog/public-discovery.server";
import type { PublicListingCard } from "@/features/catalog/public-discovery-model";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  return readListingMetadata((await params).id);
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (referencePreviewEnabled()) {
    const detail = await readProductDetail(id);
    if (!detail) notFound();
    return <ProductDetail key={detail.view.product.id} data={detail} />;
  }
  if (!validId(id)) notFound();
  const listing = await readPublishedListing(getDatabase(), id);
  if (!listing) notFound();
  let inventory: PublicInventory | null = null;
  try {
    inventory = await readPublicInventory(getDatabase(), id, listing.revision);
  } catch {
    console.error("Listing inventory unavailable.");
  }
  let moreFromSeller: PublicListingCard[] = [];
  try {
    moreFromSeller = (
      await readPublicDiscovery(
        getDatabase(),
        { sort: "newest" },
        {
          key: publicDiscoveryKey(),
          sellerId: listing.seller.id,
          excludeId: listing.id,
          limit: 4,
        },
      )
    ).items;
  } catch {
    console.error("Related seller listings unavailable.");
  }
  return (
    <PublishedProductDetail
      key={listing.id + "/" + listing.revision}
      listing={listing}
      inventory={inventory}
      moreFromSeller={moreFromSeller}
    />
  );
}
