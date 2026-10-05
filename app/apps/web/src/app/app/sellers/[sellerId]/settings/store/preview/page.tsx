import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import {
  requirePageIdentity,
  privatePageFailure,
} from "@/features/sellers/page-context.server";
import { pageLocale } from "@/features/locale/page-locale.server";
import { getDatabase } from "@/server/db/database";
import { validId } from "@/features/selling/draft-model";
import { SellerError } from "@/features/sellers/errors";
import {
  storePreviewPaths,
  type SavedStorePreview,
} from "@/features/seller-settings/store-preview-model";
import { readSavedBusinessStorePreview } from "@/features/seller-settings/store-preview.server";
import {
  SavedBusinessStorePreview,
  StorePreviewUnavailable,
} from "@/features/seller-settings/store-preview";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ sellerId: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  await connection();
  const { sellerId } = await params;
  if (!validId(sellerId)) notFound();
  const language = await pageLocale((await searchParams).lang);
  const paths = storePreviewPaths(sellerId, language);
  if (!backendConfigured())
    return <StorePreviewUnavailable sellerId={sellerId} language={language} />;
  // The existing sign-in allowlist accepts Store settings, not this new subroute.
  const identity = await requirePageIdentity(paths.settings);
  let view: SavedStorePreview;
  try {
    view = await readSavedBusinessStorePreview(
      getDatabase(),
      identity,
      sellerId,
    );
  } catch (error) {
    if (
      error instanceof SellerError &&
      ["FORBIDDEN", "NOT_FOUND", "INVALID_INPUT"].includes(error.code)
    )
      privatePageFailure(error);
    return <StorePreviewUnavailable sellerId={sellerId} language={language} />;
  }
  return <SavedBusinessStorePreview view={view} language={language} />;
}
