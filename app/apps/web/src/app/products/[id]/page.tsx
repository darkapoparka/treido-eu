import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readProductDetail } from "@/features/catalog/product-detail.server";
import { referencePreviewEnabled } from "@/features/catalog/queries.server";
import { ProductDetail } from "@/features/discovery/product";
import { readPublishedListing } from "@/features/catalog/published.server";
import { PublishedProductDetail } from "@/features/discovery/published-detail";
import { validId } from "@/features/selling/draft-model";
import { getDatabase } from "@/server/db/database";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  if (referencePreviewEnabled())
    return { robots: { index: false, follow: false } };
  try {
    const listing = await readPublishedListing(
      getDatabase(),
      (await params).id,
    );
    if (!listing)
      return { title: "Treido", robots: { index: false, follow: false } };
    return {
      title: listing.title + " | Treido",
      description: listing.description.slice(0, 160),
      robots: { index: false, follow: false },
      openGraph: {
        title: listing.title,
        description: listing.description.slice(0, 160),
      },
    };
  } catch {
    return { title: "Treido", robots: { index: false, follow: false } };
  }
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
  return (
    <PublishedProductDetail
      key={listing.id + "/" + listing.revision}
      listing={listing}
    />
  );
}
