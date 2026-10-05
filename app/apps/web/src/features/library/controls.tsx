"use client";
import { useTranslations } from "next-intl";
import { IconButton } from "../discovery/icon-button";
import { Icon } from "../discovery/icons";
import { useBuyerLibrary } from "./provider";
export function ListingSaveButton({
  id,
  title,
  overlay = true,
}: {
  id: string;
  title: string;
  overlay?: boolean;
}) {
  const library = useBuyerLibrary(),
    t = useTranslations("library");
  const saved = library.view?.savedIds.includes(id) ?? false;
  const known = library.status === "ready" || library.status === "guest";
  return (
    <IconButton
      className={overlay ? "save-button" + (saved ? " saved-active" : "") : ""}
      icon="heart"
      label={
        (known ? t(saved ? "unsave" : "save") : t("stateUnavailable")) +
        " " +
        title
      }
      pressed={known ? saved : undefined}
      disabled={!known || library.busy}
      onClick={() =>
        void library.execute({ kind: "save", listingId: id, saved: !saved })
      }
    />
  );
}
export function SellerFollowButton({ id }: { id: string }) {
  const library = useBuyerLibrary(),
    t = useTranslations("library");
  const followed = library.view?.followedIds.includes(id) ?? false;
  const known = library.status === "ready" || library.status === "guest";
  return (
    <button
      className="pill"
      type="button"
      disabled={!known || library.busy}
      aria-pressed={known ? followed : undefined}
      aria-label={t(followed ? "unfollow" : "follow")}
      onClick={() =>
        void library.execute({
          kind: "follow",
          sellerId: id,
          followed: !followed,
        })
      }
    >
      <Icon name={followed ? "check" : "plus"} />
      {t(followed ? "following" : "follow")}
    </button>
  );
}
export function ListingCollectionButton({ id }: { id: string }) {
  const library = useBuyerLibrary(),
    t = useTranslations("library");
  return (
    <button
      type="button"
      className="pill"
      onClick={() => library.openPicker(id)}
    >
      <Icon name="plus-circle" />
      {t("manageCollections")}
    </button>
  );
}
