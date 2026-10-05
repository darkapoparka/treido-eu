"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react";
import { MiniShell } from "../discovery/mini-frame";
import { Sheet } from "../discovery/components";
import { SourceLink } from "../discovery/return-navigation";
import {
  readHelperSellersAction,
  readHelperDraftsAction,
  readHelperDraftAction,
  readSellHelperAction,
  changeSellHelperAction,
} from "./actions";
import {
  parseHelperCommand,
  type HelperEdit,
  type HelperView,
  type HelperProposal,
} from "./sell-helper-model";
import { useAssistantCommand } from "./use-assistant-command";
import {
  AssistantSession,
  AssistantFeedback,
  AssistantNavigation,
  useAssistantLocale,
} from "./common-ui";
import { HelperDraftForm, type HelperSelection } from "./helper-draft-form";
import { HelperProposalCard, HelperEditFacts } from "./helper-proposal";
import { assistantCopy } from "./copy";
import s from "./assistant-tools.module.css";
const recover = (view: HelperView) => view.pending;
type SellerChoice = { id: string; name: string; kind: "personal" | "business" };
type DraftChoice = {
  id: string;
  revision: number;
  updatedAt: string;
  title: string;
  priceMinor: number | null;
  currency: "EUR";
};
export function SellHelperScreen({
  initialSeller = "",
  initialDraft = "",
  continuation = "/minis/sell-helper",
}: {
  initialSeller?: string;
  initialDraft?: string;
  continuation?: string;
}) {
  return (
    <AssistantSession kind="sellHelper" continuation={continuation}>
      {(subject) => (
        <HelperSellerChoice
          key={subject}
          subject={subject}
          initialSeller={initialSeller}
          initialDraft={initialDraft}
        />
      )}
    </AssistantSession>
  );
}
function HelperSellerChoice({
  subject,
  initialSeller,
  initialDraft,
}: {
  subject: string;
  initialSeller: string;
  initialDraft: string;
}) {
  const locale = useAssistantLocale(),
    t = assistantCopy[locale],
    [sellers, setSellers] = useState<SellerChoice[] | null>(null),
    [sellerId, setSellerId] = useState(initialSeller),
    [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const result = await readHelperSellersAction();
        if (!alive) return;
        if (result.ok && result.data.subject === subject)
          setSellers(result.data.value);
        else setError(true);
      } catch {
        if (alive) setError(true);
      }
    };
    startTransition(() => {
      void load();
    });
    return () => {
      alive = false;
    };
  }, [subject]);
  return (
    <MiniShell name={t.sellHelper}>
      <main className={s.content}>
        <h1>{t.sellHelper}</h1>
        <p className={s.note}>{t.helperIntro}</p>
        <AssistantNavigation />
        {!sellers && !error && <p role="status">{t.loading}</p>}
        {error && <p role="alert">{t.unavailable}</p>}
        {sellers && (
          <>
            <label className={s.field} htmlFor="helper-seller">
              {t.seller}
              <select
                id="helper-seller"
                value={sellerId}
                onChange={(event) => setSellerId(event.target.value)}
              >
                <option value="">{t.choose}</option>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.name}
                  </option>
                ))}
              </select>
            </label>
            {!sellers.length && <p>{t.noSellers}</p>}
            {sellerId && sellers.some((seller) => seller.id === sellerId) ? (
              <HelperWorkspace
                key={subject + ":" + sellerId}
                subject={subject}
                sellerId={sellerId}
                initialDraft={sellerId === initialSeller ? initialDraft : ""}
              />
            ) : sellerId ? (
              <p role="alert">{t.denied}</p>
            ) : null}
          </>
        )}
        <nav className={s.actions}>
          <SourceLink
            preserveDiscoveryContext={false}
            href={"/app?lang=" + locale}
          >
            {t.workspace}
          </SourceLink>
        </nav>
      </main>
    </MiniShell>
  );
}
function HelperWorkspace({
  subject,
  sellerId,
  initialDraft,
}: {
  subject: string;
  sellerId: string;
  initialDraft: string;
}) {
  const locale = useAssistantLocale(),
    t = assistantCopy[locale],
    read = useCallback(() => readSellHelperAction(sellerId), [sellerId]),
    controller = useAssistantCommand(
      subject,
      "sell-helper:" + sellerId,
      read,
      changeSellHelperAction,
      parseHelperCommand,
      recover,
    );
  const [drafts, setDrafts] = useState<DraftChoice[] | null>(null),
    [draftId, setDraftId] = useState(initialDraft),
    [selection, setSelection] = useState<HelperSelection | null>(null),
    [edits, setEdits] = useState<
      Record<string, { baseHash: string; edit: HelperEdit }>
    >({}),
    [confirmed, setConfirmed] = useState(false),
    [reading, setReading] = useState(false),
    [error, setError] = useState<string | null>(null),
    [accept, setAccept] = useState<{
      proposal: HelperProposal;
      revision: number;
    } | null>(null),
    [acceptConfirmed, setAcceptConfirmed] = useState(false),
    [discard, setDiscard] = useState<{
      proposalId: string;
      revision: number;
    } | null>(null);
  const life = useRef({ alive: false, ticket: 0 });
  useEffect(() => {
    const current = life.current;
    current.alive = true;
    const initialize = async () => {
      try {
        const result = await readHelperDraftsAction(sellerId);
        if (!current.alive) return;
        if (result.ok && result.data.subject === subject)
          setDrafts(result.data.value);
        else setError(result.ok ? t.denied : t[result.code]);
      } catch {
        if (current.alive) setError(t.unavailable);
      }
    };
    startTransition(() => {
      void initialize();
    });
    return () => {
      current.alive = false;
      ++current.ticket;
    };
  }, [sellerId, subject, t]);
  const blocked =
    controller.busy || !!controller.pending || controller.status !== "ready";
  async function loadDraft(id: string, proposal?: HelperProposal) {
    const ticket = ++life.current.ticket;
    setReading(true);
    setError(null);
    try {
      const result = await readHelperDraftAction(sellerId, id);
      if (!life.current.alive || ticket !== life.current.ticket) return;
      if (result.ok && result.data.subject === subject) {
        if (
          proposal &&
          (proposal.baseHash !== result.data.value.baseHash ||
            proposal.draftRevision !== result.data.value.draft.revision)
        ) {
          setError(t.stale);
          return;
        }
        setSelection(result.data.value);
        setDraftId(id);
        setConfirmed(false);
        if (proposal)
          setEdits((values) => ({
            ...values,
            [id]: { baseHash: result.data.value.baseHash, edit: proposal.edit },
          }));
      } else setError(result.ok ? t.denied : t[result.code]);
    } catch {
      if (life.current.alive) setError(t.unavailable);
    } finally {
      if (life.current.alive && ticket === life.current.ticket)
        setReading(false);
    }
  }
  const buffer = selection ? edits[selection.draft.id] : null,
    edit = selection ? (buffer?.edit ?? selection.edit) : null,
    staleBuffer =
      !!selection && !!buffer && buffer.baseHash !== selection.baseHash;
  function prepare() {
    if (
      !selection ||
      !edit ||
      !controller.view ||
      blocked ||
      !confirmed ||
      staleBuffer
    )
      return;
    controller.execute({
      actorKey: controller.view.actorKey,
      sellerId,
      expectedRevision: controller.view.revision,
      requestId: crypto.randomUUID(),
      operation: {
        kind: "prepare",
        draftId: selection.draft.id,
        expectedDraftRevision: selection.draft.revision,
        baseHash: selection.baseHash,
        edit,
        confirmFacts: true,
      },
    });
  }
  return (
    <section>
      <AssistantFeedback
        status={controller.status}
        feedback={controller.feedback}
        pending={!!controller.pending}
        busy={controller.busy}
        retry={controller.retry}
        reload={controller.reload}
      />
      {controller.ack && (
        <p role="status">
          {controller.ack.outcome === "applied"
            ? t.applied + " " + controller.ack.draftRevision
            : controller.ack.outcome === "conflict"
              ? t.rejected
              : t[controller.ack.outcome]}
        </p>
      )}
      {controller.view && controller.status === "ready" && (
        <>
          <div className={s.actions}>
            <label className={s.field} htmlFor="helper-draft">
              {t.draft}
              <select
                id="helper-draft"
                value={draftId}
                disabled={blocked || reading}
                onChange={(event) => setDraftId(event.target.value)}
              >
                <option value="">{t.choose}</option>
                {drafts?.map((draft) => (
                  <option key={draft.id} value={draft.id}>
                    {draft.title || t.draft} · #{draft.revision}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={s.button}
              disabled={blocked || reading || !draftId}
              onClick={() =>
                startTransition(() => {
                  void loadDraft(draftId);
                })
              }
            >
              {t.loadDraft}
            </button>
          </div>
          {drafts && !drafts.length && <p>{t.noDrafts}</p>}
          {error && <p role="alert">{error}</p>}
          {staleBuffer && (
            <div className={s.feedback}>
              <p role="alert">{t.stale}</p>
              <button
                className={s.button}
                disabled={blocked}
                onClick={() => {
                  if (selection)
                    setEdits((values) => ({
                      ...values,
                      [selection.draft.id]: {
                        baseHash: selection.baseHash,
                        edit: selection.edit,
                      },
                    }));
                  setConfirmed(false);
                }}
              >
                {t.useCurrentDraft}
              </button>
            </div>
          )}
          {selection && edit && (
            <HelperDraftForm
              selection={selection}
              edit={edit}
              locale={locale}
              disabled={blocked || reading || staleBuffer}
              confirmed={confirmed}
              onConfirm={setConfirmed}
              onEdit={(value) => {
                setEdits((values) => ({
                  ...values,
                  [selection.draft.id]: {
                    baseHash: selection.baseHash,
                    edit: value,
                  },
                }));
                setConfirmed(false);
              }}
              onPrepare={prepare}
            />
          )}
          <h2>{t.proposals}</h2>
          {!controller.view.proposals.length && <p>{t.noProposals}</p>}
          {controller.view.proposals.map((proposal) => (
            <HelperProposalCard
              key={proposal.id}
              proposal={proposal}
              locale={locale}
              disabled={blocked || reading}
              onEdit={() =>
                startTransition(() => {
                  void loadDraft(proposal.draftId, proposal);
                })
              }
              onAccept={() => {
                setAccept({
                  proposal,
                  revision: controller.view?.revision ?? 0,
                });
                setAcceptConfirmed(false);
              }}
              onDiscard={() =>
                setDiscard({
                  proposalId: proposal.id,
                  revision: controller.view?.revision ?? 0,
                })
              }
            />
          ))}
        </>
      )}
      <Sheet
        open={!!accept && controller.status === "ready"}
        title={t.accept}
        onClose={() => {
          setAccept(null);
          setAcceptConfirmed(false);
        }}
      >
        <div className={s.sheet}>
          {accept && (
            <>
              <h3>{t.before}</h3>
              <HelperEditFacts
                edit={accept.proposal.original}
                locale={locale}
              />
              <h3>{t.after}</h3>
              <HelperEditFacts edit={accept.proposal.edit} locale={locale} />
              <label className={s.check}>
                <input
                  type="checkbox"
                  checked={acceptConfirmed}
                  disabled={blocked}
                  onChange={(event) => setAcceptConfirmed(event.target.checked)}
                />
                {t.confirmAccept}
              </label>
              <button
                className={s.button + " " + s.primary}
                disabled={
                  blocked ||
                  !acceptConfirmed ||
                  accept.revision !== controller.view?.revision
                }
                onClick={() => {
                  if (controller.view)
                    controller.execute({
                      actorKey: controller.view.actorKey,
                      sellerId,
                      expectedRevision: accept.revision,
                      requestId: crypto.randomUUID(),
                      operation: {
                        kind: "accept",
                        proposalId: accept.proposal.id,
                        proposalHash: accept.proposal.proposalHash,
                        expectedDraftRevision: accept.proposal.draftRevision,
                        confirm: true,
                      },
                    });
                  setAccept(null);
                  setAcceptConfirmed(false);
                }}
              >
                {t.accept}
              </button>
            </>
          )}
        </div>
      </Sheet>
      <Sheet
        open={!!discard && controller.status === "ready"}
        title={t.confirmDiscard}
        onClose={() => setDiscard(null)}
      >
        <div className={s.sheet}>
          <p>{t.discard}</p>
          <button
            className={s.button}
            disabled={
              blocked || discard?.revision !== controller.view?.revision
            }
            onClick={() => {
              if (discard && controller.view)
                controller.execute({
                  actorKey: controller.view.actorKey,
                  sellerId,
                  expectedRevision: discard.revision,
                  requestId: crypto.randomUUID(),
                  operation: {
                    kind: "discard",
                    proposalId: discard.proposalId,
                  },
                });
              setDiscard(null);
            }}
          >
            {t.discard}
          </button>
        </div>
      </Sheet>
    </section>
  );
}
