"use client";
/* eslint-disable @next/next/no-img-element -- Allowlisted product artwork only. */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Catalog } from "../catalog/types";
import {
  consumeSheetHistory,
  IconButton,
  ProductCard,
  Sheet,
} from "./components";
import { Icon } from "./icons";
import { MiniAccess, MiniShell } from "./mini-frame";
import { sourceReturnState } from "./return-navigation";
import { SavedCard } from "./saved-card";
import styles from "./sol.module.css";
import { useReducedMotion } from "./motion-preference";
import { DecorativeVideo } from "./decorative-video";
import { solRightMask } from "./sol-decoration-mask";

const phases = [
  "welcome",
  "connecting",
  "ready",
  "greeting",
  "response",
  "choices",
  "selected",
  "results",
] as const;
type Phase = (typeof phases)[number];
const choices = {
  glasses: [
    ["gold", "sol-glasses-model", "Gold rimless glasses"],
    ["dark", "sol-glasses-dark", "Dark sunglasses"],
  ],
  caps: [
    ["tan", "sol-tan-cap", "Tan embroidered cap"],
    ["boston", "sol-boston-cap", "Boston baseball cap"],
  ],
} as const;

export function Sol({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
  const params = useSearchParams();
  const query = params.toString();
  const requested = params.get("sol") as Phase;
  const topic = params.get("topic") === "caps" ? "caps" : "glasses";
  const choice = choices[topic].find(([id]) => id === params.get("choice"));
  const rawPhase = phases.includes(requested) ? requested : "welcome";
  // An uncaptured cap/dark-glasses result must not silently become the gold
  // glasses recording. Invalid/deep-linked combinations return to their choices.
  const phase =
    rawPhase === "results" && (topic !== "glasses" || choice?.[0] !== "gold")
      ? "choices"
      : rawPhase === "selected" && !choice
        ? "choices"
        : rawPhase;
  const typing = params.get("mode") === "text";
  const muted = params.get("muted") === "1";
  const reducedMotion = useReducedMotion();
  const motion = !reducedMotion && params.get("reference") !== "captured";
  const [access, setAccess] = useState(() => rawPhase === "welcome");
  const [permission, setPermission] = useState(false);
  const [menu, setMenu] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const chosenResult = useRef(false);
  const change = useCallback(
    (
      next: Record<string, string | null>,
      replace = false,
      nextDraft?: string,
    ) => {
      const search = new URLSearchParams(query);
      for (const [key, value] of Object.entries(next)) {
        if (value === null) search.delete(key);
        else search.set(key, value);
      }
      const url = `/minis/sol${search.size ? `?${search}` : ""}`;
      const consume = consumeSheetHistory();
      // Next's public History API synchronizes useSearchParams without fetching
      // another page. Never copy reserved router flags into this query write.
      const historyState = sourceReturnState(
        { solDraft: nextDraft ?? window.history.state?.solDraft ?? "" },
        consume || !replace,
      );
      if (replace || consume)
        window.history.replaceState(historyState, "", url);
      else window.history.pushState(historyState, "", url);
    },
    [query],
  );
  useEffect(() => {
    if (phase !== "selected" && phase !== "results") {
      chosenResult.current = false;
      return;
    }
    if (phase !== "results" || !chosenResult.current) return;
    chosenResult.current = false;
    // A chosen tile disappears at results. Do not interrupt a shopper who
    // has moved to the message editor (or another surviving control).
    if (document.activeElement === document.body)
      heading.current?.focus({ preventScroll: true });
  }, [phase]);
  useEffect(() => {
    const restore = (state: unknown) => {
      const value = (state as { solDraft?: unknown } | null)?.solDraft;
      setDraft(typeof value === "string" ? value : "");
    };
    restore(window.history.state);
    const onBack = (event: PopStateEvent) => {
      restore(event.state);
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, []);
  useEffect(() => {
    if (!typing) return;
    const frame = requestAnimationFrame(() => {
      if (!document.querySelector("dialog[open]"))
        input.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [typing]);
  useEffect(() => {
    let next: Phase | undefined;
    let delay = 2400;
    if (phase === "connecting") next = motion ? "ready" : "greeting";
    if (phase === "ready") {
      next = "greeting";
      delay = motion ? 500 : 0;
    }
    if (phase === "response") next = "choices";
    if (phase === "response" && motion) delay = 750;
    if (phase === "selected" && topic === "glasses" && choice?.[0] === "gold")
      next = "results";
    if (!next) return;
    // Local playback only. This delay is a deterministic preview interval, not
    // asserted provider latency. Cleanup cancels it on Back, restart or exit.
    const timer = window.setTimeout(() => change({ sol: next }, true), delay);
    return () => window.clearTimeout(timer);
  }, [phase, topic, choice, change, motion]);

  const greeting = typing
    ? "Hey Alex, I am Sol. What are we hunting for today?"
    : muted
      ? "Hey Alex, I’m Sol. What are we hunting for today?"
      : "Hey, I am Sol. What are we hunting for today, Alex?";
  const title =
    phase === "greeting"
      ? greeting
      : phase === "response"
        ? "Nice, sunglasses are a fun pick."
        : phase === "choices"
          ? topic === "glasses"
            ? "Pick the pair that feels more you, then we will line up more in that vibe."
            : "Tap your pick and we will build from it."
          : phase === "selected"
            ? "Nice choice, let’s lean into that style and pull a few similar options."
            : "";
  const artworkVariant = access ? "loading" : permission ? "permission" : "";
  const artworkPrefix = artworkVariant ? `${artworkVariant}-` : "";
  const gold = catalog.products.find((product) => product.id === "u-see-me");
  const hush = catalog.savedListings?.find(
    (product) => product.id === "hush-glasses",
  );
  function submit() {
    const value = draft.trim();
    if (!value) return;
    if (/\b(cap|caps|hat|hats)\b/i.test(value))
      change({ sol: "choices", topic: "caps", choice: null }, false, "");
    else if (/\b(sunglasses|glasses)\b/i.test(value))
      change({ sol: "response", topic: "glasses", choice: null }, false, "");
    else {
      setUnsupported(true);
      return;
    }
    setDraft("");
    heading.current?.focus({ preventScroll: true });
  }
  return (
    <MiniShell
      name="Sol: Browse by Voice"
      showBack={phase !== "welcome"}
      onBack={() => router.back()}
      onMenu={() => setMenu(true)}
    >
      {phase === "welcome" ? (
        <section className={`sol-welcome ${styles.welcome}`}>
          <img
            className={`sol-welcome-art ${artworkVariant ? styles.sourceDimmedArtwork : ""}`}
            src={`/api/reference-media/sol-welcome-${artworkPrefix}art`}
            alt=""
          />
          {["lower-left", "lower-right"].map((position) => (
            <img
              key={position}
              className={`sol-decoration sol-decoration-${position} ${artworkVariant ? styles.sourceDimmedArtwork : ""}`}
              src={`/api/reference-media/sol-welcome-${artworkPrefix}${position}`}
              alt=""
            />
          ))}
          <DecorativeVideo
            enabled={motion && !artworkVariant}
            clips={[
              { key: "sol-welcome-motion", className: styles.welcomeVideo },
              {
                key: "sol-welcome-lower-left-motion",
                className: styles.welcomeLeftVideo,
              },
              {
                key: "sol-welcome-lower-right-motion",
                className: styles.welcomeRightVideo,
                mask: solRightMask,
              },
            ]}
          />
          <h1>Hi, I’m Sol</h1>
          <p>
            Shop with your voice. Just tell
            <br />
            Sol what you’re looking for.
          </p>
          <div>
            <h2>
              Sol needs microphone access
              <br />
              to hear you speak.
            </h2>
            <button onClick={() => setPermission(true)}>
              Allow & Continue ›
            </button>
          </div>
        </section>
      ) : (
        <section
          className={`sol-surface ${styles.surface} ${motion ? styles.phaseMotion : ""}`}
          data-sol-phase={phase}
          data-sol-mode={typing ? "text" : "voice"}
          data-sol-topic={topic}
        >
          <img
            className={`sol-mark ${styles.mark}`}
            src="/api/reference-media/sol-flower"
            alt="Sol"
          />
          <DecorativeVideo
            enabled={motion && phase === "connecting"}
            clips={[
              {
                key: "sol-connecting-motion",
                className: styles.connectingVideo,
              },
            ]}
          />
          {phase === "connecting" || phase === "ready" ? (
            <p
              className={styles.connecting}
              role="status"
              aria-label={phase === "ready" ? "Almost ready" : "Connecting"}
            >
              {phase === "ready" ? "Almost ready" : "Connecting"}{" "}
              <span aria-hidden="true">•••</span>
            </p>
          ) : (
            <div className={`sol-conversation ${styles.conversation}`}>
              <h1
                ref={heading}
                tabIndex={-1}
                aria-label={
                  phase === "choices" && motion && topic === "glasses"
                    ? title
                    : undefined
                }
              >
                {phase === "results" ? (
                  <>
                    <span className={styles.spoken}>
                      a slim profile first. Flip through and see
                    </span>{" "}
                    which one feels the easiest to wear every day.
                  </>
                ) : phase === "choices" && motion && topic === "glasses" ? (
                  <span className={styles.promptTransition} aria-hidden="true">
                    <span className={styles.choiceLead}>
                      Nice, sunglasses are a fun pick.
                    </span>
                    <span className={styles.choicePrompt}>
                      {title.split(" ").map((word, index) => (
                        <span
                          key={`${word}-${index}`}
                          style={
                            {
                              "--word-delay": `${1000 + index * 30}ms`,
                            } as CSSProperties
                          }
                        >
                          {word}{" "}
                        </span>
                      ))}
                    </span>
                  </span>
                ) : (
                  title
                )}
              </h1>
              {phase === "choices" && <p className={styles.tap}>Tap one</p>}
              {(phase === "choices" || phase === "selected") && (
                <div className={`sol-picks ${styles.picks}`}>
                  {(phase === "selected" && choice
                    ? [choice]
                    : choices[topic]
                  ).map(([id, artwork, label]) => (
                    <button
                      key={id}
                      aria-label={label}
                      aria-pressed={phase === "selected" && choice?.[0] === id}
                      onClick={() => {
                        chosenResult.current =
                          topic === "glasses" && id === "gold";
                        change({ sol: "selected", choice: id });
                      }}
                    >
                      <img src={`/api/reference-media/${artwork}`} alt="" />
                    </button>
                  ))}
                </div>
              )}
              {phase === "selected" && choice?.[0] !== "gold" && (
                <div className={styles.continuation} role="status">
                  <p>
                    {choice?.[2]} selected. Further recommendations for this
                    choice were not included in the recording.
                  </p>
                  <button
                    onClick={() => change({ sol: "choices", choice: null })}
                  >
                    Choose another
                  </button>
                </div>
              )}
              {phase === "results" && (
                <div
                  className={`product-rail sol-product-results ${styles.results}`}
                  role="region"
                  aria-label="Captured sunglasses recommendations"
                  tabIndex={0}
                >
                  {gold && (
                    <ProductCard
                      product={gold}
                      ratingStyle="summary"
                      storeName="AKIRA"
                    />
                  )}
                  {hush && (
                    <div className={styles.partialResult}>
                      <SavedCard
                        product={{
                          ...hush,
                          images: ["/api/reference-media/sol-hush-partial"],
                        }}
                        seller="FORK Eyewear"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <form
            className={`sol-controls ${styles.controls} ${typing ? styles.typing : ""} ${muted ? styles.muted : ""}`}
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            {typing ? (
              <div className={styles.composer}>
                <input
                  ref={input}
                  aria-label="Message Sol"
                  placeholder="Tap to type..."
                  value={draft}
                  maxLength={500}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    // Keep the actual draft on its own history entry, so browser
                    // Back from a reply restores what the shopper typed.
                    window.history.replaceState(
                      { ...window.history.state, solDraft: event.target.value },
                      "",
                    );
                  }}
                />
                {draft.trim() ? (
                  <button type="submit" aria-label="Send local message">
                    <Icon name="arrow" />
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="Return to voice controls"
                    onClick={() => change({ mode: null })}
                  >
                    <Icon name="back" />
                  </button>
                )}
              </div>
            ) : (
              <IconButton
                icon="type-input"
                label="Type instead"
                disabled={phase === "connecting" || phase === "ready"}
                onClick={() => change({ mode: "text" })}
              />
            )}
            <IconButton
              icon={muted ? "mic-off" : "mic"}
              label={
                muted ? "Unmute microphone preview" : "Mute microphone preview"
              }
              pressed={muted}
              filled={false}
              disabled={phase === "connecting" || phase === "ready"}
              onClick={() => change({ muted: muted ? null : "1" }, true)}
            />
          </form>
        </section>
      )}
      <MiniAccess
        open={access}
        name="Sol: Browse by Voice"
        className={styles.access}
        accessDescription="This local preview does not share your profile with Sol: Browse by Voice and does not let it update your saved products."
        profileImageSrc="/api/reference-media/auth-reference-avatar"
        onClose={() => setAccess(false)}
        onContinue={() => setAccess(false)}
      />
      <Sheet
        open={permission}
        title="Allow access to your microphone?"
        headerless
        className={`mini-access ${styles.permission}`}
        onClose={() => setPermission(false)}
      >
        <div className="mini-access-heading">
          <h2 aria-hidden="true">Allow access to your microphone?</h2>
          <div className={styles.permissionMark} aria-hidden="true">
            <img
              className={styles.permissionIcon}
              src="/api/reference-media/mini-sol-icon"
              alt=""
            />
            <img
              className={styles.permissionAvatar}
              src="/api/reference-media/auth-reference-avatar"
              alt=""
            />
          </div>
        </div>
        <p role="note">
          This local preview does not request microphone access or send audio.
        </p>
        <div className={styles.permissionActions}>
          <button onClick={() => setPermission(false)}>Cancel</button>
          <button
            onClick={() => {
              change(
                {
                  sol: "connecting",
                  mode: null,
                  topic: null,
                  choice: null,
                },
                false,
                "",
              );
              setPermission(false);
            }}
          >
            Share
          </button>
        </div>
      </Sheet>
      <Sheet
        open={menu}
        title="Sol preview controls"
        onClose={() => setMenu(false)}
      >
        <p className="sheet-copy">
          These are recorded examples, not a live assistant. No audio is
          captured or sent. Type a sunglasses or baseball-cap query, or replay
          the recorded voice example.
        </p>
        <div className={styles.menu}>
          <button
            className="primary"
            onClick={() => {
              change(
                {
                  sol: "response",
                  topic: "glasses",
                  choice: null,
                  mode: null,
                },
                false,
                "",
              );
              setMenu(false);
              setDraft("");
            }}
          >
            Use captured sunglasses voice example
          </button>
          <button
            className="pill"
            onClick={() => {
              change({
                sol: "greeting",
                mode: "text",
                topic: null,
                choice: null,
              });
              setMenu(false);
            }}
          >
            Continue with text
          </button>
          <button
            className="pill"
            onClick={() => {
              change(
                {
                  sol: null,
                  mode: null,
                  topic: null,
                  choice: null,
                  muted: null,
                },
                false,
                "",
              );
              setDraft("");
              setMenu(false);
            }}
          >
            Restart Sol preview
          </button>
        </div>
      </Sheet>
      <Sheet
        open={unsupported}
        title="Recorded responses"
        onClose={() => setUnsupported(false)}
      >
        <p className="sheet-copy">
          This recording contains sunglasses and baseball-cap examples, not a
          live answer to every query. Your message has not been sent anywhere.
        </p>
        <button
          className="primary form-submit"
          onClick={() => setUnsupported(false)}
        >
          Return to my draft
        </button>
      </Sheet>
    </MiniShell>
  );
}
