import { useTranslations } from "next-intl";
import type {
  ProductDetailProduct,
  ProductDetailSeller,
} from "../catalog/product-detail-model";
import { ProductDisclosure } from "./product-disclosure";
import { SourceLink } from "./return-navigation";
import { Icon } from "./icons";

export function ProductDelivery({
  product,
  store,
  postalCode,
  onShipTo,
  onDetails,
}: {
  product: ProductDetailProduct;
  store?: ProductDetailSeller;
  postalCode: string;
  onShipTo: () => void;
  onDetails: (title: string) => void;
}) {
  const ui = useTranslations("discoveryUI");
  const android = product.referenceStyle === "android",
    shea = product.id === "shea-butter",
    bag = product.id === "shampoo-bag";
  return (
    <>
      {store && (
        <ProductDisclosure
          className="pdp-delivery"
          title={ui("deliveryReturns")}
          collapsible={android}
        >
          <button onClick={onShipTo}>
            <Icon name="location" />
            <span>
              {ui("shipTo")} <b>{postalCode}</b>
            </span>
            <Icon name="chevron" style={{ transform: "rotate(90deg)" }} />
          </button>
          <p>
            <Icon name="truck" />
            {product.detail?.delivery
              ? postalCode === product.detail.delivery.postalCode
                ? product.detail.delivery.message
                : ui("shippingAvailabilityHasNotBeenCheckedForThisAddress")
              : ui("shippingCalculatedAtCheckout")}
          </p>
          {(shea || bag) && (
            <p>
              <Icon name="calendar" />
              {ui("arrivesAsSoonAsSunAug2")}
            </p>
          )}
          {product.detail?.delivery?.returns && (
            <p className="native-return-note">
              <Icon name="return-package" />
              <span>
                {product.detail.delivery.returns.message}
                <small>{product.detail.delivery.returns.disclaimer}</small>
              </span>
            </p>
          )}
          <div
            data-policy-count={
              product.detail?.delivery?.shippingPolicy === false ? 1 : 2
            }
          >
            {store.policies.refund ? (
              <SourceLink
                startAtTop
                href={`/stores/${store.id}/policies/refund`}
              >
                {ui("returnPolicy")}
              </SourceLink>
            ) : (
              <button onClick={() => onDetails("Return policy")}>
                {ui("returnPolicy")}
              </button>
            )}
            {product.detail?.delivery?.shippingPolicy !== false &&
              (store.policies.shipping ? (
                <SourceLink
                  startAtTop
                  href={`/stores/${store.id}/policies/shipping`}
                >
                  {ui("shippingPolicy")}
                </SourceLink>
              ) : (
                <button onClick={() => onDetails("Shipping policy")}>
                  {ui("shippingPolicy")}
                </button>
              ))}
          </div>
          {store.referenceWebsite ? (
            <a href={store.referenceWebsite} target="_blank" rel="noreferrer">
              <Icon name="link" /> {ui("visit")} {store.name}
            </a>
          ) : (
            <SourceLink startAtTop href={`/stores/${product.storeId}`}>
              <Icon name="link" /> {ui("visit")} {store.name}
            </SourceLink>
          )}
        </ProductDisclosure>
      )}
    </>
  );
}
