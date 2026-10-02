"use client";
import { useTranslations } from "next-intl";
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
  const ui = useTranslations("accountUI");
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
      aria-label={ui("shopLoading")}
      data-ui-label="shopLoading"
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
          {ui("poweredBy")}{" "}
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
  const ui = useTranslations("accountUI");
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
        aria-label={ui("closeCapturedDeletionExample")}
        data-ui-label="closeCapturedDeletionExample"
      >
        <Icon name="close" />
      </Link>
      <div className="deletion-received-copy">
        <h1>{ui("yourDeletionRequestHasBeenReceived")}</h1>
        <p>{ui("yourDataWillBeDeletedWithin30Days")}</p>
      </div>
      <span className="sr-only">
        {ui("capturedReferenceExampleNoDeletionRequestWasSubmitted")}
      </span>
    </AccountPage>
  ) : (
    <AccountPage className="delete-account-page">
      <h1>{ui("deleteYourShopAccount")}</h1>
      <div className="delete-code">
        <h2>{ui("enterTheVerificationCodeSentToYourEmail")}</h2>
        <div
          role="status"
          aria-label={ui("capturedDeletionProcessing")}
          className="deletion-processing-spinner"
          data-ui-label="capturedDeletionProcessing"
        />
      </div>
    </AccountPage>
  );
}
