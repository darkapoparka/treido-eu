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
import { SourceLink } from "../discovery/return-navigation";
import { NativeIcon } from "../discovery/native-icons";
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
  if (!isLoaded && props.view.state !== "unavailable")
    return <ProfileBody {...props} view={{ state: "guest" }} pending />;
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
  pending = false,
}: Props & {
  contact?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  signOut?: () => Promise<void>;
  pending?: boolean;
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
      <Row native={!member} label="Data & privacy" href="/account/privacy" />
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
  const orderEntry = (
    <SourceLink className="public-profile-orders-entry" href="/orders">
      <span className="public-profile-orders-icon" aria-hidden="true">
        <NativeIcon name="orders" />
      </span>
      <span className="public-profile-orders-copy">
        <strong>{bg ? "Вижте поръчките си" : "View your orders"}</strong>
        <small>
          {member || pending
            ? bg
              ? "Покупките ви през Treido са тук."
              : "Purchases made through Treido appear here."
            : bg
              ? "Влезте, за да видите поръчките си."
              : "Sign in to view your orders."}
        </small>
      </span>
      <span className="public-profile-orders-chevron" aria-hidden="true">
        ›
      </span>
    </SourceLink>
  );
  const orders = (
    <div className="account-panel public-profile-orders-card">{orderEntry}</div>
  );
  const identity = (
    <section className="guest-sign-in" aria-busy={pending || undefined}>
      <ProfileAvatar large />
      <h1>
        {pending
          ? bg
            ? "Вашият профил"
            : "Your account"
          : view.state === "unavailable"
            ? bg
              ? "Профилът временно не е достъпен"
              : "Account temporarily unavailable"
            : t("signInOrCreateAnAccount")}
      </h1>
      <p role={pending ? "status" : undefined}>
        {pending
          ? bg
            ? "Зареждане на профила…"
            : "Loading your account…"
          : view.state === "unavailable"
            ? bg
              ? "Не успяхме да потвърдим текущия профил. Опитайте отново."
              : "We could not confirm your current account. Please try again."
            : bg
              ? "Влезте, за да запазвате продукти, да следвате продавачи и да видите поръчките си."
              : "Sign in to save products, follow sellers and view your orders."}
      </p>
      {pending ? null : view.state === "unavailable" ? (
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
        savedMedia: saved.length ? (
          saved.map((product) => (
            <img key={product.id} src={product.images[0]} alt="" />
          ))
        ) : (
          <span className="public-profile-tile-icon" aria-hidden="true">
            <NativeIcon name="heart" />
          </span>
        ),
        followingMedia: followed.length ? (
          followed.map((store) => (
            <span key={store.id} className="store-logo-fallback">
              {store.name.charAt(0)}
            </span>
          ))
        ) : (
          <span className="public-profile-tile-icon" aria-hidden="true">
            <NativeIcon name="storefront" />
          </span>
        ),
        orderContent: orderEntry,
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
