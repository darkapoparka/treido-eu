import { PurchaseReviewsPage } from "@/features/purchase-reviews/pages.server";
import {
  readCatalog,
  referencePreviewEnabled,
} from "@/features/catalog/queries.server";
import { PickupCheckout } from "@/features/commerce/pickup";
import { Checkout } from "@/features/commerce/checkout";
import { LiveCheckoutBoundary } from "@/features/commerce/live-checkout-boundary";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; stage?: string; lang?: string }>;
}) {
  if (!referencePreviewEnabled())
    return <PurchaseReviewsPage searchParams={searchParams} />;
  const catalog = await readCatalog();
  const { store, stage } = await searchParams;
  const merchant = catalog.stores.find((item) => item.id === store);
  if (merchant?.referenceStyle === "android")
    return <LiveCheckoutBoundary merchant={merchant.name} />;
  if (store === "white-rock") return <PickupCheckout />;
  if (
    stage === "phone" ||
    stage === "address-search" ||
    stage === "address" ||
    stage === "payment-setup"
  )
    return <Checkout catalog={catalog} storeId={store} initialStage={stage} />;
  return <Checkout catalog={catalog} storeId={store} />;
}
