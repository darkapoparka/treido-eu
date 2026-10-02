"use client";
import { useTranslations } from "next-intl";
/* eslint-disable @next/next/no-img-element -- Bounded reference brand artwork. */
import type { Catalog } from "../catalog/types";
import { AccountPage, Row } from "./forms";
import { ProfileRecent } from "./profile-recent";
import { ProfileFooter } from "./profile-footer";
import { useAccount } from "./state";
import { Icon } from "../discovery/icons";
import { SourceLink } from "../discovery/return-navigation";
import { LanguagePreferenceRow } from "../locale/preference-row";
import { MessagesEntry } from "../messaging/entry";

export function GuestProfile({ catalog }: { catalog: Catalog }) {
  const t = useTranslations("account");
  const { orders } = useAccount();
  return (
    <AccountPage android className="android-guest-profile">
      <section className="guest-sign-in">
        <img src="/api/reference-media/live-guest-signin-mark" alt="" />
        <h1>{t("signInOrCreateAnAccount")}</h1>
        <p>{t("profileIntro")}</p>
        <SourceLink
          className="primary"
          href="/login?journey=new&returnTo=/profile"
        >
          {t("signIn")}
        </SourceLink>
      </section>
      <div className="guest-profile-panels">
        <SourceLink href="/saved">
          <span>
            <Icon name="heart" />
          </span>
          <strong>{t("saved")}</strong>
        </SourceLink>
        <SourceLink href="/following">
          <span>
            <Icon name="storefront" />
          </span>
          <strong>{t("following")}</strong>
        </SourceLink>
      </div>
      <ProfileRecent catalog={catalog} />
      <section className="guest-profile-orders">
        <h2>{t("orderHistory")}</h2>
        {orders.length === 0 ? (
          <div className="guest-no-orders">
            <img src="/api/reference-media/live-guest-order-package" alt="" />
            <span>
              <strong>{t("noOrdersYet")}</strong>
              <p>{t("orderHistoryNote")}</p>
            </span>
          </div>
        ) : (
          orders.map((order) => (
            <SourceLink
              key={order.id}
              className="account-row"
              href={"/orders/" + order.id}
            >
              <strong>{order.name}</strong>
              <span>{order.status}</span>
            </SourceLink>
          ))
        )}
      </section>
      <div className="account-panel guest-profile-settings">
        <LanguagePreferenceRow native />
        <MessagesEntry native />
        <Row native label="Sell an item" href="/sell" />
        <Row native label="Notifications" href="/account/notifications" />
        <Row native label="Data & privacy" href="/account/privacy" />
        <Row native label="Development mode" href="/account/development" />
        <Row native label="Support" href="/support" />
      </div>
      <ProfileFooter native />
    </AccountPage>
  );
}
