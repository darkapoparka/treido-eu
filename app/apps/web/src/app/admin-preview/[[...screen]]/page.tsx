import { pageLocale } from "@/features/locale/page-locale.server";
import { notFound } from "next/navigation";
import { MerchantPreview } from "@/features/sellers/preview/merchant-preview";
import {
  adminPreviewEnabled,
  parsePreviewRoute,
} from "@/features/sellers/preview/routes";
export const metadata = {
  title: "Treido · Merchant frontend preview",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ screen?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!adminPreviewEnabled(process.env)) notFound();
  const route = parsePreviewRoute((await params).screen);
  if (!route) notFound();
  const query = await searchParams;
  return (
    <MerchantPreview
      route={route}
      storeId={query.store === "personal" ? "personal" : "studio"}
      language={await pageLocale(query.lang)}
      search={typeof query.q === "string" ? query.q.slice(0, 160) : ""}
    />
  );
}
