import { readCatalog } from "@/features/catalog/queries.server";
import { DeleteAccount } from "@/features/account/pages";
export default async function Page() {
  await readCatalog();
  return <DeleteAccount />;
}
