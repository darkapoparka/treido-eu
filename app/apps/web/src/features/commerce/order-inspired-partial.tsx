/* eslint-disable @next/next/no-img-element */
import styles from "./orders-parity.module.css";

export function OrderInspiredPartial() {
  return (
    <div
      aria-label="Inspired by your order recommendations"
      className={styles.inspiredPartialRail}
      data-order-inspired-rail
      role="group"
    >
      <div className={styles.inspiredPartialCard} data-order-inspired-card>
        <img
          alt=""
          aria-hidden="true"
          height="100"
          src="/api/reference-media/order-inspired-card-photo"
          width="352"
        />
        <span className={styles.inspiredPartialRating}>★ (11.4K)</span>
      </div>
      <div className={styles.inspiredPartialNext} aria-hidden="true">
        <img
          alt=""
          height="100"
          src="/api/reference-media/order-inspired-next-fragment"
          width="16"
        />
      </div>
    </div>
  );
}

// Only the photographed header is visible in the captured manual-order history.
// Keep it decorative: the source does not expose a product identity or destination.
export function ManualPickedPreview() {
  return (
    <div
      className={styles.manualPickedPreview}
      data-manual-picked-photo
      aria-hidden="true"
    >
      <img
        src="/api/reference-media/order-manual-picked-photo"
        alt=""
        width="359"
        height="74"
      />
    </div>
  );
}
