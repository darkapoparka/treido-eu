import {
  readCatalog,
  referencePreviewEnabled,
} from "../../features/catalog/queries.server";
import { pageLocale } from "../../features/locale/page-locale.server";
import { redirect } from "next/navigation";
import { AccountDetails } from "../../features/account/pages";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  if (!referencePreviewEnabled())
    redirect(
      "/account/privacy/preferences?lang=" +
        (await pageLocale((await searchParams).lang)),
    );
  await readCatalog();
  return <AccountDetails />;
}
