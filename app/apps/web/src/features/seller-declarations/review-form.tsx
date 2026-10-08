"use client";
import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConversationDialog } from "../messaging/dialog";
import { useContactRecovery } from "../purchase-reviews/contact-recovery";
import w from "../sellers/workspace.module.css";
import s from "../trust/operations.module.css";
import { declarationMessages } from "./copy";
import {
  parseReviewDeclarationInput,
  type DeclarationReviewView,
  type ReviewDeclarationInput,
} from "./model";
import {
  readDeclarationReviewAction,
  reviewSellerDeclarationAction,
} from "./actions";
import {
  declarationRecoveryKey,
  emptyDeclarationDraft,
  parseDeclarationDraft,
  type DeclarationDraft,
} from "./recovery";

export function DeclarationReviewForm({
  initial,
  language,
  actorSubject,
  actorKey,
}: {
  initial: DeclarationReviewView;
  language: "bg" | "en";
  actorSubject: string;
  actorKey: string;
}) {
  const text = declarationMessages[language],
    clerk = useClerk(),
    { isLoaded, user } = useUser(),
    router = useRouter();
  const [view, setView] = useState(initial);
  const [storageFailed, setStorageFailed] = useState(false);
  const [access, setAccess] = useState<
    "checking" | "ready" | "denied" | "unavailable"
  >("checking");
  const [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<ReviewDeclarationInput | null>(null),
    [notice, setNotice] = useState<"saved" | "failed" | "conflict" | null>(
      null,
    );
  const generation = useRef(0),
    mounted = useRef(false),
    busyRef = useRef(false),
    refresh = useRef<() => void>(() => {}),
    prepareButton = useRef<HTMLButtonElement>(null),
    restoreFocus = useRef(false);
  const sameActor = isLoaded && user?.id === actorSubject;
  const { raw, write, clear } = useContactRecovery(
    declarationRecoveryKey(actorKey, initial.id),
  );
  const { draft, invalid } = parseDeclarationDraft(
    raw,
    initial.sellerId,
    initial.id,
  );
  useEffect(() => {
    if (!restoreFocus.current || preview || access !== "ready") return;
    restoreFocus.current = false;
    if (sameActor && clerk.user?.id === actorSubject)
      prepareButton.current?.focus({ preventScroll: true });
  }, [preview, access, sameActor, clerk, actorSubject]);
  function closePreview() {
    if (busyRef.current) return;
    restoreFocus.current = true;
    setPreview(null);
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, [actorKey, initial.id]);
  useEffect(() => {
    if (isLoaded && user?.id !== actorSubject) {
      clear();
    }
  }, [isLoaded, user?.id, actorSubject, clear]);
  useEffect(() => {
    if (!storageFailed && !draft.reason.length && !draft.attempt) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [storageFailed, draft.reason.length, draft.attempt]);
  useEffect(() => {
    let active = true;
    const load = () => {
      const ticket = ++generation.current;
      if (clerk.user?.id !== actorSubject) return;
      void readDeclarationReviewAction({ actorKey, declarationId: initial.id })
        .then((result) => {
          if (
            !active ||
            ticket !== generation.current ||
            clerk.user?.id !== actorSubject
          )
            return;
          if (result.ok) {
            setView(result.data);
            setAccess("ready");
          } else
            setAccess(
              ["FORBIDDEN", "UNAUTHENTICATED", "NOT_FOUND"].includes(
                result.code,
              )
                ? "denied"
                : "unavailable",
            );
        })
        .catch(() => {
          if (active && ticket === generation.current) setAccess("unavailable");
        });
    };
    refresh.current = () => {
      setAccess("checking");
      load();
    };
    const visibility = () => {
      generation.current += 1;
      setAccess("checking");
      if (document.visibilityState === "visible") load();
    };
    const foreground = () => {
      if (document.visibilityState === "visible") {
        setAccess("checking");
        load();
      }
    };
    load();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", foreground);
    window.addEventListener("online", foreground);
    window.addEventListener("pageshow", foreground);
    return () => {
      active = false;
      generation.current += 1;
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", foreground);
      window.removeEventListener("online", foreground);
      window.removeEventListener("pageshow", foreground);
    };
  }, [actorSubject, actorKey, clerk, initial.id, isLoaded, user?.id]);
  function store(next: DeclarationDraft) {
    const persisted = write(next);
    setStorageFailed(!persisted);
    return persisted;
  }
  function prepare() {
    if (
      !sameActor ||
      clerk.user?.id !== actorSubject ||
      access !== "ready" ||
      invalid ||
      busyRef.current ||
      draft.attempt ||
      !view.canReview
    )
      return;
    const input = parseReviewDeclarationInput({
      sellerId: view.sellerId,
      declarationId: view.id,
      expectedDeclarationRevision: view.revision,
      expectedSetupRevision: view.setupRevision,
      expectedRequirementVersion: view.requirementVersion,
      decision: draft.decision,
      reason: draft.reason,
      requestId: crypto.randomUUID(),
    });
    if (input) setPreview(input);
  }
  async function submit(input: ReviewDeclarationInput) {
    if (
      !sameActor ||
      clerk.user?.id !== actorSubject ||
      access !== "ready" ||
      invalid ||
      busyRef.current ||
      draft.rejected ||
      (draft.attempt && draft.attempt.requestId !== input.requestId)
    )
      return;
    const next = {
      ...draft,
      reason: input.reason,
      decision: input.decision,
      attempt: input,
      rejected: false,
    };
    if (!store(next)) return;
    const entry = window.location.pathname + window.location.search;
    busyRef.current = true;
    setBusy(true);
    setPreview(null);
    setNotice(null);
    try {
      const result = await reviewSellerDeclarationAction({ actorKey, input });
      if (
        !mounted.current ||
        clerk.user?.id !== actorSubject ||
        window.location.pathname + window.location.search !== entry
      )
        return;
      if (result.ok) {
        store({ ...emptyDeclarationDraft, decision: input.decision });
        setNotice("saved");
      } else {
        store({
          ...next,
          rejected: ["INVALID_INPUT", "CONFLICT"].includes(result.code),
        });
        setNotice(result.code === "CONFLICT" ? "conflict" : "failed");
      }
      refresh.current();
      router.refresh();
    } catch {
      if (mounted.current && clerk.user?.id === actorSubject)
        setNotice("failed");
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  if (!sameActor || access !== "ready")
    return (
      <section className={s.card} role="status">
        <p>
          {!isLoaded || access === "checking"
            ? text.checking
            : !sameActor || access === "denied"
              ? text.denied
              : text.failed}
        </p>
        <button className={w.button} onClick={() => refresh.current()}>
          {text.reload}
        </button>
      </section>
    );
  const locked = busy || !!draft.attempt || invalid || !view.canReview;
  return (
    <div className={s.stack} data-declaration-review>
      <section className={s.card}>
        <h2>{view.sellerName}</h2>
        <p className={s.muted}>{text.privateNote}</p>
        <dl className={s.facts}>
          {(
            [
              "legalName",
              "registrationNumber",
              "contactEmail",
              "contactAddress",
              "country",
            ] as const
          ).map((field) => (
            <div key={field}>
              <dt>{text[field]}</dt>
              <dd>{view.facts[field]}</dd>
            </div>
          ))}
          <div>
            <dt>{text.accurate}</dt>
            <dd>{view.facts.accurate ? text.yes : text.no}</dd>
          </div>
          <div>
            <dt>{text.state}</dt>
            <dd>{text[view.status]}</dd>
          </div>
          <div>
            <dt>{text.revision}</dt>
            <dd>{view.revision}</dd>
          </div>
          <div>
            <dt>{text.setupRevision}</dt>
            <dd>{view.setupRevision}</dd>
          </div>
          <div>
            <dt>{text.requirement}</dt>
            <dd>{view.requirementVersion}</dd>
          </div>
        </dl>
        {!view.isCurrent && (
          <p className={s.notice}>
            {text.older}{" "}
            <Link
              className={w.link}
              href={`/ops/declarations/${view.currentDeclarationId}?lang=${language}`}
            >
              {text.openCurrent}
            </Link>
          </p>
        )}
        {!view.canReview && <p role="status">{text.readOnly}</p>}
      </section>
      <section className={s.card}>
        <h2>{text.decision}</h2>
        <p>{text.note}</p>
        {notice && (
          <p role={notice === "saved" ? "status" : "alert"}>{text[notice]}</p>
        )}
        {storageFailed && <p role="alert">{text.storageFailed}</p>}
        {invalid ? (
          <>
            <p role="alert">{text.invalidRecovery}</p>
            <button
              className={w.button}
              onClick={() => {
                store({ ...emptyDeclarationDraft });
              }}
            >
              {text.discard}
            </button>
          </>
        ) : (
          <form
            className={w.form}
            onSubmit={(event) => {
              event.preventDefault();
              prepare();
            }}
          >
            <fieldset disabled={locked}>
              <label>
                {text.decision}
                <select
                  value={draft.decision}
                  onChange={(event) =>
                    store({
                      ...draft,
                      decision: event.target.value as "accepted" | "rejected",
                    })
                  }
                >
                  <option value="accepted">{text.accepted}</option>
                  <option value="rejected">{text.rejected}</option>
                </select>
              </label>
              <label>
                {text.reason}
                <textarea
                  required
                  minLength={2}
                  maxLength={2000}
                  rows={5}
                  value={draft.reason}
                  onChange={(event) =>
                    store({ ...draft, reason: event.target.value })
                  }
                />
              </label>
              <p className={s.muted}>{text.reasonNote}</p>
              <button
                ref={prepareButton}
                className={w.button}
                disabled={draft.reason.trim().length < 2}
              >
                {text.prepare}
              </button>
            </fieldset>
          </form>
        )}
        {draft.attempt && (
          <div className={s.notice}>
            <p role="status">{draft.rejected ? text.conflict : text.pending}</p>
            {draft.rejected ? (
              <button
                className={w.button}
                disabled={busy}
                onClick={() => {
                  store({ ...draft, attempt: null, rejected: false });
                  setNotice(null);
                  refresh.current();
                }}
              >
                {text.resume}
              </button>
            ) : (
              <button
                className={w.button}
                disabled={busy}
                onClick={() => void submit(draft.attempt!)}
              >
                {busy ? text.saving : text.retry}
              </button>
            )}
          </div>
        )}
      </section>
      {!!view.history.length && (
        <section className={s.card}>
          <h2>{text.history}</h2>
          <ol className={s.timeline}>
            {view.history.map((review) => (
              <li key={review.id}>
                <strong>
                  {text[review.decision]} · {text.revision} {review.revision}
                </strong>
                <p className={s.text}>{review.reason}</p>
                <Link
                  className={w.link}
                  href={`/ops/declarations/${review.reviewedDeclarationId}?lang=${language}`}
                >
                  {text.open}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
      {preview && (
        <ConversationDialog title={text.confirmation} onClose={closePreview}>
          <p>{text.confirmNote}</p>
          <p>
            {text.revision}: {preview.expectedDeclarationRevision} ·{" "}
            {text.setupRevision}: {preview.expectedSetupRevision}
          </p>
          <strong>{text[preview.decision]}</strong>
          <p className={s.text}>{preview.reason}</p>
          <div className={s.actions}>
            <button className={w.button} onClick={() => void submit(preview)}>
              {text.confirm}
            </button>
            <button className={w.link} onClick={closePreview}>
              {text.cancel}
            </button>
          </div>
        </ConversationDialog>
      )}
    </div>
  );
}
