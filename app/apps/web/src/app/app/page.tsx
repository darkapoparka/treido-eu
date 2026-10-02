import { pageLocale } from "@/features/locale/page-locale.server";
import Link from "next/link";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import { AdminHome } from "@/features/sellers/admin-home";
import { requirePageIdentity } from "@/features/sellers/page-context.server";
import { readPrivatePage } from "@/features/sellers/page-context.server";
import { readSignupIntent } from "@/features/sellers/setup.server";
import { listOwnedSellers } from "@/features/sellers/persistence.server";
import { startPersonalAction } from "@/features/sellers/actions";
import { getDatabase } from "@/server/db/database";
import styles from "@/features/sellers/workspace.module.css";
import admin from "@/features/sellers/admin.module.css";

export default async function MySellingPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; error?: string }>;
}) {
  const { lang, error } = await searchParams;
  const language = await pageLocale(lang);
  const bg = language === "bg";
  if (!backendConfigured())
    return <AdminHome language={language} unavailable />;
  const identity = await requirePageIdentity(`/app?lang=${language}`);
  const database = getDatabase();
  const { sellers, intent } = await readPrivatePage(async () => ({
    sellers: await listOwnedSellers(database, identity),
    intent: await readSignupIntent(database, identity),
  }));
  return (
    <AdminHome language={language}>
      {error && (
        <p role="alert" className="form-error">
          {bg
            ? "Продажбите временно не са достъпни. Опитайте отново."
            : "Selling is temporarily unavailable. Try again."}
        </p>
      )}
      <div className={styles.actions}>
        <form action={startPersonalAction}>
          <input type="hidden" name="lang" value={language} />
          <button className={styles.button}>
            {bg ? "Продай личен артикул" : "Sell a personal item"}
          </button>
        </form>
        <Link href={`/app/onboarding?lang=${language}`} className={styles.link}>
          {bg ? "Добави бизнес" : "Add a business"}
        </Link>
      </div>
      <Link className={styles.link} href={`/app/intent?lang=${language}`}>
        {intent.revision === 0
          ? bg
            ? "Какво искате да направите първо? · по избор"
            : "What would you like to do first? · optional"
          : bg
            ? "Промени началния избор"
            : "Change your starting preference"}
      </Link>
      {sellers.length ? (
        sellers.map((seller) => (
          <div key={seller.sellerId} className={admin.account}>
            <div>
              <strong>{seller.name}</strong>
              <small>
                {seller.kind === "personal"
                  ? bg
                    ? "Личен продавач"
                    : "Personal seller"
                  : bg
                    ? "Бизнес"
                    : "Business"}
              </small>
            </div>
            <Link
              className={styles.link}
              href={`/app/sellers/${seller.sellerId}?lang=${language}`}
            >
              {bg ? "Отвори" : "Open"}
            </Link>
          </div>
        ))
      ) : (
        <p>
          {bg
            ? "Все още нямате продавач. Започнете с първата си чернова."
            : "You have no seller accounts yet. Start with your first draft."}
        </p>
      )}
    </AdminHome>
  );
}
