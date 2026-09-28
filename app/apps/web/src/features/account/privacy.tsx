"use client";
/* eslint-disable @next/next/no-img-element */
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
  return (
    <AccountPage
      title="Data & privacy"
      className="account-settings-page privacy-page"
    >
      <section>
        <h2>Data sharing</h2>
        <p>
          We use your personal information to show you more of what you like and
          to make your ads experience better on other websites.
        </p>
        <p>
          If you don’t want to share your personal information for targeted ads,
          you can opt out.
        </p>
        <Link href="https://www.shopify.com/legal/privacy/choices">
          Your Privacy Choices{" "}
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
            ? "Connect Hotmail or Outlook"
            : provider === "amazon"
              ? "Connect Amazon"
              : "Connection unavailable"
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
        aria-label="Close connection"
        onClick={() => router.back()}
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
        Connect{" "}
        {provider === "gmail"
          ? "Gmail"
          : provider === "outlook"
            ? "Outlook"
            : "Amazon"}{" "}
        account
      </h1>
      <p>
        Get tracking updates for all orders
        <br />
        sent to your {provider === "gmail" ? "Gmail" : provider} account
      </p>
      <div className="connection-benefits">
        <p>
          <AccountIcon name="truck-check" />
          Track the progress of your orders associated with your Gmail account
        </p>
        <p>
          <AccountIcon name="shield" />
          Shop will scan your Gmail inbox for order information from your emails
        </p>
        <p>
          <AccountIcon name="unlink" />
          Disconnect at any time from your Shop or Google accounts
        </p>
      </div>
      <button className="primary form-submit" onClick={() => setBoundary(true)}>
        Continue to{" "}
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
      title="Connections"
      className="account-settings-page connections-page"
    >
      <div className="account-panel">
        <h2>Accounts</h2>
        <button className="account-row" onClick={() => setOpen(true)}>
          + Connect an account{" "}
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
          Sol: Browse by Voice
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
        title="Connect an account"
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
                {label}
                <small>Connect account</small>
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
      <h1>Delete your Shop account</h1>
      {codeStage ? (
        <div className="delete-code">
          <h2>Enter the verification code sent to your email</h2>
          <CodeInput
            label="Deletion verification code"
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
            <p>
              Once deleted, Shop won’t remember the info you might have shared
              including your:
            </p>
            <ul>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Order and delivery history</li>
              <li>
                Shop Pay information including credit and debit card numbers,
                billing, and shipping addresses
              </li>
            </ul>
            <p>This action can’t be undone.</p>
          </div>
          <button
            className="danger-button form-submit"
            onClick={() => setConfirm(true)}
          >
            Delete account
          </button>
          <ContextualCloseLink className="form-cancel" href="/account/privacy">
            Cancel
          </ContextualCloseLink>
        </>
      )}
      <Sheet
        open={confirm}
        title="Are you sure you want to delete your account?"
        className="delete-account-confirm"
        headerless
        onClose={() => setConfirm(false)}
      >
        <div className="delete-confirm-title">
          Are you sure you want to delete your account?
        </div>
        <p>Once deleted, your data will be lost.</p>
        <button className="form-cancel" onClick={() => setConfirm(false)}>
          Cancel
        </button>
        <button
          className="danger-button form-submit"
          onClick={() => {
            consumeSheetHistory();
            setConfirm(false);
            router.replace("/account/delete?stage=code", { scroll: false });
          }}
        >
          Delete account
        </button>
      </Sheet>
      <Sheet
        open={boundary}
        title="Account deletion is not connected"
        onClose={() => setBoundary(false)}
      >
        <p>
          No verification code was sent and no deletion request was submitted.
        </p>
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
          View captured deletion example
        </button>
        <button className="form-cancel" onClick={() => setBoundary(false)}>
          Back
        </button>
      </Sheet>
    </AccountPage>
  );
}
