"use client";
import { useState } from "react";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { Action, Button, Modal, s } from "./ui";
import styles from "./sales-channels.module.css";

export function SalesChannels() {
  const { text, href } = usePreview();
  const [details, setDetails] = useState(false);
  return (
    <section className={styles.root} data-studio-part="settings-sales-channels">
      <div className={styles.card}>
        <header>
          <span>{text("Available", "Достъпни")}</span>
          <Button
            plain
            disabled
            aria-label={text(
              "Sort sales channels unavailable",
              "Сортирането на каналите не е достъпно",
            )}
          >
            <AdminIcon name="sort" />
          </Button>
        </header>
        <div className={styles.row}>
          <AdminIcon name="store" />
          <Action plain href={href("store")}>
            {text("Storefront preview", "Преглед на магазина")}
          </Action>
          <Button
            plain
            aria-label={text("Sales channel details", "Подробности за канала")}
            onClick={() => setDetails(true)}
          >
            <AdminIcon name="more" />
          </Button>
        </div>
      </div>
      <p className={s.learn}>
        {text(
          "Device-local appearance. No sales channels are installed.",
          "Локален изглед. Няма инсталирани канали за продажба.",
        )}
      </p>
      {details && (
        <Modal
          title={text("Storefront preview", "Преглед на магазина")}
          onClose={() => setDetails(false)}
          footer={
            <Button onClick={() => setDetails(false)}>
              {text("Done", "Готово")}
            </Button>
          }
        >
          <p>
            {text(
              "Review your local products, pages and store appearance. Channel installation and publication require a connected provider.",
              "Прегледайте локалните продукти, страници и изглед на магазина. Инсталирането и публикуването на канал изискват свързан доставчик.",
            )}
          </p>
          <Action href={href("store/appearance")}>
            {text("Edit appearance", "Редактиране на изгледа")}
          </Action>
        </Modal>
      )}
    </section>
  );
}
