import {
  readCatalog,
  referencePreviewEnabled,
} from "@/features/catalog/queries.server";
import { SupportHubPage } from "@/features/support/page.server";
import { SupportChat } from "@/features/account/support";
export default async function Page(props: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  if (!referencePreviewEnabled())
    return <SupportHubPage {...props} chatUnavailable />;
  await readCatalog();
  return <SupportChat />;
}
