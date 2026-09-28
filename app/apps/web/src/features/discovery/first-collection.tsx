"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Catalog } from "../catalog/types";
import { Sheet } from "./components";
import { useSheetStages } from "./sheet-stages";
import { CollectionEditor } from "./collection-editor";
import { Icon } from "./icons";
import { useDiscovery } from "./state";
import "./first-collection.css";

/** This is triggered by a real first save, never by a screenshot/frame parameter.
 * Dismissing the suggestion does not undo the save or create a collection. */
export function FirstCollectionPrompt({ catalog }: { catalog: Catalog }) {
  const state = useDiscovery();
  const router = useRouter();
  const [startedEmpty] = useState(() => state.saved.length === 0);
  const [dismissed, setDismissed] = useState(false);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"Private" | "Public">("Private");
  const submitting = useRef(false);
  const first = catalog.products.find((item) => item.id === state.saved[0]);
  const suggest =
    startedEmpty && !dismissed && !!first && state.collections.length === 0;
  const flow = useSheetStages<"prompt" | "editor">({
    open: suggest,
    initial: "prompt",
    onClose: () => {
      if (suggest) setDismissed(true);
    },
    onReopen: () => setDismissed(false),
    onStart: () => {
      setName("");
      setVisibility("Private");
      submitting.current = false;
    },
  });
  const editing = flow.stage === "editor";
  useEffect(() => {
    if (!flow.active) return;
    const frame = requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          editing
            ? ".collection-editor[open] .collection-name-input"
            : ".first-collection-sheet[open] .first-collection-create",
        )
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [editing, flow.active]);
  return (
    <Sheet
      open={flow.active && suggest}
      manageHistory={false}
      title={editing ? "Create collection" : "Start your first collection"}
      headerless
      className={
        editing ? "saved-sheet collection-editor" : "first-collection-sheet"
      }
      initialFocus=".collection-name-input, .first-collection-create"
      onClose={() => flow.close()}
    >
      {editing ? (
        <CollectionEditor
          name={name}
          visibility={visibility}
          onNameChange={setName}
          onVisibilityChange={setVisibility}
          onCancel={() => flow.close()}
          onSave={() => {
            if (!name.trim() || submitting.current) return;
            submitting.current = true;
            flow.close(() => {
              const id = state.createCollection(name.trim());
              state.updateCollection(id, { visibility });
              router.push(
                `/saved?collection=${encodeURIComponent(id)}&view=add`,
              );
            });
          }}
        />
      ) : (
        <>
          <div
            className="first-collection-art"
            data-product-id={first?.id}
            aria-hidden="true"
          >
            <span />
            <span />
            <div>
              {first && (
                <img
                  src={
                    first.id === "rice-bundle"
                      ? "/api/reference-media/first-collection-rice-photo"
                      : first.images[0]
                  }
                  alt=""
                />
              )}
              <i>
                <Icon name="heart" filled />
              </i>
            </div>
          </div>
          <h2>Start your first collection</h2>
          <p>
            Organize your saved items to revisit later or share with others.
          </p>
          <button
            className="primary first-collection-create"
            onClick={() => flow.navigate("editor")}
          >
            Create collection
          </button>
        </>
      )}
    </Sheet>
  );
}
