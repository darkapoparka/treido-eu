"use client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AccountPage } from "../account/forms";

/** An Android merchant must never inherit another store's captured USD taxes,
 * shipping rates or payment result. Local cart editing remains available. */
export function LiveCheckoutBoundary({ merchant }: { merchant: string }) {
  const ui = useTranslations("commerceUI");
  const router = useRouter();
  return (
    <AccountPage title={ui("checkoutPreview")} dock={false}>
      <div className="empty-state">
        <h1>{merchant}</h1>
        <p>{ui("thisMerchantSCheckoutHasNotBeenCapturedInThis")}</p>
        <p>{ui("shippingTaxesAndPaymentDetailsAreUnavailableNothingWillBe")}</p>
        <button
          className="primary form-submit"
          type="button"
          onClick={() => router.back()}
        >
          {ui("backToShopping")}
        </button>
        <Link className="pill" href="/cart">
          {ui("viewYourCart")}
        </Link>
      </div>
    </AccountPage>
  );
}
