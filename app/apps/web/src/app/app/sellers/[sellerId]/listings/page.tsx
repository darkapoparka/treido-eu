import { pageLocale } from "@/features/locale/page-locale.server";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import {
  requirePageIdentity,
  readPrivatePage,
} from "@/features/sellers/page-context.server";
import { readSellerContext } from "@/features/sellers/persistence.server";
import { readAdminProducts } from "@/features/sellers/admin-products.server";
import { AdminProductList } from "@/features/sellers/admin-products";
import { getDatabase } from "@/server/db/database";

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ sellerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const input = await searchParams;
  const language = await pageLocale(input.lang);
  if (!backendConfigured())
    return <AdminProductList language={language} unavailable />;
  const { sellerId } = await params;
  const identity = await requirePageIdentity(
    `/app/sellers/${sellerId}/listings?lang=${language}`,
  );
  const database = getDatabase();
  const { seller, data } = await readPrivatePage(async () => ({
    seller: await readSellerContext(
      database,
      identity,
      sellerId,
      "listing.read",
    ),
    data: await readAdminProducts(database, identity, sellerId, input),
  }));
  return <AdminProductList seller={seller} data={data} language={language} />;
}
