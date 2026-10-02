import { useCaption } from "../locale/use-caption";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type {
  ProductDetailProduct,
  ProductDetailSeller,
} from "../catalog/product-detail-model";
import { Sheet } from "./components";
import { SourceShareFields } from "./source-share-fields";
import { ProductDescriptionContent } from "./product-description-content";

type Sharing = {
  url: string;
  status: string;
  onStatus: (status: string) => void;
};
type Delivery = {
  draft: string;
  onDraft: (draft: string) => void;
  onCommit: (postalCode: string) => void;
};
export function ProductInformationSheet({
  product,
  store,
  detail,
  onDetails,
  description,
  capturedSpendOffer,
  sharing,
  delivery,
  onViewCart,
}: {
  product: ProductDetailProduct;
  store?: Pick<ProductDetailSeller, "name">;
  detail: string;
  onDetails: (detail: string) => void;
  description: string;
  capturedSpendOffer: string;
  sharing: Sharing;
  delivery: Delivery;
  onViewCart: () => void;
}) {
  const caption = useCaption();
  const ui = useTranslations("discoveryUI");
  const android = product.referenceStyle === "android",
    shea = product.id === "shea-butter",
    bag = product.id === "shampoo-bag";
  const setDetail = onDetails;
  const {
    url: shareUrl,
    status: shareStatus,
    onStatus: setShareStatus,
  } = sharing;
  const {
    draft: postalDraft,
    onDraft: setPostalDraft,
    onCommit: setPostalCode,
  } = delivery;
  return (
    <Sheet
      open={!!detail}
      title={caption(detail)}
      className={
        detail === "Description"
          ? `product-description-sheet${shea ? " shea-description-sheet" : ""}${android ? " android-description-sheet" : ""}`
          : detail === "Sharing link"
            ? "native-source-share"
            : undefined
      }
      onClose={() => setDetail("")}
    >
      <div className="sheet-copy">
        {detail === "Sharing link" ? (
          <SourceShareFields
            id="product-share-url"
            label={ui("linkToThisProduct")}
            url={shareUrl}
            status={shareStatus}
            onStatus={setShareStatus}
          />
        ) : detail === "Description" ? (
          <>
            {shea ? (
              <>
                <ul role="list">
                  <li>
                    {ui("superHydratingFormulaMoisturizesYourSkinYouWonTEven")}
                  </li>
                  <li>
                    {ui(
                      "smallPlantDerivedExfoliantsGentlyExfoliateToRevealSofterSkin",
                    )}
                  </li>
                  <li>{ui("freeOfParabensPhthalatesSiliconesSulfates")}</li>
                  <li>
                    {ui(
                      "madeInTheUSAFromGloballySourcedIngredientsVeganCruelty",
                    )}
                  </li>
                </ul>
                <p>{ui("ingredients")}</p>
                <p>
                  Sodium Sunflowerate, Sodium Cocoate, Fragrance (Parfum),
                  Butyrospermum Parkii (Shea) Butter, Sodium Chloride (Sea
                  Salt), Prunus Armeniaca (Apricot) Seed Powder, Natural
                  Tocopherol (Vitamin E), Benzaldehyde, Limonene, Citrus
                  Aurantium Amara Peel Oil, Cinnamal, Citrus Limon (Lemon) Peel
                  Oil, Linalool, Linalyl Acetate, Mentha Viridis (Spearmint)
                  Leaf Oil, Carvone, Cananga Odorata Oil/Extract, Pinene, Iron
                  Oxides (CI 77491, 77492, CI 77499).
                </p>
                <p>{ui("naturalColor")}</p>
                <p>{ui("freeOfParabensPhthalatesSiliconesSulfates_b0249b")}</p>
                <p>{ui("fragranceAlmondCherry")}</p>
              </>
            ) : android && product.detail?.descriptionSpecs ? (
              <ProductDescriptionContent
                product={product}
                onExternal={() => setDetail("")}
              />
            ) : (
              <p>{description}</p>
            )}
          </>
        ) : detail === "Offer details" ? (
          <p>
            {shea || bag
              ? ui("offerTermsThisIsAReferenceOffer", {
                  offer: product.promotion ?? capturedSpendOffer,
                  terms:
                    product.detail?.promotionTerms ?? ui("exclusiveToShop"),
                })
              : `${product.promotion ?? ui("noOfferWasCaptured")} ${product.detail?.promotionTerms ?? ""}`}
          </p>
        ) : detail === "Checkout preview" ? (
          <>
            <p>{ui("noSellerOrCheckoutDetailsWereIncludedForThisItem")}</p>
            <button
              className="primary"
              onClick={() => {
                setDetail("");
                onViewCart();
              }}
            >
              {ui("viewCart")}
            </button>
          </>
        ) : detail === "Ship to" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!postalDraft.trim()) return;
              setPostalCode(postalDraft.trim());
              setDetail("");
            }}
          >
            <label>
              {ui("postalCode")}
              <input
                aria-label={ui("postalCode")}
                value={postalDraft}
                onChange={(e) => setPostalDraft(e.target.value)}
                required
                data-ui-label="postalCode"
              />
            </label>
            <button className="primary">{ui("done")}</button>
          </form>
        ) : detail === "Subscription" ? (
          <p>
            {ui(
              "subscriptionSelectionIsAvailableInThisPreviewRecurringCheckoutIs",
            )}
          </p>
        ) : detail.includes("policy") && store ? (
          <Link href={`/stores/${product.storeId}/info`}>
            {ui("view")} {store.name} {ui("policies_5b3a02")}
          </Link>
        ) : (
          <p>{`/products/${product.id}`}</p>
        )}
      </div>
    </Sheet>
  );
}
