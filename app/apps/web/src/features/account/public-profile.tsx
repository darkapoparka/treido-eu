"use client";
/* eslint-disable @next/next/no-img-element -- Eligible public library media, same source tile owner. */
import { useClerk, useUser } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicProfileView } from "./public-profile-model";
import type { BuyerPublicView } from "../catalog/buyer-entry-model";
import { publicSearchCatalog } from "../discovery/public-search-model";
import { usePrivateScope } from "../library/session-boundary";
import { LibraryProvider, useBuyerLibrary } from "../library/provider";
import { GuestProfile } from "./guest-profile";
import { ProfileRecent } from "./profile-recent";
import { Row } from "./forms";
import { ProfilePage, AccountDetails } from "./pages";
import { ProfileAvatar } from "./profile-media";
import { AccountIcon } from "./icons";
import { SourceLink } from "../discovery/return-navigation";
import { Sheet } from "../discovery/components";
import "../discovery/buyer-surface.css";
import "./public-profile.css";

type Props = {
  view: PublicProfileView;
  discovery: BuyerPublicView;
  details?: boolean;
};
export function PublishedProfile(props: Props) {
  const catalog = publicSearchCatalog(props.discovery);
  return (
    <LibraryProvider
      query={{
        listingIds: catalog.products.map((item) => item.id),
        sellerIds: catalog.stores.map((store) => store.id),
      }}
    >
      {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
        <CurrentProfile {...props} />
      ) : (
        <ProfileBody {...props} view={{ state: "unavailable" }} />
      )}
    </LibraryProvider>
  );
}
function CurrentProfile(props: Props) {
  const { user, isLoaded } = useUser(),
    clerk = useClerk(),
    scope = usePrivateScope();
  const member = props.view.state === "member";
  const matching =
    props.view.state === "member" &&
    isLoaded &&
    user?.id === props.view.subject &&
    scope.subject === props.view.subject &&
    scope.isCurrent();
  // Server and current client identity must both agree before contact or saved
  // preference data becomes visible, including a tab restored after sign-out.
  if ((member && !matching) || (!member && isLoaded && user))
    return <ProfileBody {...props} view={{ state: "unavailable" }} />;
  return (
    <ProfileBody
      {...props}
      contact={
        matching && user
          ? {
              firstName: user.firstName ?? "",
              lastName: user.lastName ?? "",
              email: user.primaryEmailAddress?.emailAddress ?? "",
              phone: user.primaryPhoneNumber?.phoneNumber ?? "",
            }
          : undefined
      }
      signOut={
        matching
          ? async () => {
              if (scope.isCurrent())
                await clerk.signOut({ redirectUrl: "/profile" });
            }
          : undefined
      }
    />
  );
}
function ProfileBody({
  view,
  discovery,
  details = false,
  contact,
  signOut,
}: Props & {
  contact?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  signOut?: () => Promise<void>;
}) {
  const t = useTranslations("account"),
    locale = useLocale(),
    bg = locale === "bg",
    router = useRouter(),
    library = useBuyerLibrary();
  const [unavailable, setUnavailable] = useState(false);
  const member = view.state === "member" && !!contact;
  const unavailableText = bg
    ? "Тази възможност още не е свързана с реалния профил. Няма запазени промени."
    : "This feature is not connected to your real account yet. No changes were saved.";
  const signIn =
    "/sign-in?returnTo=" +
    encodeURIComponent((details ? "/account" : "/profile") + "?lang=" + locale);
  const preferences =
    view.state === "member" ? view.preferences?.preferences : null;
  const settings = (
    <div
      className={
        member
          ? "account-panel profile-settings-panel"
          : "account-panel guest-profile-settings"
      }
    >
      <Row
        native={!member}
        label={bg ? "Език" : "Language"}
        value={
          preferences?.locale === "bg"
            ? "Български"
            : preferences?.locale === "en"
              ? "English"
              : undefined
        }
        href="/account/privacy/preferences"
      />
      <Row
        native={!member}
        label={bg ? "Вид продавач" : "Seller scope"}
        value={
          preferences?.browseScope
            ? {
                all: bg ? "Всички" : "All",
                personal: bg ? "Лични" : "Personal",
                business: bg ? "Бизнес" : "Business",
              }[preferences.browseScope]
            : undefined
        }
        href="/account/privacy/preferences"
      />
      <Row
        native={!member}
        label={bg ? "Съобщения" : "Messages"}
        href="/messages"
      />
      <Row native={!member} label="Sell an item" href="/sell" />
      {member && <Row label="Sign in & security" href="/account/security" />}
      <Row
        native={!member}
        label="Notifications"
        href="/account/notifications"
      />
      {member && (
        <Row label="Connections" onClick={() => setUnavailable(true)} />
      )}
      <Row native={!member} label="Data & privacy" href="/account/privacy" />
      {!member && (
        <Row
          native
          label="Development mode"
          onClick={() => setUnavailable(true)}
        />
      )}
      <Row native={!member} label="Support" href={"/support?lang=" + locale} />
      {view.state === "member" && view.preferencesUnavailable && (
        <p className="form-note" role="status">
          {bg
            ? "Настройките на профила временно не са достъпни."
            : "Account preferences are temporarily unavailable."}
        </p>
      )}
      {view.state === "member" && view.preferences?.registrationNeeded && (
        <p className="form-note" role="status">
          {bg
            ? "Завършете регистрацията в настройките на профила."
            : "Complete registration in account settings."}
        </p>
      )}
    </div>
  );
  const orders = (
    <div className="guest-no-orders">
      <AccountIcon name="clipboard" />
      <span>
        <strong>{t("orderHistory")}</strong>
        <p>
          {member
            ? bg
              ? "Вижте поръчките, потвърдени от Treido."
              : "View orders confirmed by Treido."
            : bg
              ? "Влезте, за да видите поръчките си."
              : "Sign in to view your orders."}
        </p>
        <SourceLink href="/orders">{t("orderHistory")}</SourceLink>
      </span>
    </div>
  );
  const identity = (
    <section className="guest-sign-in">
      <ProfileAvatar large />
      <h1>
        {view.state === "unavailable"
          ? bg
            ? "Профилът временно не е достъпен"
            : "Account temporarily unavailable"
          : t("signInOrCreateAnAccount")}
      </h1>
      <p>
        {view.state === "unavailable"
          ? bg
            ? "Не успяхме да потвърдим текущия профил. Опитайте отново."
            : "We could not confirm your current account. Please try again."
          : bg
            ? "Влезте, за да запазвате продукти, да следвате продавачи и да видите поръчките си."
            : "Sign in to save products, follow sellers and view your orders."}
      </p>
      {view.state === "unavailable" ? (
        <button className="primary" onClick={() => router.refresh()}>
          {bg ? "Опитайте отново" : "Try again"}
        </button>
      ) : (
        <SourceLink className="primary" href={signIn}>
          {t("signIn")}
        </SourceLink>
      )}
    </section>
  );
  const recent = (
    <ProfileRecent catalog={publicSearchCatalog(discovery)} publicData />
  );
  const catalog = publicSearchCatalog(discovery);
  const saved =
    library.status === "ready"
      ? catalog.products
          .filter((product) => library.view?.savedIds.includes(product.id))
          .slice(0, 3)
      : [];
  const followed =
    library.status === "ready"
      ? catalog.stores
          .filter((store) => library.view?.followedIds.includes(store.id))
          .slice(0, 3)
      : [];
  const onUnavailable = () => setUnavailable(true);
  const body = details ? (
    <AccountDetails
      publicProfile={{
        contact,
        onUnavailable,
        identity: member ? undefined : identity,
        settings,
      }}
    />
  ) : member && contact ? (
    <ProfilePage
      catalog={catalog}
      publicProfile={{
        contact,
        onUnavailable,
        settings,
        recent,
        savedMedia: saved.map((product) => (
          <img key={product.id} src={product.images[0]} alt="" />
        )),
        followingMedia: followed.map((store) => (
          <span key={store.id} className="store-logo-fallback">
            {store.name.charAt(0)}
          </span>
        )),
        orderContent: (
          <div className="profile-empty-orders">
            <span className="profile-empty-package" aria-hidden="true">
              <AccountIcon name="clipboard" />
            </span>
            <span>
              <strong>{t("orderHistory")}</strong>
              <small>
                {bg
                  ? "Вижте поръчките, потвърдени от Treido."
                  : "View orders confirmed by Treido."}
              </small>
            </span>
            <SourceLink className="pill" href="/orders">
              {t("orderHistory")}
            </SourceLink>
          </div>
        ),
        signOut: async () => {
          if (signOut) await signOut();
        },
      }}
    />
  ) : (
    <GuestProfile publicBody={{ identity, recent, orders, settings }} />
  );
  return (
    <>
      {body}
      <Sheet
        open={unavailable}
        title={bg ? "Не е достъпно" : "Unavailable"}
        className="buyer-public-account"
        onClose={() => setUnavailable(false)}
      >
        <p className="form-note">{unavailableText}</p>
        <button
          className="primary form-submit"
          onClick={() => setUnavailable(false)}
        >
          {bg ? "Затвори" : "Close"}
        </button>
      </Sheet>
    </>
  );
}
