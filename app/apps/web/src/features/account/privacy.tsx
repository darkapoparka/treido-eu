"use client";
/* eslint-disable @next/next/no-img-element */
import { useCaption } from "../locale/use-caption";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AccountPage, Row, CodeInput, Boundary } from "./forms";
import { Sheet, consumeSheetHistory } from "../discovery/components";
import { AccountIcon } from "./icons";
import { useAccount } from "./state";
import { DeletionOutcomePreview } from "./reference-transitions";
import {
  ContextualCloseLink,
  SourceLink,
} from "../discovery/return-navigation";
export function PrivacyPage() {
  const ui = useTranslations("accountUI");
  return (
    <AccountPage
      title={ui("dataPrivacy")}
      className="account-settings-page privacy-page"
    >
      <section>
        <h2>{ui("dataSharing")}</h2>
        <p>{ui("weUseYourPersonalInformationToShowYouMoreOf")}</p>
        <p>{ui("ifYouDonTWantToShareYourPersonalInformation")}</p>
        <Link href="https://www.shopify.com/legal/privacy/choices">
          {ui("yourPrivacyChoices")}{" "}
          <svg
            className="privacy-choices-mark"
            aria-hidden="true"
            viewBox="0 0 32 16"
          >
            <rect width="32" height="16" rx="8" fill="#326bf7" />
            <path
              d="m5 8 3 3 6-7M22 5l5 6m0-6-5 6"
              stroke="white"
              strokeWidth="1.5"
              fill="none"
            />
          </svg>
        </Link>
      </section>
      <Row
        label="Privacy policy"
        href="https://www.shopify.com/legal/privacy/consumers"
      />
      <Row label="Delete account" href="/account/delete" />
    </AccountPage>
  );
}
export function ConnectionsPage() {
  const caption = useCaption();
  const ui = useTranslations("accountUI");
  const params = useSearchParams(),
    router = useRouter();
  const provider = params.get("provider");
  const [open, setOpen] = useState(false),
    [boundary, setBoundary] = useState(false);
  if (provider && provider !== "gmail")
    return (
      <AccountPage
        title={
          provider === "outlook"
            ? ui("connectHotmailOrOutlook")
            : provider === "amazon"
              ? ui("connectAmazon")
              : ui("connectionUnavailable")
        }
      >
        <Boundary
          open
          onClose={() => router.replace("/account/connections")}
          kind={
            provider === "outlook"
              ? "Outlook connection"
              : provider === "amazon"
                ? "Amazon connection"
                : "Account connection"
          }
        />
      </AccountPage>
    );
  return provider ? (
    <AccountPage dock={false} className="gmail-connect">
      <button
        className="connection-close connection-drag-handle"
        aria-label={ui("closeConnection")}
        onClick={() => router.back()}
        data-ui-label="closeConnection"
      >
        <span aria-hidden="true" />
      </button>
      <div className="connection-brands">
        <span className="google-brand">
          <img src="/api/reference-media/connection-google" alt="Google" />
        </span>
        <i>••••</i>
        <img
          className="connection-shop-brand"
          src="/api/reference-media/connection-shop"
          alt="Shop"
        />
      </div>
      <h1>
        {ui("connect")}{" "}
        {provider === "gmail"
          ? "Gmail"
          : provider === "outlook"
            ? "Outlook"
            : "Amazon"}{" "}
        {ui("account")}
      </h1>
      <p>
        {ui("getTrackingUpdatesForAllOrders")}
        <br />
        {ui("sentToYour")} {provider === "gmail" ? "Gmail" : provider}{" "}
        {ui("account")}
      </p>
      <div className="connection-benefits">
        <p>
          <AccountIcon name="truck-check" />
          {ui("trackTheProgressOfYourOrdersAssociatedWithYourGmail")}
        </p>
        <p>
          <AccountIcon name="shield" />
          {ui("shopWillScanYourGmailInboxForOrderInformationFrom")}
        </p>
        <p>
          <AccountIcon name="unlink" />
          {ui("disconnectAtAnyTimeFromYourShopOrGoogleAccounts")}
        </p>
      </div>
      <button className="primary form-submit" onClick={() => setBoundary(true)}>
        {ui("continueTo")}{" "}
        {provider === "gmail"
          ? "Google"
          : provider === "outlook"
            ? "Outlook"
            : "Amazon"}
      </button>
      <Boundary
        open={boundary}
        onClose={() => setBoundary(false)}
        kind="Account connection"
      />
    </AccountPage>
  ) : (
    <AccountPage
      title={ui("connections")}
      className="account-settings-page connections-page"
    >
      <div className="account-panel">
        <h2>{ui("accounts")}</h2>
        <button className="account-row" onClick={() => setOpen(true)}>
          {ui("connectAnAccount")}{" "}
          <span className="connection-provider-marks">
            {["outlook", "amazon", "google"].map((p) => (
              <img
                key={p}
                src={`/api/reference-media/connection-${p}`}
                alt=""
              />
            ))}
          </span>
        </button>
      </div>
      <div className="account-panel">
        <h2>Minis</h2>
        <SourceLink className="account-row" href="/minis/sol">
          <img
            className="connection-mini"
            src="/api/reference-media/mini-sol-icon"
            alt=""
          />
          {ui("solBrowseByVoice")}
        </SourceLink>
        <SourceLink className="account-row" href="/minis/gift">
          <img
            className="connection-mini"
            src="/api/reference-media/mini-gift-icon"
            alt=""
          />
          Gift Sense
        </SourceLink>
      </div>
      <Sheet
        open={open}
        title={ui("connectAnAccount_efeac4")}
        className="connection-provider-sheet"
        onClose={() => setOpen(false)}
      >
        <div className="connection-choices">
          {[
            ["gmail", "Gmail"],
            ["outlook", "Hotmail or Outlook"],
            ["amazon", "Amazon"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                consumeSheetHistory();
                setOpen(false);
                router.replace(`/account/connections?provider=${id}`, {
                  scroll: false,
                });
              }}
            >
              <span>
                <img
                  src={`/api/reference-media/connection-${id === "gmail" ? "google" : id}`}
                  alt=""
                />
              </span>
              <strong>
                {caption(label)}
                <small>{ui("connectAccount")}</small>
              </strong>
              <b>+</b>
            </button>
          ))}
        </div>
      </Sheet>
    </AccountPage>
  );
}
export function DeleteAccount() {
  const ui = useTranslations("accountUI");
  const { profile } = useAccount();
  const router = useRouter(),
    params = useSearchParams();
  const codeStage = params.get("stage") === "code";
  const [confirm, setConfirm] = useState(false),
    [code, setCode] = useState(""),
    [boundary, setBoundary] = useState(false);
  if (
    params.get("preview") === "1" &&
    ["processing", "received"].includes(params.get("stage") ?? "")
  )
    return (
      <DeletionOutcomePreview received={params.get("stage") === "received"} />
    );
  return (
    <AccountPage className="delete-account-page">
      <h1>{ui("deleteYourShopAccount")}</h1>
      {codeStage ? (
        <div className="delete-code">
          <h2>{ui("enterTheVerificationCodeSentToYourEmail")}</h2>
          <CodeInput
            label={ui("deletionVerificationCode")}
            value={code}
            onChange={(v) => {
              setCode(v);
              if (v.length === 6) setBoundary(true);
            }}
          />
        </div>
      ) : (
        <>
          <div className="delete-identity">
            <span className="profile-avatar">{profile.firstName[0]}</span>
            {profile.email}
          </div>
          <div className="delete-copy">
            <p>{ui("onceDeletedShopWonTRememberTheInfoYouMight")}</p>
            <ul>
              <li>{ui("emailAddress")}</li>
              <li>{ui("phoneNumber")}</li>
              <li>{ui("orderAndDeliveryHistory")}</li>
              <li>
                {ui(
                  "shopPayInformationIncludingCreditAndDebitCardNumbersBilling",
                )}
              </li>
            </ul>
            <p>{ui("thisActionCanTBeUndone")}</p>
          </div>
          <button
            className="danger-button form-submit"
            onClick={() => setConfirm(true)}
          >
            {ui("deleteAccount")}
          </button>
          <ContextualCloseLink className="form-cancel" href="/account/privacy">
            {ui("cancel")}
          </ContextualCloseLink>
        </>
      )}
      <Sheet
        open={confirm}
        title={ui("areYouSureYouWantToDeleteYourAccount")}
        className="delete-account-confirm"
        headerless
        onClose={() => setConfirm(false)}
      >
        <div className="delete-confirm-title">
          {ui("areYouSureYouWantToDeleteYourAccount")}
        </div>
        <p>{ui("onceDeletedYourDataWillBeLost")}</p>
        <button className="form-cancel" onClick={() => setConfirm(false)}>
          {ui("cancel")}
        </button>
        <button
          className="danger-button form-submit"
          onClick={() => {
            consumeSheetHistory();
            setConfirm(false);
            router.replace("/account/delete?stage=code", { scroll: false });
          }}
        >
          {ui("deleteAccount")}
        </button>
      </Sheet>
      <Sheet
        open={boundary}
        title={ui("accountDeletionIsNotConnected")}
        onClose={() => setBoundary(false)}
      >
        <p>{ui("noVerificationCodeWasSentAndNoDeletionRequestWas")}</p>
        <button
          className="form-cancel"
          onClick={() => {
            consumeSheetHistory();
            setBoundary(false);
            router.replace("/account/delete?stage=processing&preview=1", {
              scroll: false,
            });
          }}
        >
          {ui("viewCapturedDeletionExample")}
        </button>
        <button className="form-cancel" onClick={() => setBoundary(false)}>
          {ui("back")}
        </button>
      </Sheet>
    </AccountPage>
  );
}
