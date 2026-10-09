"use client";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { MiniShell } from "../discovery/mini-frame";
import { Sheet } from "../discovery/components";
import { SourceLink } from "../discovery/return-navigation";
import { LibraryProvider } from "../library/provider";
import { observe } from "../shopping-tools/model";
import { useAssistantCommand } from "../assistant-tools/use-assistant-command";
import {
  AssistantFeedback,
  AssistantNavigation,
  useAssistantLocale,
} from "../assistant-tools/common-ui";
import { parseGiftContinuation } from "./continuation";
import { parseGiftCommand, type GiftBrief, type GiftOperation } from "./model";
import { readGiftAction, changeGiftAction } from "./actions";
import { GiftBriefForm, GiftBriefSummary } from "./brief-form";
import { GiftCandidates } from "./candidates";
import { giftCopy } from "./copy";
import s from "./gift.module.css";
export function GiftScreen({ continuation }: { continuation: string }) {
  const { isLoaded, userId } = useAuth(),
    locale = useAssistantLocale(),
    t = giftCopy[locale];
  if (!isLoaded || !userId)
    return (
      <MiniShell name={t.title}>
        <section className={s.content}>
          <h1>{t.title}</h1>
          <p role="status">{isLoaded ? t.guest : "…"}</p>
          {isLoaded && (
            <SourceLink
              preserveDiscoveryContext={false}
              href={
                "/sign-in?lang=" +
                locale +
                "&next=" +
                encodeURIComponent(
                  parseGiftContinuation(continuation) ??
                    "/minis/gift-finder?lang=" + locale,
                )
              }
            >
              {t.signIn}
            </SourceLink>
          )}
        </section>
      </MiniShell>
    );
  return <GiftWorkspace key={userId} subject={userId} />;
}
function GiftWorkspace({ subject }: { subject: string }) {
  const locale = useAssistantLocale(),
    t = giftCopy[locale],
    controller = useAssistantCommand(
      subject,
      "gift-finder",
      readGiftAction,
      changeGiftAction,
      parseGiftCommand,
    );
  const [review, setReview] = useState<{
      revision: number;
      operation: GiftOperation;
      labels: string[];
    } | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [editor, setEditor] = useState<{ nonce: number; seed: GiftBrief | null }>({
      nonce: 0,
      seed: null,
    });
  const view = controller.view,
    blocked =
      controller.status !== "ready" ||
      controller.busy ||
      Boolean(controller.pending);
  function reviewOperation(operation: GiftOperation) {
    if (!view || blocked) return;
    const ids = "listingIds" in operation ? operation.listingIds : [];
    setReview({
      revision: view.revision,
      operation,
      labels: ids.map(
        (id) =>
          view.items.find((item) => item.listingId === id)?.current?.card
            .title ?? t.unavailable,
      ),
    });
    setConfirmed(false);
  }
  const content = (
    <MiniShell name={t.title}>
      <section className={s.content}>
        <h1>{t.title}</h1>
        <p className={s.note}>{t.intro}</p>
        <AssistantNavigation />
        <AssistantFeedback
          status={controller.status}
          feedback={controller.feedback}
          pending={Boolean(controller.pending)}
          busy={controller.busy}
          retry={controller.retry}
          reload={controller.reload}
        />
        <div hidden={controller.status !== "ready"}>
          {view?.brief && (
            <>
              <h2>{t.savedBrief}</h2>
              <GiftBriefSummary brief={view.brief} locale={locale} />
              <button
                className={s.button}
                disabled={blocked}
                onClick={() =>
                  setEditor((old) => ({
                    nonce: old.nonce + 1,
                    seed: view.brief,
                  }))
                }
              >
                {t.restore}
              </button>
            </>
          )}
          <GiftBriefForm
            key={editor.nonce}
            initial={editor.seed}
            locale={locale}
            disabled={blocked}
            onReview={(brief) =>
              reviewOperation({ kind: "find", brief, confirmed: true })
            }
          />
        </div>
        {view && (
          <>
            <GiftCandidates
              key={view.revision}
              view={view}
              subject={subject}
              locale={locale}
              disabled={blocked}
              onReview={reviewOperation}
            />
            <div className={s.actions}>
              {view.nextCursor && (
                <button
                  className={s.button}
                  disabled={blocked}
                  onClick={() =>
                    reviewOperation({
                      kind: "page",
                      briefHash: view.briefHash,
                      cursor: view.nextCursor!,
                    })
                  }
                >
                  {t.next}
                </button>
              )}
              {view.brief && (
                <>
                  <button
                    className={s.button}
                    disabled={blocked || view.items.length === 0}
                    onClick={() =>
                      reviewOperation({
                        kind: "refresh",
                        briefHash: view.briefHash,
                        listingIds: view.items.map((item) => item.listingId),
                        expected: view.items.map((item) => ({
                          listingId: item.listingId,
                          observation: item.current
                            ? observe(item.current)
                            : null,
                        })),
                      })
                    }
                  >
                    {t.refresh}
                  </button>
                  <button
                    className={s.button}
                    disabled={blocked}
                    onClick={() =>
                      reviewOperation({
                        kind: "clear",
                        briefHash: view.briefHash,
                        listingIds: view.items.map((item) => item.listingId),
                      })
                    }
                  >
                    {t.clear}
                  </button>
                </>
              )}
            </div>
          </>
        )}
        <Sheet
          open={!!review && controller.status === "ready"}
          title={t.review}
          onClose={() => setReview(null)}
        >
          <div className={s.sheet}>
            {review?.operation.kind === "find" && (
              <GiftBriefSummary
                brief={review.operation.brief}
                locale={locale}
              />
            )}
            {review && review.operation.kind !== "find" && view?.brief && (
              <GiftBriefSummary brief={view.brief} locale={locale} />
            )}
            {(review?.operation.kind === "find" ||
              review?.operation.kind === "page") && <p>{t.replace}</p>}
            {review?.operation.kind === "refresh" && <p>{t.refreshNote}</p>}
            {review?.operation.kind === "clear" && <p>{t.clearNote}</p>}
            {review && review.operation.kind !== "find" && (
              <ul>
                {review.labels.map((label, index) => (
                  <li key={index}>{label}</li>
                ))}
              </ul>
            )}
            <label className={s.check}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              {review?.operation.kind === "find"
                ? t.confirm
                : t.confirmOperation}
            </label>
            <button
              className={s.button}
              disabled={
                blocked || !confirmed || review?.revision !== view?.revision
              }
              onClick={() => {
                if (review && view)
                  controller.execute({
                    actorKey: view.actorKey,
                    expectedRevision: review.revision,
                    requestId: crypto.randomUUID(),
                    operation: review.operation,
                  });
                setReview(null);
              }}
            >
              {review?.operation.kind === "find" ? t.find : t.confirmOperation}
            </button>
          </div>
        </Sheet>
      </section>
    </MiniShell>
  );
  return (
    <LibraryProvider
      query={{ listingIds: view?.items.map((item) => item.listingId) ?? [] }}
    >
      {content}
    </LibraryProvider>
  );
}
