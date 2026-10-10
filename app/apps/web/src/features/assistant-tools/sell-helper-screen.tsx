"use client";
import { startTransition, useEffect, useState } from "react";
import { MiniShell } from "../discovery/mini-frame";
import { SourceLink } from "../discovery/return-navigation";
import { readHelperSellersAction } from "./actions";
import { AssistantSession, AssistantNavigation, useAssistantLocale } from "./common-ui";
import { HelperWorkspace } from "./helper-workspace";
import { assistantCopy } from "./copy";
import s from "./assistant-tools.module.css";
type SellerChoice = { id: string; name: string; kind: "personal" | "business" };
export function SellHelperScreen({ initialSeller = "", initialDraft = "", continuation = "/minis/sell-helper" }: { initialSeller?: string; initialDraft?: string; continuation?: string }) {
  return <AssistantSession kind="sellHelper" continuation={continuation}>{(subject) => <HelperSellerChoice key={subject} subject={subject} initialSeller={initialSeller} initialDraft={initialDraft} />}</AssistantSession>;
}
function HelperSellerChoice({ subject, initialSeller, initialDraft }: { subject: string; initialSeller: string; initialDraft: string }) {
  const locale = useAssistantLocale(), t = assistantCopy[locale], [sellers, setSellers] = useState<SellerChoice[] | null>(null),
    [sellerId, setSellerId] = useState(initialSeller), [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const result = await readHelperSellersAction();
        if (!alive) return;
        if (result.ok && result.data.subject === subject) setSellers(result.data.value); else setError(true);
      } catch { if (alive) setError(true); }
    };
    startTransition(() => { void load(); });
    return () => { alive = false; };
  }, [subject]);
  return <MiniShell name={t.sellHelper}><section className={s.content}>
    <h1>{t.sellHelper}</h1><p className={s.note}>{t.helperIntro}</p><AssistantNavigation />
    {!sellers && !error && <p role="status">{t.loading}</p>}
    {error && <p role="alert">{t.unavailable}</p>}
    {sellers && <>
      <label className={s.field} htmlFor="helper-seller">{t.seller}<select id="helper-seller" value={sellerId} onChange={(event) => setSellerId(event.target.value)}>
        <option value="">{t.choose}</option>{sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
      </select></label>
      {!sellers.length && <p>{t.noSellers}</p>}
      {sellerId && sellers.some((seller) => seller.id === sellerId) ? <HelperWorkspace key={`${subject}:${sellerId}`} subject={subject} sellerId={sellerId} initialDraft={sellerId === initialSeller ? initialDraft : ""} /> : sellerId ? <p role="alert">{t.denied}</p> : null}
    </>}
    <nav className={s.actions}><SourceLink preserveDiscoveryContext={false} href={`/app?lang=${locale}`}>{t.workspace}</SourceLink></nav>
  </section></MiniShell>;
}
