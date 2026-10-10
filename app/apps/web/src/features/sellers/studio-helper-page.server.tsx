import "server-only";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDatabase } from "../../server/db/database";
import { pageLocale } from "../locale/page-locale.server";
import { readListingDraft } from "../selling/drafts.server";
import { validId } from "../selling/draft-model";
import { backendConfigured } from "./backend-status.server";
import { requirePageIdentity, readPrivatePage } from "./page-context.server";
import { readSellerContext } from "./persistence.server";
import { StudioHelper } from "./studio-helper";
import a from "./admin.module.css";

export async function StudioHelperPage({ params, searchParams }: {
  params: Promise<{ sellerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { sellerId } = await params, raw = await searchParams, language = await pageLocale(raw.lang), bg = language === "bg";
  if (Object.keys(raw).some((key) => !["lang", "draftId"].includes(key)) || (raw.lang !== undefined && !["bg", "en"].includes(raw.lang as string)) || (raw.draftId !== undefined && !validId(raw.draftId))) notFound();
  const draftId = typeof raw.draftId === "string" ? raw.draftId : "";
  if (!backendConfigured()) return <main><header className={a.pageBar}><h1>Sell Helper</h1></header><div className={a.pageBody}><p role="status">{bg ? "Инструментът временно не е достъпен. Черновите не се променят." : "The tool is temporarily unavailable. Drafts are unchanged."}</p></div></main>;
  const identity = await requirePageIdentity(`/app/sellers/${sellerId}/sell-helper?lang=${language}${draftId ? `&draftId=${draftId}` : ""}`);
  await readPrivatePage(async () => {
    await readSellerContext(getDatabase(), identity, sellerId, "listing.write");
    await readSellerContext(getDatabase(), identity, sellerId, "listing.read");
    if (draftId) await readListingDraft(getDatabase(), identity, sellerId, draftId);
  });
  return <main><header className={a.pageBar}><h1>{bg ? "Помощник за продажби" : "Sell Helper"}</h1><Link className={a.secondary} href={`/app/sellers/${sellerId}/listings?lang=${language}`}>{bg ? "Продукти" : "Products"}</Link></header>
    <div className={a.pageBody}><StudioHelper actorSubject={identity.subject} sellerId={sellerId} initialDraft={draftId} /></div>
  </main>;
}
