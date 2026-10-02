import { pageLocale } from "@/features/locale/page-locale.server";
import { redirect } from "next/navigation";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import { BackendUnavailable } from "@/features/sellers/workspace";
import {
  requirePageIdentity,
  readPrivatePage,
} from "@/features/sellers/page-context.server";
import { readSellerContext } from "@/features/sellers/persistence.server";
import { getDatabase } from "@/server/db/database";

export default async function SellerSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ sellerId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  if (!backendConfigured()) return <BackendUnavailable />;
  const { sellerId } = await params;
  const { lang } = await searchParams;
  const language = await pageLocale(lang);
  const identity = await requirePageIdentity(
    `/app/sellers/${sellerId}/settings?lang=${language}`,
  );
  const seller = await readPrivatePage(() =>
    readSellerContext(getDatabase(), identity, sellerId),
  );
  redirect(
    `/app/sellers/${sellerId}${seller.kind === "business" ? "/onboarding?step=details&" : "?"}lang=${language}`,
  );
}
