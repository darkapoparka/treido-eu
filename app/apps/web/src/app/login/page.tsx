import { readCatalog } from "@/features/catalog/queries.server";
import { LoginPage } from "@/features/account/support";
export default async function Page() {
  await readCatalog();
  return <LoginPage />;
}
