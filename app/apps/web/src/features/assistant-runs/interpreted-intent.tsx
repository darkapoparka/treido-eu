"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Image from "next/image";
import { Sheet } from "../discovery/components";
import { ProductCard } from "../discovery/product-card";
import { LibraryProvider } from "../library/provider";
import { ListingSaveButton } from "../library/controls";
import { AssistantFeedback } from "../assistant-tools/common-ui";
import { AssistantListingActions } from "../assistant-tools/listing-actions";
import { useAssistantCommand } from "../assistant-tools/use-assistant-command";
import { IntentControls } from "../shopping-tools/intent-controls";
import { AddComparison, ComparisonFeedback } from "../shopping-tools/tool-ui";
import {
  parseToolIntent,
  toolParams,
  type ToolIntent,
} from "../shopping-tools/intent";
import {
  readAssistantInputAction,
  signAssistantInputUploadAction,
} from "./actions";
import { submitAssistantInput, stopInputRequest } from "./transport";
import {
  parseInputCommand,
  preserveConstraints,
  INPUT_LIMITS,
  type InputOperation,
  type InputView,
  type AssistantInterpretInputProps,
} from "./model";
import { InputCriteriaSummary } from "./criteria-summary";
import { InputConsentWithdrawal } from "./consent-withdrawal";
import { VoiceInput } from "./voice-input";
import { inputCopy } from "./copy";
import s from "../photo-match/photo.module.css";
/** Existing Find owns its route/filters. This island returns criteria only after
 * explicit server acceptance and a separate deliberate parent handoff. */
export function AssistantInterpretInput(props: AssistantInterpretInputProps) {
  const { isLoaded, userId } = useAuth(),
    t = inputCopy[props.locale];
  if (!isLoaded || !userId)
    return (
      <section className={s.panel}>
        <h2>{t.titles[props.mode]}</h2>
        <p role="status">{isLoaded ? t.guest : "…"}</p>
      </section>
    );
  return (
    <InputWorkspace
      key={userId + ":" + props.mode}
      {...props}
      subject={userId}
    />
  );
}
function InputWorkspace({
  initial,
  locale,
  mode,
  onReviewedIntent,
  subject,
}: AssistantInterpretInputProps & { subject: string }) {
  const t = inputCopy[locale],
    read = useCallback(() => readAssistantInputAction(mode), [mode]),
    controller = useAssistantCommand(
      subject,
      "assistant-input:" + mode,
      read,
      submitAssistantInput,
      parseInputCommand,
    );
  const [prompt, setPrompt] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [localBusy, setLocalBusy] = useState(false),
    [error, setError] = useState<
      "fileError" | "uploadError" | "invalid" | null
    >(null),
    [review, setReview] = useState<{
      revision: number;
      operation: InputOperation;
    } | null>(null),
    [confirmed, setConfirmed] = useState(false);
  const uploadRequest = useRef<AbortController | null>(null);
  const life = useRef({ alive: true, ticket: 0 }),
    view = controller.view,
    base = toolParams({ ...initial, cursor: null }).toString(),
    blocked =
      controller.status !== "ready" ||
      controller.busy ||
      Boolean(controller.pending) ||
      localBusy,
    available = Boolean(view?.policy?.modes.includes(mode)),
    inputAllowed = available && Boolean(view?.consent);
  const actorKey = view?.actorKey;
  const chooseFile = useCallback((value: File | null) => {
    ++life.current.ticket;
    setFile(value);
    setError(null);
  }, []);
  useEffect(() => {
    const current = life.current;
    current.alive = true;
    const hide = () => {
      if (document.visibilityState !== "visible") {
        ++current.ticket;
        uploadRequest.current?.abort();
        setFile(null);
        setReview(null);
        setPrompt("");
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      current.alive = false;
      ++current.ticket;
      uploadRequest.current?.abort();
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  useEffect(() => {
    if (!actorKey) return;
    const hidden = () => {
      if (document.visibilityState !== "visible")
        stopInputRequest(actorKey, mode);
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      stopInputRequest(actorKey, mode);
    };
  }, [actorKey, mode]);
  function reviewOperation(operation: InputOperation) {
    if (!view || blocked) return;
    setReview({ revision: view.revision, operation });
    setConfirmed(false);
    setError(null);
  }
  async function stage() {
    if (!view?.policy || !file || blocked || !inputAllowed) return;
    const current = life.current,
      ticket = ++current.ticket;
    setLocalBusy(true);
    try {
      if (
        file.size < 1 ||
        file.size > INPUT_LIMITS.mediaBytes ||
        !(
          mode === "voice"
            ? ["audio/wav"]
            : ["image/jpeg", "image/png", "image/webp"]
        ).includes(file.type)
      )
        throw Error();
      const checksum = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
        ),
      )
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      if (current.alive && ticket === current.ticket) {
        setReview({
          revision: view.revision,
          operation: {
            kind: "stage",
            policyId: view.policy.id,
            bytes: file.size,
            contentType: file.type,
            checksum,
            confirmed: true,
          },
        });
        setConfirmed(false);
      }
    } catch {
      if (current.alive && ticket === current.ticket) setError("fileError");
    } finally {
      if (current.alive) setLocalBusy(false);
    }
  }
  async function upload() {
    if (
      !view?.asset ||
      !file ||
      blocked ||
      !inputAllowed ||
      view.asset.state !== "staged"
    )
      return;
    const current = life.current,
      ticket = ++current.ticket;
    const uploadController = new AbortController();
    uploadRequest.current = uploadController;
    setLocalBusy(true);
    setError(null);
    try {
      const checksum = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
        ),
      )
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      if (
        file.size !== view.asset.bytes ||
        file.type !== view.asset.contentType ||
        checksum !== view.asset.checksum
      )
        throw Error();
      const result = await signAssistantInputUploadAction({
        actorKey: view.actorKey,
        assetId: view.asset.id,
      });
      if (!result.ok || result.data.subject !== subject) throw Error();
      if (!current.alive || ticket !== current.ticket) return;
      const response = await fetch(result.data.value.url, {
        method: "PUT",
        headers: result.data.value.headers,
        body: file,
        redirect: "error",
        signal: AbortSignal.any([
          uploadController.signal,
          AbortSignal.timeout(15000),
        ]),
      });
      await response.body?.cancel();
      if (!response.ok) throw Error();
      if (current.alive && ticket === current.ticket) controller.reload();
    } catch {
      if (current.alive && ticket === current.ticket) setError("uploadError");
    } finally {
      if (uploadRequest.current === uploadController)
        uploadRequest.current = null;
      if (current.alive) setLocalBusy(false);
    }
  }
  const run = view?.run;
  return (
    <section aria-label={t.titles[mode]} className={s.editor}>
      <h2>{t.titles[mode]}</h2>
      <p className={s.note}>{t.intro}</p>
      <AssistantFeedback
        status={controller.status}
        feedback={controller.feedback}
        pending={Boolean(controller.pending)}
        busy={controller.busy}
        retry={controller.retry}
        reload={controller.reload}
      />
      {controller.busy && controller.pending?.operation.kind === "execute" && (
        <>
          <button
            type="button"
            className={s.button}
            onClick={() => stopInputRequest(controller.pending!.actorKey, mode)}
          >
            {t.stopRequest}
          </button>
          <p>{t.stopNote}</p>
        </>
      )}
      {error && <p role="alert">{t[error]}</p>}
      {view && (
        <>
          {!available && <p role="status">{t.unavailable}</p>}
          {view.policy && (
            <div className={s.panel}>
              <h3>{t.privacy}</h3>
              <p>
                {locale === "bg" ? view.policy.noticeBg : view.policy.noticeEn}
              </p>
              <div className={s.actions}>
                {!view.consent && (
                  <button
                    type="button"
                    className={s.button}
                    disabled={blocked || !available}
                    onClick={() =>
                      reviewOperation({
                        kind: "consent",
                        policyId: view.policy!.id,
                        granted: true,
                        confirmed: true,
                      })
                    }
                  >
                    {t.consent}
                  </button>
                )}
              </div>
            </div>
          )}
          <InputConsentWithdrawal
            choice={view.consentChoice}
            locale={locale}
            blocked={blocked}
            onWithdraw={(policyId) =>
              reviewOperation({
                kind: "consent",
                policyId,
                granted: false,
                confirmed: true,
              })
            }
          />
          <details>
            <summary>{t.selection}</summary>
            <InputCriteriaSummary canonical={base} locale={locale} />
          </details>
          {!run && (
            <>
              {mode !== "voice" && (
                <label className={s.field}>
                  {t.prompt}
                  <textarea
                    value={prompt}
                    maxLength={INPUT_LIMITS.prompt}
                    disabled={blocked || !inputAllowed}
                    onChange={(event) => setPrompt(event.target.value)}
                  />
                </label>
              )}
              {mode === "photo" && !view.asset && (
                <label className={s.field}>
                  {t.photo}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={blocked || !inputAllowed}
                    onChange={(event) =>
                      chooseFile(event.target.files?.[0] ?? null)
                    }
                  />
                </label>
              )}
              {mode === "voice" && !view.asset && (
                <VoiceInput
                  locale={locale}
                  maximumSeconds={
                    view.policy?.audioSeconds ?? INPUT_LIMITS.audioSeconds
                  }
                  disabled={blocked || !inputAllowed}
                  onFile={chooseFile}
                />
              )}
              {file && (
                <p>
                  {file.name} · {file.size} B
                </p>
              )}
              {mode !== "text" && <p>{t.local}</p>}
              {mode !== "text" && !view.asset && (
                <button
                  type="button"
                  className={s.button}
                  disabled={blocked || !inputAllowed || !file}
                  onClick={() => void stage()}
                >
                  {t.stage}
                </button>
              )}
              {view.asset?.state === "staged" && (
                <div className={s.actions}>
                  {!file && (
                    <label className={s.field}>
                      {t.uploadAgain}
                      <input
                        type="file"
                        accept={
                          mode === "voice"
                            ? "audio/wav"
                            : "image/jpeg,image/png,image/webp"
                        }
                        disabled={blocked || !inputAllowed}
                        onChange={(event) =>
                          chooseFile(event.target.files?.[0] ?? null)
                        }
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    className={s.button}
                    disabled={blocked || !file || !inputAllowed}
                    onClick={() => void upload()}
                  >
                    {t.upload}
                  </button>
                  <button
                    type="button"
                    className={s.button}
                    disabled={blocked || !inputAllowed}
                    onClick={() =>
                      reviewOperation({
                        kind: "complete",
                        assetId: view.asset!.id,
                      })
                    }
                  >
                    {t.complete}
                  </button>
                </div>
              )}
              {view.asset?.preview &&
                (mode === "photo" ? (
                  <Image
                    className={s.preview}
                    src={view.asset.preview}
                    alt={t.photo}
                    width={280}
                    height={280}
                    unoptimized
                  />
                ) : (
                  <audio
                    className={s.audio}
                    controls
                    preload="none"
                    src={view.asset.preview}
                  />
                ))}
              {view.asset && (
                <>
                  <p>
                    {t.expiry}:{" "}
                    {new Date(view.asset.expiresAt).toLocaleString(locale)}
                  </p>
                  <p>
                    {t.cleanup}:{" "}
                    {new Date(view.asset.cleanupAfter).toLocaleString(locale)}
                  </p>
                  <p>{t.retention}</p>
                </>
              )}
              {(mode === "text" || view.asset?.state === "ready") && (
                <button
                  type="button"
                  className={s.button}
                  disabled={
                    blocked ||
                    !inputAllowed ||
                    (mode === "text" && !prompt.trim())
                  }
                  onClick={() =>
                    reviewOperation({
                      kind: "prepare",
                      policyId: view.policy!.id,
                      criteria: base,
                      prompt,
                      mediaId: view.asset?.id ?? null,
                      confirmed: true,
                    })
                  }
                >
                  {t.prepare}
                </button>
              )}
            </>
          )}
          {run && (
            <>
              {run.state === "reserved" && (
                <div className={s.panel}>
                  <p>{t.reserved}</p>
                  <button
                    type="button"
                    className={s.button}
                    disabled={blocked || !inputAllowed}
                    onClick={() =>
                      reviewOperation({
                        kind: "execute",
                        runId: run.id,
                        confirmed: true,
                      })
                    }
                  >
                    {t.execute}
                  </button>
                </div>
              )}
              {run.state === "calling" && <p role="status">{t.calling}</p>}
              {run.state === "unknown" && <p role="status">{t.unknown}</p>}
              {run.state === "failed" && <p role="status">{t.failed}</p>}
              {run.budgetPending && <p>{t.costPending}</p>}
              {run.state === "proposed" && run.proposal && run.criteria && (
                <InterpretationReview
                  key={run.id + ":" + view.revision}
                  view={view}
                  locale={locale}
                  disabled={blocked || !inputAllowed}
                  onReview={reviewOperation}
                />
              )}
              {run.state === "accepted" && run.reviewedCriteria && (
                <div className={s.panel}>
                  <h3>{t.accepted}</h3>
                  <InputCriteriaSummary
                    canonical={run.reviewedCriteria}
                    locale={locale}
                  />
                  {onReviewedIntent && (
                    <button
                      type="button"
                      className={s.button}
                      disabled={blocked || !inputAllowed}
                      onClick={() => {
                        try {
                          onReviewedIntent(
                            preserveConstraints(base, run.reviewedCriteria!),
                          );
                        } catch {
                          setError("invalid");
                        }
                      }}
                    >
                      {t.apply}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          {(view.run || view.asset) && (
            <button
              type="button"
              className={s.button}
              disabled={blocked}
              onClick={() =>
                reviewOperation({
                  kind: "cancel",
                  runId: view.run?.id ?? null,
                  assetId: view.asset?.id ?? null,
                  confirmed: true,
                })
              }
            >
              {t.cancel}
            </button>
          )}
          {view.results && (
            <LibraryProvider
              query={{
                listingIds: view.results.items.map((item) => item.card.id),
                sellerIds: view.results.items.map(
                  (item) => item.card.seller.id,
                ),
              }}
            >
              <section aria-label={t.results}>
                <h3>{t.results}</h3>
                <p>{t.scope}</p>
                <p>{t.shipping}</p>
                <ComparisonFeedback />
                {!view.results.items.length && <p>{t.empty}</p>}
                <div className={s.grid}>
                  {view.results.items.map((item) => (
                    <article className={s.result} key={item.card.id}>
                      <ProductCard
                        product={item.card}
                        showRating={false}
                        saveControl={
                          <ListingSaveButton
                            id={item.card.id}
                            title={item.card.title}
                          />
                        }
                      />
                      <AddComparison item={item} />
                      <AssistantListingActions
                        listingId={item.card.id}
                        subject={subject}
                      />
                    </article>
                  ))}
                </div>
              </section>
            </LibraryProvider>
          )}
        </>
      )}
      <Sheet
        open={Boolean(review) && controller.status === "ready"}
        title={t.review}
        onClose={() => setReview(null)}
      >
        <div className={s.sheet}>
          {review?.operation.kind === "consent" &&
            (review.operation.granted ? (
              view?.policy && (
                <p>
                  {locale === "bg"
                    ? view.policy.noticeBg
                    : view.policy.noticeEn}
                </p>
              )
            ) : (
              <p>{t.withdrawNote}</p>
            ))}
          {review?.operation.kind === "stage" && file && (
            <p>
              {file.name} · {file.size} B
            </p>
          )}
          {review && "criteria" in review.operation && (
            <InputCriteriaSummary
              canonical={review.operation.criteria}
              locale={locale}
            />
          )}
          {review?.operation.kind === "prepare" && (
            <p>{review.operation.prompt}</p>
          )}
          {review?.operation.kind === "execute" && run?.criteria && (
            <>
              <InputCriteriaSummary canonical={run.criteria} locale={locale} />
              <p>{run.prompt}</p>
            </>
          )}
          <p>{t.operationNote}</p>
          <label className={s.check}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            {t.confirm}
          </label>
          <button
            type="button"
            className={s.button}
            disabled={
              blocked || !confirmed || review?.revision !== view?.revision
            }
            onClick={() => {
              if (view && review) {
                controller.execute({
                  actorKey: view.actorKey,
                  requestId: crypto.randomUUID(),
                  expectedRevision: review.revision,
                  mode,
                  operation: review.operation,
                });
                if (
                  review.operation.kind === "cancel" ||
                  (review.operation.kind === "consent" &&
                    !review.operation.granted)
                ) {
                  chooseFile(null);
                  setPrompt("");
                }
              }
              setReview(null);
            }}
          >
            {t.continue}
          </button>
        </div>
      </Sheet>
    </section>
  );
}
function InterpretationReview({
  view,
  locale,
  disabled,
  onReview,
}: {
  view: InputView;
  locale: "bg" | "en";
  disabled: boolean;
  onReview: (operation: InputOperation) => void;
}) {
  const run = view.run!,
    proposal = run.proposal!,
    t = inputCopy[locale],
    [transcript, setTranscript] = useState(proposal.transcript ?? ""),
    [error, setError] = useState(false);
  function accept(intent: ToolIntent) {
    try {
      const canonical = preserveConstraints(
        run.criteria!,
        toolParams(intent).toString(),
      );
      setError(false);
      onReview({
        kind: "accept",
        runId: run.id,
        criteria: canonical,
        confirmed: true,
      });
    } catch {
      setError(true);
    }
  }
  return (
    <div className={s.panel}>
      <h3>{t.proposed}</h3>
      <p>{t.noGuess}</p>
      <dl>
        {(["itemType", "colour", "style"] as const).map(
          (key) =>
            proposal[key] && (
              <div key={key}>
                <dt>{t[key]}</dt>
                <dd>{proposal[key]}</dd>
              </div>
            ),
        )}
      </dl>
      {proposal.transcript !== null && (
        <>
          <p>{t.recognition}</p>
          <label className={s.field}>
            {t.transcript}
            <textarea
              value={transcript}
              maxLength={INPUT_LIMITS.transcript}
              disabled={disabled}
              onChange={(event) => setTranscript(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={s.button}
            disabled={disabled || !transcript.trim()}
            onClick={() => {
              try {
                const params = new URLSearchParams(proposal.criteria);
                params.set("q", transcript);
                accept(parseToolIntent(params.toString(), "find-for-me"));
              } catch {
                setError(true);
              }
            }}
          >
            {t.spokenSearch}
          </button>
        </>
      )}
      {error && <p role="alert">{t.invalid}</p>}
      <fieldset className={s.locked} disabled={disabled}>
        <IntentControls
          initial={parseToolIntent(proposal.criteria, "find-for-me")}
          mode="find-for-me"
          onReview={accept}
        />
      </fieldset>
    </div>
  );
}
