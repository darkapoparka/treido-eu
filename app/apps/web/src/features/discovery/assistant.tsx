"use client";
import { useLocale as useIntlLocale } from "next-intl";
import { useCaption } from "../locale/use-caption";
import { useTranslations } from "next-intl";
import { ShopSurface } from "./hydration-boundary";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDiscovery } from "./state";
import type { SearchCatalog } from "../catalog/search-catalog";
import { formatMoney } from "../catalog/types";
import { Sheet, SaveButton, IconButton, commitSheetQuery } from "./components";
import { Icon } from "./icons";
import { ReviewStars } from "./review-feedback";
import { capturedCapQuestion } from "./search-model";
import { useSearchDraft } from "./search-draft";
import { ContextualCloseLink, SourceLink } from "./return-navigation";
import styles from "./search-entry.module.css";
import photoStyles from "./search-photo.module.css";

// Recorded gallery position only: uncaptured images are not invented.
function CapturedPagination({
  count,
  current = 0,
  centered = false,
}: {
  count: number;
  current?: number;
  centered?: boolean;
}) {
  return (
    <span
      className={`${styles.photoPagination} ${centered ? styles.answerPagination : ""}`}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <i key={index} data-current={index === current || undefined} />
      ))}
    </span>
  );
}

export function Assistant({ catalog }: { catalog: SearchCatalog }) {
  const params = useSearchParams();
  const { viewAnswer } = useDiscovery();
  const photo = params.get("example") === "photo";
  useEffect(() => {
    if (!photo) viewAnswer("jeans");
  }, [photo, viewAnswer]);
  if (photo) return <PhotoAssistant catalog={catalog} />;
  return (
    <ShopSurface className={`shop-page ${styles.assistantStandalone}`}>
      <JeansAnswer catalog={catalog} />
    </ShopSurface>
  );
}
export function JeansAnswer({
  catalog,
  onClose,
  onConsumedNavigate,
}: {
  catalog: SearchCatalog;
  onClose?: () => void;
  onConsumedNavigate?: (href: string) => void;
}) {
  const intlLocale = useIntlLocale();
  const caption = useCaption();
  const ui = useTranslations("discoveryUI");
  const [feedback, setFeedback] = useState(false),
    [votes, setVotes] = useState<Record<string, boolean>>({}),
    [notes, setNotes] = useState(""),
    [submitted, setSubmitted] = useState(false),
    [sentiment, setSentiment] = useState<"positive" | "negative" | null>(null),
    [feedbackSentiment, setFeedbackSentiment] = useState<
      "positive" | "negative"
    >("positive"),
    [boundary, setBoundary] = useState("");
  const { draft: query, update: updateQuery } = useSearchDraft("jeans-answer");
  const products = [
    "assistant-signature-straight",
    "assistant-urban-straight",
    "assistant-blue-skinny",
  ].flatMap((id) => {
    const p = catalog.products.find((p) => p.id === id);
    const artwork =
      id === "assistant-signature-straight"
        ? "assistant-white-square"
        : id === "assistant-urban-straight"
          ? "assistant-black-square"
          : id === "assistant-blue-skinny"
            ? "assistant-blue-partial"
            : null;
    return p
      ? [
          {
            ...p,
            images: artwork ? [`/api/reference-media/${artwork}`] : p.images,
            feedbackImage:
              id === "assistant-signature-straight"
                ? "/api/reference-media/assistant-feedback-signature"
                : id === "assistant-urban-straight"
                  ? "/api/reference-media/assistant-feedback-urban"
                  : artwork
                    ? `/api/reference-media/${artwork}`
                    : p.images[0],
          },
        ]
      : [];
  });
  const cityProduct = catalog.products.find(
    (product) => product.id === "city-duaa-denim",
  );
  const signatureProduct = products.find(
    (product) => product.id === "assistant-signature-straight",
  );
  return (
    <section
      className={`assistant-page ${styles.answerBody} ${onClose ? styles.embeddedAnswer : ""}`}
      onClickCapture={(event) => {
        // The enclosing Sheet consumes its route entry before this handler.
        // Return to Search's real answer opener, not the retired sheet card.
        if (!event.defaultPrevented || !onConsumedNavigate) return;
        const link = (event.target as Element).closest<HTMLAnchorElement>(
          "a[href]",
        );
        if (link && !link.classList.contains("assistant-edit"))
          onConsumedNavigate(link.href);
      }}
    >
      <Link
        href="/search?q=jeans"
        className="assistant-edit"
        aria-label={ui("editSearch")}
        data-ui-label="editSearch"
      >
        <Icon name="edit-search" />
      </Link>
      <h1 tabIndex={-1} data-answer-heading>
        {ui("jeans")}
      </h1>
      <p>
        {ui("fromEverydayStraightLegsToBoldVintageInspiredStreetwearThe")}{" "}
        <SourceLink startAtTop href="/stores/jeans-warehouse">
          Jeans Warehouse
        </SourceLink>{" "}
        {ui("and")}{" "}
        <SourceLink startAtTop href="/stores/city-jeans">
          City Jeans
        </SourceLink>{" "}
        {ui("toHelpYouFindYourNextGoToPair")}
      </p>
      <h2>{ui("classicAndStraightLegFits")}</h2>
      <p className="form-note">
        {ui("theFoundationOfAnyWardrobeWithAComfortableTimelessCut")}
      </p>
      <div className="assistant-product-rail">
        {products.map((p) => (
          <article key={p.id}>
            <div
              className={`product-media ${p.id === "assistant-blue-skinny" ? "assistant-partial-product" : ""}`}
            >
              <SourceLink startAtTop href={`/products/${p.id}`}>
                <img src={p.images[0]} alt={p.title} />
              </SourceLink>
              <SaveButton product={p} />
            </div>
            <span>Jeans Warehouse</span>
            <SourceLink startAtTop href={`/products/${p.id}`}>
              <strong>{p.title}</strong>
            </SourceLink>
            <b>{formatMoney(p.price, intlLocale)}</b>
          </article>
        ))}
      </div>
      <h2>{ui("wideLegAndRelaxedSilhouettes")}</h2>
      <p className="form-note">{ui("modernRoomyFitsWithPlentyOfMovement")}</p>
      <div className="assistant-product-rail assistant-wide-rail">
        {["assistant-wide-one", "assistant-wide-two"].map((key) => (
          <article key={key}>
            <div className="product-media">
              <button
                type="button"
                className={styles.boundedWideEntry}
                aria-label={ui("viewCapturedWideLegRecommendationValue1", {
                  value1: key === "assistant-wide-one" ? "1" : "2",
                })}
                onClick={() => setBoundary(ui("productDetailsUnavailable"))}
              >
                <img src={`/api/reference-media/${key}`} alt="" />
              </button>
            </div>
            <span>Jeans Warehouse</span>
          </article>
        ))}
        <article className="assistant-wide-partial" aria-hidden="true">
          <div className="product-media">
            <img src="/api/reference-media/assistant-wide-partial" alt="" />
          </div>
        </article>
      </div>
      <p className="assistant-wide-continuation">
        {ui("keepYouComfortableThroughALongDay")}
      </p>
      <div
        className="assistant-answer-card"
        data-answer-product="city-duaa-denim"
      >
        <div className={`product-media ${styles.answerCardPhoto}`}>
          <SourceLink startAtTop href="/products/city-duaa-denim">
            <img
              src="/api/reference-media/assistant-city-square"
              alt={ui("menSDuaaNeptuneDenim")}
            />
          </SourceLink>
          {cityProduct && <SaveButton product={cityProduct} />}
          <CapturedPagination count={4} centered />
          <span className={`price-badge deal ${styles.answerCardDeal}`}>
            {ui("save10")}
          </span>
        </div>
        <div>
          <SourceLink
            startAtTop
            className={styles.answerSeller}
            href="/stores/city-jeans"
          >
            <img src="/api/reference-media/suggestion-city-jeans" alt="" />
            <span>
              City Jeans
              <small>
                4.8 ★ <span>(3.7K)</span>
              </small>
            </span>
          </SourceLink>
          <strong>
            <SourceLink startAtTop href="/products/city-duaa-denim">
              {ui("menSDuaaNeptuneDenim_c8f363")}
            </SourceLink>
          </strong>
          <p>$90.00</p>
          <ul>
            <li>{ui("heavyKneeDistressing")}</li>
            <li>{ui("authenticVintageBlueWash")}</li>
            <li>{ui("modernStreetwearFit")}</li>
          </ul>
        </div>
      </div>
      <div
        className="assistant-answer-card"
        data-answer-product="assistant-signature-straight"
      >
        <div className={`product-media ${styles.answerCardPhoto}`}>
          <SourceLink startAtTop href="/products/assistant-signature-straight">
            <img
              src="/api/reference-media/assistant-signature-square"
              alt={ui("signatureStraightJeans")}
            />
          </SourceLink>
          {signatureProduct && <SaveButton product={signatureProduct} />}
          <CapturedPagination count={2} current={1} centered />
        </div>
        <div>
          <SourceLink
            startAtTop
            className={styles.answerSeller}
            href="/stores/jeans-warehouse"
          >
            <img src="/api/reference-media/suggestion-jeans-warehouse" alt="" />
            <span>
              Jeans Warehouse
              <small>
                4.7 ★ <span>(294)</span>
              </small>
            </span>
          </SourceLink>
          <strong>
            <SourceLink
              startAtTop
              href="/products/assistant-signature-straight"
            >
              SIGNATURE STRAIGHT…
            </SourceLink>
          </strong>
          <p>$29.99</p>
          <ul>
            <li>{ui("cleanStraightLegCut")}</li>
            <li>{ui("comfortableStretchBlend")}</li>
            <li>{ui("versatileDailyWash")}</li>
          </ul>
        </div>
      </div>
      <div className="assistant-preferences">
        <p>{ui("areYouShoppingForYourselfTodayOrLookingForSomeone")}</p>
        <button
          className="pill"
          onClick={() => setBoundary(ui("shoppingPreferences"))}
        >
          {ui("forMyself")}
        </button>
        <button
          className="pill"
          onClick={() => setBoundary(ui("addSomeone_d3d464"))}
        >
          {ui("addSomeone")}
        </button>
      </div>
      <div className="assistant-feedback-actions">
        <IconButton
          icon="thumb-up"
          label={ui("givePositiveFeedback")}
          pressed={sentiment === "positive"}
          filled={false}
          onClick={() => {
            setFeedbackSentiment("positive");
            setFeedback(true);
          }}
          data-ui-label="givePositiveFeedback"
        />
        <IconButton
          icon="thumb-down"
          label={ui("giveNegativeFeedback")}
          pressed={sentiment === "negative"}
          filled={false}
          onClick={() => {
            setFeedbackSentiment("negative");
            setFeedback(true);
          }}
          data-ui-label="giveNegativeFeedback"
        />
      </div>
      <form
        className="assistant-composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) setBoundary(ui("followUp"));
        }}
      >
        <input
          aria-label={ui("askAFollowUp")}
          placeholder={ui("askAFollowUp")}
          value={query}
          onChange={(e) => updateQuery({ draft: e.target.value })}
          data-ui-label="askAFollowUp"
        />
        {onClose ? (
          <IconButton
            icon="close"
            label={ui("closeAssistant")}
            onClick={onClose}
            data-ui-label="closeAssistant"
          />
        ) : (
          <ContextualCloseLink
            href="/search"
            className="icon-button"
            aria-label={ui("closeAssistant")}
            data-ui-label="closeAssistant"
          >
            <Icon name="close" />
          </ContextualCloseLink>
        )}
      </form>
      <Sheet
        open={feedback}
        title={ui("feedback")}
        className={`assistant-feedback-sheet ${styles.feedbackSheet}`}
        onClose={() => setFeedback(false)}
      >
        <p>{ui("letUsKnowWhichProductsYouPreferred")}</p>
        <div className="feedback-products">
          {products
            .filter((p) => p.id !== "assistant-blue-skinny")
            .map((p) => (
              <div key={p.id}>
                <img src={p.feedbackImage} alt={p.title} />
                <button
                  aria-label={ui("likeValue1", { value1: p.title ?? "" })}
                  aria-pressed={votes[p.id] === true}
                  onClick={() => setVotes((v) => ({ ...v, [p.id]: true }))}
                >
                  <Icon name="thumb-up" />
                </button>
                <button
                  aria-label={ui("dislikeValue1", { value1: p.title ?? "" })}
                  aria-pressed={votes[p.id] === false}
                  onClick={() => setVotes((v) => ({ ...v, [p.id]: false }))}
                >
                  <Icon name="thumb-down" />
                </button>
              </div>
            ))}
          <div className={styles.feedbackFragment} aria-hidden="true">
            <img
              src="/api/reference-media/assistant-feedback-third-fragment"
              alt=""
            />
          </div>
        </div>
        <label>
          {ui("shareAnyThoughtsAboutTheEntireResponse")}
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="sheet-actions">
          <button className="pill" onClick={() => setFeedback(false)}>
            {ui("cancel")}
          </button>
          <button
            className="primary"
            onClick={() => {
              setFeedback(false);
              setSubmitted(true);
              setSentiment(feedbackSentiment);
            }}
          >
            {ui("submit")}
          </button>
        </div>
      </Sheet>
      <Sheet
        open={!!boundary}
        title={caption(boundary)}
        onClose={() => setBoundary("")}
      >
        <p className="sheet-copy">
          {boundary === "Product details unavailable"
            ? ui(
                "thisRecommendationAppearsInTheCapturedAnswerItsCompleteProduct",
              )
            : ui(
                "thisRecordedAnswerIsAvailableLocallyNewAssistantResponsesAnd",
              )}
        </p>
      </Sheet>
      {submitted && (
        <button
          className={`local-toast ${styles.feedbackToast}`}
          aria-label={ui("thanksForYourFeedbackSavedInThisLocalExample")}
          onClick={() => setSubmitted(false)}
          data-ui-label="thanksForYourFeedbackSavedInThisLocalExample"
        >
          {ui("thanksForYourFeedback")}
        </button>
      )}
    </section>
  );
}

function PhotoAssistant({ catalog }: { catalog: SearchCatalog }) {
  const caption = useCaption();
  const ui = useTranslations("discoveryUI");
  const params = useSearchParams();
  const steps = params.get("steps") === "1";
  function toggleSteps() {
    const next = new URLSearchParams(params);
    if (steps) next.delete("steps");
    else next.set("steps", "1");
    commitSheetQuery(next);
  }
  const [choice, setChoice] = useState("");
  const [boundary, setBoundary] = useState("");
  const { draft, update: updateDraft } = useSearchDraft("photo-answer");
  const boundedTrigger = useRef<HTMLButtonElement>(null);
  const cards = [
    {
      id: "assistant-cap",
      imageKey: "assistant-dad-photo",
      comparisonImageKey: "assistant-dad-comparison-photo",
      productId: "assistant-mobbin-dad-hat",
      seller: "Mobbin",
      title: "Mobbin Dad Hat",
      price: "$19.99",
      details: [
        "Bio-washed chino twill",
        "Relaxed unstructured fit",
        "Pre-curved casual brim",
      ],
    },
    {
      id: "assistant-armor-cap",
      imageKey: "assistant-armor-photo",
      comparisonImageKey: "assistant-armor-comparison-photo",
      productId: "assistant-mob-armor-snapback",
      seller: "Mob Armor",
      title: "Mob Armor Snapback Hats",
      price: "$19.99",
      details: [
        "Structured 6-panel build",
        "Adjustable snapback fit",
        "Durable daily workhorse",
      ],
    },
  ];
  const recommendations = [
    cards[0]!,
    {
      id: "assistant-mobbin-merch-cap",
      imageKey: "assistant-merch-photo",
      productId: "assistant-mobbin-merch-cap",
      seller: "Mobbin Merch",
      title: "Mobbin Cap",
      price: "$45.00",
    },
  ];
  function productMedia(
    card: (typeof recommendations)[number],
    imageKey = card.imageKey,
  ) {
    const product = catalog.products.find((item) => item.id === card.productId);
    const photograph = (
      <img src={`/api/reference-media/${imageKey}`} alt={card.title} />
    );
    return (
      <div className={`product-media ${styles.photoCardMedia}`}>
        {imageKey === "assistant-armor-comparison-photo" && (
          <CapturedPagination count={9} />
        )}
        {product ? (
          <SourceLink startAtTop href={`/products/${product.id}`}>
            {photograph}
          </SourceLink>
        ) : (
          <button
            type="button"
            className={styles.photoProduct}
            aria-label={ui("viewValue1", { value1: card.title ?? "" })}
            onClick={() => setBoundary(ui("productDetailsUnavailable"))}
          >
            {photograph}
          </button>
        )}
        {product ? (
          <SaveButton product={product} />
        ) : (
          <IconButton
            icon="heart"
            label={ui("saveValue1", { value1: card.title ?? "" })}
            className="save-button"
            onClick={() => setBoundary(ui("productDetailsUnavailable"))}
            data-ui-label="saveValue1"
          />
        )}
      </div>
    );
  }
  function productLink(
    card: { productId: string; title: string },
    children: ReactNode,
    inline = false,
  ) {
    const product = catalog.products.find((item) => item.id === card.productId);
    // Native buttons are atomic inline boxes: they cannot split a product
    // name across lines as the captured paragraph does. Keep this local
    // disclosure as a focusable inline action, with both button activation keys.
    if (!product && inline)
      return (
        <span
          role="button"
          tabIndex={0}
          className={styles.photoProductLink}
          onClick={() => setBoundary(ui("productDetailsUnavailable"))}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setBoundary(ui("productDetailsUnavailable"));
            }
          }}
        >
          {children}
        </span>
      );
    return product ? (
      <SourceLink
        startAtTop
        className={styles.photoProductLink}
        href={`/products/${product.id}`}
      >
        {children}
      </SourceLink>
    ) : (
      <button
        type="button"
        className={styles.photoProductLink}
        onClick={() => setBoundary(ui("productDetailsUnavailable"))}
      >
        {children}
      </button>
    );
  }
  function closeBoundary() {
    const restoreBoundedTrigger = boundary === "Source-bounded recommendation";
    setBoundary("");
    if (restoreBoundedTrigger)
      requestAnimationFrame(() =>
        boundedTrigger.current?.focus({ preventScroll: true }),
      );
  }
  return (
    <ShopSurface
      className={`shop-page assistant-page photo-assistant ${styles.answerBody} ${styles.photoAnswer}`}
    >
      <Link
        href="/search?edit=photo"
        className="assistant-edit"
        aria-label={ui("editSearch")}
        data-ui-label="editSearch"
      >
        <Icon name="edit-search" />
      </Link>
      <h1>{capturedCapQuestion}</h1>
      <span className="photo-tag">
        <img src="/api/reference-media/assistant-uploaded-cap" alt="" />
        <span className={styles.photoTagText}>{ui("photo")}</span>
      </span>
      <button
        className="assistant-steps"
        onClick={toggleSteps}
        aria-expanded={steps}
      >
        {ui("assistantSteps")} <Icon name="chevron" />
      </button>
      {steps && (
        <div className="assistant-step-list">
          <small>{ui("searchForProducts")}</small>
          {[
            "Mobbin black baseball cap",
            "Mobbin hat black",
            "Mobbin embroidered baseball cap",
            "black baseball cap white embroidery Mobbin",
          ].map((query) => (
            <p key={query}>
              <Icon name="search" />
              {query}
            </p>
          ))}
          <button
            type="button"
            onClick={() =>
              setBoundary(ui("additionalAssistantStepsUnavailable"))
            }
          >
            {ui("text2More")}
          </button>
        </div>
      )}
      <p>
        {ui("theCapInYourPhotoIsTheClassic")} <strong>Mobbin</strong>{" "}
        {ui("dadHatARelaxedLowProfileStapleThatPrioritizesThat")}
      </p>
      <p>{ui("iFoundTheExactMatchYouReLookingForAlong")}</p>
      <h2>{ui("theMobbinSignatureCollection")}</h2>
      <p className="form-note">
        {ui("theExactRelaxedFitAndBrandingFromYourPhoto")}
      </p>
      <div className="assistant-product-rail">
        {recommendations.map((card) => (
          <article key={card.id} data-photo-recommendation={card.id}>
            {productMedia(card)}
            <span>{card.seller}</span>
            <strong>{productLink(card, card.title)}</strong>
            {card.id === "assistant-mobbin-merch-cap" && (
              <span className={styles.photoRating}>
                <ReviewStars rating={5} /> (1)
              </span>
            )}
            <b>{card.price}</b>
          </article>
        ))}
        <article
          className={photoStyles.boundedRecommendation}
          data-photo-recommendation="source-bounded-third"
          data-source-boundary="partial-third"
        >
          <button
            ref={boundedTrigger}
            type="button"
            className={`product-media ${styles.photoCardMedia} ${photoStyles.boundedMedia}`}
            aria-label={ui("viewSourceBoundedRecommendation")}
            onClick={() => setBoundary(ui("sourceBoundedRecommendation"))}
            data-ui-label="viewSourceBoundedRecommendation"
          >
            <img
              src="/api/reference-media/assistant-bounded-third-photo"
              alt={ui("sourceBoundedCapRecommendation")}
            />
          </button>
          <span>Venice Ru…</span>
          <strong>Mobbin B…</strong>
          <b>$25.00</b>
        </article>
      </div>
      <h2>{ui("structuredAndSnapbackAlternatives")}</h2>
      <p className={`form-note ${photoStyles.structuredNote}`}>
        {ui("higherProfileOptionsWithSimilarMonochromeBranding")}
      </p>
      <div className={`assistant-product-rail ${photoStyles.structuredRail}`}>
        {["first", "second", "third"].map((position) => (
          <article
            key={position}
            className={photoStyles.structuredFragment}
            data-source-boundary={`structured-${position}`}
            aria-label={ui(
              "partiallyCapturedRecommendationProductDetailsUnavailable",
            )}
            data-ui-label="partiallyCapturedRecommendationProductDetailsUnavailable"
          >
            <img
              src={`/api/reference-media/assistant-structured-${position}-fragment`}
              alt=""
            />
          </article>
        ))}
      </div>
      <p className={styles.photoComparisonCopy}>
        {ui("the")} {productLink(cards[0], "Mobbin Dad Hat", true)}{" "}
        {ui("isTheHeroHereAtJustUnder20ItS")}{" "}
        {productLink(cards[1], "Mob Armor Snapback", true)}{" "}
        {ui("offersAStructuredCrownAndAMoreRigidVisorThat")}
      </p>
      {cards.map((card) => (
        <article
          className="assistant-answer-card"
          key={card.id}
          data-photo-comparison={card.id}
        >
          {productMedia(card, card.comparisonImageKey)}
          <div>
            <div className={styles.photoSeller}>
              {card.seller === "Mobbin" ? (
                <span className={styles.photoSellerLogo} aria-hidden="true">
                  M
                </span>
              ) : (
                <img
                  className={styles.photoSellerLogo}
                  src="/api/reference-media/assistant-armor-logo"
                  alt=""
                />
              )}
              <div>
                <p>{card.seller}</p>
                {card.seller === "Mob Armor" && (
                  <small>
                    4.8 ★ <span>(1.2K)</span>
                  </small>
                )}
              </div>
            </div>
            <strong>{productLink(card, card.title)}</strong>
            <p>{card.price}</p>
            <ul>
              {card.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          </div>
        </article>
      ))}
      <p>{ui("mobbinIsABrandRootedInCarCultureAndUrban")}</p>
      <p>{ui("doYouPreferThisRelaxedDadHatFitOrAre")}</p>
      <div className="assistant-preferences">
        {["Relaxed dad hats", "Structured snapbacks", "Other Mobbin gear"].map(
          (option) => (
            <button
              className="pill"
              key={option}
              aria-pressed={choice === option}
              onClick={() => {
                setChoice(option);
                setBoundary(ui("assistantIsNotConnected"));
              }}
            >
              {caption(option)}
            </button>
          ),
        )}
      </div>
      <div className="assistant-feedback-actions">
        <IconButton
          icon="thumb-up"
          label={ui("givePositiveFeedback")}
          onClick={() => setBoundary(ui("photoAnswerFeedbackUnavailable"))}
          data-ui-label="givePositiveFeedback"
        />
        <IconButton
          icon="thumb-down"
          label={ui("giveNegativeFeedback")}
          onClick={() => setBoundary(ui("photoAnswerFeedbackUnavailable"))}
          data-ui-label="giveNegativeFeedback"
        />
      </div>
      <form
        className="assistant-composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) setBoundary(ui("assistantIsNotConnected"));
        }}
      >
        <input
          placeholder={ui("askAFollowUp")}
          aria-label={ui("askAFollowUp")}
          value={draft}
          onChange={(event) => updateDraft({ draft: event.target.value })}
          data-ui-label="askAFollowUp"
        />
        <ContextualCloseLink
          href="/search"
          className="icon-button"
          aria-label={ui("closeAssistant")}
          data-ui-label="closeAssistant"
        >
          <Icon name="close" />
        </ContextualCloseLink>
      </form>
      <Sheet
        open={!!boundary}
        title={caption(boundary)}
        onClose={closeBoundary}
      >
        <p className="sheet-copy">
          {boundary === "Source-bounded recommendation"
            ? ui("theSourceExposesOnlyThisBoundedFragmentItsCompleteSeller")
            : boundary === "Product details unavailable"
              ? ui("thisProductWasShownInTheCapturedAnswerItsComplete")
              : boundary === "Additional assistant steps unavailable"
                ? ui("theCaptureShowsTwoMoreSearchStepsWithoutTheirText")
                : ui("yourSelectionStaysLocalNoPhotoOrMessageWasSent")}
        </p>
      </Sheet>
    </ShopSurface>
  );
}
