"use client";
/* eslint-disable @next/next/no-img-element */
import { useCaption } from "../locale/use-caption";
import { useTranslations } from "next-intl";
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
  const caption = useCaption();
  const ui = useTranslations("discoveryUI");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) onSave();
      }}
    >
      <div className="editor-toolbar">
        <button type="button" onClick={onCancel}>
          {ui("cancel")}
        </button>
        <button disabled={!name.trim()} type="submit">
          {ui("save")}
        </button>
      </div>
      {editing && (
        <>
          <div className="collection-edit-thumbnails">
            {thumbnails.map((product) => (
              <img key={product.id} src={product.images[0]} alt="" />
            ))}
          </div>
          <p className="collection-input-label">{ui("collectionName")}</p>
        </>
      )}
      <input
        ref={inputRef}
        className="collection-name-input"
        aria-label={ui("collectionName")}
        placeholder={ui("collectionName")}
        value={name}
        maxLength={COLLECTION_NAME_MAX_LENGTH}
        onChange={(event) => onNameChange(event.target.value)}
        autoComplete="off"
        enterKeyHint="done"
        required
        data-ui-label="collectionName"
      />
      {!editing && (
        <div className="collection-privacy-row">
          <div
            className="visibility-options"
            role="group"
            aria-label={ui("collectionVisibility")}
            data-ui-label="collectionVisibility"
          >
            {(["Private", "Public"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-label={caption(value)}
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
                ? ui("visibleOnlyToYouAndCollaborators")
                : ui("anyoneOnShopCanView")}
            </p>
          </div>
        </div>
      )}
    </form>
  );
}
