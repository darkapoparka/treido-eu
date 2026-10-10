"use client";
import { getCategory, getCategoryLabel } from "@treido/contracts/categories";
import { formatAttribute } from "../shopping-tools/tool-ui";
import { toCategoryAttributes } from "../selling/form-model";
import type { HelperProposal, HelperEdit } from "./sell-helper-model";
import { assistantCopy, type AssistantLocale } from "./copy";
import s from "./assistant-tools.module.css";
export function HelperEditFacts({ edit, locale }: { edit: HelperEdit; locale: AssistantLocale }) {
  const t = assistantCopy[locale], category = edit.categoryId ? getCategory(edit.categoryId) : null,
    attributes = category?.kind === "leaf" ? toCategoryAttributes(category, edit.fields) : {};
  return <dl className={s.factList}>
    <dt>{t.title}</dt><dd>{edit.title || t.missingFact}</dd>
    <dt>{t.proposedCategory}</dt><dd>{edit.categoryId ? getCategoryLabel(edit.categoryId, locale) : t.missingFact}</dd>
    <dt>{t.description}</dt><dd>{edit.description || t.missingFact}</dd>
    {Object.entries(attributes).map(([field, value]) => <div className={s.wide} key={field}>
      <dt>{category?.kind === "leaf" ? category.profile.fields.find((item) => item.id === field)?.labels[locale] : field}</dt>
      <dd>{formatAttribute(value as Parameters<typeof formatAttribute>[0], locale)}</dd>
    </div>)}
  </dl>;
}
export function HelperProposalCard({ proposal, locale, disabled, onAccept, onDiscard, onEdit }: {
  proposal: HelperProposal; locale: AssistantLocale; disabled: boolean; onAccept: () => void; onDiscard: () => void; onEdit: () => void;
}) {
  const t = assistantCopy[locale];
  return <article className={s.panel}>
    <h3>{proposal.edit.title || t.draft} · #{proposal.draftRevision}</h3>
    <p><time dateTime={proposal.createdAt}>{new Date(proposal.createdAt).toLocaleString(locale, { timeZone: "Europe/Sofia" })}</time></p>
    {!proposal.current && <p role="alert">{t.stale}</p>}
    <details><summary>{t.before}</summary><HelperEditFacts edit={proposal.original} locale={locale} /></details>
    <h4>{t.after}</h4><HelperEditFacts edit={proposal.edit} locale={locale} />
    <p className={s.note}>{t.helperLimit}</p>
    <div className={s.actions}>
      <button className={s.button} disabled={disabled || !proposal.current} onClick={onEdit}>{t.editProposal}</button>
      <button className={s.button} disabled={disabled || !proposal.current} onClick={onAccept}>{t.accept}</button>
      <button className={s.button} disabled={disabled} onClick={onDiscard}>{t.discard}</button>
    </div>
  </article>;
}
