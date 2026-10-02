import Image from "next/image";
import styles from "./admin.module.css";

const ARTWORK = {
  products: { src: "/images/admin/onboarding-products-v1.webp", height: 472 },
  store: { src: "/images/admin/onboarding-store-v1.webp", height: 472 },
  review: { src: "/images/admin/onboarding-review-v1.webp", height: 471 },
  profile: { src: "/merchant-admin/onboarding-profile-v1.png", height: 472 },
  shipping: { src: "/merchant-admin/onboarding-shipping-v1.png", height: 472 },
  markets: { src: "/merchant-admin/onboarding-markets-v1.png", height: 472 },
  policies: { src: "/merchant-admin/onboarding-policies-v1.png", height: 472 },
} as const;

/** Original generated Treido illustrations; provenance lives with the assets. */
export function AdminArt({ kind }: { kind: keyof typeof ARTWORK }) {
  const artwork = ARTWORK[kind];
  return (
    <Image
      className={styles.art}
      src={artwork.src}
      width={960}
      height={artwork.height}
      sizes="(max-width: 767px) calc(100vw - 50px), (max-width: 1000px) 50vw, 285px"
      loading="eager"
      alt=""
      aria-hidden="true"
    />
  );
}
