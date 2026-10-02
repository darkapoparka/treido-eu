import Link from "next/link";
import type { SellerContext } from "./persistence.server";
import { AdminIcon } from "./admin-icons";
import { AdminProductArt } from "./admin-product-art";
import {
  productHref,
  productStatuses,
  productStatusLabel,
  type AdminProducts,
} from "./admin-products-model";
import styles from "./admin.module.css";
import { AdminProductTable } from "./admin-product-table";

export function AdminProductList({
  seller,
  data,
  language = "en",
  unavailable = false,
}: {
  seller?: SellerContext;
  data?: AdminProducts;
  language?: "bg" | "en";
  unavailable?: boolean;
}) {
  const bg = language === "bg";
  const base = seller
    ? `/app/sellers/${seller.sellerId}/listings`
    : "/app/products";
  const query = data?.query ?? {
    q: "",
    status: "all",
    sort: "newest" as const,
    cursor: null,
  };
  const create =
    seller && seller.capabilities.includes("listing.write")
      ? `${base}/new?lang=${language}`
      : null;
  const filtered = !!query.q || query.status !== "all" || !!query.cursor;
  return (
    <main>
      <header className={styles.pageBar}>
        <h1>
          <AdminIcon name="product" />
          {bg ? "Продукти" : "Products"}
        </h1>
        {create && !!data?.items.length && (
          <Link href={create} className={styles.primary}>
            <AdminIcon name="plus" />
            {bg ? "Добави продукт" : "Add product"}
          </Link>
        )}
        <details className={styles.pageActions}>
          <summary aria-label={bg ? "Действия на страницата" : "Page actions"}>
            <AdminIcon name="more" />
          </summary>
          <div>
            <Link
              href={
                seller
                  ? `/app/sellers/${seller.sellerId}?lang=${language}`
                  : `/app?lang=${language}`
              }
            >
              {bg ? "Към началото" : "Go to Home"}
            </Link>
          </div>
        </details>
      </header>
      <div className={styles.pageBody}>
        <section
          className={styles.productPanel}
          aria-label={bg ? "Продукти на продавача" : "Seller products"}
        >
          <div className={styles.productToolbar}>
            <nav
              className={styles.statusTabs}
              aria-label={bg ? "Състояние на продуктите" : "Product status"}
            >
              {(data && data.counts.all
                ? productStatuses
                : ["all" as const]
              ).map((status) => (
                <Link
                  key={status}
                  href={productHref(base, language, query, { status })}
                  aria-current={query.status === status ? "page" : undefined}
                >
                  {productStatusLabel(status, language)}
                  {data && data.counts.all > 0 && (
                    <small>{data.counts[status]}</small>
                  )}
                </Link>
              ))}
            </nav>
            {!data?.counts.all && !filtered && (
              <>
                <button
                  type="button"
                  className={styles.toolbarIcon}
                  disabled
                  aria-label={
                    bg
                      ? "Създаването на изглед все още не е достъпно"
                      : "Create new view is not available yet"
                  }
                >
                  <AdminIcon name="plus" />
                </button>
                <div className={styles.toolbarTools}>
                  <button
                    type="button"
                    className={styles.toolbarIcon}
                    disabled
                    aria-label={
                      bg ? "Търси и филтрирай" : "Search and filter results"
                    }
                  >
                    <AdminIcon name="search" />
                  </button>
                  <button
                    type="button"
                    className={styles.toolbarIcon}
                    disabled
                    aria-label={bg ? "Подреди резултатите" : "Sort the results"}
                  >
                    <AdminIcon name="sort" />
                  </button>
                </div>
              </>
            )}
            {data && (data.counts.all > 0 || filtered) && (
              <form action={base} className={styles.filterForm}>
                <input type="hidden" name="lang" value={language} />
                <input type="hidden" name="status" value={query.status} />
                <input
                  name="q"
                  type="search"
                  maxLength={160}
                  defaultValue={query.q}
                  placeholder={bg ? "Търси продукти" : "Search products"}
                  aria-label={bg ? "Търси продукти" : "Search products"}
                />
                <select
                  name="sort"
                  defaultValue={query.sort}
                  aria-label={bg ? "Подредба" : "Sort products"}
                >
                  <option value="newest">
                    {bg ? "Най-нови" : "Newest first"}
                  </option>
                  <option value="oldest">
                    {bg ? "Най-стари" : "Oldest first"}
                  </option>
                </select>
                <button className={styles.secondary}>
                  {bg ? "Приложи" : "Apply"}
                </button>
              </form>
            )}
          </div>
          {!data?.items.length ? (
            <>
              <div className={styles.empty}>
                <div>
                  <h2>
                    {unavailable
                      ? bg
                        ? "Продуктите не са достъпни"
                        : "Products are currently unavailable"
                      : filtered
                        ? bg
                          ? "Няма съвпадащи продукти"
                          : "No matching products"
                        : bg
                          ? "Добави твоите продукти"
                          : "Add your products"}
                  </h2>
                  <p>
                    {unavailable
                      ? bg
                        ? "Опитай отново по-късно. Запазените ти чернови не се променят."
                        : "Try again later. Your saved drafts are unchanged."
                      : filtered
                        ? bg
                          ? "Промени търсенето или филтрите, за да намериш продукт."
                          : "Change your search or filters to find a product."
                        : bg
                          ? "Започни с продуктите, които твоите купувачи ще харесат."
                          : "Start by adding products to your store that your customers will love."}
                  </p>
                  {unavailable ? (
                    <Link href="/sell" className={styles.secondary}>
                      {bg ? "Подготви артикул" : "Prepare an item"}
                    </Link>
                  ) : filtered ? (
                    <Link
                      href={`${base}?lang=${language}`}
                      className={styles.secondary}
                    >
                      {bg ? "Изчисти филтрите" : "Clear filters"}
                    </Link>
                  ) : create ? (
                    <div className={styles.emptyActions}>
                      <Link href={create} className={styles.primary}>
                        <AdminIcon name="plus" />
                        {bg ? "Добави продукт" : "Add product"}
                      </Link>
                      <button
                        type="button"
                        className={styles.secondary}
                        disabled
                        title={
                          bg
                            ? "Импортът все още не е достъпен"
                            : "Import is not available yet"
                        }
                      >
                        {bg ? "Импорт" : "Import"}
                      </button>
                    </div>
                  ) : (
                    <p>
                      {bg
                        ? "Нямаш право да създаваш продукти в този акаунт."
                        : "You do not have permission to create products in this account."}
                    </p>
                  )}
                </div>
                <AdminProductArt />
              </div>
              <div className={styles.emptyFooter}>
                <h3>
                  {bg
                    ? "От чернова до първия купувач"
                    : "From a draft to your first buyer"}
                </h3>
                <p>
                  {bg
                    ? "Добави снимки, категория и цена. Прегледай запазения продукт, за да видиш какво още е нужно за публикуване."
                    : "Add photos, a category and a price to your draft. Review the saved product to check the requirements before you publish it to the Treido marketplace."}
                </p>
                <Link
                  className={styles.secondary}
                  href={
                    seller
                      ? `/app/sellers/${seller.sellerId}?lang=${language}`
                      : `/app?lang=${language}`
                  }
                >
                  {bg ? "Към началото" : "Go to Home"}
                </Link>
              </div>
            </>
          ) : (
            <>
              <AdminProductTable
                key={`${seller!.sellerId}|${language}|${JSON.stringify(query)}`}
                items={data.items}
                sellerId={seller!.sellerId}
                language={language}
                canDuplicate={seller!.capabilities.includes("listing.write")}
                canWithdraw={seller!.capabilities.includes("listing.publish")}
              />
              <div className={styles.pagination}>
                <span>
                  {bg
                    ? "До 30 продукта на страница"
                    : "Up to 30 products per page"}
                </span>
                {query.cursor && (
                  <Link
                    href={productHref(base, language, query)}
                    className={styles.secondary}
                  >
                    {bg ? "Първа страница" : "First page"}
                  </Link>
                )}
                {data.nextCursor && (
                  <Link
                    href={productHref(base, language, query, {
                      cursor: data.nextCursor,
                    })}
                    className={styles.secondary}
                  >
                    {bg ? "Следваща страница" : "Next page"}
                    <AdminIcon name="arrow" />
                  </Link>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
