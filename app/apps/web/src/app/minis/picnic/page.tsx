import { readBuyerReferenceCatalog as readCatalog } from "@/features/catalog/buyer-data-mode.server";
import { NativeMiniSignIn } from "@/features/discovery/native-minis";

export default async function Page() {
  await readCatalog();
  return <NativeMiniSignIn name="Picnic Gift Registry" />;
}
