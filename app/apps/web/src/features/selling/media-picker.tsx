"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useClerk } from "@clerk/nextjs";
import {
  listMediaAction,
  createMediaIntentAction,
  completeMediaAction,
  changeMediaAction,
} from "./media-actions";
import { MEDIA_LIMITS, type MediaView } from "./media-model";
import styles from "../sellers/workspace.module.css";

type UploadAttempt = {
  file: File;
  requestId: string;
  checksum?: string;
  assetId?: string;
  uploaded: boolean;
};
export function MediaPicker({
  sellerId,
  draftId,
  actorSubject,
  language,
  canWrite,
  available,
}: {
  sellerId: string;
  draftId: string | null;
  actorSubject: string;
  language: "bg" | "en";
  canWrite: boolean;
  available: boolean;
}) {
  const [assets, setAssets] = useState<MediaView[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const mounted = useRef(false);
  const upload = useRef<AbortController | null>(null);
  const attempt = useRef<UploadAttempt | null>(null);
  const clerk = useClerk();
  const bg = language === "bg";
  const current = useCallback(
    () => mounted.current && clerk.user?.id === actorSubject,
    [clerk, actorSubject],
  );
  const deny = useCallback((code: string) => {
    if (code === "FORBIDDEN" || code === "NOT_FOUND") {
      setAssets([]);
      setBlocked(true);
      upload.current?.abort();
      attempt.current = null;
      setRetryAvailable(false);
    }
    setNotice(code);
  }, []);
  const refresh = useCallback(async () => {
    if (!draftId || !current()) return;
    const result = await listMediaAction({ sellerId, draftId });
    if (!current()) return;
    if (result.ok) setAssets(result.data);
    else deny(result.code);
  }, [draftId, sellerId, current, deny]);
  useEffect(() => {
    mounted.current = true;
    if (draftId && current())
      void listMediaAction({ sellerId, draftId })
        .then((result) => {
          if (!current()) return;
          if (result.ok) setAssets(result.data);
          else deny(result.code);
        })
        .catch(() => {
          if (current()) setNotice("NOT_AVAILABLE");
        });
    return () => {
      mounted.current = false;
      upload.current?.abort();
      attempt.current = null;
    };
  }, [draftId, sellerId, current, deny]);
  useEffect(() => {
    if (blocked || !assets.some((asset) => asset.state === "processing"))
      return;
    const timer = window.setInterval(() => {
      void refresh().catch(() => {
        if (current()) setNotice("NOT_AVAILABLE");
      });
    }, 4000);
    return () => window.clearInterval(timer);
  }, [assets, blocked, refresh, current]);
  async function finish(assetId: string) {
    if (!draftId || blocked || !current()) return false;
    const result = await completeMediaAction({ sellerId, draftId, assetId });
    if (!current()) return false;
    if (!result.ok) {
      deny(result.code);
      return false;
    }
    setNotice("PROCESSING");
    await refresh();
    return true;
  }
  async function send() {
    const selected = attempt.current;
    if (
      !selected ||
      !draftId ||
      busy ||
      blocked ||
      !canWrite ||
      !available ||
      !current()
    )
      return;
    setBusy(true);
    setNotice("UPLOADING");
    const control = new AbortController();
    upload.current = control;
    try {
      if (!selected.uploaded) {
        const bytes = await selected.file.arrayBuffer();
        if (!current() || control.signal.aborted) return;
        selected.checksum ??= Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          (byte) => byte.toString(16).padStart(2, "0"),
        ).join("");
        const intent = await createMediaIntentAction({
          sellerId,
          draftId,
          requestId: selected.requestId,
          bytes: selected.file.size,
          contentType: selected.file.type,
          checksum: selected.checksum,
        });
        if (!current() || control.signal.aborted) return;
        if (!intent.ok) {
          deny(intent.code);
          return;
        }
        selected.assetId = intent.data.assetId;
        const response = await fetch(intent.data.url, {
          method: "PUT",
          headers: intent.data.headers,
          body: bytes,
          credentials: "omit",
          signal: control.signal,
        });
        if (!response.ok) throw new Error("Upload unavailable.");
        selected.uploaded = true;
      }
      if (!current() || control.signal.aborted || !selected.assetId) return;
      if (await finish(selected.assetId)) {
        attempt.current = null;
        setRetryAvailable(false);
      }
    } catch {
      if (current() && !control.signal.aborted) setNotice("NOT_AVAILABLE");
    } finally {
      if (current()) {
        setBusy(false);
        await refresh().catch(() => {});
      }
    }
  }
  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      file.size < 1 ||
      file.size > MEDIA_LIMITS.bytes ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setNotice("INVALID_INPUT");
      return;
    }
    attempt.current = { file, requestId: crypto.randomUUID(), uploaded: false };
    setRetryAvailable(true);
    void send();
  }
  async function change(
    asset: MediaView,
    direction: "earlier" | "later" | "remove",
  ) {
    if (!draftId || busy || blocked || !current() || !canWrite) return;
    const ordered = [...assets];
    const index = ordered.findIndex((item) => item.id === asset.id);
    if (direction !== "remove") {
      const next = index + (direction === "earlier" ? -1 : 1);
      if (next < 0 || next >= ordered.length) return;
      [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = await changeMediaAction({
        sellerId,
        draftId,
        assets: ordered.map((item) => ({
          id: item.id,
          revision: item.revision,
        })),
        ...(direction === "remove" ? { removeId: asset.id } : {}),
      });
      if (!current()) return;
      if (!result.ok) deny(result.code);
      await refresh();
    } catch {
      if (current()) setNotice("NOT_AVAILABLE");
    } finally {
      if (current()) setBusy(false);
    }
  }
  const messages: Record<string, [string, string]> = {
    UPLOADING: ["Uploading photo…", "Качване на снимката…"],
    PROCESSING: [
      "Photo uploaded. Processing continues after you leave this page.",
      "Снимката е качена. Обработката продължава и след затваряне на страницата.",
    ],
    INVALID_INPUT: [
      "Choose a JPEG, PNG or WebP photo up to 12 MiB.",
      "Изберете JPEG, PNG или WebP снимка до 12 MiB.",
    ],
    NOT_AVAILABLE: [
      "Could not finish the photo upload. Your draft is preserved. Retry or refresh the photo list.",
      "Качването на снимката не е завършено. Черновата е запазена. Опитайте отново или обновете снимките.",
    ],
    CONFLICT: [
      "Photos changed in another session. The latest order has been loaded.",
      "Снимките са променени в друга сесия. Зареден е актуалният ред.",
    ],
    FORBIDDEN: [
      "Photo access has ended. Sign in again.",
      "Достъпът до снимките е прекратен. Влезте отново.",
    ],
    NOT_FOUND: [
      "These photos are no longer available.",
      "Тези снимки вече не са достъпни.",
    ],
    QUOTA_EXCEEDED: [
      "You can add up to 12 photos. Remove a photo before adding another.",
      "Можете да добавите до 12 снимки. Премахнете снимка, преди да добавите друга.",
    ],
  };
  return (
    <section
      className={`account-panel ${styles.photos}`}
      aria-label={bg ? "Снимки на артикула" : "Item photos"}
    >
      <h2>{bg ? "Снимки" : "Photos"}</h2>
      <p className="form-note">
        {!draftId
          ? bg
            ? "Запазете черновата, за да добавите снимки."
            : "Save your draft to add photos."
          : !available
            ? bg
              ? "Качването на снимки временно не е достъпно."
              : "Photo uploads are currently unavailable."
            : bg
              ? "До 12 снимки, JPEG, PNG или WebP, до 12 MiB всяка."
              : "Up to 12 photos: JPEG, PNG or WebP, up to 12 MiB each."}
      </p>
      {!!assets.length && !blocked && (
        <ol className={styles.photoList}>
          {assets.map((asset, index) => (
            <li key={asset.id} className={styles.photo}>
              {asset.state === "ready" ? (
                // Private images must reach the current authorization gate on every request.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.photoImage}
                  src={`/api/seller-media/${asset.id}?sellerId=${sellerId}`}
                  alt={bg ? `Снимка ${index + 1}` : `Photo ${index + 1}`}
                  onError={() => setNotice("NOT_AVAILABLE")}
                />
              ) : (
                <div className={styles.photoPlaceholder}>
                  {asset.state === "processing"
                    ? bg
                      ? "Обработване…"
                      : "Processing…"
                    : asset.state === "staged"
                      ? bg
                        ? "Качването не е завършено"
                        : "Upload not finished"
                      : bg
                        ? "Неуспешна снимка"
                        : "Photo failed"}
                </div>
              )}
              <div className={styles.photoControls}>
                <button
                  type="button"
                  className={styles.link}
                  disabled={busy || !canWrite || index === 0}
                  aria-label={
                    bg
                      ? `Премести снимка ${index + 1} по-рано`
                      : `Move photo ${index + 1} earlier`
                  }
                  onClick={() => void change(asset, "earlier")}
                >
                  {bg ? "По-рано" : "Earlier"}
                </button>
                <button
                  type="button"
                  className={styles.link}
                  disabled={busy || !canWrite || index === assets.length - 1}
                  aria-label={
                    bg
                      ? `Премести снимка ${index + 1} по-късно`
                      : `Move photo ${index + 1} later`
                  }
                  onClick={() => void change(asset, "later")}
                >
                  {bg ? "По-късно" : "Later"}
                </button>
                <button
                  type="button"
                  className={styles.link}
                  disabled={busy || !canWrite}
                  onClick={() => void change(asset, "remove")}
                >
                  {bg ? "Премахни" : "Remove"}
                </button>
                {asset.state === "staged" && available && (
                  <button
                    type="button"
                    className={styles.link}
                    disabled={busy || !canWrite}
                    onClick={() => {
                      setBusy(true);
                      void finish(asset.id)
                        .catch(() => {})
                        .finally(() => {
                          if (current()) setBusy(false);
                        });
                    }}
                  >
                    {bg ? "Завърши качването" : "Finish upload"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      {draftId && available && !blocked && (
        <label
          className={`${styles.link} ${styles.photoUpload}`}
          aria-disabled={
            busy || !canWrite || assets.length >= MEDIA_LIMITS.count
          }
        >
          <span>{bg ? "Добави снимка" : "Add a photo"}</span>
          <input
            type="file"
            aria-label={bg ? "Добави снимка" : "Add a photo"}
            accept="image/jpeg,image/png,image/webp"
            disabled={busy || !canWrite || assets.length >= MEDIA_LIMITS.count}
            onChange={choose}
          />
        </label>
      )}
      {notice && (
        <p
          role={
            notice === "UPLOADING" || notice === "PROCESSING"
              ? "status"
              : "alert"
          }
        >
          {(messages[notice] ?? messages.NOT_AVAILABLE)[bg ? 1 : 0]}
        </p>
      )}
      {!blocked && draftId && (
        <div className={styles.photoControls}>
          {retryAvailable && !busy && (
            <button
              type="button"
              className={styles.link}
              disabled={!canWrite || !available}
              onClick={() => void send()}
            >
              {bg ? "Опитай отново" : "Retry upload"}
            </button>
          )}
          <button
            type="button"
            className={styles.link}
            disabled={busy}
            onClick={() =>
              void refresh().catch(() => setNotice("NOT_AVAILABLE"))
            }
          >
            {bg ? "Обнови снимките" : "Refresh photos"}
          </button>
        </div>
      )}
    </section>
  );
}
