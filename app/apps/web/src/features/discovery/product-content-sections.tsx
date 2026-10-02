import { displayCount } from "../locale/number-display";
import { useLocale as useIntlLocale } from "next-intl";
import { useTranslations } from "next-intl";
import type { ProductDetailProduct } from "../catalog/product-detail-model";
import { ProductDisclosure, ProductSummaryCredit } from "./product-disclosure";
import { ProductDescriptionContent } from "./product-description-content";
import { ProductReviewPreview } from "./product-review-preview";
import styles from "./product-detail.module.css";

export function ProductContentSections({
  product,
  descriptionPreview,
  hasSeller,
  onDetails,
}: {
  product: ProductDetailProduct;
  descriptionPreview: readonly string[];
  hasSeller: boolean;
  onDetails: (title: string) => void;
}) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("discoveryUI");
  const android = product.referenceStyle === "android",
    shea = product.id === "shea-butter",
    bag = product.id === "shampoo-bag";
  return (
    <>
      {android && product.detail?.highlights && (
        <ProductDisclosure
          title={ui("highlights")}
          collapsible
          className="native-product-highlights"
        >
          <ul>
            {product.detail.highlights.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
          <ProductSummaryCredit />
        </ProductDisclosure>
      )}
      <ProductDisclosure
        title={ui("description")}
        initiallyOpen={!product.detail?.descriptionInitiallyCollapsed}
        collapsible={android}
        className={`pdp-description${bag ? " pdp-description-bag" : shea ? " pdp-description-shea" : ""}`}
      >
        {android && product.detail?.descriptionSpecs ? (
          <>
            <ProductDescriptionContent product={product} preview />
            <button
              className="native-description-more"
              onClick={() => onDetails("Description")}
            >
              {ui("readMore")}
            </button>
          </>
        ) : (
          descriptionPreview.map((paragraph, index) => (
            <p key={paragraph}>
              {paragraph}
              {!product.detail?.completeDescription &&
                index === descriptionPreview.length - 1 && (
                  <button onClick={() => onDetails("Description")}>
                    {ui("readMore")}
                  </button>
                )}
            </p>
          ))
        )}
      </ProductDisclosure>
      {android && product.detail?.specifications && (
        <ProductDisclosure
          title={ui("specifications")}
          collapsible
          initiallyOpen={false}
          className="native-product-specifications"
        >
          <dl>
            {product.detail.specifications.map(({ label, value }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <ProductSummaryCredit />
        </ProductDisclosure>
      )}
      {android &&
        product.detail?.reviewPreview &&
        product.rating !== undefined && (
          <ProductReviewPreview
            productId={product.id}
            rating={product.rating}
            ratingCount={product.ratingCount}
            cardWidth={product.detail.reviewPreview.cardWidth}
            distribution={product.detail.reviewPreview.distribution}
            reviews={product.detail.reviewPreview.reviews}
            collapsible
          />
        )}
      {(shea || bag) && (
        <ProductReviewPreview
          productId={product.id}
          rating={product.rating ?? 4.6}
          ratingCount={shea ? "3.3K" : "3.8K"}
          distribution={shea ? [80, 9, 5, 3, 3] : [80, 9, 5, 3, 5]}
          reviews={
            shea
              ? [
                  {
                    title: "Girlfriend loves it and I can breathe .",
                    rating: 5,
                    author: "Wes",
                    date: "13 days ago",
                  },
                  {
                    title: "How much I love your product",
                    rating: 5,
                    author: "Juanita",
                    date: "18 days ago",
                  },
                ]
              : [
                  {
                    title: "Curly Hair Shampoo Bar",
                    rating: 4,
                    author: "Jessica",
                    date: "Jun 22, 2026",
                  },
                  {
                    title: "Great…",
                    rating: 5,
                    initial: "S",
                    partial: true,
                  },
                ]
          }
        />
      )}
      {!hasSeller && product.rating !== undefined && (
        <section className={styles.unrecordedReviews}>
          <h2>{ui("reviews")}</h2>
          <p>
            {ui("thisReferenceIncludes")}{" "}
            {displayCount(product.ratingCount, intlLocale)}{" "}
            {ui("ratingsIndividualReviewTextWasNotCapturedForThisProduct")}
          </p>
        </section>
      )}
    </>
  );
}
