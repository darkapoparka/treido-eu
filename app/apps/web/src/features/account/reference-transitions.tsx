"use client";
import { ShopSurface } from "../discovery/hydration-boundary";
/* eslint-disable @next/next/no-img-element -- Allowlisted reference branding. */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "../discovery/icons";
import { AccountPage } from "./forms";

export function ShopSplash({
  newJourney = false,
  captured = false,
}: {
  newJourney?: boolean;
  captured?: boolean;
}) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        router.replace(
          newJourney
            ? `/onboarding?journey=new${captured ? "&reference=captured" : ""}`
            : captured
              ? "/onboarding"
              : "/onboarding?welcome=returning",
        ),
      1400,
    );
    return () => window.clearTimeout(timer);
  }, [router, newJourney, captured]);
  return (
    <ShopSurface
      className={"shop-splash" + (newJourney ? " purple" : "")}
      aria-label="Shop loading"
    >
      <img
        className="splash-wordmark"
        src="/api/reference-media/shop-wordmark"
        alt="Shop"
        width="126"
        height="51"
      />
      {!newJourney && (
        <div className="splash-powered">
          powered by{" "}
          <b>
            <svg viewBox="0 0 20 22" aria-hidden="true">
              <path
                fill="currentColor"
                d="M4 5 15 3l3 17-16 1ZM7 5C7-1 13-1 13 4h-2c0-4-3-3-3 1Z"
              />
              <text x="6" y="16" fill="white" fontSize="11" fontStyle="italic">
                S
              </text>
            </svg>
            shopify
          </b>
        </div>
      )}
    </ShopSurface>
  );
}

// Reachable only by explicitly choosing the captured completion in the
// unconnected-provider boundary. This is not a submitted deletion request.
export function DeletionOutcomePreview({ received }: { received: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (received) return;
    const timer = window.setTimeout(
      () =>
        router.replace("/account/delete?stage=received&preview=1", {
          scroll: false,
        }),
      1400,
    );
    return () => window.clearTimeout(timer);
  }, [router, received]);
  return received ? (
    <AccountPage dock={false} className="deletion-received-page">
      <Link
        className="deletion-received-close"
        href="/account/privacy"
        aria-label="Close captured deletion example"
      >
        <Icon name="close" />
      </Link>
      <div className="deletion-received-copy">
        <h1>Your deletion request has been received</h1>
        <p>Your data will be deleted within 30 days.</p>
      </div>
      <span className="sr-only">
        Captured reference example. No deletion request was submitted.
      </span>
    </AccountPage>
  ) : (
    <AccountPage className="delete-account-page">
      <h1>Delete your Shop account</h1>
      <div className="delete-code">
        <h2>Enter the verification code sent to your email</h2>
        <div
          role="status"
          aria-label="Captured deletion processing"
          className="deletion-processing-spinner"
        />
      </div>
    </AccountPage>
  );
}
