"use client";
/* eslint-disable @next/next/no-img-element -- User-selected in-memory avatar, never uploaded. */
import { useCaption } from "../locale/use-caption";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Sheet } from "../discovery/components";
import { Icon } from "../discovery/icons";

export function ProfileAvatar({
  src,
  name = "",
  large = false,
  initial = false,
}: {
  src?: string;
  name?: string;
  large?: boolean;
  initial?: boolean;
}) {
  const ui = useTranslations("accountUI");
  return (
    <span
      className={`profile-avatar source-profile-avatar ${large ? "large" : ""} ${name ? "named" : ""} ${initial ? "person-initial" : ""}`}
    >
      {src ? (
        <img src={src} alt={ui("selectedProfilePicture")} />
      ) : initial ? (
        name.charAt(0)
      ) : name ? (
        <svg viewBox="0 0 96 96" aria-hidden="true">
          <circle cx="48" cy="37" r="9" />
          <path d="M31 64c0-9.4 7.6-17 17-17s17 7.6 17 17v2H31Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 96 96" aria-hidden="true">
          <circle cx="48" cy="37" r="14" />
          <path d="M21 76c6-17 48-17 54 0-7 7-16 11-27 11S28 83 21 76Z" />
        </svg>
      )}
    </span>
  );
}
export function ProfileChoice({
  open,
  title,
  top,
  value,
  options,
  onSelect,
  onClose,
}: {
  open: boolean;
  title: string;
  top: number;
  value: string;
  options: readonly { value: string; label: string }[];
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const caption = useCaption();
  return (
    <div style={{ "--profile-menu-top": `${top}px` } as CSSProperties}>
      <Sheet
        open={open}
        headerless
        title={caption(title)}
        className="profile-choice"
        initialFocus='[aria-checked="true"]'
        onClose={onClose}
      >
        <div role="radiogroup" aria-label={caption(title)}>
          {options.map((option) => (
            <button
              key={option.value}
              role="radio"
              aria-checked={value === option.value}
              onClick={() => {
                onSelect(option.value);
                onClose();
              }}
            >
              <span aria-hidden="true">
                {value === option.value && <Icon name="check" />}
              </span>
              {caption(option.label)}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
export function ProfilePhotoMenu({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (source: string) => void;
}) {
  const ui = useTranslations("accountUI");
  const library = useRef<HTMLInputElement>(null),
    camera = useRef<HTMLInputElement>(null);
  const reader = useRef<FileReader | null>(null),
    generation = useRef(0);
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      generation.current += 1;
      reader.current?.abort();
    },
    [],
  );
  function choose(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError(ui("chooseAJPEGPNGOrWebPImage"));
      return;
    }
    if (file.size > 3_000_000) {
      setError(ui("chooseAnImageSmallerThan3MB"));
      return;
    }
    const ticket = ++generation.current;
    reader.current?.abort();
    setError("");
    const next = new FileReader();
    reader.current = next;
    next.onerror = () => {
      if (generation.current === ticket)
        setError(ui("thisImageCouldNotBeReadTryAnotherPhoto"));
    };
    next.onload = () => {
      if (generation.current !== ticket || typeof next.result !== "string")
        return;
      const source = next.result,
        image = new Image();
      image.onerror = () => {
        if (generation.current === ticket)
          setError(ui("thisFileIsNotAUsableImageTryAnotherPhoto"));
      };
      image.onload = () => {
        if (generation.current !== ticket) return;
        if (
          !image.width ||
          !image.height ||
          image.width * image.height > 32_000_000
        ) {
          setError(ui("chooseAnImageUnder32Megapixels"));
          return;
        }
        onSelect(source);
        onClose();
      };
      image.src = source;
    };
    next.readAsDataURL(file);
  }
  const close = () => {
    generation.current += 1;
    reader.current?.abort();
    setError("");
    onClose();
  };
  return (
    <Sheet
      open={open}
      headerless
      title={ui("profilePicture")}
      className="profile-photo-menu"
      onClose={close}
    >
      <button
        className="profile-photo-option"
        onClick={() => library.current?.click()}
      >
        <Icon name="photo-library" />
        {ui("chooseFromLibrary")}
      </button>
      <button
        className="profile-photo-option"
        onClick={() => camera.current?.click()}
      >
        <Icon name="camera" />
        {ui("takeAPhoto")}
      </button>
      <input
        ref={library}
        hidden
        aria-label={ui("chooseProfilePhoto")}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          choose(event.target.files?.[0]);
          event.target.value = "";
        }}
        data-ui-label="chooseProfilePhoto"
      />
      <input
        ref={camera}
        hidden
        aria-label={ui("takeProfilePhoto")}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="user"
        onChange={(event) => {
          choose(event.target.files?.[0]);
          event.target.value = "";
        }}
        data-ui-label="takeProfilePhoto"
      />
      <p className="sr-only">
        {ui("theImageStaysInThisBrowserSessionAndIsNot")}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Sheet>
  );
}
