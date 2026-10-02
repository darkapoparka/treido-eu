"use client";
import Image from "next/image";
import { useState } from "react";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { MiniIcon, useStudioMini } from "./studio-mini-context";
import s from "./studio-mini.module.css";

export function MiniAvatar({ size = 20 }: { size?: number }) {
  return (
    <Image
      src="/merchant-admin/treido-sell-helper-v1.png"
      alt=""
      width={size}
      height={size}
      sizes={`${size}px`}
      className={s.avatar}
    />
  );
}
export function StudioMiniLauncher({ phone = false }: { phone?: boolean }) {
  const { text } = usePreview();
  const mini = useStudioMini();
  return (
    <button
      type="button"
      className={phone ? s.phoneLauncher : s.launcher}
      aria-label={text(
        "Open Sell Helper Mini",
        "Отвори Мини помощник за продажби",
      )}
      aria-haspopup="dialog"
      onClick={() => mini.open()}
    >
      <MiniAvatar size={28} />
    </button>
  );
}
export function StudioMiniDock() {
  const { text, largeText } = usePreview();
  const mini = useStudioMini();
  const [prompt, setPrompt] = useState("");
  return (
    <form
      data-studio-mini=""
      className={`${s.dock} ${largeText ? s.large : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (prompt.trim()) {
          mini.ask(prompt);
          setPrompt("");
        } else mini.open();
      }}
    >
      <button
        type="button"
        className={s.avatarButton}
        aria-label={text(
          "Open Sell Helper Mini",
          "Отвори Мини помощник за продажби",
        )}
        onClick={() => mini.open()}
      >
        <MiniAvatar />
      </button>
      <input
        aria-label={text(
          "Work with Sell Helper",
          "Работи с помощника за продажби",
        )}
        placeholder={text(
          "Work with Sell Helper",
          "Работи с помощника за продажби",
        )}
        maxLength={500}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
      />
      <button
        type="button"
        className={s.tool}
        aria-label={text("Add files and more", "Добави файлове и още")}
        onClick={() => mini.open("attachments")}
      >
        <AdminIcon name="plus" />
      </button>
      <button
        type="button"
        className={s.tool}
        aria-label={text("Voice", "Глас")}
        onClick={() => mini.open("voice")}
      >
        <MiniIcon name="voice" />
      </button>
      <span className={s.separator} aria-hidden="true" />
      <button
        type="submit"
        className={s.tool}
        aria-label={text("Open Sell Helper", "Отвори помощника за продажби")}
      >
        <AdminIcon name="menu" />
      </button>
    </form>
  );
}
export function StudioMiniComposer({ home = false }: { home?: boolean }) {
  const { text, largeText } = usePreview();
  const mini = useStudioMini();
  const [prompt, setPrompt] = useState("");
  const submit = () => {
    if (!prompt.trim()) return;
    mini.ask(prompt);
    setPrompt("");
  };
  return (
    <form
      data-studio-mini=""
      className={`${s.composer} ${home ? s.homeComposer : s.chatComposer} ${largeText ? s.large : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        aria-label={
          home
            ? text("Create a product listing", "Създай обява за продукт")
            : text("Work with Sell Helper", "Работи с помощника за продажби")
        }
        placeholder={
          home
            ? text(
                "Help me create a product listing",
                "Помогни ми да създам обява",
              )
            : text("Work with Sell Helper", "Работи с помощника за продажби")
        }
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={1}
        maxLength={500}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div className={s.composerActions}>
        {home && (
          <button
            type="button"
            className={s.avatarButton}
            aria-label={text(
              "Open Sell Helper Mini",
              "Отвори Мини помощник за продажби",
            )}
            onClick={() => mini.open()}
          >
            <MiniAvatar />
          </button>
        )}
        {home && (
          <button
            type="button"
            className={s.recents}
            onClick={() => mini.open("recents")}
          >
            <MiniIcon name="recent" />
            {text("Recents", "Скорошни")}
          </button>
        )}
        {home && <span className={s.separator} aria-hidden="true" />}
        <button
          type="button"
          className={s.tool}
          aria-label={text("Add files and more", "Добави файлове и още")}
          onClick={() => mini.open("attachments")}
        >
          <AdminIcon name="plus" />
        </button>
        {prompt.trim() ? (
          <button
            type="submit"
            className={`${s.tool} ${s.send}`}
            aria-label={text("Send to Sell Helper", "Изпрати до помощника")}
          >
            <AdminIcon name="arrow" />
          </button>
        ) : (
          <button
            type="button"
            className={s.tool}
            aria-label={text("Voice", "Глас")}
            onClick={() => mini.open("voice")}
          >
            <MiniIcon name="voice" />
          </button>
        )}
      </div>
    </form>
  );
}
