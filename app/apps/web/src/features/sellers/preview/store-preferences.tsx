"use client";
import { useState } from "react";
import { usePreview } from "./context";
import { Button, Check, EditorBreadcrumb, Field, Panel, s } from "./ui";
import styles from "./store-preferences.module.css";
import { LetterEmptyArtwork } from "./file-empty-artwork";
import { AdminIcon, type AdminIconName } from "../admin-icons";

export function StorePreferences() {
  const { store, text, href, update, notify } = usePreview();
  const [title, setTitle] = useState(
    store.settings.seoTitle ?? store.settings.name,
  );
  const [description, setDescription] = useState(
    store.settings.seoDescription ?? store.settings.description,
  );
  const [crawlerView, setCrawlerView] = useState("All");
  const unavailableRow = (
    en: string,
    bg: string,
    detailEn: string,
    detailBg: string,
    icon?: AdminIconName,
  ) => (
    <div
      className={styles.preferenceRow}
      data-studio-part="store-preference-row"
    >
      {icon && <AdminIcon name={icon} />}
      <span>
        <strong>{text(en, bg)}</strong>
        {detailEn && <small>{text(detailEn, detailBg)}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={false}
        disabled
        aria-label={text(en, bg)}
      />
    </div>
  );
  return (
    <main className={styles.root} data-studio-part="store-preferences">
      <EditorBreadcrumb
        href={href("store")}
        title={text("Online Store", "Магазин")}
        icon="store"
        current={text("Preferences", "Предпочитания")}
      />
      <div className={styles.content}>
        <Panel
          title={text("Store access", "Достъп до магазина")}
          part="store-access"
        >
          <p>
            {text(
              "This is a device-local storefront preview. Password access and business-only access require a real published store.",
              "Това е локален преглед на магазина. Достъпът с парола и достъпът само за бизнес клиенти изискват реален публикуван магазин.",
            )}
          </p>
          <Check
            label={text(
              "Password protection unavailable",
              "Защитата с парола не е достъпна",
            )}
            checked={false}
            disabled
            onChange={() => {}}
          />
          <div className={styles.inset}>
            <strong>
              {text("Business customer access", "Достъп за бизнес клиенти")}
            </strong>
            <Check
              radio
              name="preview-business-access"
              label={text(
                "Access controls are not connected",
                "Контролите за достъп не са свързани",
              )}
              checked
              disabled
              onChange={() => {}}
            />
          </div>
        </Panel>
        <Panel
          title={text(
            "Social sharing image and SEO",
            "Изображение за споделяне и SEO",
          )}
          part="store-seo"
        >
          <div className={styles.seo}>
            <div className={styles.image}>
              <span aria-hidden="true">▧</span>
              <p>
                {text(
                  "Social image publishing is unavailable",
                  "Публикуването на изображение за споделяне не е достъпно",
                )}
              </p>
              <Button disabled>
                {text("Add image", "Добавяне на изображение")}
              </Button>
              <small>
                {text(
                  "Recommended: 1200 × 628 px",
                  "Препоръчително: 1200 × 628 px",
                )}
              </small>
              <div className={styles.socialSummary}>
                <strong>{store.settings.name}</strong>
                <span>{title}</span>
              </div>
            </div>
            <div className={s.stack}>
              <Field
                label={text("Homepage title", "Заглавие на началната страница")}
                help={text(
                  `${title.length} of 70 characters used`,
                  `${title.length} от 70 използвани знака`,
                )}
              >
                <input
                  maxLength={70}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </Field>
              <Field
                label={text("Meta description", "Мета описание")}
                help={text(
                  `${description.length} of 320 characters used`,
                  `${description.length} от 320 използвани знака`,
                )}
              >
                <textarea
                  maxLength={320}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Field>
              <p className={s.help}>
                {text(
                  "Saved only as local preview notes. No live search metadata is published.",
                  "Запазва се само като локални бележки. Не се публикуват мета данни за реално търсене.",
                )}
              </p>
            </div>
          </div>
          {unavailableRow(
            "Automatic hreflang tags",
            "Автоматични hreflang тагове",
            "Search language metadata requires a published storefront.",
            "Езиковите мета данни изискват публикуван магазин.",
            "markets",
          )}
        </Panel>
        <Panel
          title={text("Automatic redirection", "Автоматично пренасочване")}
          part="store-redirection"
        >
          {unavailableRow(
            "Country/region",
            "Държава/регион",
            "Direct visitors to a regional storefront. Regional routing is unavailable in this preview.",
            "Насочване към регионален магазин. Регионалното маршрутизиране не е достъпно в прегледа.",
            "markets",
          )}
          {unavailableRow(
            "Language",
            "Език",
            "Direct visitors to their preferred language. Automatic locale routing is unavailable.",
            "Насочване към предпочитания език. Автоматичното езиково маршрутизиране не е достъпно.",
            "content",
          )}
        </Panel>
        <Panel
          title={text("Spam protection", "Защита от спам")}
          part="store-spam"
        >
          <p className={s.help}>
            {text(
              "Spam protection needs a connected security provider. These controls cannot change store security.",
              "Защитата от спам изисква свързан доставчик за сигурност. Тези контроли не променят сигурността на магазина.",
            )}
          </p>
          {unavailableRow(
            "Contact and comment forms",
            "Контактни форми и коментари",
            "",
            "",
          )}
          {unavailableRow(
            "Login, account creation and password recovery",
            "Вход, създаване на акаунт и възстановяване на парола",
            "",
            "",
          )}
        </Panel>
        <Panel
          title={text("Crawler access", "Достъп за обхождащи роботи")}
          part="store-crawler"
          action={
            <Button disabled>
              {text("Create signature", "Създаване на подпис")}
            </Button>
          }
        >
          <p className={s.help}>
            {text(
              "Crawler signatures require a published store and are unavailable in this preview.",
              "Подписите за роботи изискват публикуван магазин и не са достъпни в прегледа.",
            )}
          </p>
          <div
            className={styles.crawlerTabs}
            role="tablist"
            aria-label={text("Crawler signatures", "Подписи за роботи")}
          >
            {[
              ["All", "Всички"],
              ["Active", "Активни"],
              ["Expired", "Изтекли"],
            ].map(([value, bg]) => (
              <button
                type="button"
                role="tab"
                key={value}
                aria-selected={crawlerView === value}
                onClick={() => setCrawlerView(value)}
              >
                {text(value, bg)}
              </button>
            ))}
          </div>
          <div
            className={styles.crawlerEmpty}
            data-studio-part="store-crawler-empty"
          >
            <LetterEmptyArtwork />
            <strong>
              {text(
                "Crawler credentials are unavailable",
                "Данните за достъп на роботи не са достъпни",
              )}
            </strong>
            <p>
              {text(
                "This preview cannot issue signatures or change access to a published store.",
                "Прегледът не издава подписи и не променя достъпа до публикуван магазин.",
              )}
            </p>
            <Button disabled>
              {text("Create signature", "Създаване на подпис")}
            </Button>
          </div>
        </Panel>
        <div className={s.saveBar}>
          <Button
            primary
            disabled={!title.trim() || title.length > 70}
            onClick={() => {
              update({
                settings: {
                  ...store.settings,
                  seoTitle: title.trim(),
                  seoDescription: description.trim(),
                },
              });
              notify(
                text(
                  "Store preferences saved in this device's preview.",
                  "Предпочитанията са запазени в прегледа на това устройство.",
                ),
              );
            }}
          >
            {text(
              "Save local preferences",
              "Запазване на локалните предпочитания",
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}
