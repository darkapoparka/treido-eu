"use client";
import { usePreview } from "./context";
import { Action, Button, Check, Header, Panel, s } from "./ui";
import styles from "./agentic-surface.module.css";

export function AgenticSurface() {
  const { store, text, href } = usePreview();
  const active = store.products.filter(
    (product) => product.status === "Active",
  ).length;
  return (
    <main className={s.page} data-studio-part="page">
      <Header title={text("Agentic", "AI канали")} icon="store" />
      <div className={styles.columns} data-studio-part="agentic-view">
        <div>
          <h2>
            {text(
              "Prepare your catalog for new discovery channels",
              "Подгответе каталога за нови канали за откриване",
            )}
          </h2>
          <p className={styles.intro}>
            {text(
              "Review local products and policies before connecting external AI distribution. This preview does not publish products to AI channels.",
              "Прегледайте локалните продукти и политики преди свързване на външни AI канали. Този преглед не публикува продукти към AI канали.",
            )}
          </p>
          <h3>{text("Get ready", "Подготовка")}</h3>
          <Panel part="agentic-prerequisites">
            <div className={styles.row}>
              <div>
                <strong>
                  {text("Review your products", "Прегледайте продуктите")}
                </strong>
                <p>
                  {active}{" "}
                  {text(
                    "active products in this local preview",
                    "активни продукта в този локален преглед",
                  )}
                </p>
              </div>
              <Action href={href("products")}>
                {text("Review", "Преглед")}
              </Action>
            </div>
            <div className={styles.row}>
              <div>
                <strong>
                  {text(
                    "Review store policies",
                    "Прегледайте политиките на магазина",
                  )}
                </strong>
                <p>
                  {text(
                    "Local draft policies require review before any publication.",
                    "Локалните чернови на политики изискват преглед преди публикуване.",
                  )}
                </p>
              </div>
              <Action href={href("settings/policies")}>
                {text("Review", "Преглед")}
              </Action>
            </div>
          </Panel>
        </div>
        <aside className={s.editorSide}>
          <Panel title={text("Channels", "Канали")}>
            <p>
              {text(
                "External channels are not connected.",
                "Външните канали не са свързани.",
              )}
            </p>
            <Check
              label={text(
                "AI distribution unavailable",
                "AI разпространението не е достъпно",
              )}
              checked={false}
              disabled
              onChange={() => {}}
            />
          </Panel>
          <Panel title={text("Sources", "Източници")}>
            <Action plain href={href("products")}>
              {text("Local product catalog", "Локален продуктов каталог")}
            </Action>
            <p className={s.help}>
              {text(
                "A connected knowledge source is required for external channel answers.",
                "За отговори във външни канали е необходим свързан източник на знания.",
              )}
            </p>
            <Button disabled>
              {text("Add knowledge source", "Добавяне на източник на знания")}
            </Button>
          </Panel>
        </aside>
      </div>
    </main>
  );
}
