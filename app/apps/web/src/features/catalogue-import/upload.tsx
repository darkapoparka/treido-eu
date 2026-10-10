"use client";
import { importMessageKey } from "./copy";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { CSV_LIMITS } from "./csv";
import { createImportUploadAction, appendImportChunkAction, finishImportUploadAction, readCatalogueImportAction } from "./actions";
import { importUploadJournalKey, restoreImportUpload, type ImportUploadJournal } from "./upload-recovery";
import type { ImportView } from "./model";
import { downloadTemplate, downloadCategoryGuide } from "./download";
import a from "../sellers/admin.module.css";
import f from "../sellers/admin-editor.module.css";
import s from "./import.module.css";
function encode(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 2048) text += String.fromCharCode(...bytes.subarray(i, i + 2048));
  return btoa(text);
}
type Props = { sellerId: string; actorSubject: string; resume?: ImportView };
export function ImportUpload(props: Props) {
  return <Upload key={`${props.actorSubject}:${props.sellerId}:${props.resume?.id ?? "new"}`} {...props} />;
}
function Upload({ sellerId, actorSubject, resume }: Props) {
  const t = useTranslations("catalogueImport"), locale = useLocale(), router = useRouter(), clerk = useClerk(), auth = useAuth();
  const sessionId = auth.isLoaded ? auth.sessionId : null;
  const entry = typeof location === "undefined" ? "" : location.pathname + location.search;
  const frame = useMemo(() => ({ sellerId, actorSubject, sessionId, entry, user: clerk.user, session: clerk.session }), [sellerId, actorSubject, sessionId, entry, clerk.user, clerk.session]);
  const [file, setFile] = useState<File | null>(null);
  const [ui, setUi] = useState<{ frame: typeof frame; busy: boolean; progress: number; error: string | null; paused: boolean; recovering: boolean } | null>(null);
  const life = useRef<{ frame: typeof frame | null; active: symbol | null }>({ frame: null, active: null });
  const memory = useRef(new Map<string, ImportUploadJournal>());
  useLayoutEffect(() => {
    life.current.frame = frame; life.current.active = null;
    return () => { life.current.frame = null; life.current.active = null; };
  }, [frame]);
  useEffect(() => {
    let user = clerk.user, session = clerk.session, signature = `${clerk.user?.id}:${clerk.session?.id}:${clerk.session?.status}`;
    const retire = () => {
      const current = life.current;
      if (!current.active) return;
      current.active = null;
      setUi((value) => value ? { ...value, busy: false, paused: true } : value);
    };
    const unsubscribe = clerk.addListener(() => {
      const next = `${clerk.user?.id}:${clerk.session?.id}:${clerk.session?.status}`;
      if (next !== signature || clerk.user !== user || clerk.session !== session) {
        user = clerk.user; session = clerk.session; signature = next; retire();
      }
    });
    const visibility = () => { if (document.visibilityState !== "visible") retire(); };
    window.addEventListener("blur", retire); window.addEventListener("pagehide", retire); document.addEventListener("visibilitychange", visibility);
    return () => { unsubscribe(); window.removeEventListener("blur", retire); window.removeEventListener("pagehide", retire); document.removeEventListener("visibilitychange", visibility); };
  }, [clerk]);
  const qualified = auth.isLoaded && auth.isSignedIn && auth.userId === actorSubject && !!sessionId && clerk.user?.id === actorSubject && clerk.session?.id === sessionId && clerk.session.status === "active";
  const currentUi = qualified && ui?.frame === frame ? ui : null;
  const busy = currentUi?.busy ?? false, progress = currentUi?.progress ?? 0, error = currentUi?.error ?? null;
  function current() {
    return qualified && life.current.frame === frame && clerk.user === frame.user && clerk.session === frame.session &&
      clerk.user?.id === actorSubject && clerk.session?.id === sessionId && clerk.session.status === "active" &&
      location.pathname + location.search === entry && document.visibilityState === "visible";
  }
  function save(key: string, journal: ImportUploadJournal) {
    memory.current.set(key, journal);
    try { sessionStorage.setItem(key, JSON.stringify(journal)); } catch { /* Optional browser recovery; same-tab memory preserves the exact request. */ }
  }
  function pause() {
    if (!current()) return;
    life.current.active = null;
    setUi({ frame, busy: false, progress, error: null, paused: true, recovering: currentUi?.recovering ?? false });
  }
  async function upload() {
    if (!file || life.current.active || !current()) return;
    const ticket = Symbol("import upload"); life.current.active = ticket;
    const valid = () => current() && life.current.active === ticket;
    setUi({ frame, busy: true, progress: 0, error: null, paused: false, recovering: false });
    const bind = (command: Record<string, unknown>) => ({ actorSubject, command });
    try {
      if (!file.size) throw new Error("empty_file");
      if (file.size > CSV_LIMITS.bytes) throw new Error("file_too_large");
      if (file.name.length > 180 || !/\.csv$/i.test(file.name) || /[\/\\]/.test(file.name)) throw new Error("INVALID_INPUT");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!valid()) return;
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((n) => n.toString(16).padStart(2, "0")).join("");
      if (!valid()) return;
      if (resume && (resume.sellerId !== sellerId || resume.sourceHash !== hash || resume.sourceBytes !== file.size)) throw new Error("fileMismatch");
      const scope = { actorSubject, sellerId, checksum: hash, bytes: file.size, name: file.name }, key = importUploadJournalKey(scope);
      let stored: string | null = null;
      try { stored = sessionStorage.getItem(key); } catch { /* Same-tab memory is sufficient. */ }
      const recovered = restoreImportUpload(memory.current.get(key), scope) ?? restoreImportUpload(stored, scope);
      const journal: ImportUploadJournal = recovered ?? { version: 1, ...scope, requestId: crypto.randomUUID(), importId: null };
      if (resume && journal.importId && resume.id !== journal.importId) throw new Error("fileMismatch");
      if (resume) journal.importId = resume.id;
      save(key, journal);
      if (recovered || resume) setUi((value) => value?.frame === frame ? { ...value, recovering: true } : value);
      let id = journal.importId;
      if (!id) {
        const result = await createImportUploadAction(bind({ sellerId, requestId: journal.requestId, name: file.name, bytes: file.size, checksum: hash }));
        if (!valid()) return;
        if (!result.ok) throw new Error(result.detail ?? result.code);
        id = result.data.id; journal.importId = id; save(key, journal);
      }
      const snapshot = await readCatalogueImportAction({ sellerId, importId: id });
      if (!valid()) return;
      if (!snapshot.ok) throw new Error(snapshot.detail ?? snapshot.code);
      if (snapshot.data.id !== id || snapshot.data.sellerId !== sellerId || snapshot.data.sourceHash !== hash || snapshot.data.sourceBytes !== file.size) throw new Error("fileMismatch");
      if (snapshot.data.state === "cancelled") throw new Error("CONFLICT");
      if (snapshot.data.state === "uploading") {
        const completed = new Set(snapshot.data.uploaded), total = Math.ceil(bytes.length / CSV_LIMITS.chunkBytes);
        for (let position = 0; position < total; position++) {
          if (!valid()) return;
          if (!completed.has(position)) {
            const result = await appendImportChunkAction(bind({ sellerId, importId: id, position, encoded: encode(bytes.subarray(position * CSV_LIMITS.chunkBytes, (position + 1) * CSV_LIMITS.chunkBytes)) }));
            if (!valid()) return;
            if (!result.ok) throw new Error(result.detail ?? result.code);
          }
          setUi((value) => value?.frame === frame ? { ...value, progress: Math.round(((position + 1) * 100) / total) } : value);
        }
        if (!valid()) return;
        const result = await finishImportUploadAction(bind({ sellerId, importId: id }));
        if (!valid()) return;
        if (!result.ok) throw new Error(result.detail ?? result.code);
        if (result.data.id !== id) throw new Error("NOT_AVAILABLE");
      }
      // Keep the original identity even after upload completion. Selecting this
      // exact file again resumes its review, rather than manufacturing duplicates.
      const destination = "/app/sellers/" + sellerId + "/imports/" + id;
      if (window.location.pathname === destination) router.refresh();
      else router.push(destination + "?lang=" + locale);
    } catch (cause) {
      if (valid()) setUi((value) => ({ frame, busy: false, progress: value?.frame === frame ? value.progress : 0, error: importMessageKey(cause instanceof Error ? cause.message : null), paused: false, recovering: value?.recovering ?? false }));
    } finally {
      if (life.current.active === ticket) {
        life.current.active = null;
        if (current()) setUi((value) => value?.frame === frame ? { ...value, busy: false } : value);
      }
    }
  }
  return <section className={f.panel}><div className={s.upload}>
    <h2>{t(resume ? "resumeUpload" : "newImport")}</h2><p className={f.help}>{t(resume ? "resumeNote" : "description")}</p>
    <div className={s.toolbar}><button type="button" className={a.secondary} onClick={downloadTemplate}>{t("template")}</button><button type="button" className={a.secondary} onClick={downloadCategoryGuide}>{t("categories")}</button></div>
    <label>{t("file")}<input type="file" accept=".csv,text/csv" disabled={busy || !qualified} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setUi(null); }} /></label>
    <p className={f.help}>{t("fileNote")}</p><p className={f.help}>{t("formatNote")}</p><p className={f.help}>{t("noStock")}</p>
    <p className={f.help}>{t("reloadUploadNote")}</p>
    {!qualified && <p role="status">{t("denied")}</p>}
    {currentUi?.recovering && <p role="status">{t("originalUploadRecovered")}</p>}
    {(busy || currentUi?.paused) && <><progress className={s.progress} value={progress} max={100} aria-label={t("progress", { percent: progress })} /><p role="status">{t(currentUi?.paused ? "uploadPaused" : "progress", { percent: progress })}</p></>}
    {error && <p className={s.error} role="alert">{t(importMessageKey(error))}</p>}
    <div className={s.toolbar}><button type="button" className={a.primary} disabled={!file || busy || !qualified} onClick={() => void upload()}>{t(resume || currentUi?.paused ? "resumeUpload" : "upload")}</button>
      {busy && <button type="button" className={a.secondary} onClick={pause}>{t("pauseUpload")}</button>}</div>
    <p className={f.help}>{t("privacy")}</p>
  </div></section>;
}
