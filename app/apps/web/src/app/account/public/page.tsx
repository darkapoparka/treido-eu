import { readCatalog } from "@/features/catalog/queries.server";
import { PublicProfile } from "@/features/account/pages";
export default async function Page() {
  const catalog = await readCatalog();
  return <PublicProfile catalog={catalog} />;
}
