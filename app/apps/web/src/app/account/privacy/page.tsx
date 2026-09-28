import { readCatalog } from "@/features/catalog/queries.server";
import { PrivacyPage } from "@/features/account/privacy";
export default async function Page() {
  await readCatalog();
  return <PrivacyPage />;
}
