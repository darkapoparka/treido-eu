"use client";
import { categoryLeaves, getCategory } from "@treido/contracts/categories";
import { SourceLink } from "../discovery/return-navigation";
import { AttributeFields } from "../selling/attribute-fields";
import { inspectHelperDraft, type HelperEdit } from "./sell-helper-model";
import { assistantCopy, type AssistantLocale } from "./copy";
import { suggestHelperEdit } from "./suggestions";
import type { helperDraftSelection } from "./draft-selection.server";
import { money } from "../shopping-tools/copy";
import s from "./assistant-tools.module.css";
export type HelperSelection = Awaited<ReturnType<typeof helperDraftSelection>>;
export function HelperDraftForm({ selection, edit, locale, disabled, confirmed, onConfirm, onEdit, onPrepare }: {
  selection: HelperSelection; edit: HelperEdit; locale: AssistantLocale; disabled: boolean; confirmed: boolean;
  onConfirm: (value: boolean) => void; onEdit: (edit: HelperEdit) => void; onPrepare: () => void;
}) {
  const t = assistantCopy[locale], category = edit.categoryId ? getCategory(edit.categoryId) : null,
    issues = inspectHelperDraft({ ...selection.draft.payload, ...edit }), errors: Record<string, "required" | "invalid"> = {};
  for (const issue of issues) if (issue.reason !== "confirm_at_review") errors[issue.field] = issue.reason === "missing" ? "required" : "invalid";
  const labels = (field: string) => category?.kind === "leaf"
    ? category.profile.fields.find((item) => item.id === field)?.labels[locale] ?? (Object.hasOwn(t, field) ? t[field as keyof typeof t] : field)
    : Object.hasOwn(t, field) ? t[field as keyof typeof t] : field;
  const editable = ["draft", "withdrawn"].includes(selection.draft.publication);
  const allowedCategory = category?.kind === "leaf" && category.policy.sellerKinds.includes(selection.sellerKind);
  return <section className={s.panel} aria-label={t.draft}>
    <h2>{selection.draft.payload.title || t.draft} · #{selection.draft.revision}</h2>
    {!editable && <p role="alert">{t.draftPublished}</p>}
    <p className={s.note}>{t.helperLimit}</p>
    <nav className={s.actions}>
      <SourceLink preserveDiscoveryContext={false} href={`/app/sellers/${selection.draft.sellerId}/listings/${selection.draft.id}/edit?lang=${locale}`}>{t.editor}</SourceLink>
      <SourceLink preserveDiscoveryContext={false} href={`/app/sellers/${selection.draft.sellerId}/listings/${selection.draft.id}/review?lang=${locale}`}>{t.review}</SourceLink>
    </nav>
    <h3>{t.issues}</h3>
    <ul>{issues.map((issue) => <li key={issue.field}>{labels(issue.field)} · {issue.reason === "missing" ? t.missingFact : issue.reason === "invalid" ? t.invalidFact : t.confirm_at_review}</li>)}</ul>
    <fieldset disabled={disabled || !editable}>
      <div className={s.fields}>
        <label className={s.field} htmlFor="helper-title">{t.title}<input id="helper-title" maxLength={160} value={edit.title} onChange={(event) => onEdit({ ...edit, title: event.target.value })} /></label>
        <label className={s.field} htmlFor="helper-category">{t.proposedCategory}
          <select id="helper-category" value={edit.categoryId ?? ""} aria-describedby={!allowedCategory ? "helper-category-required" : undefined} onChange={(event) => onEdit({ ...edit, categoryId: event.target.value ? event.target.value as HelperEdit["categoryId"] : null, fields: {} })}>
            <option value="">{t.choose}</option>
            {categoryLeaves.filter((leaf) => leaf.policy.sellerKinds.includes(selection.sellerKind)).map((leaf) => <option value={leaf.id} key={leaf.id}>{leaf.labels[locale]}</option>)}
          </select>
          {!allowedCategory && <span id="helper-category-required">{t.missingFact}</span>}
        </label>
        <label className={`${s.field} ${s.wide}`} htmlFor="helper-description">{t.description}<textarea id="helper-description" maxLength={6000} value={edit.description} onChange={(event) => onEdit({ ...edit, description: event.target.value })} /></label>
        {category?.kind === "leaf" && <AttributeFields category={category} fields={edit.fields} errors={errors} locale={locale} onChange={(field, value) => onEdit({ ...edit, fields: { ...edit.fields, [field]: value } })} />}
      </div>
      <div className={s.actions}><button type="button" className={s.button} disabled={!allowedCategory} onClick={() => onEdit(suggestHelperEdit({ ...selection.draft.payload, ...edit }, locale))}>{t.suggest}</button></div>
      <label className={s.check}><input type="checkbox" checked={confirmed} onChange={(event) => onConfirm(event.target.checked)} />{t.confirmFacts}</label>
      <button type="button" className={`${s.button} ${s.primary}`} disabled={!confirmed || !allowedCategory} onClick={onPrepare}>{t.prepare}</button>
    </fieldset>
    <h3>{t.asking}</h3><p className={s.note}>{t.askingNote}</p>
    {selection.askingStatus !== "observed" && <p>{selection.askingStatus === "unavailable" ? t.askingUnavailable : t.insufficient}</p>}
    {selection.asking.map((item) => <p key={item.listingId}>
      <SourceLink preserveDiscoveryContext={false} href={`/products/${item.listingId}?lang=${locale}`}>{money(item.priceMinor, locale)}</SourceLink> · {t.publication} {item.revision} · <time dateTime={item.checkedAt}>{new Date(item.checkedAt).toLocaleString(locale, { timeZone: "Europe/Sofia" })}</time>
    </p>)}
  </section>;
}
