"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { useAttachments } from "./use-attachments";
import { attachmentHref, type AttachmentScope } from "./model";
import type { Locale } from "../locale/locale";
import s from "./attachments.module.css";
const copy = {
  en: {
    add: "Add images",
    remove: "Remove",
    retry: "Retry",
    ready: "Ready to send",
    pending: "Preparing image…",
    failed: "Image unavailable. Retry or remove it.",
    invalid: "Use a still JPEG, PNG or WebP image, up to 3 MiB.",
    note: "Up to 4 private images. Unsent images expire after 24 hours. File deletion can take additional time.",
    image: "Message image",
    load: "Load image",
    loading: "Loading…",
  },
  bg: {
    add: "Добави снимки",
    remove: "Премахни",
    retry: "Опитай отново",
    ready: "Готова за изпращане",
    pending: "Подготовка на снимката…",
    failed: "Снимката не е налична. Опитай отново или я премахни.",
    invalid: "Избери статична JPEG, PNG или WebP снимка до 3 MiB.",
    note: "До 4 лични снимки. Неизпратените снимки изтичат след 24 часа. Изтриването на файловете може да отнеме допълнително време.",
    image: "Снимка в съобщението",
    load: "Зареди снимката",
    loading: "Зареждане…",
  },
};
export function AttachmentPicker({
  controller,
  scope,
  language,
  disabled,
}: {
  controller: ReturnType<typeof useAttachments>;
  scope: AttachmentScope;
  language: Locale;
  disabled: boolean;
}) {
  const t = copy[language],
    input = useRef<HTMLInputElement>(null);
  return (
    <div className={s.picker}>
      <input
        ref={input}
        className={s.file}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={disabled || controller.items.length >= 4}
        aria-label={t.add}
        onChange={(e) => {
          controller.add(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className={s.button}
        disabled={disabled || controller.items.length >= 4}
        onClick={() => input.current?.click()}
      >
        {t.add}
      </button>
      <p className={s.note}>{t.note}</p>
      <ul className={s.list}>
        {controller.items.map((item) => (
          <li key={item.localId}>
            {item.view?.state === "ready" && (
              <PrivateAttachmentImage
                scope={scope}
                id={item.view.id}
                language={language}
              />
            )}
            <span>{item.file?.name ?? t.image}</span>
            <small role="status">
              {item.error
                ? item.error === "INVALID_INPUT"
                  ? t.invalid
                  : t.failed
                : item.view?.state === "ready"
                  ? t.ready
                  : t.pending}
            </small>
            <div className={s.actions}>
              {item.error && item.file && (
                <button
                  type="button"
                  className={s.button}
                  disabled={
                    disabled || item.busy || item.error === "INVALID_INPUT"
                  }
                  onClick={() => void controller.upload(item)}
                >
                  {t.retry}
                </button>
              )}
              <button
                type="button"
                className={s.button}
                disabled={disabled || item.busy}
                onClick={() => void controller.remove(item)}
              >
                {t.remove}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
export function PrivateAttachmentImage({
  scope,
  id,
  language,
}: {
  scope: AttachmentScope;
  id: string;
  language: Locale;
}) {
  const [attempt, setAttempt] = useState(0),
    [failed, setFailed] = useState(false);
  const t = copy[language];
  return (
    <div className={s.image}>
      {!failed ? (
        <a href={attachmentHref(scope, id)} target="_blank" rel="noreferrer">
          <Image
            unoptimized
            width={2048}
            height={2048}
            key={attempt}
            src={
              attachmentHref(scope, id) +
              (attempt ? "&revision=" + attempt : "")
            }
            alt={t.image}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        </a>
      ) : (
        <>
          <span role="status">{t.failed}</span>
          <button
            type="button"
            className={s.button}
            onClick={() => {
              setFailed(false);
              setAttempt((v) => v + 1);
            }}
          >
            {t.retry}
          </button>
        </>
      )}
    </div>
  );
}
