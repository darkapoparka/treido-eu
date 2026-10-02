import { backendConfigured } from "@/features/sellers/backend-status.server";
import {
  requirePageIdentity,
  readPrivatePage,
} from "@/features/sellers/page-context.server";
import { readSellerContext } from "@/features/sellers/persistence.server";
import { getDatabase } from "@/server/db/database";

export default async function OperatingSellerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ sellerId: string }>;
}) {
  if (!backendConfigured()) return children;
  const { sellerId } = await params;
  const identity = await requirePageIdentity(`/app/sellers/${sellerId}`);
  const database = getDatabase();
  await readPrivatePage(() => readSellerContext(database, identity, sellerId));
  return children;
}
