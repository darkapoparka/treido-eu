import { useTranslations } from "next-intl";
import { AccountIcon } from "../account/icons";

/** A saved reference item is not a purchase or a live restock subscription. */
export function ProductUnavailable({
  saved,
  onSave,
}: {
  saved: boolean;
  onSave: () => void;
}) {
  const ui = useTranslations("discoveryUI");
  return (
    <div className="native-sold-out-actions">
      <button type="button" aria-pressed={saved} onClick={onSave}>
        {saved ? ui("saved") : ui("addToSavedItems")}
      </button>
      <p>
        <AccountIcon name="bell" />{" "}
        {ui("weNotifyYouWhenSavedItemsAreBackInStock")}
      </p>
      <span className="sr-only">
        {ui("localReferencePreviewOnlyNoRestockNotificationsHaveBeenEnabled")}
      </span>
    </div>
  );
}
