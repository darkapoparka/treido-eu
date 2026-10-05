"use client";
import { importMessageKey } from "./copy";
import { useEffect, useRef, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { CSV_LIMITS } from "./csv";
import {
  createImportUploadAction,
  appendImportChunkAction,
  finishImportUploadAction,
  readCatalogueImportAction,
} from "./actions";
import type { ImportView } from "./model";
import { downloadTemplate, downloadCategoryGuide } from "./download";
import a from "../sellers/admin.module.css";
import f from "../sellers/admin-editor.module.css";
import s from "./import.module.css";
function encode(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 2048)
    text += String.fromCharCode(...bytes.subarray(i, i + 2048));
  return btoa(text);
}
export function ImportUpload({
  sellerId,
  actorSubject,
  resume,
}: {
  sellerId: string;
  actorSubject: string;
  resume?: ImportView;
}) {
  const t = useTranslations("catalogueImport"),
    locale = useLocale(),
    router = useRouter(),
    clerk = useClerk();
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState<string | null>(null);
  const attempt = useRef<{
      fingerprint: string;
      requestId: string;
      id?: string;
    } | null>(null),
    life = useRef({ live: true, epoch: 0 }),
    working = useRef(false);
  useEffect(() => {
    const current = life.current;
    current.live = true;
    return () => {
      current.live = false;
      ++current.epoch;
    };
  }, []);
  async function upload() {
    if (!file || working.current || clerk.user?.id !== actorSubject) return;
    working.current = true;
    setBusy(true);
    setError(null);
    const ticket = ++life.current.epoch;
    const valid = () =>
      life.current.live &&
      ticket === life.current.epoch &&
      clerk.user?.id === actorSubject;
    try {
      if (!file.size) throw new Error("empty_file");
      if (file.size > CSV_LIMITS.bytes) throw new Error("file_too_large");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      )
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      if (!valid()) return;
      if (
        resume &&
        (resume.sourceHash !== hash || resume.sourceBytes !== file.size)
      )
        throw new Error("fileMismatch");
      const fingerprint = hash + ":" + file.name;
      if (attempt.current?.fingerprint !== fingerprint)
        attempt.current = { fingerprint, requestId: crypto.randomUUID() };
      let id = resume?.id ?? attempt.current.id;
      if (!id) {
        const result = await createImportUploadAction({
          sellerId,
          requestId: attempt.current.requestId,
          name: file.name,
          bytes: file.size,
          checksum: hash,
        });
        if (!valid()) return;
        if (!result.ok) throw new Error(result.detail ?? result.code);
        id = result.data.id;
        attempt.current.id = id;
      }
      const current = await readCatalogueImportAction({
        sellerId,
        importId: id,
      });
      if (!valid()) return;
      if (!current.ok) throw new Error(current.detail ?? current.code);
      if (current.data.state === "uploading") {
        const completed = new Set(current.data.uploaded),
          total = Math.ceil(bytes.length / CSV_LIMITS.chunkBytes);
        for (let position = 0; position < total; position++) {
          if (!valid()) return;
          if (!completed.has(position)) {
            const result = await appendImportChunkAction({
              sellerId,
              importId: id,
              position,
              encoded: encode(
                bytes.subarray(
                  position * CSV_LIMITS.chunkBytes,
                  (position + 1) * CSV_LIMITS.chunkBytes,
                ),
              ),
            });
            if (!valid()) return;
            if (!result.ok) throw new Error(result.detail ?? result.code);
          }
          setProgress(Math.round(((position + 1) * 100) / total));
        }
        const result = await finishImportUploadAction({
          sellerId,
          importId: id,
        });
        if (!valid()) return;
        if (!result.ok) throw new Error(result.detail ?? result.code);
      }
      const destination = "/app/sellers/" + sellerId + "/imports/" + id;
      if (window.location.pathname === destination) router.refresh();
      else router.push(destination + "?lang=" + locale);
    } catch (error) {
      if (valid())
        setError(
          importMessageKey(error instanceof Error ? error.message : null),
        );
    } finally {
      working.current = false;
      if (life.current.live) setBusy(false);
    }
  }
  return (
    <section className={f.panel}>
      <div className={s.upload}>
        <h2>{t(resume ? "resumeUpload" : "newImport")}</h2>
        <p className={f.help}>{t(resume ? "resumeNote" : "description")}</p>
        <div className={s.toolbar}>
          <button
            type="button"
            className={a.secondary}
            onClick={downloadTemplate}
          >
            {t("template")}
          </button>
          <button
            type="button"
            className={a.secondary}
            onClick={downloadCategoryGuide}
          >
            {t("categories")}
          </button>
        </div>
        <label>
          {t("file")}
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError(null);
              setProgress(0);
            }}
          />
        </label>
        <p className={f.help}>{t("fileNote")}</p>
        <p className={f.help}>{t("formatNote")}</p>
        <p className={f.help}>{t("noStock")}</p>
        {busy && (
          <>
            <progress className={s.progress} value={progress} max={100} />
            <p role="status">{t("progress", { percent: progress })}</p>
          </>
        )}
        {error && (
          <p className={s.error} role="alert">
            {t(importMessageKey(error))}
          </p>
        )}
        <div>
          <button
            type="button"
            className={a.primary}
            disabled={!file || busy}
            onClick={() => void upload()}
          >
            {t(resume ? "resumeUpload" : "upload")}
          </button>
        </div>
        <p className={f.help}>{t("privacy")}</p>
      </div>
    </section>
  );
}
