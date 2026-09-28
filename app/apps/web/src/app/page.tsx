import {
  readCatalog,
  referencePreviewEnabled,
} from "@/features/catalog/queries.server";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Home } from "@/features/discovery/home";
import { referenceScenarioCookie } from "@/features/catalog/reference/scenarios";
import { previewOnboardedCookie } from "@/features/catalog/reference/session";
import { HomeLoading } from "@/features/discovery/home-loading";
import { Suspense } from "react";
async function HomeContent() {
  return <Home catalog={await readCatalog()} />;
}
export default async function Page() {
  await connection();
  // Preserve the non-preview 404 before the loading boundary can stream.
  if (!referencePreviewEnabled()) notFound();
  const cookieStore = await cookies();
  const scenario = cookieStore.get(referenceScenarioCookie)?.value;
  const onboarded = cookieStore.get(previewOnboardedCookie)?.value === "1";
  if (!scenario && !onboarded) redirect("/onboarding?step=splash&journey=new");
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeContent />
    </Suspense>
  );
}
