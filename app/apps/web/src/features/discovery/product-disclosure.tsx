/* eslint-disable @next/next/no-img-element -- Verified decorative native brand mark. */
import type { ReactNode } from "react";
import { Icon } from "./icons";

/** Native product disclosures share one keyboard-operable, reversible owner.
 * Frozen product sections retain their original non-collapsible composition. */
export function ProductDisclosure({
  title,
  className,
  collapsible,
  children,
  productId,
  initiallyOpen = true,
}: {
  title: string;
  productId?: string;
  className: string;
  collapsible?: boolean;
  initiallyOpen?: boolean;
  children: ReactNode;
}) {
  if (!collapsible)
    return (
      <section className={className} data-product-id={productId}>
        <h2>{title}</h2>
        {children}
      </section>
    );
  return (
    <details
      className={className + " native-pdp-disclosure"}
      data-product-id={productId}
      open={initiallyOpen}
    >
      <summary>
        <h2>{title}</h2>
        <Icon name="chevron" />
      </summary>
      {children}
    </details>
  );
}

export function ProductSummaryCredit() {
  return (
    <small className="native-summary-credit">
      <img
        src="/api/reference-media/live-guest-signin-mark"
        alt=""
        width={16}
        height={16}
      />
      Summarized by Shop
    </small>
  );
}
