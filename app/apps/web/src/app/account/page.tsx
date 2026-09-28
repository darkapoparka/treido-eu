import { readCatalog } from "@/features/catalog/queries.server";
import { AccountDetails } from "@/features/account/pages";
export default async function Page() {
  await readCatalog();
  return <AccountDetails />;
}
