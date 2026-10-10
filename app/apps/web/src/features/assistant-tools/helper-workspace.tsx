"use client";
import { startTransition, useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Sheet } from "../discovery/components";
import { readHelperDraftsAction, readHelperDraftAction, readSellHelperAction, changeSellHelperAction } from "./actions";
import { parseHelperCommand, type HelperEdit, type HelperView, type HelperProposal } from "./sell-helper-model";
import { useAssistantCommand } from "./use-assistant-command";
import { AssistantFeedback, useAssistantLocale } from "./common-ui";
import { HelperDraftForm, type HelperSelection } from "./helper-draft-form";
import { HelperProposalCard, HelperEditFacts } from "./helper-proposal";
import { HelperHistory } from "./helper-history";
import { assistantCopy } from "./copy";
import s from "./assistant-tools.module.css";
const recover = (view: HelperView) => view.pending;
export type HelperDialogProps = { open: boolean; title: string; onClose: () => void; children: ReactNode };
type DraftChoice = { id: string; revision: number; updatedAt: string; title: string; priceMinor: number | null; currency: "EUR" };

/** Shared real command workflow; Studio supplies its own dialog frame, never
 * preview records or a second draft/publishing authority. */
export function HelperWorkspace({ subject, sellerId, initialDraft = "", Dialog = Sheet }: {
  subject: string; sellerId: string; initialDraft?: string; Dialog?: ComponentType<HelperDialogProps>;
}) {
  const locale = useAssistantLocale(), t = assistantCopy[locale],
    read = useCallback(() => readSellHelperAction(sellerId), [sellerId]),
    controller = useAssistantCommand(subject, `sell-helper:${sellerId}`, read, changeSellHelperAction, parseHelperCommand, recover);
  const [drafts, setDrafts] = useState<DraftChoice[] | null>(null), [draftId, setDraftId] = useState(initialDraft),
    [selection, setSelection] = useState<HelperSelection | null>(null),
    [edits, setEdits] = useState<Record<string, { baseHash: string; edit: HelperEdit }>>({}),
    [confirmed, setConfirmed] = useState(false), [reading, setReading] = useState(false),
    [error, setError] = useState<string | null>(null),
    [accept, setAccept] = useState<{ proposal: HelperProposal; revision: number } | null>(null),
    [acceptConfirmed, setAcceptConfirmed] = useState(false),
    [discard, setDiscard] = useState<{ proposalId: string; revision: number } | null>(null);
  const life = useRef({ alive: false, ticket: 0 });
  useEffect(() => {
    const current = life.current; current.alive = true;
    const initialize = async () => {
      try {
        const result = await readHelperDraftsAction(sellerId);
        if (!current.alive) return;
        if (result.ok && result.data.subject === subject) setDrafts(result.data.value);
        else setError(result.ok ? t.denied : t[result.code]);
      } catch { if (current.alive) setError(t.unavailable); }
    };
    startTransition(() => { void initialize(); });
    return () => { current.alive = false; ++current.ticket; };
  }, [sellerId, subject, t]);
  const blocked = controller.busy || !!controller.pending || controller.status !== "ready";
  async function loadDraft(id: string, proposal?: HelperProposal) {
    const ticket = ++life.current.ticket;
    setReading(true); setError(null);
    try {
      const result = await readHelperDraftAction(sellerId, id);
      if (!life.current.alive || ticket !== life.current.ticket) return;
      if (result.ok && result.data.subject === subject) {
        if (proposal && (proposal.baseHash !== result.data.value.baseHash || proposal.draftRevision !== result.data.value.draft.revision)) { setError(t.stale); return; }
        setSelection(result.data.value); setDraftId(id); setConfirmed(false);
        if (proposal) setEdits((values) => ({ ...values, [id]: { baseHash: result.data.value.baseHash, edit: proposal.edit } }));
      } else setError(result.ok ? t.denied : t[result.code]);
    } catch { if (life.current.alive && ticket === life.current.ticket) setError(t.unavailable); }
    finally { if (life.current.alive && ticket === life.current.ticket) setReading(false); }
  }
  const buffer = selection ? edits[selection.draft.id] : null,
    edit = selection ? buffer?.edit ?? selection.edit : null,
    staleBuffer = !!selection && !!buffer && buffer.baseHash !== selection.baseHash;
  function prepare() {
    if (!selection || !edit || !edit.categoryId || !controller.view || blocked || !confirmed || staleBuffer) return;
    controller.execute({ actorKey: controller.view.actorKey, sellerId, expectedRevision: controller.view.revision, requestId: crypto.randomUUID(),
      operation: { kind: "prepare", draftId: selection.draft.id, expectedDraftRevision: selection.draft.revision, baseHash: selection.baseHash, edit, confirmFacts: true } });
  }
  return <section data-seller-helper-workspace="">
    <AssistantFeedback status={controller.status} feedback={controller.feedback} pending={!!controller.pending} busy={controller.busy} retry={controller.retry} reload={controller.reload} />
    {controller.ack && <p role="status">{controller.ack.outcome === "applied" ? `${t.applied} ${controller.ack.draftRevision}` : controller.ack.outcome === "conflict" ? t.rejected : t[controller.ack.outcome]}</p>}
    {controller.view && controller.status === "ready" && <>
      <div className={s.actions}>
        <label className={s.field} htmlFor="helper-draft">{t.draft}<select id="helper-draft" value={draftId} disabled={blocked || reading} onChange={(event) => { setDraftId(event.target.value); setConfirmed(false); }}>
          <option value="">{t.choose}</option>
          {initialDraft && drafts && !drafts.some((draft) => draft.id === initialDraft) && <option value={initialDraft}>{t.draft} · {initialDraft}</option>}
          {drafts?.map((draft) => <option key={draft.id} value={draft.id}>{draft.title || t.draft} · #{draft.revision}</option>)}
        </select></label>
        <button className={s.button} disabled={blocked || reading || !draftId} onClick={() => startTransition(() => { void loadDraft(draftId); })}>{t.loadDraft}</button>
      </div>
      {drafts && !drafts.length && !initialDraft && <p>{t.noDrafts}</p>}
      {error && <p role="alert">{error}</p>}
      {staleBuffer && <div className={s.feedback}><p role="alert">{t.stale}</p><button className={s.button} disabled={blocked} onClick={() => {
        if (selection) setEdits((values) => ({ ...values, [selection.draft.id]: { baseHash: selection.baseHash, edit: selection.edit } }));
        setConfirmed(false);
      }}>{t.useCurrentDraft}</button></div>}
      {selection && edit && <HelperDraftForm selection={selection} edit={edit} locale={locale} disabled={blocked || reading || staleBuffer || selection.draft.id !== draftId}
        confirmed={confirmed} onConfirm={setConfirmed} onEdit={(value) => {
          setEdits((values) => ({ ...values, [selection.draft.id]: { baseHash: selection.baseHash, edit: value } })); setConfirmed(false);
        }} onPrepare={prepare} />}
      <h2>{t.proposals}</h2>
      {!controller.view.proposals.length && <p>{t.noProposals}</p>}
      {controller.view.proposals.map((proposal) => <HelperProposalCard key={proposal.id} proposal={proposal} locale={locale} disabled={blocked || reading}
        onEdit={() => startTransition(() => { void loadDraft(proposal.draftId, proposal); })}
        onAccept={() => { setAccept({ proposal, revision: controller.view?.revision ?? 0 }); setAcceptConfirmed(false); }}
        onDiscard={() => setDiscard({ proposalId: proposal.id, revision: controller.view?.revision ?? 0 })} />)}
      <HelperHistory key={`${subject}:${sellerId}:${controller.view.revision}`} subject={subject} sellerId={sellerId} locale={locale} />
    </>}
    <Dialog open={!!accept && controller.status === "ready"} title={t.accept} onClose={() => { setAccept(null); setAcceptConfirmed(false); }}>
      <div className={s.sheet}>{accept && <>
        <h3>{t.before}</h3><HelperEditFacts edit={accept.proposal.original} locale={locale} />
        <h3>{t.after}</h3><HelperEditFacts edit={accept.proposal.edit} locale={locale} />
        <label className={s.check}><input type="checkbox" checked={acceptConfirmed} disabled={blocked} onChange={(event) => setAcceptConfirmed(event.target.checked)} />{t.confirmAccept}</label>
        <button className={`${s.button} ${s.primary}`} disabled={blocked || !acceptConfirmed || accept.revision !== controller.view?.revision} onClick={() => {
          if (controller.view) controller.execute({ actorKey: controller.view.actorKey, sellerId, expectedRevision: accept.revision, requestId: crypto.randomUUID(),
            operation: { kind: "accept", proposalId: accept.proposal.id, proposalHash: accept.proposal.proposalHash, expectedDraftRevision: accept.proposal.draftRevision, confirm: true } });
          setAccept(null); setAcceptConfirmed(false);
        }}>{t.accept}</button>
      </>}</div>
    </Dialog>
    <Dialog open={!!discard && controller.status === "ready"} title={t.confirmDiscard} onClose={() => setDiscard(null)}>
      <div className={s.sheet}><p>{t.discard}</p><button className={s.button} disabled={blocked || discard?.revision !== controller.view?.revision} onClick={() => {
        if (discard && controller.view) controller.execute({ actorKey: controller.view.actorKey, sellerId, expectedRevision: discard.revision, requestId: crypto.randomUUID(), operation: { kind: "discard", proposalId: discard.proposalId } });
        setDiscard(null);
      }}>{t.discard}</button></div>
    </Dialog>
  </section>;
}
