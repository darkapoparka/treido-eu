"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";
import { readSellerSetupAction, saveSellerSetupAction } from "./setup-actions";
import {
  declarationSubmissionIssue,
  emptyDeclaration,
  type BusinessSetupView,
} from "./setup-model";
import { useUnsavedChanges } from "./use-unsaved-changes";
import styles from "./workspace.module.css";

export function BusinessSetupForm({
  initial,
  section,
  requestId,
  actorSubject,
  language,
}: {
  initial: BusinessSetupView;
  section: "details" | "declaration";
  requestId: string;
  actorSubject: string;
  language: "bg" | "en";
}) {
  const [profile, setProfile] = useState(initial.profile);
  const [declaration, setDeclaration] = useState(
    initial.declaration ?? emptyDeclaration,
  );
  const [revision, setRevision] = useState(initial.revision);
  const [saved, setSaved] = useState(
    JSON.stringify(
      section === "details"
        ? initial.profile
        : (initial.declaration ?? emptyDeclaration),
    ),
  );
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [latest, setLatest] = useState<BusinessSetupView | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [showRequired, setShowRequired] = useState(false);
  const attempt = useRef({ id: requestId, hash: "" });
  const active = useRef(true);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const clerk = useClerk();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const actorChanged = isLoaded && (!isSignedIn || userId !== actorSubject);
  const bg = language === "bg";
  const canWrite =
    section === "details" ? initial.canEditProfile : initial.canEditDeclaration;
  const payload = section === "details" ? profile : declaration;
  const dirty = JSON.stringify(payload) !== saved;
  useUnsavedChanges(dirty && !actorChanged && !blocked, language);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const stillHere = (entry: string) =>
    active.current &&
    clerk.user?.id === actorSubject &&
    location.pathname + location.search === entry;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !canWrite || actorChanged || blocked) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const submit =
      submitter instanceof HTMLButtonElement &&
      submitter.name === "submitDeclaration";
    const submissionIssue = submit
      ? declarationSubmissionIssue(declaration)
      : null;
    if (submissionIssue) {
      setShowRequired(true);
      setNotice("INVALID_INPUT");
      formRef.current
        ?.querySelector<HTMLInputElement>(`[name="${submissionIssue}"]`)
        ?.focus();
      return;
    }
    const entry = location.pathname + location.search;
    const hash = JSON.stringify({ payload, revision, submit });
    if (attempt.current.hash && attempt.current.hash !== hash)
      attempt.current.id = crypto.randomUUID();
    attempt.current.hash = hash;
    setPending(true);
    setNotice(null);
    try {
      const result = await saveSellerSetupAction({
        sellerId: initial.sellerId,
        expectedRevision: revision,
        requestId: attempt.current.id,
        section,
        submit,
        payload,
      });
      if (!stillHere(entry)) return;
      if (!result.ok) {
        setNotice(result.code);
        if (result.code === "FORBIDDEN" || result.code === "UNAUTHENTICATED")
          setBlocked(true);
        return;
      }
      setRevision(result.data.revision);
      setSaved(JSON.stringify(payload));
      setNotice("SAVED");
      setLatest(null);
      attempt.current = { id: crypto.randomUUID(), hash: "" };
      if (section === "details" || submit)
        router.push(
          `/app/sellers/${initial.sellerId}/onboarding?step=${result.data.step}&lang=${language}`,
        );
    } catch {
      if (stillHere(entry)) setNotice("NOT_AVAILABLE");
    } finally {
      if (active.current) setPending(false);
    }
  }
  async function compare() {
    if (pending) return;
    const entry = location.pathname + location.search;
    setPending(true);
    try {
      const result = await readSellerSetupAction(initial.sellerId);
      if (!stillHere(entry)) return;
      if (result.ok) setLatest(result.data);
      else {
        setNotice(result.code);
        if (result.code === "FORBIDDEN" || result.code === "UNAUTHENTICATED")
          setBlocked(true);
      }
    } catch {
      if (stillHere(entry)) setNotice("NOT_AVAILABLE");
    } finally {
      if (active.current) setPending(false);
    }
  }
  if (actorChanged || blocked)
    return (
      <section className="account-panel" role="status">
        <p>
          {bg
            ? "Този профил вече няма достъп до настройките. Влезте отново или изберете друг продавач."
            : "This account no longer has access to these settings. Sign in again or choose another seller."}
        </p>
        <Link href={`/app?lang=${language}`} className={styles.link}>
          {bg ? "Моите продажби" : "My selling"}
        </Link>
      </section>
    );
  if (!canWrite)
    return (
      <p role="status">
        {bg
          ? "Помолете собственик да попълни тази стъпка."
          : "Ask an owner to complete this step."}
      </p>
    );
  const messages: Record<string, [string, string]> = {
    SAVED: [
      "Saved to this business account.",
      "Запазено в този бизнес профил.",
    ],
    CONFLICT: [
      "Another version was saved. Your input is still here. Compare the saved version before making another change.",
      "Запазена е друга версия. Въведеното остава тук. Сравнете със запазената версия преди нова промяна.",
    ],
    INVALID_INPUT: [
      "Check the details. Submission requires every trader field and your confirmation.",
      "Проверете данните. За изпращане са нужни всички данни за търговец и вашето потвърждение.",
    ],
    NOT_AVAILABLE: [
      "The save could not be confirmed. Your input is still here; retry with the same details.",
      "Запазването не е потвърдено. Въведеното остава тук; опитайте отново със същите данни.",
    ],
  };
  const changeDeclaration = (
    field: keyof typeof declaration,
    value: string | boolean,
  ) => {
    setDeclaration((previous) => ({ ...previous, [field]: value }));
    setNotice(null);
  };
  return (
    <>
      <p className="form-note">
        {section === "details"
          ? bg
            ? "Името, описанието и населеното място са данни за публичния профил. Може да започнете артикул преди да завършите настройките."
            : "Name, description and locality are public profile details. You can start an item before completing setup."
          : bg
            ? "Тези данни са за проверката на търговеца. Тук няма качване на документи или банкови данни. Незапазеното остава само на тази страница."
            : "These details are for trader review. No documents or bank details are collected here. Unsaved input stays on this page."}
      </p>
      <form
        ref={formRef}
        onSubmit={save}
        className={`account-form ${styles.form}`}
      >
        <fieldset disabled={pending} className={styles.form}>
          {section === "details" ? (
            <>
              <label className="form-field">
                {bg ? "Име на бизнеса" : "Business name"}
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="organization"
                  value={profile.name}
                  onChange={(event) => {
                    setProfile({ ...profile, name: event.target.value });
                    setNotice(null);
                  }}
                />
              </label>
              <label className="form-field">
                {bg ? "Описание · по избор" : "Description · optional"}
                <textarea
                  name="description"
                  rows={4}
                  maxLength={1200}
                  value={profile.description}
                  onChange={(event) => {
                    setProfile({ ...profile, description: event.target.value });
                    setNotice(null);
                  }}
                />
              </label>
              <label className="form-field">
                {bg ? "Населено място · по избор" : "Locality · optional"}
                <input
                  name="locality"
                  maxLength={100}
                  autoComplete="address-level2"
                  value={profile.locality}
                  onChange={(event) => {
                    setProfile({ ...profile, locality: event.target.value });
                    setNotice(null);
                  }}
                />
              </label>
            </>
          ) : (
            <>
              <label className="form-field">
                {bg ? "Държава" : "Country"}
                <select name="country" value="BG" disabled>
                  <option value="BG">{bg ? "България" : "Bulgaria"}</option>
                </select>
              </label>
              {(
                [
                  [
                    "legalName",
                    bg ? "Юридическо име" : "Legal name",
                    160,
                    "organization",
                  ],
                  [
                    "registrationNumber",
                    bg
                      ? "ЕИК / регистрационен номер"
                      : "Business registration number",
                    40,
                    "off",
                  ],
                  [
                    "contactEmail",
                    bg ? "Имейл за контакт" : "Contact email",
                    254,
                    "email",
                  ],
                  [
                    "contactAddress",
                    bg ? "Адрес за контакт" : "Contact address",
                    500,
                    "street-address",
                  ],
                ] as const
              ).map(([field, label, maximum, autocomplete]) => (
                <label className="form-field" key={field}>
                  {label}
                  <input
                    name={field}
                    type={field === "contactEmail" ? "email" : "text"}
                    maxLength={maximum}
                    autoComplete={autocomplete}
                    aria-invalid={
                      showRequired &&
                      (!declaration[field].trim() ||
                        declarationSubmissionIssue(declaration) === field)
                    }
                    value={declaration[field]}
                    onChange={(event) =>
                      changeDeclaration(field, event.target.value)
                    }
                  />
                </label>
              ))}
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  name="accurate"
                  aria-invalid={showRequired && !declaration.accurate}
                  checked={declaration.accurate}
                  onChange={(event) =>
                    changeDeclaration("accurate", event.target.checked)
                  }
                />
                <span>
                  {bg
                    ? "Продавам като търговец и потвърждавам, че предоставените данни са точни."
                    : "I sell as a trader and confirm that these details are accurate."}
                </span>
              </label>
              <p className="form-note">
                {bg
                  ? "Изпращането заявява проверка. То не е потвърдена верификация или разрешение за публикуване."
                  : "Submitting requests review. It does not confirm verification or permission to publish."}
              </p>
            </>
          )}
          <div className={styles.actions}>
            <button className={styles.button} type="submit">
              {pending
                ? bg
                  ? "Запазване…"
                  : "Saving…"
                : section === "details"
                  ? bg
                    ? "Запази и продължи"
                    : "Save and continue"
                  : bg
                    ? "Запази за по-късно"
                    : "Save for later"}
            </button>
            {section === "declaration" && (
              <button
                type="submit"
                name="submitDeclaration"
                className={styles.link}
              >
                {bg ? "Изпрати за проверка" : "Submit for review"}
              </button>
            )}
          </div>
        </fieldset>
      </form>
      <p
        className={notice && notice !== "SAVED" ? "form-error" : styles.status}
        role={notice && notice !== "SAVED" ? "alert" : "status"}
      >
        {notice
          ? (messages[notice] ?? messages.NOT_AVAILABLE)[bg ? 1 : 0]
          : revision > 0
            ? bg
              ? `Запазена версия ${revision}`
              : `Saved revision ${revision}`
            : ""}
      </p>
      {notice === "CONFLICT" && (
        <button
          type="button"
          className={styles.link}
          disabled={pending}
          onClick={compare}
        >
          {bg ? "Сравни със запазеното" : "Compare saved version"}
        </button>
      )}
      {latest && (
        <section
          className="account-panel"
          aria-label={bg ? "Запазена версия" : "Saved version"}
        >
          <h2>
            {bg
              ? `Запазена версия ${latest.revision}`
              : `Saved revision ${latest.revision}`}
          </h2>
          <dl className={styles.summary}>
            {Object.entries(
              section === "details"
                ? latest.profile
                : (latest.declaration ?? {}),
            )
              .filter(([field]) => !["accurate", "country"].includes(field))
              .map(([field, value]) => (
                <div key={field}>
                  <dt>
                    {
                      (
                        {
                          name: bg ? "Име" : "Name",
                          description: bg ? "Описание" : "Description",
                          locality: bg ? "Място" : "Locality",
                          legalName: bg ? "Юридическо име" : "Legal name",
                          registrationNumber: bg
                            ? "Регистрационен номер"
                            : "Registration number",
                          contactEmail: bg ? "Имейл" : "Email",
                          contactAddress: bg ? "Адрес" : "Address",
                        } as Record<string, string>
                      )[field]
                    }
                  </dt>
                  <dd>{String(value) || "—"}</dd>
                </div>
              ))}
          </dl>
          <p>
            {bg
              ? "Вашето въведено остава във формата. Зареждането на запазеното ще го замени."
              : "Your input remains in the form. Loading the saved version will replace it."}
          </p>
          <button
            type="button"
            className={styles.link}
            onClick={() => {
              setProfile(latest.profile);
              setDeclaration(latest.declaration ?? emptyDeclaration);
              setRevision(latest.revision);
              setSaved(
                JSON.stringify(
                  section === "details"
                    ? latest.profile
                    : (latest.declaration ?? emptyDeclaration),
                ),
              );
              setLatest(null);
              setNotice(null);
              attempt.current = { id: crypto.randomUUID(), hash: "" };
            }}
          >
            {bg ? "Зареди запазеното" : "Load saved version"}
          </button>
        </section>
      )}
    </>
  );
}
