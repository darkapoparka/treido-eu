"use client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AccountPage } from "./forms";
import { AccountIcon } from "./icons";
import { Icon } from "../discovery/icons";
import { Sheet } from "../discovery/components";
import { ContextualCloseLink } from "../discovery/return-navigation";
import { useAccount, type SupportConversation } from "./state";

const capturedQuestion =
  "Is it possible to cancel an order and request a refund?";
const capturedReply = [
  "Yes, it is possible to cancel an order and request a refund, but these actions are typically handled by the store where you made the purchase. The Shop app helps you track your orders, but the store is responsible for processing cancellations and refunds.",
  "To proceed, you should contact the store directly to request a cancellation or refund. You can usually find contact options for the store within the Shop app once you locate your order.",
  "If you need to check the status of your order or find your order details, you can do so in the Orders tab of the Shop app.",
];
// This opt-in reference surface replays only the frozen example. Arbitrary
// questions never claim to contact support or receive a live model response.
export function SupportChat() {
  const ui = useTranslations("accountUI");
  const { supportConversation, setSupportConversation } = useAccount();
  const { draft, attempt, phase, query } = supportConversation;
  const setDraft = (draft: string) =>
    setSupportConversation((previous) => ({ ...previous, draft }));
  const setAttempt = (attempt: string) =>
    setSupportConversation((previous) => ({ ...previous, attempt }));
  const setPhase = (phase: SupportConversation["phase"]) =>
    setSupportConversation((previous) => ({ ...previous, phase }));
  const setQuery = (query: string) =>
    setSupportConversation((previous) => ({ ...previous, query }));
  const [searching, setSearching] = useState(false);
  const conversation = useRef<HTMLDivElement>(null);
  const restoredScroll = useRef(supportConversation.scrollTop);
  const savedScroll = useRef(supportConversation.scrollTop);
  const previousReply = useRef({ phase, attempt });
  useEffect(() => {
    const pane = conversation.current;
    if (!pane) return;
    pane.scrollTop = restoredScroll.current;
    return () =>
      setSupportConversation((previous) => ({
        ...previous,
        scrollTop: savedScroll.current,
      }));
  }, [setSupportConversation]);
  useEffect(() => {
    if (phase !== "thinking") return;
    const timer = window.setTimeout(
      () =>
        setSupportConversation((previous) => ({
          ...previous,
          phase: "captured",
        })),
      1400,
    );
    return () => window.clearTimeout(timer);
  }, [phase, setSupportConversation]);
  useEffect(() => {
    const pane = conversation.current;
    if (
      pane &&
      (previousReply.current.phase !== phase ||
        previousReply.current.attempt !== attempt)
    ) {
      pane.scrollTop = pane.scrollHeight;
      savedScroll.current = pane.scrollTop;
    }
    previousReply.current = { phase, attempt };
  }, [phase, attempt]);
  const reset = () => {
    setDraft("");
    setAttempt("");
    setPhase("idle");
    setQuery("");
  };
  const playExample = () => {
    setAttempt(capturedQuestion);
    setDraft("");
    setPhase("thinking");
  };
  const text = [attempt, ...(phase === "captured" ? capturedReply : [])].filter(
    Boolean,
  );
  return (
    <AccountPage dock={false} className="support-chat-page">
      <header className="support-chat-heading">
        <ContextualCloseLink
          className="icon-button"
          href="/support"
          aria-label={ui("closeSupport")}
          data-ui-label="closeSupport"
        >
          <Icon name="close" />
        </ContextualCloseLink>
        <h1>{ui("support")}</h1>
      </header>
      <div
        ref={conversation}
        className="support-chat-scroll"
        aria-label={ui("supportConversation")}
        onScroll={(event) => {
          savedScroll.current = event.currentTarget.scrollTop;
        }}
        data-ui-label="supportConversation"
      >
        <div className="support-chat-messages">
          <p className="support-chat-notice">
            {ui("youCanCloseThisConversationAtAnyTimeAndReturn")}
          </p>
          <p className="support-message">
            {ui("hiIMYourAISupportAssistantWhatCanI")}
          </p>
          {attempt && (
            <p
              className={
                "support-message user" +
                (phase === "thinking" ? " pending" : "")
              }
            >
              {attempt}
            </p>
          )}
          {phase === "thinking" && (
            <div
              className="support-typing"
              role="status"
              aria-label={ui("preparingCapturedReply")}
              data-ui-label="preparingCapturedReply"
            >
              <i />
              <i />
              <i />
            </div>
          )}
          {phase === "captured" && (
            <>
              <div
                className="support-message response"
                aria-label={ui("capturedExampleResponse")}
                data-ui-label="capturedExampleResponse"
              >
                {capturedReply.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
              <Link className="support-orders-link" href="/orders">
                <span>
                  <AccountIcon name="receipt" filled />
                </span>
                {ui("goToOrders")} <Icon name="chevron" />
              </Link>
            </>
          )}
          {phase === "unavailable" && (
            <div className="support-unavailable">
              <p role="status">
                {ui("supportIsNotConnectedYourMessageWasNotSent")}
              </p>
              <button className="form-cancel" onClick={playExample}>
                {ui("viewCapturedExampleConversation")}
              </button>
            </div>
          )}
        </div>
      </div>
      <button
        className="support-search-fab icon-button"
        aria-label={ui("searchConversation")}
        onClick={() => setSearching(true)}
        data-ui-label="searchConversation"
      >
        <Icon name="search" />
      </button>
      <form
        className="support-chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          const message = draft.trim();
          setAttempt(message);
          setDraft("");
          setPhase(
            message.toLowerCase() === capturedQuestion.toLowerCase()
              ? "thinking"
              : "unavailable",
          );
        }}
      >
        <textarea
          rows={1}
          aria-label={ui("messageSupport")}
          placeholder={ui("askAnything")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
          data-ui-label="messageSupport"
        />
        {phase === "thinking" ? (
          <button
            type="button"
            className="support-stop"
            aria-label={ui("stopResponse")}
            onClick={() => setPhase("idle")}
            data-ui-label="stopResponse"
          >
            <span />
          </button>
        ) : draft.trim() ? (
          <button
            type="submit"
            className="support-send"
            aria-label={ui("sendMessage")}
            data-ui-label="sendMessage"
          >
            ↑
          </button>
        ) : (
          <button
            type="button"
            className="support-reset"
            aria-label={ui("startANewConversation")}
            onClick={reset}
            data-ui-label="startANewConversation"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 4 2 8l4 4M2 8h14a4 4 0 0 1 4 4M18 20l4-4-4-4m4 4H8a4 4 0 0 1-4-4" />
            </svg>
          </button>
        )}
      </form>
      <Sheet
        open={searching}
        title={ui("searchConversation")}
        onClose={() => setSearching(false)}
      >
        <label className="form-field">
          {ui("search")}
          <input
            aria-label={ui("searchMessages")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-ui-label="searchMessages"
          />
        </label>
        <div className="support-search-results">
          {text
            .filter((p) => p.toLowerCase().includes(query.toLowerCase()))
            .map((p) => (
              <p key={p}>{p}</p>
            ))}
          {query &&
            !text.some((p) =>
              p.toLowerCase().includes(query.toLowerCase()),
            ) && <p>{ui("noMatchingMessages")}</p>}
        </div>
      </Sheet>
    </AccountPage>
  );
}
