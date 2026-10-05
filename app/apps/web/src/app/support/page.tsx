import {
  readCatalog,
  referencePreviewEnabled,
} from "@/features/catalog/queries.server";
import { SupportHubPage } from "@/features/support/page.server";
import { SupportPage } from "@/features/account/support";
export default async function Page(props: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  if (!referencePreviewEnabled()) return <SupportHubPage {...props} />;
  const catalog = await readCatalog();
  return <SupportPage android={Boolean(catalog.liveHomeStoreIds)} />;
}
