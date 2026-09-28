"use client";
/* eslint-disable @next/next/no-img-element */
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
  const router = useRouter();
  const { params, change } = useMiniRoute(usePathname());
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
              aria-label="Go back in Mini"
              onClick={documentType ? closePanel : onBack}
            >
              <Icon name="back" />
            </button>
          ) : (
            <ContextualCloseLink href="/minis" aria-label="Back to Minis">
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
        <ContextualCloseLink href="/minis" aria-label={`Close ${name}`}>
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
          <small>Developed by {nativeInfo.developer}</small>
          <div>
            <button
              onClick={() => {
                setCopyStatus("");
                setSharing(true);
              }}
            >
              <Icon name="share-android" />
              Share
            </button>
            <button onClick={() => openDocument("terms")}>
              <Icon name="info" />
              Terms and conditions
            </button>
            <button onClick={() => openDocument("privacy")}>
              <Icon name="shield-check" />
              Privacy policy
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
          aria-label="Close Mini information"
          onClick={closePanel}
        />
      )}
      {nativeInfo && documentType && (
        <section
          className="mini-native-document"
          aria-label={
            documentType === "terms" ? "Terms and conditions" : "Privacy policy"
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
                  ? "Terms and conditions"
                  : "Privacy policy"}
              </span>
            )}
            <button
              ref={documentClose}
              aria-label="Close provider page"
              onClick={closePanel}
            >
              <Icon name="close" />
            </button>
          </header>
          {documentUrl ? (
            <iframe
              src={documentUrl}
              title={
                documentType === "terms"
                  ? "Provider terms and conditions"
                  : "Provider privacy policy"
              }
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          ) : (
            <p>
              This provider page isn’t connected in the local preview. No
              agreement has been accepted.
            </p>
          )}
        </section>
      )}
      {nativeInfo && (
        <Sheet
          open={sharing}
          title="Sharing link"
          onClose={() => setSharing(false)}
          className="curation-share-sheet"
        >
          <label htmlFor="mini-share-url">Link to {name}</label>
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
            Copy link
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
              aria-label={firstName ? `${firstName}'s profile` : "Your profile"}
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
            By continuing to use this Mini, you agree to the{" "}
            <button onClick={() => setInformation("Terms")}>terms</button> and{" "}
            <button onClick={() => setInformation("Privacy policy")}>
              privacy policy
            </button>{" "}
            of 9.8.
          </p>
        )}
        <p>
          {accessDescription ?? (
            <>
              By Agreeing, {name} will be able to access your profile and update
              your saved products.
            </>
          )}{" "}
          <button onClick={() => setInformation("Mini access")}>
            Learn more
          </button>
        </p>
        {previewNote && <p role="note">{previewNote}</p>}
        <button className="mini-agree" onClick={onContinue}>
          Agree
        </button>
        <button className="mini-without" onClick={onContinue}>
          Continue without access
        </button>
      </Sheet>
      <Sheet
        open={!!information}
        title={information}
        onClose={() => setInformation("")}
      >
        <p className="sheet-copy">
          This local preview does not share your profile or saved products with
          a Mini. External terms and privacy services are not connected.
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
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Allow access to your camera?"
      headerless
      className="native-mini-photo-access"
    >
      <div className="native-mini-access-heading">
        <div>
          <h2>Allow access to your camera?</h2>
          <p>Choose a photo on this device. Nothing is uploaded or analyzed.</p>
        </div>
        <img src={icon} alt="" />
      </div>
      <div className="native-mini-access-actions">
        <button onClick={onClose}>Cancel</button>
        <button onClick={onContinue}>Share</button>
      </div>
    </Sheet>
  );
}
