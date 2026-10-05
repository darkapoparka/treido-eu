"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { CSV_LIMITS, CsvError } from "../catalogue-import/csv";
import {
  inspectSellerCsv,
  sellerCsvIssueReport,
  type PreflightResult,
} from "./preflight";
import { preflightCopy } from "./preflight-copy";
import s from "./preflight.module.css";
import form from "../selling/selling.module.css";
type Failure = keyof typeof preflightCopy.en.errors;
const PAGE = 25;
export function SellerCsvPreflight({ language }: { language: "bg" | "en" }) {
  const t = preflightCopy[language];
  const sequence = useRef(0),
    input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<PreflightResult | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false),
    [page, setPage] = useState(0);
  useEffect(
    () => () => {
      sequence.current += 1;
    },
    [],
  );
  function clear() {
    sequence.current += 1;
    setResult(null);
    setName("");
    setError(null);
    setBusy(false);
    setPage(0);
    if (input.current) {
      input.current.value = "";
      input.current.focus();
    }
  }
  async function inspect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    const request = ++sequence.current;
    setResult(null);
    setError(null);
    setPage(0);
    setName(file?.name.slice(0, 180) ?? "");
    if (!file) {
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      if (file.size > CSV_LIMITS.bytes) throw new CsvError("file_too_large");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (request !== sequence.current) return;
      const checked = inspectSellerCsv(bytes);
      if (request === sequence.current) setResult(checked);
    } catch (cause) {
      if (request === sequence.current)
        setError(cause instanceof CsvError ? cause.code : "unavailable");
    } finally {
      if (request === sequence.current) setBusy(false);
    }
  }
  function report() {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([sellerCsvIssueReport(result)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "treido-import-issues.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section
      className={s.root}
      aria-labelledby="seller-preflight-title"
      data-seller-csv-preflight
    >
      <h2 id="seller-preflight-title">{t.title}</h2>
      <p id="seller-preflight-privacy">{t.intro}</p>
      <label htmlFor="seller-preflight-file">{t.choose}</label>
      <input
        ref={input}
        id="seller-preflight-file"
        type="file"
        accept=".csv,text/csv"
        onChange={inspect}
        aria-describedby="seller-preflight-privacy seller-preflight-limits"
      />
      <p id="seller-preflight-limits" className={s.caption}>
        {t.limits}
      </p>
      <p role="status" aria-live="polite">
        {busy
          ? t.checking
          : result
            ? t.summary(result.rows.length, result.valid)
            : ""}
      </p>
      {error && <p role="alert">{t.errors[error]}</p>}
      {name && (
        <div className={s.actions}>
          <span>{name}</span>
          <button type="button" className={form.textButton} onClick={clear}>
            {t.clear}
          </button>
        </div>
      )}
      {result && (
        <>
          <ol className={s.rows} start={page * PAGE + 1} aria-label={t.issues}>
            {result.rows.slice(page * PAGE, (page + 1) * PAGE).map((row) => (
              <li key={row.number}>
                <h3>
                  {t.row} {row.number}: {row.raw.title || t.missing}
                </h3>
                {row.errors.length ? (
                  <ul>
                    {row.errors.map((issue, i) => (
                      <li key={issue.field + ":" + i}>
                        <code>{issue.field}</code>: {t.codes[issue.code]}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{t.valid}</p>
                )}
              </li>
            ))}
          </ol>
          <p>
            {t.page(
              page * PAGE + 1,
              Math.min((page + 1) * PAGE, result.rows.length),
              result.rows.length,
            )}
          </p>
          <div className={s.actions}>
            <button
              type="button"
              className={form.textButton}
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              {t.previous}
            </button>
            <button
              type="button"
              className={form.textButton}
              disabled={(page + 1) * PAGE >= result.rows.length}
              onClick={() => setPage((p) => p + 1)}
            >
              {t.next}
            </button>
            {result.invalid > 0 && (
              <button
                type="button"
                className={form.textButton}
                onClick={report}
              >
                {t.report}
              </button>
            )}
          </div>
          <p>{t.note}</p>
          <div className={s.actions}>
            <Link className={form.textButton} href={"/app?lang=" + language}>
              {t.continue}
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
