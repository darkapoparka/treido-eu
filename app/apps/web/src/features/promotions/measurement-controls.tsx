"use client";
import Link from "next/link";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccountPage } from "../account/forms";
import type {
  Language,
  MeasurementChoiceCommand,
  MeasurementChoiceView,
} from "./model";
import { parseMeasurementChoice } from "./model";
import {
  readPromotionMeasurementAction,
  changePromotionMeasurementAction,
} from "./measurement-actions";
import s from "./measurement.module.css";
export function MeasurementControls({
  initial,
  subject,
  language,
}: {
  initial: MeasurementChoiceView;
  subject: string;
  language: Language;
}) {
  const { isLoaded, isSignedIn, userId } = useAuth(),
    clerk = useClerk(),
    bg = language === "bg";
  const [view, setView] = useState(initial),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState<string | null>(null),
    [pending, setPending] = useState<MeasurementChoiceCommand | null>(null);
  const life = useRef({ mounted: false, sequence: 0, busy: false }),
    attempt = useRef<MeasurementChoiceCommand | null>(null);
  const key = "treido-promotion-measurement-pending-v1:" + initial.actorKey;
  const verifiedReady = ready && isLoaded && isSignedIn && userId === subject;
  const active = useCallback(
    () =>
      life.current.mounted &&
      clerk.user?.id === subject &&
      clerk.session?.status === "active",
    [clerk, subject],
  );
  const clear = useCallback(() => {
    attempt.current = null;
    setPending(null);
    try {
      sessionStorage.removeItem(key);
    } catch {}
  }, [key]);
  const refresh = useCallback(async () => {
    if (!active() || document.visibilityState !== "visible") return;
    const sessionId = clerk.session?.id,
      sequence = ++life.current.sequence;
    setReady(false);
    try {
      const result = await readPromotionMeasurementAction();
      if (
        !active() ||
        sessionId !== clerk.session?.id ||
        sequence !== life.current.sequence
      )
        return;
      if (
        !result.ok ||
        result.data.subject !== subject ||
        result.data.view.actorKey !== initial.actorKey
      ) {
        setMessage(
          bg
            ? "Достъпът не може да бъде проверен."
            : "Access could not be checked.",
        );
        if (
          !result.ok &&
          ["FORBIDDEN", "UNAUTHENTICATED", "NOT_FOUND"].includes(result.code)
        )
          clear();
        return;
      }
      // Current authority precedes restoration; unsaved in-memory recovery always wins.
      if (!attempt.current) {
        try {
          const saved = sessionStorage.getItem(key);
          if (saved && saved.length < 2048) {
            const restored = parseMeasurementChoice(JSON.parse(saved));
            if (restored.actorKey !== initial.actorKey) throw Error();
            attempt.current = restored;
            setPending(restored);
          }
        } catch {
          try {
            sessionStorage.removeItem(key);
          } catch {}
        }
      }
      setView(result.data.view);
      setReady(true);
    } catch {
      if (
        active() &&
        sessionId === clerk.session?.id &&
        sequence === life.current.sequence
      )
        setMessage(
          bg ? "Проверката не е достъпна." : "The check is unavailable.",
        );
    }
  }, [active, clerk, subject, initial.actorKey, key, bg, clear]);
  useEffect(() => {
    const current = life.current;
    current.mounted = true;
    let identity: string | null = null;
    const unsubscribe = clerk.addListener((resources) => {
      const next = [
        resources.user?.id ?? "",
        resources.session?.id ?? "",
        resources.session?.status ?? "",
      ].join(":");
      if (next === identity) return;
      identity = next;
      ++current.sequence;
      if (
        resources.user?.id !== subject ||
        resources.session?.status !== "active"
      ) {
        clear();
        setReady(false);
        setMessage(null);
      } else {
        void refresh();
      }
    });
    const hide = () => {
      ++current.sequence;
      setReady(false);
    };
    const show = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") hide();
      else show();
    };
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) show();
    };
    window.addEventListener("blur", hide);
    window.addEventListener("focus", show);
    window.addEventListener("pageshow", restore);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      current.mounted = false;
      ++current.sequence;
      unsubscribe();
      window.removeEventListener("blur", hide);
      window.removeEventListener("focus", show);
      window.removeEventListener("pageshow", restore);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [clerk, subject, clear, refresh]);
  const execute = async (command: MeasurementChoiceCommand) => {
    if (!active() || life.current.busy) return;
    const sessionId = clerk.session?.id;
    life.current.busy = true;
    setBusy(true);
    attempt.current = command;
    setPending(command);
    setMessage(null);
    try {
      sessionStorage.setItem(key, JSON.stringify(command));
    } catch {}
    try {
      const result = await changePromotionMeasurementAction(command);
      if (!active() || sessionId !== clerk.session?.id) return;
      if (!result.ok) {
        setMessage(
          result.code === "CONFLICT"
            ? bg
              ? "Изборът е променен. Обновете преди нов избор."
              : "Your choice changed. Refresh before choosing again."
            : bg
              ? "Резултатът не е потвърден. Проверете същата заявка."
              : "The result is unconfirmed. Check the same request.",
        );
        if (result.code !== "NOT_AVAILABLE") clear();
        if (["FORBIDDEN", "UNAUTHENTICATED", "NOT_FOUND"].includes(result.code))
          setReady(false);
        return;
      }
      if (result.data.subject !== subject) {
        clear();
        setReady(false);
        return;
      }
      clear();
      await refresh();
    } catch {
      if (active() && sessionId === clerk.session?.id)
        setMessage(
          bg
            ? "Резултатът е неизвестен. Повторете само същата заявка."
            : "The result is unknown. Retry only the same request.",
        );
    } finally {
      life.current.busy = false;
      if (life.current.mounted) setBusy(false);
    }
  };
  const choose = (allowed: boolean) => {
    if (view.policy && !busy && !pending && verifiedReady)
      void execute({
        actorKey: view.actorKey,
        policyId: view.policy.id,
        requestId: crypto.randomUUID(),
        expectedRevision: view.revision,
        allowed,
      });
  };
  return (
    <AccountPage
      title={
        bg ? "Поверителност при промотиране" : "Promotion measurement privacy"
      }
      dock={false}
    >
      <div className={s.content} lang={language}>
        <p>
          {bg
            ? "Отделен, незадължителен избор за измерване на спонсорирани карти. Входът, отварянето на страница, търсене, абонамент или покупка не означават съгласие."
            : "A separate optional choice for measuring sponsored cards. Signing in, opening a page, searching, subscribing or buying does not give consent."}
        </p>
        <p>
          {bg
            ? "visible-v1: поне 50% от картата за 1 непрекъсната секунда на видим екран; клик само към артикула. Не се съхранява история на купувачите в отчетите на продавача."
            : "visible-v1: at least 50% of the card for 1 continuous second in a foreground document; clicks only to the product. Seller reports do not retain buyer histories."}
        </p>
        {!verifiedReady ? (
          <p role="status">
            {bg
              ? "Проверка на текущия избор…"
              : "Checking your current choice…"}
          </p>
        ) : view.policy ? (
          <section>
            <p className={s.terms}>{view.policy.text[language]}</p>
            <p>
              {bg ? "Одобрен срок за събитията" : "Approved event retention"}:{" "}
              {view.policy.retentionDays} {bg ? "дни" : "days"}
            </p>
            <p role="status">
              {view.allowed
                ? bg
                  ? "Измерването е разрешено."
                  : "Measurement is enabled."
                : bg
                  ? "Измерването е изключено."
                  : "Measurement is off."}
            </p>
            <div className={s.controls}>
              <button
                disabled={busy || !!pending || view.allowed}
                onClick={() => choose(true)}
              >
                {bg
                  ? "Разреши отделно измерването"
                  : "Enable optional measurement"}
              </button>
              <button
                disabled={busy || !!pending || !view.allowed}
                onClick={() => choose(false)}
              >
                {bg ? "Оттегли разрешението" : "Withdraw permission"}
              </button>
            </div>
          </section>
        ) : (
          <p role="status">
            {bg
              ? "Няма текуща одобрена политика. Измерването не е достъпно и избор не се записва."
              : "No current approved policy is available. Measurement is unavailable and no choice is recorded."}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {verifiedReady && pending && (
          <div className={s.controls}>
            <button
              disabled={busy || !ready}
              onClick={() => void execute(pending)}
            >
              {bg
                ? "Провери същия първоначален избор"
                : "Check same original choice"}
            </button>
          </div>
        )}
        <div className={s.controls}>
          <button disabled={busy} onClick={() => void refresh()}>
            {bg ? "Обнови" : "Refresh"}
          </button>
          <Link href={`/account/privacy?lang=${language}`}>
            {bg ? "Към поверителност" : "Back to privacy"}
          </Link>
        </div>
      </div>
    </AccountPage>
  );
}
