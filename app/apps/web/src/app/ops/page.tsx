import { pageLocale } from "@/features/locale/page-locale.server";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import { Workspace } from "@/features/sellers/workspace";
import { SellerError } from "@/features/sellers/errors";
import { getDatabase, inTransaction } from "@/server/db/database";
import { readVerifiedIdentity } from "@/server/identity/clerk.server";
import {
  authorizeOperator,
  readOperatorReports,
} from "@/features/trust/reports.server";
import { OperatorDecisionForm } from "@/features/trust/operator-form";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Report review | Treido",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const language = await pageLocale(lang),
    bg = language === "bg";
  const title = bg ? "Преглед на сигнали" : "Report review";
  if (!backendConfigured())
    return (
      <Workspace title={title} language={language} back="/">
        <p role="status">
          {bg
            ? "Прегледът в момента не е достъпен. Опитайте отново по-късно."
            : "Review is currently unavailable. Try again later."}
        </p>
      </Workspace>
    );
  const actor = await readVerifiedIdentity();
  if (!actor)
    redirect(
      `/sign-in?returnTo=${encodeURIComponent(`/ops?lang=${language}`)}`,
    );
  const database = getDatabase();
  let rows: Awaited<ReturnType<typeof readOperatorReports>>,
    canModerate = false;
  try {
    rows = await readOperatorReports(database, actor);
  } catch (error) {
    if (error instanceof SellerError) notFound();
    throw new Error("Review is temporarily unavailable.");
  }
  try {
    await inTransaction(database, (tx) =>
      authorizeOperator(tx, actor, "moderation.write"),
    );
    canModerate = true;
  } catch (error) {
    if (!(error instanceof SellerError))
      throw new Error("Review is temporarily unavailable.");
  }
  return (
    <Workspace title={title} language={language} back="/">
      {!rows.length && (
        <p>{bg ? "Няма отворени сигнали." : "There are no open reports."}</p>
      )}
      {rows.map((row) => (
        <section className="account-panel" key={row.id}>
          <h2>{row.reason}</h2>
          <p>{row.details}</p>
          {canModerate &&
          row.resourceKind === "listing" &&
          row.moderationRevision !== null ? (
            <OperatorDecisionForm
              listingId={row.resourceId}
              reportId={row.id}
              revision={row.moderationRevision}
              requestId={randomUUID()}
              language={language}
            />
          ) : (
            <p>
              {bg
                ? "Този сигнал изисква отделен преглед."
                : "This report needs a separate review."}
            </p>
          )}
        </section>
      ))}
    </Workspace>
  );
}
