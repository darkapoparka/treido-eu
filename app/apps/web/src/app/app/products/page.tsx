import { pageLocale } from "@/features/locale/page-locale.server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import {
  requirePageIdentity,
  readPrivatePage,
} from "@/features/sellers/page-context.server";
import { listOwnedSellers } from "@/features/sellers/persistence.server";
import { AdminProductList } from "@/features/sellers/admin-products";
import {
  parseProductQuery,
  productHref,
} from "@/features/sellers/admin-products-model";
import { Workspace } from "@/features/sellers/workspace";
import { getDatabase } from "@/server/db/database";
import styles from "@/features/sellers/admin.module.css";

export default async function ProductEntry({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const input = await searchParams;
  const language = await pageLocale(input.lang);
  const query = parseProductQuery(input);
  if (!query) notFound();
  if (!backendConfigured())
    return <AdminProductList language={language} unavailable />;
  const identity = await requirePageIdentity(`/app/products?lang=${language}`);
  const sellers = await readPrivatePage(() =>
    listOwnedSellers(getDatabase(), identity),
  );
  const readable = sellers.filter((item) =>
    item.capabilities.includes("listing.read"),
  );
  const selected =
    readable.find((item) => item.kind === "personal") ??
    (readable.length === 1 ? readable[0] : null);
  if (selected)
    redirect(
      productHref(
        `/app/sellers/${selected.sellerId}/listings`,
        language,
        query,
        { cursor: query.cursor },
      ),
    );
  return (
    <Workspace
      title={language === "bg" ? "Избери продавач" : "Choose a seller"}
      language={language}
    >
      <p>
        {language === "bg"
          ? "Отвори каталога на акаунта, в който искаш да работиш."
          : "Open the catalog for the account you want to work in."}
      </p>
      <div className={styles.accounts}>
        {readable.map((seller) => (
          <Link
            className={styles.account}
            key={seller.sellerId}
            href={productHref(
              `/app/sellers/${seller.sellerId}/listings`,
              language,
              query,
            )}
          >
            {seller.name}
          </Link>
        ))}
      </div>
      {!readable.length && (
        <Link className={styles.primary} href="/sell">
          {language === "bg"
            ? "Добави първия си артикул"
            : "Add your first item"}
        </Link>
      )}
    </Workspace>
  );
}
