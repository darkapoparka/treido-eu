import { readCatalog } from "@/features/catalog/queries.server";
import { OnboardingPage } from "@/features/account/support";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const catalog = await readCatalog();
  const query = await searchParams;
  const initialStep =
    query.step === "preferences"
      ? 1
      : query.step === "tracking"
        ? 2
        : query.step === "updates"
          ? 3
          : 0;
  return <OnboardingPage catalog={catalog} initialStep={initialStep} />;
}
