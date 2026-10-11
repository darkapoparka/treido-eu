"use client";

import { useState, type FormEvent } from "react";
import { useReverification } from "@clerk/nextjs";
import { useDurableRequest } from "../order-aftercare/use-durable-request";
import { aftercareAction, recoverAftercareAction } from "../order-aftercare/actions";
import type { AftercareView } from "../order-aftercare/view";
import { useUnsavedChanges } from "./use-unsaved-changes";
import admin from "./admin.module.css";
import editor from "./admin-editor.module.css";
import styles from "./catalog-workspace.module.css";

export function MerchantShippingForm({ view, legacyRefund }: { view: AftercareView; legacyRefund: boolean }) {
  const bg = view.language === "bg";
  const action = useReverification(aftercareAction);
  const request = useDurableRequest({
    key: `treido-aftercare:${view.actorKey}:${view.orderId}:${view.sellerId}:shipping`,
    actorSubject: view.actorSubject, language: view.language,
    scope: { actorKey: view.actorKey, orderId: view.orderId, sellerId: view.sellerId, language: view.language },
    recovery: { actorKey: view.actorKey, orderId: view.orderId, sellerId: view.sellerId }, action, recover: recoverAftercareAction,
  });
  const [saved, setSaved] = useState({ revision: view.fulfilment.revision, reference: view.fulfilment.trackingReference ?? "", description: view.fulfilment.description ?? "" });
  const [reference, setReference] = useState(saved.reference);
  const [description, setDescription] = useState(saved.description);
  const dirty = reference !== saved.reference || description !== saved.description;
  const stale = saved.revision !== view.fulfilment.revision;
  useUnsavedChanges(dirty && !stale, view.language);
  const canEdit = view.canTrack && view.paymentState === "paid" && view.originalSettlementState === "transferred" &&
    !legacyRefund && !view.refunds.some((refund) => refund.state !== "expired") &&
    !["buyer_confirmed_delivery", "blocked"].includes(view.fulfilment.state);
  function reload() {
    if (dirty && !window.confirm(bg ? "Да се заредят ли запазените данни вместо незапазените промени?" : "Load the saved tracking details and discard unsaved changes?")) return;
    const current = { revision: view.fulfilment.revision, reference: view.fulfilment.trackingReference ?? "", description: view.fulfilment.description ?? "" };
    setSaved(current); setReference(current.reference); setDescription(current.description);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || stale || !view.acceptedCarrier) return;
    request.run({ action: "record_tracking", expectedRevision: saved.revision, carrier: view.acceptedCarrier.code, trackingReference: reference, description });
  }
  if (!view.shippingContractAvailable) return <p>{bg ? "За тази поръчка няма достъпна възможност за записване на доставка. Отвори поддръжката за поръчката, за да прегледаш приетите условия." : "Tracking entry is not available for this order. Open order support to review the accepted terms."}</p>;
  return <form className={styles.form} onSubmit={submit}>
    <p>{bg ? "Това е запис на изпращане от продавача. Не създава товарителница и не е потвърждение за доставка от куриер." : "This records the seller's dispatch report. It does not buy a shipping label or confirm carrier delivery."}</p>
    {view.shippingRecipient?.available && <details><summary>{bg ? "Получател и адрес" : "Recipient and address"}</summary>
      <p>{view.shippingRecipient.purpose}</p><dl>{Object.entries(view.shippingRecipient.recipient).map(([field, value]) => <div key={field}><dt>{({ name: bg ? "Получател" : "Recipient", phone: bg ? "Телефон" : "Phone", address: bg ? "Адрес" : "Address", city: bg ? "Град" : "City", postalCode: bg ? "Пощенски код" : "Postal code", officeCode: bg ? "Офис" : "Office" } as Record<string, string>)[field] ?? field}</dt><dd>{value}</dd></div>)}</dl><small>{view.shippingRecipient.retention}</small>
    </details>}
    {view.fulfilment.trackingReference && <p>{bg ? "Запазена товарителница" : "Saved tracking reference"}: <strong>{view.fulfilment.trackingReference}</strong></p>}
    <fieldset className={styles.fields} disabled={!canEdit || request.disabled || stale}>
      <label className={editor.field}><span>{bg ? "Приет куриер" : "Accepted carrier"}</span><input readOnly value={view.acceptedCarrier?.label ?? ""} /></label>
      <label className={editor.field}><span>{bg ? "Товарителница / референция" : "Tracking reference"}</span><input required maxLength={100} value={reference} onChange={(event) => setReference(event.target.value)} /></label>
      <label className={editor.field}><span>{bg ? "Данни за изпращането" : "Dispatch details"}</span><textarea required maxLength={500} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      {canEdit && <button className={admin.primary} disabled={!dirty}>{view.fulfilment.trackingReference ? (bg ? "Запази данните за доставка" : "Save shipping details") : (bg ? "Запиши изпращането" : "Record dispatch")}</button>}
    </fieldset>
    {!canEdit && <p>{bg ? "Данните за доставка са само за преглед в текущото състояние на поръчката." : "Shipping details are read-only in the order's current state."}</p>}
    {request.status && <p role="status">{request.status}</p>}
    {request.original && <button type="button" className={admin.secondary} disabled={request.pending} onClick={request.recover}>{bg ? "Провери предишното запазване" : "Check previous save"}</button>}
    {stale && !request.original && <div className={styles.actions}><p>{bg ? "Показана е по-нова запазена версия. Зареди я преди следващата промяна." : "A newer saved version is available. Load it before the next change."}</p><button type="button" className={admin.secondary} onClick={reload}>{bg ? "Зареди запазеното" : "Load saved details"}</button></div>}
  </form>;
}
