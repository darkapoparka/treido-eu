"use client";
/* eslint-disable @next/next/no-img-element */
import type { Ref } from "react";
import { Icon } from "./icons";
import { COLLECTION_NAME_MAX_LENGTH } from "./saved-model";
import "./saved.css";

export function CollectionEditor({
  name,
  visibility,
  editing = false,
  thumbnails = [],
  inputRef,
  onNameChange,
  onVisibilityChange,
  onCancel,
  onSave,
}: {
  name: string;
  visibility: "Private" | "Public";
  editing?: boolean;
  thumbnails?: readonly { id: string; images: readonly string[] }[];
  inputRef?: Ref<HTMLInputElement>;
  onNameChange: (value: string) => void;
  onVisibilityChange: (value: "Private" | "Public") => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) onSave();
      }}
    >
      <div className="editor-toolbar">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button disabled={!name.trim()} type="submit">
          Save
        </button>
      </div>
      {editing && (
        <>
          <div className="collection-edit-thumbnails">
            {thumbnails.map((product) => (
              <img key={product.id} src={product.images[0]} alt="" />
            ))}
          </div>
          <p className="collection-input-label">Collection name</p>
        </>
      )}
      <input
        ref={inputRef}
        className="collection-name-input"
        aria-label="Collection name"
        placeholder="Collection name"
        value={name}
        maxLength={COLLECTION_NAME_MAX_LENGTH}
        onChange={(event) => onNameChange(event.target.value)}
        autoComplete="off"
        enterKeyHint="done"
        required
      />
      {!editing && (
        <div className="collection-privacy-row">
          <div
            className="visibility-options"
            role="group"
            aria-label="Collection visibility"
          >
            {(["Private", "Public"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-label={value}
                aria-pressed={visibility === value}
                onClick={() => onVisibilityChange(value)}
              >
                <Icon name={value === "Private" ? "lock" : "globe"} />
              </button>
            ))}
          </div>
          <div>
            <strong>{visibility}</strong>
            <p>
              {visibility === "Private"
                ? "Visible only to you and collaborators"
                : "Anyone on Shop can view"}
            </p>
          </div>
        </div>
      )}
    </form>
  );
}
