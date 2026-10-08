import { readCatalog } from "../../features/catalog/queries.server";
import { readBuyerReferenceMode } from "../../features/catalog/buyer-data-mode.server";
import { readBuyerPublicView } from "../../features/catalog/buyer-entry.server";
import { PublishedProfile } from "../../features/account/public-profile";
import { readPublicProfile } from "../../features/account/public-profile.server";
import { AccountDetails } from "../../features/account/pages";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  if (!(await readBuyerReferenceMode()))
    return (
      <PublishedProfile
        details
        view={await readPublicProfile()}
        discovery={await readBuyerPublicView(await searchParams)}
      />
    );
  await readCatalog();
  return <AccountDetails />;
}
