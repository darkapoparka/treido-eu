"use client";
import Image from "next/image";
import { useState } from "react";
import { usePreview } from "./context";
import { normalizePreviewFileUrl, type Entry } from "./model";
import { FileEmptyArtwork } from "./file-empty-artwork";
import { Button, Empty, Field, Modal, s } from "./ui";
import styles from "./media-library.module.css";

export function MediaLibrary({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (image: string) => void;
}) {
  const { store, text, update } = usePreview();
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [urlEditor, setUrlEditor] = useState(false);
  const [url, setUrl] = useState("");
  const files = store.entries.filter((entry) => entry.type === "File");
  const images = files.filter(
    (entry) =>
      entry.body.startsWith("data:image/") &&
      entry.title.toLowerCase().includes(query.toLowerCase()),
  );
  const upload = (file?: File) => {
    if (!file) return;
    if (
      file.size > 120000 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError(
        text(
          "Choose a JPG, PNG or WebP image up to 120 KB.",
          "Изберете JPG, PNG или WebP изображение до 120 KB.",
        ),
      );
      return;
    }
    const reader = new FileReader();
    reader.onerror = () =>
      setError(
        text(
          "The image could not be read. Try again.",
          "Изображението не може да бъде прочетено. Опитайте отново.",
        ),
      );
    reader.onload = () => {
      const body = String(reader.result);
      const entry: Entry = {
        id: `file-${crypto.randomUUID()}`,
        title: file.name.slice(0, 200),
        type: "File",
        status: "Saved",
        body,
        tags: "",
      };
      update({ entries: [...store.entries, entry] });
      setSelected(body);
      setError("");
    };
    reader.readAsDataURL(file);
  };
  const uploadControl = (
    <label
      className={`${s.button} ${s.primary} ${styles.upload}`}
      data-studio-part="button"
    >
      {text("Upload file", "Качване на файл")}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={text(
          "Upload image to local files",
          "Качване на изображение в локалните файлове",
        )}
        onChange={(event) => upload(event.target.files?.[0])}
      />
    </label>
  );
  return (
    <Modal
      title={
        urlEditor
          ? text("Add file from URL", "Добавяне на файл чрез URL")
          : text("Select file", "Избор на файл")
      }
      onClose={onClose}
      surface={urlEditor ? "media-library-url" : "media-library"}
      className={urlEditor ? "" : styles.library}
      footer={
        <>
          <Button
            onClick={
              urlEditor
                ? () => {
                    setUrlEditor(false);
                    setError("");
                  }
                : onClose
            }
          >
            {text("Cancel", "Отказ")}
          </Button>
          <Button
            primary
            disabled={urlEditor ? !normalizePreviewFileUrl(url) : !selected}
            onClick={() => {
              if (urlEditor) {
                const normalized = normalizePreviewFileUrl(url);
                if (!normalized) {
                  setError(
                    text(
                      "Enter a valid HTTP or HTTPS URL.",
                      "Въведете валиден HTTP или HTTPS URL.",
                    ),
                  );
                  return;
                }
                update({
                  entries: [
                    ...store.entries,
                    {
                      id: `file-${crypto.randomUUID()}`,
                      title: new URL(normalized).hostname,
                      body: "",
                      url: normalized,
                      type: "File",
                      status: "Saved",
                      tags: "",
                    },
                  ],
                });
                setUrlEditor(false);
                setUrl("");
                setError("");
              } else {
                onSelect(selected);
                onClose();
              }
            }}
          >
            {urlEditor
              ? text("Save URL", "Запазване на URL")
              : text("Done", "Готово")}
          </Button>
        </>
      }
    >
      {urlEditor ? (
        <>
          <p>
            {text(
              "A local URL reference is saved. External images are not downloaded or imported into product media.",
              "Запазва се локален URL запис. Външни изображения не се изтеглят и не се добавят към снимките на продукта.",
            )}
          </p>
          <Field label={text("File URL", "URL на файла")}>
            <input
              type="url"
              maxLength={2048}
              placeholder="https://"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              aria-invalid={!!url && !normalizePreviewFileUrl(url)}
            />
          </Field>
        </>
      ) : (
        <div className={styles.body} data-studio-part="media-library-body">
          {images.length || files.length ? (
            <>
              <div className={styles.toolbar}>
                <Field label={text("Search files", "Търсене на файлове")}>
                  <input
                    type="search"
                    maxLength={120}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </Field>
                {uploadControl}
              </div>
              <div className={styles.grid}>
                {images.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    aria-pressed={selected === entry.body}
                    onClick={() => setSelected(entry.body)}
                  >
                    <Image
                      unoptimized
                      src={entry.body}
                      width={120}
                      height={120}
                      alt=""
                    />
                    <span>{entry.title}</span>
                  </button>
                ))}
              </div>
              {!images.length && (
                <p className={styles.noImages}>
                  {text(
                    "No reusable images. Upload an image to select product media.",
                    "Няма изображения за повторно използване. Качете изображение за снимка на продукта.",
                  )}
                </p>
              )}
              {files
                .filter((entry) => entry.url)
                .map((entry) => (
                  <p key={entry.id} className={s.help}>
                    {entry.title} · {text("URL reference", "URL запис")}
                  </p>
                ))}
              <Button plain onClick={() => setUrlEditor(true)}>
                {text("Add from URL", "Добавяне чрез URL")}
              </Button>
            </>
          ) : (
            <Empty
              kind="content"
              art={<FileEmptyArtwork />}
              title={text("No files yet", "Все още няма файлове")}
              body={text(
                "Upload images to make a selection. You can reuse these files in this device's preview.",
                "Качете изображения, за да изберете снимка. Можете да ги използвате повторно в прегледа на това устройство.",
              )}
            >
              {uploadControl}
              <Button plain onClick={() => setUrlEditor(true)}>
                {text("Add from URL", "Добавяне чрез URL")}
              </Button>
            </Empty>
          )}
        </div>
      )}
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
