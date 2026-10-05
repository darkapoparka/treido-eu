import {
  readCatalog,
  referencePreviewEnabled,
} from "../../features/catalog/queries.server";
import { pageLocale } from "../../features/locale/page-locale.server";
import { redirect } from "next/navigation";
import { OnboardingPage } from "../../features/account/support";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; lang?: string | string[] }>;
}) {
  if (!referencePreviewEnabled())
    redirect(
      "/app/intent?lang=" + (await pageLocale((await searchParams).lang)),
    );
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
