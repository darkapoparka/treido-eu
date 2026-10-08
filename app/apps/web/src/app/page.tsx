import { readBuyerPageMetadata } from "@/features/catalog/public-metadata.server";
export const generateMetadata = () => readBuyerPageMetadata("home");
import { referencePreviewEnabled } from "@/features/catalog/queries.server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Home } from "@/features/discovery/home";
import { readBuyerHomeData } from "@/features/catalog/buyer-entry.server";
import { referenceScenarioCookie } from "@/features/catalog/reference/scenarios";
import { previewOnboardedCookie } from "@/features/catalog/reference/session";
import { HomeLoading } from "@/features/discovery/home-loading";
import { Suspense } from "react";
import { type MarketplaceSearchParams } from "@/features/discovery/marketplace-page.server";
async function HomeContent({ raw }: { raw: MarketplaceSearchParams }) {
  return <Home {...await readBuyerHomeData(raw)} />;
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<MarketplaceSearchParams>;
}) {
  await connection();
  if (referencePreviewEnabled()) {
    const cookieStore = await cookies();
    const scenario = cookieStore.get(referenceScenarioCookie)?.value;
    const onboarded = cookieStore.get(previewOnboardedCookie)?.value === "1";
    if (!scenario && !onboarded)
      redirect("/onboarding?step=splash&journey=new");
  }
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeContent raw={await searchParams} />
    </Suspense>
  );
}
