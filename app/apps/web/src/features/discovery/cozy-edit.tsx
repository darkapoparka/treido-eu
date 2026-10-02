"use client";
/* eslint-disable @next/next/no-img-element -- Private reference photographs. */
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ShopSurface } from "./hydration-boundary";
import { FloatingNav, IconButton, ProductCard, Sheet } from "./components";
import { DecorativeVideo } from "./decorative-video";
import type { Catalog } from "../catalog/types";
import "./cozy-edit.css";

const sections = [
  {
    id: "living",
    motionAvailable: true,
    title: "For a lived-in living room",
    mediaLabel: "A collection of cozy throws",
    copy: "When crisp air has you spending more time inside, invite warmth into your living space with earth-toned accessories, soft lighting, and sumptuous fabrics.",
    products: [
      "wake-light",
      "camila-throw",
      "olive-mugs",
      "matisse-throw",
      "hinoki-candle",
      "vera-sconce",
    ],
    quote:
      "“Wall sconces cast a beautiful wash of light across the wall, instantly making the room feel more inviting.”",
    attribution: "Jessica Alpert, designer and ADPro Directory member",
  },
  {
    id: "corner",
    motionAvailable: true,
    title: "For a comfier corner",
    mediaLabel: "A collection of textured pillows",
    copy: "Make any nook in your home a restful autumnal oasis by adding a sculptural lamp, layers of wool and waffle-textured pillows, and a handwoven basket to house your reading materials.",
    products: [
      "wavy-lamp",
      "nina-rug",
      "waffle-pillow",
      "teddy-pillow",
      "fir-candle",
      "striped-basket",
    ],
    quote:
      '"Evergreen scents aren\'t just for Christmastime. I start lighting this Douglas Fir candle from Flamingo Estate as soon as the temperature drops below 60 degrees."',
    attribution: "Abbey Stone, AD senior shopping director",
  },
  {
    id: "bedroom",
    // The retained source has a settled frame, not a usable motion capture.
    motionAvailable: false,
    title: "For a dreamy bedroom",
    mediaLabel: "Layers of cozy bedding",
    copy: "Transition your bedroom from summer to fall by adding creamy cashmere layers to your bed. Details like tapered candles and Moroccan water glasses on your bedside table can make your room feel staycation-worthy.",
    products: [
      "sateen-sheets",
      "cashmere-throw",
      "honey-tapers",
      "amber-glasses",
      "match-striker",
      "pastel-stemware",
    ],
    quote:
      "“Brooklinen's sateen sheets are spectacularly soft. They're silky to the touch and have moisture-wicking properties that keep me cool under a pile of blankets.”",
    attribution: "Julia Harrison, AD shopping writer",
  },
] as const;

function EditorialQuote({
  text,
  attribution,
}: {
  text: string;
  attribution: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setVisible(true);
        observer.disconnect();
      },
      { threshold: 0.15 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <figure
      ref={ref}
      className={`android-curation-quote ${visible ? "is-visible" : ""}`}
    >
      <blockquote>{text}</blockquote>
      {attribution && <figcaption>{attribution}</figcaption>}
    </figure>
  );
}

export function CozyEdit({ catalog }: { catalog: Catalog }) {
  const ui = useTranslations("discoveryUI");
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  return (
    <ShopSurface className="shop-page android-live android-curation">
      <header className="android-curation-hero">
        <img
          src="/api/reference-media/live-explore-cozy-room"
          alt={ui("warmLivingRoomPhotographedByChrisMottalini")}
        />
        <IconButton
          icon="share-android"
          label={ui("shareTheCozyEdit")}
          className="curation-share"
          onClick={() => {
            setShareUrl(window.location.href);
            setCopyStatus("");
            setSharing(true);
          }}
          data-ui-label="shareTheCozyEdit"
        />
        <div className="android-curation-copy">
          <div className="android-curation-credit-logo">
            <span aria-hidden="true">AD</span>
            {ui("curatedByArchitecturalDigest")}
          </div>
          <h1>
            {ui("theCozyEditBy")}
            <br />
            Architectural Digest
          </h1>
          <p>{ui("makeYourHomeFeelLikeASanctuaryThisFall")}</p>
        </div>
      </header>
      <p className="android-curation-photo-credit">
        {ui("creditChrisMottaliniArtAlecSothMagnumPhotosWeinsteinHammons")}
      </p>
      <p className="android-curation-intro">
        {ui("letADHelpYouEmbraceSweaterWeatherWithOurEditors")}
      </p>
      {sections.map((section) => (
        <section
          className="android-curation-section"
          key={section.id}
          aria-labelledby={`cozy-${section.id}-heading`}
        >
          <div
            className="android-curation-film"
            data-media-state={
              section.motionAvailable ? "recorded-motion" : "source-still"
            }
          >
            <img
              src={`/api/reference-media/live-cozy-film-${section.id}-poster`}
              alt={section.mediaLabel}
              loading="lazy"
            />
            <DecorativeVideo
              enabled={section.motionAvailable}
              clips={[
                {
                  key: `live-cozy-film-${section.id}`,
                  className: "curation-film-video",
                },
              ]}
              loop
            />
          </div>
          <h2 id={`cozy-${section.id}-heading`}>{section.title}</h2>
          <p>{section.copy}</p>
          <div className="product-grid android-curation-products">
            {section.products.map((id) => {
              const product = catalog.products.find(
                (item) => item.id === `live-cozy-${id}`,
              );
              if (!product) return null;
              const store = catalog.stores.find(
                (item) => item.id === product.storeId,
              );
              return (
                <ProductCard
                  key={id}
                  product={{
                    ...product,
                    // Keep the editorial composition separate from clean PDP media.
                    images: [`/api/reference-media/live-cozy-${id}`],
                  }}
                  storeName={store?.name}
                  showPromotion={false}
                />
              );
            })}
          </div>
          <EditorialQuote
            text={section.quote}
            attribution={section.attribution}
          />
        </section>
      ))}
      <FloatingNav android back fade />
      <Sheet
        open={sharing}
        title={ui("sharingLink")}
        onClose={() => setSharing(false)}
        className="curation-share-sheet"
      >
        <label htmlFor="curation-share-url">{ui("linkToThisEdit")}</label>
        <input
          id="curation-share-url"
          value={shareUrl}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
        />
        <button
          type="button"
          className="primary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(shareUrl);
              setCopyStatus("Link copied");
            } catch {
              setCopyStatus("Select the link above to copy it manually.");
            }
          }}
        >
          {ui("copyLink")}
        </button>
        <p role="status">{copyStatus}</p>
      </Sheet>
    </ShopSurface>
  );
}
