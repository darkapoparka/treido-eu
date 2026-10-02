"use client";
import Link from "next/link";
import { useLocale } from "../locale/provider";
import { parseLocale } from "../locale/locale";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import type { SellerContext } from "./persistence.server";
import styles from "./workspace.module.css";

export function SellerNavigation({
  sellers,
}: {
  sellers: readonly SellerContext[];
}) {
  const params = useParams();
  const pathname = usePathname();
  const preference = useLocale();
  const bg =
    (parseLocale(useSearchParams().get("lang")) ?? preference.locale) === "bg";
  const language = bg ? "bg" : "en";
  const selected = sellers.find(
    (seller) => seller.sellerId === params.sellerId,
  );
  if (!selected) return null;
  const base = `/app/sellers/${selected.sellerId}`;
  return (
    <aside
      className={styles.navigation}
      aria-label={bg ? "Работно пространство на продавача" : "Seller workspace"}
    >
      <details className={styles.sellerChooser}>
        <summary>
          {bg ? "Продавач" : "Seller"}: <strong>{selected.name}</strong>
        </summary>
        <ul>
          {sellers.map((seller) => (
            <li key={seller.sellerId}>
              <Link
                prefetch={false}
                className={styles.link}
                href={`/app/sellers/${seller.sellerId}?lang=${language}`}
                aria-current={
                  seller.sellerId === selected.sellerId ? "true" : undefined
                }
              >
                <span>
                  {seller.name}
                  <small>
                    {seller.kind === "personal"
                      ? bg
                        ? "Личен продавач"
                        : "Personal seller"
                      : bg
                        ? "Бизнес"
                        : "Business"}
                  </small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link className={styles.link} href={`/app/onboarding?lang=${language}`}>
          {bg ? "Добави бизнес" : "Add a business"}
        </Link>
      </details>
      <nav className={styles.tabs} aria-label={bg ? "Продажби" : "My selling"}>
        <Link
          className={styles.link}
          aria-current={pathname === base ? "page" : undefined}
          href={`${base}?lang=${language}`}
        >
          {bg ? "Преглед" : "Overview"}
        </Link>
        {selected.capabilities.includes("listing.write") && (
          <Link
            className={styles.link}
            href={`${base}/listings/new?lang=${language}`}
          >
            {bg ? "Нов артикул" : "New item"}
          </Link>
        )}
        {selected.kind === "business" && (
          <Link
            className={styles.link}
            aria-current={pathname.includes("/onboarding") ? "page" : undefined}
            href={`${base}/onboarding?lang=${language}`}
          >
            {bg ? "Настройки" : "Business setup"}
          </Link>
        )}
      </nav>
    </aside>
  );
}
