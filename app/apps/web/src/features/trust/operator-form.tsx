"use client";
import { useActionState } from "react";
import { moderateListingAction } from "./actions";
import styles from "../sellers/workspace.module.css";
export function OperatorDecisionForm({
  listingId,
  reportId,
  revision,
  requestId,
  language = "en",
}: {
  listingId: string;
  reportId: string;
  revision: number;
  requestId: string;
  language?: "bg" | "en";
}) {
  const [result, action, pending] = useActionState(moderateListingAction, null);
  const bg = language === "bg";
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="expectedRevision" value={revision} />
      <input type="hidden" name="requestId" value={requestId} />
      <fieldset disabled={pending || Boolean(result?.ok)}>
        <label>
          {bg ? "Решение" : "Decision"}
          <select name="state" defaultValue="restricted">
            <option value="restricted">{bg ? "Ограничи" : "Restrict"}</option>
            <option value="removed">{bg ? "Премахни" : "Remove"}</option>
            <option value="clear">
              {bg ? "Без ограничение" : "Clear restriction"}
            </option>
          </select>
        </label>
        <label>
          {bg ? "Основание" : "Reason"}
          <textarea name="reason" required maxLength={2000} rows={3} />
        </label>
        <button type="submit" className={styles.button}>
          {pending
            ? bg
              ? "Запазване…"
              : "Saving…"
            : bg
              ? "Запази решението"
              : "Save decision"}
        </button>
      </fieldset>
      {result && (
        <p role={result.ok ? "status" : "alert"}>
          {result.ok
            ? bg
              ? "Решението е записано. Презаредете опашката."
              : "Decision recorded. Reload the queue."
            : result.code === "CONFLICT"
              ? bg
                ? "Състоянието е променено. Презаредете преди ново решение."
                : "State changed. Reload before deciding again."
              : bg
                ? "Решението не е записано. Проверете достъпа и опитайте отново."
                : "Decision was not recorded. Check access and try again."}
        </p>
      )}
    </form>
  );
}
