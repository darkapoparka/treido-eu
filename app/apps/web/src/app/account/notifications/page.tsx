import { readCatalog } from "@/features/catalog/queries.server";
import { NotificationSettings } from "@/features/account/pages";
export default async function Page() {
  await readCatalog();
  return <NotificationSettings />;
}
