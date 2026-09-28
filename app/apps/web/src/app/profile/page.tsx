import { readCatalog } from "@/features/catalog/queries.server";
import { ProfilePage } from "@/features/account/pages";
export default async function Page() {
  const catalog = await readCatalog();
  return <ProfilePage catalog={catalog} />;
}
