"use client";
import { useTranslations } from "next-intl";
import type { PublicServiceSettings } from "./model";
import s from "../discovery/marketplace.module.css";
export function PublicServiceInfo({
  services,
}: {
  services: PublicServiceSettings | undefined;
}) {
  const t = useTranslations("sellerSettings");
  if (!services || (!services.contact && !services.delivery)) return null;
  const { contact, delivery } = services;
  return (
    <div data-public-service-info>
      {contact && (
        <section>
          <h3>{t("contact")}</h3>
          <dl>
            {contact.publicEmail && (
              <div>
                <dt>{t("email")}</dt>
                <dd>
                  <a href={"mailto:" + encodeURIComponent(contact.publicEmail)}>
                    {contact.publicEmail}
                  </a>
                </dd>
              </div>
            )}
            {contact.publicPhone && (
              <div>
                <dt>{t("phone")}</dt>
                <dd>
                  <a href={"tel:" + contact.publicPhone.replace(/[^+\d]/g, "")}>
                    {contact.publicPhone}
                  </a>
                </dd>
              </div>
            )}
          </dl>
          {contact.contactNote && (
            <p className={s.description}>{contact.contactNote}</p>
          )}
        </section>
      )}
      {delivery && (
        <section>
          <h3>{t("delivery")}</h3>
          {delivery.pickup && (
            <>
              <h4>{t("collection")}</h4>
              <p>{delivery.pickupArea}</p>
              {delivery.pickupNote && (
                <p className={s.description}>{delivery.pickupNote}</p>
              )}
            </>
          )}
          {delivery.deliveryByArrangement && (
            <>
              <h4>{t("deliveryByArrangement")}</h4>
              <p className={s.description}>{delivery.deliveryNote}</p>
            </>
          )}
          {delivery.returnsNote && (
            <>
              <h4>{t("returns")}</h4>
              <p className={s.description}>{delivery.returnsNote}</p>
            </>
          )}
        </section>
      )}
      <p>{t("buyerNote")}</p>
    </div>
  );
}
