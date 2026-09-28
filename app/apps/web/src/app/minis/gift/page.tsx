import { readCatalog } from "@/features/catalog/queries.server";
import { GiftSense } from "@/features/discovery/minis";
import { NativeMiniSignIn } from "@/features/discovery/native-minis";
export default async function Page() {
  const catalog = await readCatalog();
  return catalog.liveHomeStoreIds ? (
    <NativeMiniSignIn name="Gift Sense" />
  ) : (
    <GiftSense catalog={catalog} />
  );
}
