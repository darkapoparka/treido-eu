import { readCatalog } from "@/features/catalog/queries.server";
import { SupportChat } from "@/features/account/support";
export default async function Page() {
  await readCatalog();
  return <SupportChat />;
}
