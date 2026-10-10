import "server-only";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getDatabase } from "../../server/db/database";
import { pageLocale } from "../locale/page-locale.server";
import { backendConfigured } from "../sellers/backend-status.server";
import {
  readPrivatePage,
  requirePageIdentity,
} from "../sellers/page-context.server";
import { readSellerContext } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { libraryActorKey } from "../library/cursor.server";
import { canReadConnectStatus } from "./connect-status";
import { readConnectReadiness } from "./connect.server";
import { PaymentBoundary, OnboardingButton } from "./controls";
import { SellerConnectView } from "./seller-connect";
import { paymentText } from "./messages";
export async function SellerConnectPage({
  params,
  searchParams,
}: {
  params: Promise<{ sellerId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  await connection();
  const { sellerId } = await params;
  const language = await pageLocale((await searchParams).lang);
  if (!backendConfigured())
    return <p role="status">{paymentText(language).unavailable}</p>;
  const identity = await requirePageIdentity(
    `/app/sellers/${sellerId}/settings/payments?lang=${language}`,
  );
  const database = getDatabase();
  let status: Awaited<ReturnType<typeof readConnectReadiness>> | null = null;
  try {
    status = await readConnectReadiness(database, identity, sellerId);
  } catch (error) {
    if (
      error instanceof SellerError &&
      ["FORBIDDEN", "NOT_FOUND", "INVALID_INPUT"].includes(error.code)
    )
      notFound();
    // Provider and binding errors remain visible and retryable. Never fall back
    // to remembered browser readiness or show another seller's account data.
  }
  const context = await readPrivatePage(() =>
    readSellerContext(database, identity, sellerId),
  );
  if (!canReadConnectStatus(context.capabilities)) notFound();
  return (
    <PaymentBoundary actorSubject={identity.subject} language={language}>
      <SellerConnectView
        sellerId={sellerId}
        sellerName={context.name}
        capabilities={context.capabilities}
        status={status}
        language={language}
        onboarding={
          status && context.capabilities.includes("payment.setup") ? (
            <OnboardingButton
              key={`${identity.subject}:${sellerId}`}
              actorKey={libraryActorKey(identity)}
              actorSubject={identity.subject}
              sellerId={sellerId}
              language={language}
            />
          ) : undefined
        }
      />
    </PaymentBoundary>
  );
}
