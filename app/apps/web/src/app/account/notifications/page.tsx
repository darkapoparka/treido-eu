import { readCatalog } from "@/features/catalog/queries.server";
import { NotificationSettings } from "@/features/account/pages";
import { readBuyerReferenceMode } from "@/features/catalog/buyer-data-mode.server";
export default async function Page() {
  if (!(await readBuyerReferenceMode()))
    return <NotificationSettings publicData />;
  await readCatalog();
  return <NotificationSettings />;
}
