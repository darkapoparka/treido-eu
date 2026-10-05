import {
  readCatalog,
  referencePreviewEnabled,
} from "@/features/catalog/queries.server";
import { SupportHubPage } from "@/features/support/page.server";
import { HelpPage } from "@/features/account/support";
export default async function Page(props: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  if (!referencePreviewEnabled()) return <SupportHubPage {...props} />;
  await readCatalog();
  return <HelpPage />;
}
