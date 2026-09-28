"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Sheet } from "./components";
import { Icon } from "./icons";
import { useSheetStages } from "./sheet-stages";

export { ReviewStars } from "./rating-stars";

function measureReview(element: HTMLParagraphElement, body: string) {
  const style = getComputedStyle(element);
  const lines = Number.parseInt(style.webkitLineClamp, 10);
  const lineHeight = Number.parseFloat(style.lineHeight);
  const clone = element.cloneNode(false) as HTMLParagraphElement;
  clone.removeAttribute("id");
  clone.setAttribute("aria-hidden", "true");
  clone.textContent = body;
  Object.assign(clone.style, {
    position: "absolute",
    visibility: "hidden",
    pointerEvents: "none",
    width: `${element.getBoundingClientRect().width}px`,
    display: "block",
    height: "auto",
    maxHeight: "none",
    webkitLineClamp: "unset",
  });
  element.after(clone);
  try {
    const overflows = clone.scrollHeight > element.clientHeight + 1;
    let split: [number, number] | null = null;
    if (overflows && lines > 0 && lineHeight > 0 && clone.firstChild) {
      const range = document.createRange();
      let firstLine: number | undefined;
      for (const word of body.matchAll(/\S+/gu)) {
        range.setStart(clone.firstChild, word.index);
        range.setEnd(clone.firstChild, word.index + 1);
        const top = range.getBoundingClientRect().top;
        firstLine ??= top;
        if (top - firstLine >= lines * lineHeight - 1) {
          split = [word.index, word.index + word[0].length];
          break;
        }
      }
    }
    return { overflows, split };
  } finally {
    clone.remove();
  }
}

// Whether a review needs expansion depends on rendered lines, not character
// count. Keep its paragraph mounted while measuring and opening other sheets.
export function ReviewBody({
  body,
  expanded,
  onToggle,
}: {
  body: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [overflows, setOverflows] = useState(false);
  const [breakWord, setBreakWord] = useState<{
    body: string;
    range: [number, number] | null;
  }>({ body, range: null });
  const ref = useRef<HTMLParagraphElement>(null);
  const id = useId();
  useEffect(() => {
    const element = ref.current;
    if (!element || expanded) return;
    let active = true;
    const measure = () => {
      if (!active) return;
      const { overflows, split } = measureReview(element, body);
      setOverflows(overflows);
      setBreakWord((previous) =>
        previous.body === body &&
        previous.range?.[0] === split?.[0] &&
        previous.range?.[1] === split?.[1]
          ? previous
          : { body, range: split },
      );
    };
    const frame = requestAnimationFrame(measure);
    // A clamped paragraph can keep the same box height while font metrics alter
    // its hidden lines. ResizeObserver alone does not cover that transition.
    void document.fonts.ready.then(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [body, expanded]);
  if (!body) return null;
  const split = !expanded && breakWord.body === body ? breakWord.range : null;
  return (
    <>
      <p ref={ref} id={id} className={expanded ? "" : "review-truncated"}>
        {split ? (
          <>
            {body.slice(0, split[0])}
            {/* Only the final overflowing word may break within a word, as in
                the native capture. Earlier wrapping and copied text stay intact. */}
            <span style={{ wordBreak: "break-all" }}>
              {body.slice(split[0], split[1])}
            </span>
            {body.slice(split[1])}
          </>
        ) : (
          body
        )}
      </p>
      {(expanded || overflows) && (
        <button
          className="read-more"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={onToggle}
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
    </>
  );
}

export function ReviewHelpful({
  selected,
  onToggle,
  disabled = false,
}: {
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`review-helpful ${selected ? "helpful-selected" : ""}`}
      aria-label={selected ? "Helpful (1) ✓" : "Helpful"}
      aria-pressed={selected}
      title="Helpful selection is local to this reference preview"
      disabled={disabled}
      onClick={onToggle}
    >
      <Icon name="thumb-up" /> Helpful
      {selected && <b className="helpful-count">1</b>}
    </button>
  );
}

// Frozen flow fae1016a-facb-4633-b62b-7ddd809e0fac, frames 002–006.
// The confirmation deliberately does not repeat the source's service promise.
const reportReasons = [
  [
    "It’s bullying or harassment",
    "It attacks an individual or a group of people.",
  ],
  [
    "It’s a conflict of interest",
    "It’s from someone affiliated with the Shop Store or a competitor’s store.",
  ],
  [
    "It’s offensive",
    "It contains inappropriate, sexually explicit, or violent content.",
  ],
  [
    "It’s fraud or scam",
    "It has allegations about improper store or buyer behavior.",
  ],
  [
    "It’s hate speech",
    "It contains harmful content based on an individual or group identity.",
  ],
  [
    "It’s about illegal activities or regulated goods",
    "It references items that go against Shop Merchant Guidelines.",
  ],
  [
    "It’s an intellectual property infringement",
    "It violates intellectual property laws.",
  ],
  [
    "It’s personal information",
    "It contains information that could identify the reviewer e.g. email, phone number, or credit card details.",
  ],
  ["It’s spam", "It contains ads or promotional content."],
] as const;

export function ReviewReport({
  open,
  onClose,
  onReopen,
  onReport,
}: {
  open: boolean;
  onClose: () => void;
  onReopen: () => void;
  onReport: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const flow = useSheetStages<"menu" | "reasons" | "thanks">({
    open,
    initial: "menu",
    onClose,
    onReopen,
    onStart: () => setReason(""),
  });
  const stage = flow.stage;
  const group = useId();
  const reasonRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const entryRef = useRef<HTMLButtonElement>(null);
  const previousStage = useRef(stage);
  useEffect(() => {
    if (!open) return;
    if (stage === "menu" && previousStage.current !== "menu")
      entryRef.current?.focus({ preventScroll: true });
    if (stage === "reasons") reasonRef.current?.focus({ preventScroll: true });
    if (stage === "thanks") closeRef.current?.focus({ preventScroll: true });
    previousStage.current = stage;
  }, [open, stage]);
  const title =
    stage === "menu"
      ? "More options"
      : stage === "reasons"
        ? "Why are you reporting this review?"
        : "Thanks for reporting";
  return (
    <Sheet
      open={open}
      title={title}
      onClose={() => flow.close()}
      manageHistory={false}
      headerless={stage !== "menu"}
      className={`review-report-${stage}`}
    >
      {stage === "menu" ? (
        <button
          ref={entryRef}
          className="review-report-entry danger-text"
          onClick={() => flow.navigate("reasons")}
        >
          <Icon name="alert" /> Report this review
        </button>
      ) : stage === "reasons" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!reason) return;
            onReport(reason);
            flow.navigate("thanks");
          }}
        >
          {/* Sheet already supplies the accessible heading in headerless mode. */}
          <p className="review-report-title" aria-hidden="true">
            {title}
          </p>
          <p className="review-report-subtitle">
            This won’t be shared with the reviewer or the store.
          </p>
          <fieldset className="review-reason-options">
            <legend className="sr-only">
              Choose a reason for reporting this review
            </legend>
            {reportReasons.map(([label, description], index) => (
              <label key={label}>
                <span>
                  <strong>{label}</strong>
                  <small id={`${group}-${index}`}>{description}</small>
                </span>
                <input
                  ref={
                    reason === label || (!reason && index === 0)
                      ? reasonRef
                      : undefined
                  }
                  type="radio"
                  name={group}
                  value={label}
                  aria-label={label}
                  checked={reason === label}
                  aria-describedby={`${group}-${index}`}
                  onChange={() => setReason(label)}
                />
              </label>
            ))}
          </fieldset>
          <div className="sheet-actions">
            <button type="button" className="pill" onClick={() => flow.close()}>
              Cancel
            </button>
            <button
              type="submit"
              className="primary"
              disabled={!reason}
              title="Local preview only; no report will be sent"
            >
              Report
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="review-report-title" aria-hidden="true">
            {title}
          </p>
          <p className="review-report-confirmation" role="status">
            Your selection is marked in this browser preview only. No report was
            sent to the reviewer, store or moderation service. Moderation is
            unavailable in this preview; the marked review is a local example.
          </p>
          <button
            ref={closeRef}
            type="button"
            className="review-report-close"
            onClick={() => flow.close()}
          >
            Close
          </button>
        </>
      )}
    </Sheet>
  );
}
