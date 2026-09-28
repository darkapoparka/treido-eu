"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { Catalog } from "../catalog/types";
import { formatMoney } from "../catalog/types";
import { IconButton, SaveButton } from "./components";
import { Icon } from "./icons";
import { KitschWordmark } from "./kitsch-wordmark";
import "./home-campaigns.css";
import { ShopOptionsMenu, type ShopMenuStage } from "./shop-options-menu";

type Campaign = {
  id: string;
  store?: string;
  title?: string;
  rating: string;
  tone: string;
  tall?: boolean;
  photo?: string;
  partialPhoto?: boolean;
  headerPhoto?: string;
  footerPhoto?: string;
  wordmark?: string;
  products: string[];
  partialProducts?: boolean;
  trailingPrice?: string;
  offer?: string;
  threshold?: string;
  continuation?: boolean;
};
// Each composition is a frozen Home capture. Missing photo regions are not fabricated.
const campaigns: Campaign[] = [
  {
    id: "princess",
    store: "princess-polly",
    title: "PRINCESS POLLY",
    rating: "4.5 ★ (414.7K)",
    tone: "princess",
    headerPhoto: "home-campaign-princess-header",
    wordmark: "home-campaign-princess-wordmark",
    products: ["home-princess-top", "home-princess-dress"],
    partialProducts: true,
    trailingPrice: "$35.00",
  },
  {
    id: "drmtlgy",
    store: "drmtlgy",
    title: "DRMTLGY",
    rating: "4.5 ★ (78.1K)",
    tone: "drmtlgy",
    headerPhoto: "home-campaign-drmtlgy-header",
    footerPhoto: "home-campaign-drmtlgy-footer",
    wordmark: "home-campaign-drmtlgy-wordmark",
    products: [
      "home-drmtlgy-eye",
      "home-drmtlgy-retinol",
      "home-drmtlgy-tinted",
      "home-drmtlgy-needleless",
    ],
    offer: "Save $30",
    threshold: "$50",
  },
  {
    id: "mountain",
    store: "mountain-goat",
    rating: "4.9 ★ (2K)",
    tone: "mountain",
    headerPhoto: "home-campaign-mountain-header",
    products: ["home-mountain-pink", "home-mountain-black"],
    partialProducts: true,
    trailingPrice: "$14.00",
  },
  {
    id: "tea",
    store: "loaded-tea",
    rating: "4.8 ★ (101.8K)",
    tone: "tea",
    products: ["home-tea-blue", "home-tea-orange"],
    partialProducts: true,
    trailingPrice: "$4.00",
    offer: "Save $10",
    threshold: "$20",
  },
  {
    id: "accessories",
    rating: "4.3 ★ (1.6K)",
    tone: "accessories",
    headerPhoto: "home-campaign-accessories-header",
    products: [],
    offer: "Save $35",
    threshold: "$140",
  },
  {
    id: "kitsch",
    store: "kitsch",
    title: "/kit·sch/",
    rating: "4.5 ★ (194.9K)",
    tone: "kitsch",
    headerPhoto: "home-campaign-kitsch-header",
    footerPhoto: "home-campaign-kitsch-footer",
    tall: true,
    photo: "home-kitsch-photo",
    partialPhoto: true,
    products: ["home-air-dry-cream", "home-curl-cream", "rice-bundle"],
    offer: "Save $15",
    threshold: "$50",
  },
  {
    id: "carpe",
    store: "carpe",
    rating: "",
    tone: "carpe",
    continuation: true,
    // Only the next campaign's header is visible in f002-006/f042-001/f096-001.
    // Its rating, product identities, prices and lower artwork are unknown.
    products: [],
  },
  {
    id: "pura",
    store: "pura",
    title: "pura.",
    rating: "4.6 ★ (1.1M)",
    tone: "pura",
    tall: true,
    photo: "home-pura-photo",
    headerPhoto: "home-pura-menu-header",
    wordmark: "home-pura-menu-wordmark",
    partialPhoto: true,
    products: [],
  },
];

export type CampaignHistory = "welcome" | "tracking" | "pura-options";

const campaignHistoryIds: Record<CampaignHistory, string[]> = {
  welcome: [
    "princess",
    "drmtlgy",
    "mountain",
    "tea",
    "accessories",
    "kitsch",
    "carpe",
  ],
  tracking: ["drmtlgy", "mountain", "tea", "accessories", "kitsch", "carpe"],
  "pura-options": ["pura", "drmtlgy"],
};

type HomeCampaignReturn = { id: string; top: number; focus: string };

function rememberHomeCampaignReturn(
  event: MouseEvent<HTMLAnchorElement>,
  id: string,
  focus: string,
) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.currentTarget.target === "_blank"
  )
    return;
  const campaign = event.currentTarget.closest<HTMLElement>(".home-campaign");
  if (!campaign) return;
  window.history.replaceState(
    {
      ...window.history.state,
      shopHomeCampaignReturn: {
        id,
        top: campaign.getBoundingClientRect().top,
        focus,
      } satisfies HomeCampaignReturn,
    },
    "",
    window.location.href,
  );
  // Next can preserve a long Home scroll while the destination mounts. Reset
  // before navigation; the owned Home entry restores its campaign anchor on Back.
  window.scrollTo(0, 0);
}

// Campaign photographs preserve the recorded framing without changing detail-page media.
const campaignProductPhotos: Record<string, string> = {
  "home-princess-top": "home-campaign-princess-top",
  "home-princess-dress": "home-campaign-princess-dress",
  "home-tea-blue": "home-campaign-tea-blue",
  "home-tea-orange": "home-campaign-tea-orange",
  "home-mountain-pink": "home-campaign-mountain-pink",
  "home-mountain-black": "home-campaign-mountain-black",
};

const campaignTrailingPhotos: Record<string, string> = {
  princess: "home-campaign-princess-trailing",
  mountain: "home-campaign-mountain-trailing",
  tea: "home-campaign-tea-trailing",
};

export function HomeCampaigns({
  catalog,
  productLayout = "rail",
  productOrder = "welcome",
  history = "welcome",
}: {
  catalog: Catalog;
  productLayout?: "rail" | "grid";
  productOrder?: "welcome" | "tracking";
  history?: CampaignHistory;
}) {
  // Captured histories are bounded sequences, not one rotating global feed.
  // Conceal/Undo only affect the selected card; they never reorder the history.
  const orderedCampaigns = campaignHistoryIds[history].flatMap((id) =>
    campaigns.filter((campaign) => campaign.id === id),
  );
  useEffect(() => {
    const value: unknown = window.history.state?.shopHomeCampaignReturn;
    if (
      !value ||
      typeof value !== "object" ||
      !("id" in value) ||
      typeof value.id !== "string" ||
      !("top" in value) ||
      typeof value.top !== "number" ||
      !("focus" in value) ||
      typeof value.focus !== "string"
    )
      return;
    const saved = value as HomeCampaignReturn;
    let cancelled = false;
    let secondFrame = 0;
    let focusFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (cancelled) return;
        const selector = `[data-campaign="${CSS.escape(saved.id)}"]`;
        const campaign = document.querySelector<HTMLElement>(selector);
        if (!campaign) return;
        const align = () => {
          const delta = campaign.getBoundingClientRect().top - saved.top;
          if (Math.abs(delta) > 0.5)
            window.scrollBy({ top: delta, behavior: "instant" });
        };
        align();
        focusFrame = requestAnimationFrame(() => {
          if (cancelled) return;
          align();
          campaign
            .querySelector<HTMLAnchorElement>(
              `[data-home-campaign-return="${CSS.escape(saved.focus)}"]`,
            )
            ?.focus({ preventScroll: true });
          const state = { ...window.history.state };
          delete state.shopHomeCampaignReturn;
          window.history.replaceState(state, "", window.location.href);
        });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      cancelAnimationFrame(focusFrame);
    };
  }, [history]);
  const [menu, setMenu] = useState<Campaign | null>(null);
  const lastMenu = useRef<Campaign | null>(null);
  const [stage, setStage] = useState<ShopMenuStage>("menu");
  const [hidden, setHidden] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  const selectedStore = catalog.stores.find((s) => s.id === menu?.store);
  function close() {
    setMenu(null);
    setStage("menu");
  }
  return (
    <>
      <div className="home-campaigns" data-campaign-history={history}>
        {orderedCampaigns.map((c) => {
          const store = catalog.stores.find((s) => s.id === c.store),
            concealed = hidden.includes(c.id),
            puraReason =
              c.id === "pura" && menu?.id === c.id && stage === "reason",
            campaignPhoto = puraReason ? "home-pura-reason-photo" : c.photo,
            campaignHeaderPhoto = puraReason
              ? "home-pura-reason-header"
              : c.id === "drmtlgy" && productLayout === "grid"
                ? "home-campaign-drmtlgy-returning-photo"
                : c.headerPhoto,
            campaignWordmark = puraReason
              ? "home-pura-reason-wordmark"
              : c.id === "drmtlgy" && productLayout === "grid"
                ? "home-campaign-drmtlgy-returning-wordmark"
                : c.wordmark;
          const href = c.store ? `/stores/${c.store}` : "/search";
          const rating =
            c.id === "drmtlgy" && productOrder === "welcome"
              ? "4.5 ★ (78K)"
              : c.rating;
          return (
            <section
              key={c.id}
              data-campaign={c.id}
              data-product-order={productOrder}
              aria-label={`${store?.name ?? "Accessories"} campaign`}
              className={`home-campaign campaign-${c.tone} ${c.tall || (c.id === "drmtlgy" && productLayout === "grid") ? "campaign-tall" : ""} ${c.continuation ? "campaign-continuation" : ""} ${c.id === "drmtlgy" && productLayout === "grid" ? "campaign-product-grid" : ""} ${puraReason ? "campaign-pura-reason" : ""} ${concealed ? "campaign-concealed" : ""}`}
            >
              <div
                className="campaign-art"
                inert={concealed}
                aria-hidden={concealed || undefined}
              >
                {campaignHeaderPhoto && (
                  <img
                    className="campaign-header-photo"
                    src={`/api/reference-media/${campaignHeaderPhoto}`}
                    alt=""
                  />
                )}
                {c.footerPhoto &&
                  !(c.id === "drmtlgy" && productLayout === "grid") && (
                    <img
                      className="campaign-footer-photo"
                      src={`/api/reference-media/${c.footerPhoto}`}
                      alt=""
                    />
                  )}
                {campaignPhoto && (
                  <img
                    className={
                      c.partialPhoto
                        ? "campaign-photo-partial"
                        : "campaign-photo"
                    }
                    src={`/api/reference-media/${campaignPhoto}`}
                    alt=""
                  />
                )}
                <header className="campaign-header">
                  <Link
                    href={href}
                    className={`campaign-brand ${c.title ? "campaign-wordmark" : ""}`}
                    aria-label={`Visit ${store?.name ?? "shop"}`}
                    data-home-campaign-return="brand"
                    onClick={(event) =>
                      rememberHomeCampaignReturn(event, c.id, "brand")
                    }
                  >
                    {campaignWordmark ? (
                      <img
                        className="campaign-wordmark-image"
                        src={`/api/reference-media/${campaignWordmark}`}
                        alt={c.title ?? store?.name ?? ""}
                      />
                    ) : c.title ? (
                      c.id === "kitsch" ? (
                        <KitschWordmark />
                      ) : (
                        <span>{c.title}</span>
                      )
                    ) : store ? (
                      <>
                        {store.logo ? (
                          <img src={store.logo} alt="" />
                        ) : (
                          <span
                            className="store-logo-fallback"
                            aria-hidden="true"
                          >
                            {store.name[0]}
                          </span>
                        )}
                        <span>
                          {store.name}
                          {c.rating && <small>{c.rating}</small>}
                        </span>
                      </>
                    ) : null}
                  </Link>
                  {(c.title || !store) && (
                    <span className="campaign-rating">{rating}</span>
                  )}
                  <IconButton
                    icon="more"
                    label={`More options for ${store?.name ?? "shop"}`}
                    onClick={() => {
                      lastMenu.current = c;
                      setMenu(c);
                      setStage("menu");
                    }}
                  />
                </header>
                <div className="campaign-product-rail">
                  {(c.id === "drmtlgy" && productLayout === "grid"
                    ? [
                        "home-drmtlgy-eye",
                        "home-drmtlgy-retinol",
                        "home-drmtlgy-tinted",
                        "home-drmtlgy-bundle",
                        "home-drmtlgy-eye",
                        "home-drmtlgy-masks",
                      ]
                    : c.id === "drmtlgy" && productOrder === "welcome"
                      ? [
                          "home-drmtlgy-retinol",
                          "home-drmtlgy-needleless",
                          "home-drmtlgy-tinted",
                          "home-drmtlgy-eye",
                        ]
                      : c.products
                  ).map((id, index) => {
                    const p = catalog.products.find((p) => p.id === id);
                    return p ? (
                      <article
                        data-campaign-product={id}
                        className={`campaign-product ${c.partialProducts ? "campaign-partial-product" : ""} ${id === "home-drmtlgy-bundle" ? "campaign-bundle" : id === "home-drmtlgy-masks" ? "campaign-eye-masks" : ["home-drmtlgy-eye", "home-drmtlgy-tinted"].includes(id) ? "campaign-isolated-bottle" : ""}`}
                        key={`${id}-${index}`}
                      >
                        <Link
                          href={`/products/${id}`}
                          aria-label={p.title}
                          data-home-campaign-return={`product-${index}`}
                          onClick={(event) =>
                            rememberHomeCampaignReturn(
                              event,
                              c.id,
                              `product-${index}`,
                            )
                          }
                        >
                          <img
                            src={
                              productLayout === "grid" &&
                              id === "home-drmtlgy-retinol"
                                ? "/api/reference-media/home-returning-drmtlgy-retinol"
                                : campaignProductPhotos[id]
                                  ? `/api/reference-media/${campaignProductPhotos[id]}`
                                  : p.images[0]
                            }
                            alt={p.title}
                          />
                        </Link>
                        <span className="campaign-price">
                          {formatMoney(p.price)}
                          {p.compareAt && (
                            <>
                              {" "}
                              <del>{formatMoney(p.compareAt)}</del>
                            </>
                          )}
                        </span>
                        <SaveButton product={p} />
                      </article>
                    ) : null;
                  })}
                  {c.trailingPrice && (
                    <Link
                      className="campaign-product campaign-uncaptured"
                      href={href}
                      aria-label={`More products from ${store?.name}`}
                      data-home-campaign-return="more-products"
                      onClick={(event) =>
                        rememberHomeCampaignReturn(event, c.id, "more-products")
                      }
                    >
                      {campaignTrailingPhotos[c.id] && (
                        <img
                          src={`/api/reference-media/${campaignTrailingPhotos[c.id]}`}
                          alt=""
                        />
                      )}
                      <span className="campaign-price">{c.trailingPrice}</span>
                    </Link>
                  )}
                  {c.id === "accessories" &&
                    [
                      ["home-campaign-accessory-cap", "$38.50", "$99.99"],
                      ["home-campaign-accessory-glasses", "$33.50", "$786.00"],
                      ["home-campaign-accessory-trailing", "$108.50", ""],
                    ].map(([image, price, was], index) => (
                      <Link
                        href="/search"
                        className={`campaign-product campaign-partial-product ${index === 1 ? "campaign-accessory-dark" : ""} ${index === 2 ? "campaign-source-sliver" : ""}`}
                        key={price}
                        aria-label="Browse accessories"
                        data-home-campaign-return={`accessory-${index}`}
                        onClick={(event) =>
                          rememberHomeCampaignReturn(
                            event,
                            c.id,
                            `accessory-${index}`,
                          )
                        }
                      >
                        {image && (
                          <img src={`/api/reference-media/${image}`} alt="" />
                        )}
                        <span className="campaign-price">
                          {price} {was && <del>{was}</del>}
                        </span>
                        {index < 2 && (
                          <span
                            className="save-button campaign-source-save"
                            data-campaign-source-save="accessory"
                            aria-hidden="true"
                          >
                            <Icon name="heart" />
                          </span>
                        )}
                      </Link>
                    ))}
                  {c.id === "pura" &&
                    [0, 1, 2].map((n) => (
                      <Link
                        href={href}
                        key={n}
                        className="campaign-product campaign-uncaptured"
                        aria-label="Explore Pura fragrances"
                        data-home-campaign-return={`fragrance-${n}`}
                        onClick={(event) =>
                          rememberHomeCampaignReturn(
                            event,
                            c.id,
                            `fragrance-${n}`,
                          )
                        }
                      />
                    ))}
                </div>
                {(c.offer || c.id === "princess") && (
                  <Link
                    href={href}
                    className="campaign-cta"
                    data-home-campaign-return="cta"
                    onClick={(event) =>
                      rememberHomeCampaignReturn(event, c.id, "cta")
                    }
                  >
                    <strong>{c.offer ?? "Shop all"}</strong>
                    <Icon name="arrow" />
                  </Link>
                )}
              </div>
              {c.offer && (
                <Link
                  href={href}
                  className="campaign-offer"
                  inert={concealed}
                  aria-hidden={concealed || undefined}
                  data-home-campaign-return="offer"
                  onClick={(event) =>
                    rememberHomeCampaignReturn(event, c.id, "offer")
                  }
                >
                  <b>{c.offer}</b>
                  <span>on orders over {c.threshold}</span>
                </Link>
              )}
              {concealed && c.id === "pura" && (
                <img
                  className="campaign-hidden-photo"
                  src="/api/reference-media/home-pura-hidden-photo"
                  alt=""
                />
              )}
              {concealed && (
                <div className="campaign-hidden-message">
                  <Icon name="eye-off" />
                  <p>We’ll show you less like this</p>
                  <button
                    onClick={() => {
                      setHidden((v) => v.filter((id) => id !== c.id));
                      setNotice("");
                    }}
                  >
                    Undo
                  </button>
                </div>
              )}
              {concealed && notice === c.id && (
                <div className="campaign-hidden-toast" role="status">
                  We’ll show you less like this
                </div>
              )}
            </section>
          );
        })}
      </div>
      <ShopOptionsMenu
        open={!!menu}
        store={selectedStore}
        rating={menu?.rating}
        stage={stage}
        onStageChange={setStage}
        onClose={close}
        onReopen={() => setMenu(lastMenu.current)}
        onHide={() => {
          if (menu) {
            setHidden((values) => [...new Set([...values, menu.id])]);
            setNotice(menu.id);
          }
          close();
        }}
      />
    </>
  );
}
