import { readCatalog } from "@/features/catalog/queries.server";
import { NativeMiniSignIn } from "@/features/discovery/native-minis";

export default async function Page() {
  await readCatalog();
  return <NativeMiniSignIn name="Picnic Gift Registry" />;
}
