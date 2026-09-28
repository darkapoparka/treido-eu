"use client";
/* eslint-disable @next/next/no-img-element -- User-selected in-memory avatar, never uploaded. */
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
  return (
    <span
      className={`profile-avatar source-profile-avatar ${large ? "large" : ""} ${name ? "named" : ""} ${initial ? "person-initial" : ""}`}
    >
      {src ? (
        <img src={src} alt="Selected profile picture" />
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
  return (
    <div style={{ "--profile-menu-top": `${top}px` } as CSSProperties}>
      <Sheet
        open={open}
        headerless
        title={title}
        className="profile-choice"
        initialFocus='[aria-checked="true"]'
        onClose={onClose}
      >
        <div role="radiogroup" aria-label={title}>
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
              {option.label}
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
      setError("Choose a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > 3_000_000) {
      setError("Choose an image smaller than 3 MB.");
      return;
    }
    const ticket = ++generation.current;
    reader.current?.abort();
    setError("");
    const next = new FileReader();
    reader.current = next;
    next.onerror = () => {
      if (generation.current === ticket)
        setError("This image could not be read. Try another photo.");
    };
    next.onload = () => {
      if (generation.current !== ticket || typeof next.result !== "string")
        return;
      const source = next.result,
        image = new Image();
      image.onerror = () => {
        if (generation.current === ticket)
          setError("This file is not a usable image. Try another photo.");
      };
      image.onload = () => {
        if (generation.current !== ticket) return;
        if (
          !image.width ||
          !image.height ||
          image.width * image.height > 32_000_000
        ) {
          setError("Choose an image under 32 megapixels.");
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
      title="Profile picture"
      className="profile-photo-menu"
      onClose={close}
    >
      <button
        className="profile-photo-option"
        onClick={() => library.current?.click()}
      >
        <Icon name="photo-library" />
        Choose from library
      </button>
      <button
        className="profile-photo-option"
        onClick={() => camera.current?.click()}
      >
        <Icon name="camera" />
        Take a photo
      </button>
      <input
        ref={library}
        hidden
        aria-label="Choose profile photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          choose(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={camera}
        hidden
        aria-label="Take profile photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="user"
        onChange={(event) => {
          choose(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <p className="sr-only">
        The image stays in this browser session and is not uploaded.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Sheet>
  );
}
