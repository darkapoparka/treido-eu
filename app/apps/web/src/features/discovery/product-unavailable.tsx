import { AccountIcon } from "../account/icons";

/** A saved reference item is not a purchase or a live restock subscription. */
export function ProductUnavailable({
  saved,
  onSave,
}: {
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <div className="native-sold-out-actions">
      <button type="button" aria-pressed={saved} onClick={onSave}>
        {saved ? "Saved" : "Add to saved items"}
      </button>
      <p>
        <AccountIcon name="bell" /> We notify you when saved items are back in
        stock
      </p>
      <span className="sr-only">
        Local reference preview only. No restock notifications have been
        enabled.
      </span>
    </div>
  );
}
