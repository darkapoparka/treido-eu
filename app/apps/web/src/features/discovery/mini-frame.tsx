"use client";
/* eslint-disable @next/next/no-img-element */
import { useCaption } from "../locale/use-caption";
import { useLocale, useTranslations } from "next-intl";
import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMiniRoute } from "./mini-navigation";
import type { NativeMiniInformation } from "./mini-model";
import "./mini-native-host.css";
import { useAccount } from "../account/state";
import { AccountIcon } from "../account/icons";
import { Sheet } from "./components";
import { ShopSurface } from "./hydration-boundary";
import { Icon } from "./icons";
import { ContextualCloseLink } from "./return-navigation";
import { discoveryDestination } from "./browse-scope-route";
import { localeDestination } from "../locale/locale";

export function MiniShell({
  name,
  children,
  showBack = true,
  onBack,
  onMenu,
  menuLabel = "Sol preview controls",
  className = "",
  nativeInfo,
}: {
  name: string;
  children: ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  onMenu?: () => void;
  menuLabel?: string;
  className?: string;
  nativeInfo?: NativeMiniInformation;
}) {
  const ui = useTranslations("discoveryUI");
  const locale = useLocale();
  const router = useRouter();
  const { params, change } = useMiniRoute(usePathname());
  const catalogueHref = localeDestination(
    discoveryDestination("/minis", params),
    locale === "en" ? "en" : "bg",
  );
  const menuOpen = Boolean(nativeInfo && params.get("miniMenu") === "1");
  const requestedDocument = params.get("miniDocument");
  const documentType =
    nativeInfo &&
    (requestedDocument === "terms" || requestedDocument === "privacy")
      ? requestedDocument
      : null;
  const documentUrl =
    documentType === "terms"
      ? nativeInfo?.termsUrl
      : documentType === "privacy"
        ? nativeInfo?.privacyUrl
        : undefined;
  const [sharing, setSharing] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [menuHeight, setMenuHeight] = useState(222);
  const menu = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const documentClose = useRef<HTMLButtonElement>(null);
  const hadPanel = useRef(false);
  const closePanel = useCallback(() => {
    if (window.history.state?.nativeMiniPanel) router.back();
    else change({ miniMenu: null, miniDocument: null }, true);
  }, [change, router]);
  const openDocument = (document: "terms" | "privacy") =>
    change({ miniMenu: null, miniDocument: document }, true, {
      nativeMiniPanel: true,
    });
  useLayoutEffect(() => {
    if (menuOpen && menu.current) {
      const resize = () =>
        setMenuHeight(menu.current?.getBoundingClientRect().height ?? 222);
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(menu.current);
      menu.current
        .querySelector<HTMLButtonElement>("button")
        ?.focus({ preventScroll: true });
      hadPanel.current = true;
      return () => observer.disconnect();
    }
    if (documentType) {
      documentClose.current?.focus({ preventScroll: true });
      hadPanel.current = true;
    } else if (hadPanel.current) {
      menuButton.current?.focus({ preventScroll: true });
      hadPanel.current = false;
    }
  }, [menuOpen, documentType]);
  useEffect(() => {
    if (!menuOpen && !documentType) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) {
        event.preventDefault();
        closePanel();
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", escape);
    };
  }, [menuOpen, documentType, closePanel]);
  return (
    <ShopSurface
      className={`mini-shell ${className}${nativeInfo ? " android-mini" : ""}`}
    >
      <header>
        {showBack || documentType ? (
          onBack || documentType ? (
            <button
              aria-label={ui("goBackInMini")}
              onClick={documentType ? closePanel : onBack}
              data-ui-label="goBackInMini"
            >
              <Icon name="back" />
            </button>
          ) : (
            <ContextualCloseLink
              href={catalogueHref}
              aria-label={ui("backToMinis")}
              data-ui-label="backToMinis"
            >
              <Icon name="back" />
            </ContextualCloseLink>
          )
        ) : (
          <span aria-hidden="true" />
        )}
        {onMenu || nativeInfo ? (
          <button
            ref={menuButton}
            className="mini-shell-title"
            aria-label={nativeInfo ? `About ${name}` : menuLabel}
            aria-expanded={nativeInfo ? menuOpen : undefined}
            onClick={
              nativeInfo
                ? () =>
                    menuOpen
                      ? closePanel()
                      : change(
                          { miniMenu: "1", miniDocument: null },
                          Boolean(documentType),
                          { nativeMiniPanel: true },
                        )
                : onMenu
            }
          >
            <span>{name}</span>
            <Icon name="chevron" />
          </button>
        ) : (
          <span className="mini-shell-title">
            <span>{name}</span>
            <Icon name="chevron" />
          </span>
        )}
        <ContextualCloseLink
          href={catalogueHref}
          aria-label={ui("closeValue1", { value1: name ?? "" })}
        >
          <Icon name="close" />
        </ContextualCloseLink>
      </header>
      {nativeInfo && menuOpen && (
        <nav
          ref={menu}
          className="mini-native-menu"
          aria-label={name + " information"}
        >
          <p>{nativeInfo.description}</p>
          <small>
            {ui("developedBy")} {nativeInfo.developer}
          </small>
          <div>
            <button
              onClick={() => {
                setCopyStatus("");
                setSharing(true);
              }}
            >
              <Icon name="share-android" />
              {ui("share")}
            </button>
            <button onClick={() => openDocument("terms")}>
              <Icon name="info" />
              {ui("termsAndConditions")}
            </button>
            <button onClick={() => openDocument("privacy")}>
              <Icon name="shield-check" />
              {ui("privacyPolicy")}
            </button>
          </div>
        </nav>
      )}
      {nativeInfo ? (
        <div
          className="mini-native-content"
          inert={menuOpen || Boolean(documentType) ? true : undefined}
          style={{
            transform: menuOpen
              ? `translateY(${menuHeight + 12}px)`
              : undefined,
          }}
        >
          {children}
        </div>
      ) : (
        children
      )}
      {menuOpen && (
        <button
          className="mini-native-shade"
          style={{ top: 44 + menuHeight + 12 }}
          aria-label={ui("closeMiniInformation")}
          onClick={closePanel}
          data-ui-label="closeMiniInformation"
        />
      )}
      {nativeInfo && documentType && (
        <section
          className="mini-native-document"
          aria-label={
            documentType === "terms"
              ? ui("termsAndConditions")
              : ui("privacyPolicy")
          }
        >
          <header>
            {documentUrl ? (
              <a href={documentUrl} target="_blank" rel="noreferrer">
                {new URL(documentUrl).host}
              </a>
            ) : (
              <span>
                {documentType === "terms"
                  ? ui("termsAndConditions")
                  : ui("privacyPolicy")}
              </span>
            )}
            <button
              ref={documentClose}
              aria-label={ui("closeProviderPage")}
              onClick={closePanel}
              data-ui-label="closeProviderPage"
            >
              <Icon name="close" />
            </button>
          </header>
          {documentUrl ? (
            <iframe
              src={documentUrl}
              title={
                documentType === "terms"
                  ? ui("providerTermsAndConditions")
                  : ui("providerPrivacyPolicy")
              }
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          ) : (
            <p>{ui("thisProviderPageIsnTConnectedInTheLocalPreview")}</p>
          )}
        </section>
      )}
      {nativeInfo && (
        <Sheet
          open={sharing}
          title={ui("sharingLink")}
          onClose={() => setSharing(false)}
          className="curation-share-sheet"
        >
          <label htmlFor="mini-share-url">
            {ui("linkTo")} {name}
          </label>
          <input
            id="mini-share-url"
            value={nativeInfo.shareUrl}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            className="primary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(nativeInfo.shareUrl);
                setCopyStatus("Link copied");
              } catch {
                setCopyStatus("Select the link above to copy it manually.");
              }
            }}
          >
            {ui("copyLink")}
          </button>
          <p role="status">{copyStatus}</p>
        </Sheet>
      )}
    </ShopSurface>
  );
}

export function MiniAccess({
  open,
  onClose,
  onContinue,
  name,
  accessDescription,
  profileImageSrc,
  profileImageRequiresName = false,
  previewNote,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
  name: string;
  accessDescription?: string;
  profileImageSrc?: string;
  profileImageRequiresName?: boolean;
  previewNote?: string;
  className?: string;
}) {
  const caption = useCaption();
  const ui = useTranslations("discoveryUI");
  const account = useAccount();
  const [information, setInformation] = useState("");
  const firstName = account.profile.firstName.trim();
  const title =
    name === "Gift Sense"
      ? firstName
        ? `Continue as ${firstName}?`
        : "Continue to Gift Sense?"
      : "Continue";
  return (
    <>
      <Sheet
        open={open}
        title={title}
        headerless
        className={`mini-access ${className}`}
        onClose={onClose}
      >
        <div className="mini-access-heading">
          <h2 aria-hidden="true">{title}</h2>
          <div>
            <img
              src={`/api/reference-media/mini-${name === "Gift Sense" ? "gift" : "sol"}-icon`}
              alt=""
            />
            <span
              aria-label={
                firstName ? `${firstName}'s profile` : ui("yourProfile")
              }
            >
              {profileImageSrc && (!profileImageRequiresName || firstName) ? (
                <img src={profileImageSrc} alt="" />
              ) : firstName ? (
                firstName[0]
              ) : (
                <AccountIcon name="person" />
              )}
            </span>
          </div>
        </div>
        {name !== "Gift Sense" && (
          <p>
            {ui("byContinuingToUseThisMiniYouAgreeToThe")}{" "}
            <button onClick={() => setInformation("Terms")}>
              {ui("terms")}
            </button>{" "}
            {ui("and")}{" "}
            <button onClick={() => setInformation("Privacy policy")}>
              {ui("privacyPolicy_2b7281")}
            </button>{" "}
            {ui("of98")}
          </p>
        )}
        <p>
          {accessDescription ?? (
            <>
              {ui("byAgreeing")} {name}{" "}
              {ui("willBeAbleToAccessYourProfileAndUpdateYour")}
            </>
          )}{" "}
          <button onClick={() => setInformation("Mini access")}>
            {ui("learnMore")}
          </button>
        </p>
        {previewNote && <p role="note">{previewNote}</p>}
        <button className="mini-agree" onClick={onContinue}>
          {ui("agree")}
        </button>
        <button className="mini-without" onClick={onContinue}>
          {ui("continueWithoutAccess")}
        </button>
      </Sheet>
      <Sheet
        open={!!information}
        title={caption(information)}
        onClose={() => setInformation("")}
      >
        <p className="sheet-copy">
          {ui("thisLocalPreviewDoesNotShareYourProfileOrSaved")}
        </p>
      </Sheet>
    </>
  );
}

/** Native pre-picker presentation, with an explicit browser-only data boundary. */
export function NativeMiniPhotoAccess({
  open,
  onClose,
  onContinue,
  icon,
}: {
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
  icon: string;
}) {
  const ui = useTranslations("discoveryUI");
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={ui("allowAccessToYourCamera")}
      headerless
      className="native-mini-photo-access"
    >
      <div className="native-mini-access-heading">
        <div>
          <h2>{ui("allowAccessToYourCamera")}</h2>
          <p>{ui("chooseAPhotoOnThisDeviceNothingIsUploadedOr")}</p>
        </div>
        <img src={icon} alt="" />
      </div>
      <div className="native-mini-access-actions">
        <button onClick={onClose}>{ui("cancel")}</button>
        <button onClick={onContinue}>{ui("share")}</button>
      </div>
    </Sheet>
  );
}
