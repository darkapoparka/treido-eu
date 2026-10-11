import { CatalogIndexPage } from "@/features/sellers/catalog-pages.server";
export default function Page(props: { params: Promise<{ sellerId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <CatalogIndexPage {...props} mode="catalog" />;
}
