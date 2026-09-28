"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AccountPage } from "../account/forms";

/** An Android merchant must never inherit another store's captured USD taxes,
 * shipping rates or payment result. Local cart editing remains available. */
export function LiveCheckoutBoundary({ merchant }: { merchant: string }) {
  const router = useRouter();
  return (
    <AccountPage title="Checkout preview" dock={false}>
      <div className="empty-state">
        <h1>{merchant}</h1>
        <p>This merchant’s checkout has not been captured in this preview.</p>
        <p>
          Shipping, taxes and payment details are unavailable. Nothing will be
          charged.
        </p>
        <button
          className="primary form-submit"
          type="button"
          onClick={() => router.back()}
        >
          Back to shopping
        </button>
        <Link className="pill" href="/cart">
          View your cart
        </Link>
      </div>
    </AccountPage>
  );
}
