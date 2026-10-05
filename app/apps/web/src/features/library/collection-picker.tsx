"use client";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Sheet } from "../discovery/components";
import { Icon } from "../discovery/icons";
import { useLibraryController } from "./use-library";
import { LibraryFeedback, LibraryLoadState } from "./feedback";
import { LIBRARY_LIMITS } from "./model";
import s from "./library.module.css";
export function CollectionPicker({
  listingId,
  onClose,
}: {
  listingId: string;
  onClose: () => void;
}) {
  const library = useLibraryController({
    view: "state",
    listingIds: [listingId],
    pickerId: listingId,
  });
  const [name, setName] = useState("");
  const t = useTranslations("library");
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const accepted = await library.execute({
      kind: "createCollection",
      name,
      listingId,
    });
    if (accepted) setName("");
  }
  return (
    <>
      <Sheet
        open
        title={t("saveToCollection")}
        onClose={onClose}
        className={"saved-sheet collection-options-sheet " + s.picker}
      >
        {library.status !== "ready" ? (
          <LibraryLoadState controller={library} />
        ) : (
          <>
            <p className="sheet-copy">{t("collectionHint")}</p>
            <div className="collection-option-rows">
              {library.view?.collections.map((collection) => (
                <button
                  key={collection.id}
                  type="button"
                  aria-pressed={collection.contains}
                  disabled={library.busy}
                  onClick={() =>
                    void library.execute({
                      kind: "collectionItem",
                      collectionId: collection.id,
                      listingId,
                      included: !collection.contains,
                    })
                  }
                >
                  <Icon name={collection.contains ? "check" : "plus-circle"} />
                  <span>{collection.name}</span>
                  <small>{t("private")}</small>
                </button>
              ))}
            </div>
            <form onSubmit={create} className={s.form}>
              <label>
                {t("name")}
                <input
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={LIBRARY_LIMITS.name}
                  required
                  autoComplete="off"
                />
              </label>
              <button
                className="primary"
                type="submit"
                disabled={library.busy || !name.trim()}
              >
                {t("createCollection")}
              </button>
              <p>{t("privateNote")}</p>
            </form>
          </>
        )}
        <LibraryFeedback controller={library} inline />
        <button type="button" className="pill form-submit" onClick={onClose}>
          {t("done")}
        </button>
      </Sheet>
    </>
  );
}
