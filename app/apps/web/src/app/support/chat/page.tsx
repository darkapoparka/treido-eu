import { readCatalog } from "@/features/catalog/queries.server";
import { readBuyerReferenceMode } from "@/features/catalog/buyer-data-mode.server";
import { SupportHubPage } from "@/features/support/page.server";
import { SupportChat } from "@/features/account/support";
export default async function Page(props: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  if (!(await readBuyerReferenceMode()))
    return <SupportHubPage {...props} chatUnavailable />;
  await readCatalog();
  return <SupportChat />;
}
