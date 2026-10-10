"use client";
import Image from "next/image";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { Action, Button } from "./ui";
import styles from "./campaign-introduction.module.css";

export function CampaignIntroduction({ create }: { create: () => void }) {
  const { text, href } = usePreview();
  return (
    <section className={styles.card} data-studio-part="campaign-introduction">
      <header>
        <span>{text("All", "Всички")}</span>
        <Button
          plain
          disabled
          aria-label={text(
            "Sort campaigns unavailable",
            "Сортирането на кампании не е достъпно",
          )}
        >
          <AdminIcon name="sort" />
        </Button>
      </header>
      <div className={styles.introduction}>
        <div>
          <h2>
            {text(
              "Centralize your campaign planning",
              "Планирайте кампаниите на едно място",
            )}
          </h2>
          <p>
            {text(
              "Prepare campaign ideas, choose products and an audience, and keep their local status together. Delivery and attribution are not connected in this preview.",
              "Подгответе идеи за кампании, изберете продукти и аудитория и следете локалното им състояние. Изпращането и атрибуцията не са свързани в този преглед.",
            )}
          </p>
          <div className={styles.actions}>
            <Button primary onClick={create}>
              {text("Create campaign", "Създаване на кампания")}
            </Button>
            <Action href={href("growth")}>
              {text("Learn more", "Научете повече")}
            </Action>
          </div>
        </div>
        <Image
          src="/images/admin/onboarding-review-v1.webp"
          unoptimized
          width={960}
          height={472}
          alt={text(
            "Treido campaign planning illustration",
            "Илюстрация за планиране на кампании в Treido",
          )}
        />
      </div>
      <div className={styles.apps}>
        <h3>{text("Marketing integrations", "Маркетингови интеграции")}</h3>
        <p>
          {text(
            "App installation, message delivery and advertising require connected providers. You can prepare a local campaign plan here.",
            "Инсталирането на приложения, изпращането на съобщения и рекламирането изискват свързани доставчици. Тук можете да подготвите локален план за кампания.",
          )}
        </p>
        <Button disabled>
          {text(
            "Marketing apps unavailable",
            "Маркетинговите приложения не са достъпни",
          )}
        </Button>
      </div>
    </section>
  );
}
