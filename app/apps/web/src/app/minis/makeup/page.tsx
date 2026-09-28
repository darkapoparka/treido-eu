import { readCatalog } from "@/features/catalog/queries.server";
import { MakeupMaster } from "@/features/discovery/native-minis";
export default async function Page() {
  await readCatalog();
  return <MakeupMaster />;
}
