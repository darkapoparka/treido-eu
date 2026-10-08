"use client";
/* eslint-disable @next/next/no-img-element */
import { useLocale as useIntlLocale } from "next-intl";
import { useCaption } from "../locale/use-caption";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type ComponentProps,
} from "react";
import { paymentText, type PaymentLanguage } from "../payments/messages";
import { useRouter, useSearchParams } from "next/navigation";
import { TrackingDetail } from "./tracking";
import { CartOverlay } from "./checkout";
import type { Catalog } from "../catalog/types";
import { orderGridDeals } from "../catalog/reference/order-fixtures";
import { formatMoney } from "../catalog/types";
import { Icon } from "../discovery/icons";
import { DecorativeVideo } from "../discovery/decorative-video";
import { RatingStar, ReviewStars } from "../discovery/rating-stars";
import { capturedReceipts } from "./receipt-data";
import { useCapturedConfirmation } from "./captured-transition";
import { shopSourceBuyer } from "./source-fixtures";
import { useManualOrderDraft } from "./manual-order-draft";
import {
  SourceLink,
  ContextualCloseLink,
  rememberSourcePosition,
  restoreSourcePosition,
} from "../discovery/return-navigation";
import {
  commitSheetQuery,
  consumeSheetHistory,
  Sheet,
  ProductCard,
} from "../discovery/components";
import {
  ManageOrderIcon,
  OrderAction,
  OrderBrand,
  OrderProgress,
  OrderRecommendations,
  OrderSectionHeading,
} from "./order-presentation";
import styles from "./orders-parity.module.css";
import "./confirmation-parity.css";
import { AccountPage, Boundary } from "../account/forms";
import { useAccount, type ReferenceOrder } from "../account/state";
import "../discovery/buyer-surface.css";

function OrdersListPresentation(props: ComponentProps<typeof AccountPage>) {
  return <AccountPage {...props} />;
}
function OrderListCard({
  className = "account-panel tracking-card",
  sourceKey,
  status,
  href,
  seller,
  title,
  children,
  image,
  imageAlt = "",
}: {
  className?: string;
  sourceKey: string;
  status?: string;
  href: string;
  seller: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  image?: string;
  imageAlt?: string;
}) {
  return (
    <SourceLink
      className={className}
      sourceKey={sourceKey}
      data-order-status={status}
      href={href}
    >
      <div>
        <strong className="order-seller-label">{seller}</strong>
        <h2>{title}</h2>
        {children}
      </div>
      {image && <img src={image} alt={imageAlt} />}
    </SourceLink>
  );
}
function OrdersEmpty({
  className = "order-empty-source",
  art,
  title,
  description,
  actions,
}: {
  className?: string;
  art?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={className}>
      {art}
      <h2>{title}</h2>
      {description !== undefined && <p>{description}</p>}
      {actions}
    </div>
  );
}

/** The source order-list geometry accepts only current, authorized order facts. */
export type BuyerOrderSummary = {
  id: string;
  sellerName: string;
  totalMinor: number;
  currency: "EUR";
  payment: string;
  fulfilment: string;
  settlement: string;
  titles: string[];
};
export function BuyerOrders({
  orders,
  language,
  children,
  back = false,
}: {
  orders?: BuyerOrderSummary[];
  language: PaymentLanguage;
  children?: ReactNode;
  back?: boolean;
}) {
  const ui = useTranslations("commerceUI"),
    t = paymentText(language);
  return (
    <OrdersListPresentation
      title={ui("orders")}
      android
      publicData
      back={back}
      className={`source-orders-page android-orders ${styles.list}`}
    >
      {children ??
        (!orders?.length ? (
          <OrdersEmpty title={t.empty} />
        ) : (
          orders.map((order) => {
            return (
              <OrderListCard
                sourceKey={"order-card:" + order.id}
                href={"/orders/" + order.id + "?lang=" + language}
                key={order.id}
                seller={order.sellerName}
                title={formatMoney(
                  { amount: order.totalMinor, currency: order.currency },
                  language,
                )}
              >
                <p>{order.payment}</p>
                <p>{order.fulfilment}</p>
                <p>{order.settlement}</p>
                <p>{order.titles.join(" · ")}</p>
              </OrderListCard>
            );
          })
        ))}
    </OrdersListPresentation>
  );
}
export function OrdersPage({
  catalog,
  archive = false,
  history = false,
}: {
  catalog: Catalog;
  archive?: boolean;
  history?: boolean;
}) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("commerceUI");
  const { orders, deletedOrder, restoreOrder, profile } = useAccount();
  const native = !!catalog.liveHomeStoreIds;
  const guest = native && !profile.email;
  const params = useSearchParams();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [deal, setDeal] = useState<number | null>(null);
  const [historyConnect, setHistoryConnect] = useState(true);
  const forcedView = !archive && !history ? params.get("view") : null;
  const labelCreated = params.get("progress") === "label";
  const visible = (
    forcedView === "empty"
      ? []
      : orders.filter(
          (o) =>
            (history || (archive ? o.archived : !o.archived)) &&
            `${o.name} ${o.id}`.toLowerCase().includes(query.toLowerCase()),
        )
  ).sort((a, b) => {
    if (history) return a.id === "REF-1002" ? -1 : b.id === "REF-1002" ? 1 : 0;
    if (forcedView === "manual") {
      const aManual = a.productId ? 1 : 0;
      const bManual = b.productId ? 1 : 0;
      return aManual - bManual;
    }
    return 0;
  });
  const hasDeliveredOrder = visible.some(
    (order) => order.status === "Delivered",
  );
  const deals = hasDeliveredOrder
    ? orderGridDeals.delivered
    : orderGridDeals.transit;
  return (
    <OrdersListPresentation
      android={native}
      back={archive || history || forcedView === "manual"}
      cart={!archive && !history ? () => setCartOpen(true) : undefined}
      showCartWhenEmpty={
        !native &&
        !archive &&
        !history &&
        (forcedView === "empty" || !orders.some((order) => !order.archived))
      }
      title={
        history
          ? ui("orderHistory_928f4f")
          : archive
            ? ui("archived")
            : ui("orders")
      }
      className={`${archive ? "archive-page" : "source-orders-page"} ${forcedView === "manual" ? "manual-order-result" : ""} ${styles.list} ${native ? "android-orders" : ""}`}
      action={
        !archive && (
          <div className="order-actions">
            {!history && (
              <button
                aria-label={ui("searchOrders")}
                onClick={() => setSearch(!search)}
                data-ui-label="searchOrders"
              >
                <Icon name="search" />
              </button>
            )}
            <button
              aria-label={ui("moreOrderOptions")}
              onClick={() => {
                rememberSourcePosition('[data-ui-label="moreOrderOptions"]');
                setMenu(true);
              }}
              data-ui-label="moreOrderOptions"
            >
              <Icon name="more" />
            </button>
          </div>
        )
      }
    >
      {deletedOrder && (
        <div className={styles.deletedOrderNotice} role="status">
          <span>{ui("orderDeletedFromThisPreview")}</span>
          <button onClick={restoreOrder}>{ui("undo")}</button>
        </div>
      )}
      {search && (
        <label className="form-field">
          {ui("searchOrders")}
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={ui("searchYourOrders")}
          />
        </label>
      )}
      {history && historyConnect && (
        <div className="history-connect-banner">
          <img src="/api/reference-media/onboarding-package" alt="" />
          <SourceLink href="/account/connections">
            <strong>{ui("connectEmailToSeeMoreDeliveries")}</strong>
            <small>{ui("trackMoreOfYourPackagesWithShop")}</small>
          </SourceLink>
          <button
            aria-label={ui("dismissEmailConnection")}
            onClick={() => setHistoryConnect(false)}
            data-ui-label="dismissEmailConnection"
          >
            ×
          </button>
        </div>
      )}
      {visible.map((o) => {
        const p = catalog.products.find((p) => p.id === o.productId);
        const sourceWaiting =
          !o.statusChangedLocally &&
          (forcedView === "waiting" || forcedView === "manual") &&
          o.id === "REF-1001";
        if (archive) {
          const sourceProduct = p;
          const receipt = capturedReceipts[o.id];
          const seller = catalog.stores.find(
            (store) => store.id === p?.storeId,
          );
          return (
            <SourceLink
              key={o.id}
              className="archive-order-row"
              href={`/orders/${o.id}`}
            >
              {sourceProduct && <img src={sourceProduct.images[0]} alt="" />}
              <span>
                <strong>{receipt ? ui("orderedJul27") : o.name}</strong>
                <small>
                  {seller?.name ?? o.carrier}
                  {receipt
                    ? ` · 1 item · ${formatMoney({ amount: receipt.total, currency: "USD" }, intlLocale)}`
                    : ""}
                </small>
              </span>
            </SourceLink>
          );
        }
        if (history) {
          const kitsch = o.id === "REF-1001";
          return (
            <SourceLink
              className={`order-history-row ${kitsch ? "is-kitsch" : "is-package"}`}
              key={o.id}
              href={`/orders/${o.id}`}
            >
              {kitsch ? (
                <img src="/api/reference-media/kitsch-logo" alt="" />
              ) : (
                <span className="history-package-initial" aria-hidden="true">
                  L
                </span>
              )}
              <span>
                <strong>{kitsch ? "KITSCH" : o.name}</strong>
                <small>{kitsch ? ui("orderPlaced") : ui("onTheWay")}</small>
              </span>
              {kitsch && p && (
                <img
                  className="history-product-thumb"
                  src={p.images[0]}
                  alt=""
                />
              )}
              {kitsch && <b>{ui("text1Item1082")}</b>}
              <small className="history-order-date">{ui("jul27")}</small>
            </SourceLink>
          );
        }
        return (
          <OrderListCard
            className={`account-panel tracking-card ${!p ? "manual-tracking-card" : ""}`}
            sourceKey={`order-card:${o.id}`}
            status={o.status}
            href={
              o.status === "Delivered" && p
                ? `/orders/${o.id}/review`
                : o.id === "REF-1001"
                  ? `/orders/${o.id}?state=${sourceWaiting ? "waiting" : o.status === "Delivered" ? "delivered" : "in-transit"}`
                  : `/orders/${o.id}`
            }
            key={o.id}
            seller={
              <>
                {p && <img src="/api/reference-media/kitsch-logo" alt="" />}
                {p ? "KITSCH" : o.name}
              </>
            }
            title={
              o.status === "Delivered"
                ? p
                  ? ui("reviewYourOrder")
                  : ui("deliveredToday")
                : sourceWaiting
                  ? ui("expectedByAug3")
                  : o.status === "Ordered"
                    ? p
                      ? ui("orderPlaced")
                      : ui("labelCreated")
                    : ui("arrivesJul31Aug1")
            }
            image={p ? p.images[0] : "/api/reference-media/order-manual-parcel"}
            imageAlt={p ? o.name : ui("trackedPackage")}
          >
            {o.status === "Delivered" && p ? (
              <span className="review-stars" aria-hidden="true">
                <ReviewStars rating={0} />
              </span>
            ) : (
              <OrderProgress
                carrier={o.carrier}
                phase={
                  o.status === "Delivered"
                    ? "delivered"
                    : sourceWaiting
                      ? "waiting"
                      : o.status === "Ordered" || labelCreated
                        ? "label"
                        : "transit"
                }
              />
            )}
          </OrderListCard>
        );
      })}
      {!visible.length && (
        <OrdersEmpty
          className={
            archive || query ? "notification-empty" : "order-empty-source"
          }
          art={
            <>
              {!archive && !query && (
                <span
                  className={`${styles.emptyArt} ${native ? "android-order-art" : ""}`}
                >
                  <img
                    src={
                      native
                        ? "/api/reference-media/live-empty-orders-art"
                        : "/api/reference-media/order-empty-art"
                    }
                    alt=""
                  />
                  <DecorativeVideo
                    enabled={!native && params.get("reference") !== "captured"}
                    clips={[
                      {
                        key: "orders-empty-motion",
                        className: styles.emptyArtVideo,
                      },
                    ]}
                    loop
                  />
                </span>
              )}
              {archive && !query && (
                <img
                  className="archive-empty-package"
                  src="/api/reference-media/onboarding-package"
                  alt=""
                />
              )}
            </>
          }
          title={
            query
              ? ui("noOrdersFound")
              : archive
                ? ui("noArchivedOrdersYet")
                : ui("trackAllYourOrdersHere")
          }
          description={
            query
              ? ui("tryAnotherNameOrOrderNumber")
              : archive
                ? ui("cleanUpYourOrdersTabByMovingYourPastOrders")
                : guest
                  ? ui("signInToConnectYourAccountAndShopWillAutomatically")
                  : ui(
                      "connectYourAccountAndShopWillAutomaticallyTrackYourOrders",
                    )
          }
          actions={
            !archive &&
            !query && (
              <>
                <SourceLink
                  className="primary form-submit"
                  href={
                    guest
                      ? "/login?journey=new&returnTo=/orders"
                      : "/account/connections"
                  }
                >
                  {guest ? ui("signIn") : ui("connectAccount")}
                </SourceLink>
                {!guest && (
                  <SourceLink className="form-cancel" href="/orders/new">
                    {ui("addAPackageManually")}
                  </SourceLink>
                )}
              </>
            )
          }
        />
      )}
      {!history &&
        !archive &&
        forcedView !== "waiting" &&
        forcedView !== "manual" &&
        visible.some((o) => o.status !== "Ordered") && (
          <>
            <section className="orders-deals">
              <OrderSectionHeading label={ui("dealsBasedOnYourOrders")} />
              <div className="orders-deal-grid">
                {deals.map((entry, i) => (
                  <button
                    key={i}
                    aria-label={ui("viewDealValue1", { value1: i + 1 })}
                    onClick={() => setDeal(i)}
                  >
                    <img src={`/api/reference-media/${entry.photo}`} alt="" />
                    <span>{entry.promotion}</span>
                    <i>
                      <Icon name="bag-add" />
                    </i>
                  </button>
                ))}
              </div>
            </section>
            <section className="orders-past">
              <OrderSectionHeading label={ui("pastOrders")} />
              {orders
                .filter((o) => o.archived)
                .map((o) => (
                  <SourceLink href={`/orders/${o.id}`} key={o.id}>
                    <img
                      src={
                        catalog.products.find(
                          (product) => product.id === o.productId,
                        )?.images[0] ??
                        "/api/reference-media/order-manual-parcel"
                      }
                      alt=""
                    />
                    <span>
                      {labelCreated
                        ? ui("deliveredYesterday")
                        : ui("deliveredJul28")}
                      <small>{o.name}</small>
                    </span>
                  </SourceLink>
                ))}
            </section>
          </>
        )}
      <CartOverlay
        catalog={catalog}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
      />
      <Sheet
        open={deal !== null}
        title={ui("yourDeal")}
        onClose={() => setDeal(null)}
      >
        {deal !== null && (
          <img
            className="deal-preview-image"
            src={`/api/reference-media/${deals[deal].photo}`}
            alt={ui("selectedDeal")}
          />
        )}
        <Link className="primary form-submit" href="/search">
          {ui("shopProducts")}
        </Link>
      </Sheet>
      {!archive &&
        !history &&
        visible.length > 0 &&
        (forcedView === "waiting" ||
          forcedView === "manual" ||
          !visible.some((o) => o.status !== "Ordered")) && (
          <>
            {forcedView === "manual" && (
              <section className="orders-buy-again">
                <OrderSectionHeading label={ui("buyAgain")} />
                {(() => {
                  const product = catalog.products.find(
                    (entry) => entry.id === "shampoo-bag",
                  );
                  return product ? (
                    <SourceLink href={`/products/${product.id}`}>
                      <img
                        src={product.images[0]}
                        alt={ui("shampooBarBag_b19810")}
                      />
                      <span>
                        <Icon name="bag-add" />
                      </span>
                    </SourceLink>
                  ) : null;
                })()}
              </section>
            )}
            <SourceLink
              className="form-cancel order-archive-link"
              href="/orders/archived"
            >
              {ui("viewArchivedOrders")}
            </SourceLink>
          </>
        )}
      <Sheet
        open={menu}
        title={ui("moreOptions")}
        className={styles.orderMenu}
        onClose={() => setMenu(false)}
      >
        <OrderAction label={ui("viewOrderArchive")} href="/orders/archived" />
        <OrderAction
          label={ui("connectEmailAccounts")}
          href="/account/connections"
        />
        <OrderAction label={ui("addOrderManually")} href="/orders/new" />
      </Sheet>
    </OrdersListPresentation>
  );
}
export function OrderDetail({ catalog, id }: { catalog: Catalog; id: string }) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("commerceUI");
  const { orders, saveOrder, deleteOrder } = useAccount();
  const order = orders.find((o) => o.id === id);
  const [menu, setMenu] = useState(false);
  const router = useRouter(),
    params = useSearchParams();
  const progress = params.get("view") === "tracking";
  const sourceState = params.get("state");
  useEffect(() => {
    if (!progress) restoreSourcePosition(".order-status");
  }, [progress]);
  const setProgress = () => {
    rememberSourcePosition(".order-status");
    const next = new URLSearchParams(params.toString());
    next.set("view", "tracking");
    router.push(`/orders/${id}?${next}`, { scroll: false });
  };
  const [edit, setEdit] = useState(false);
  const [boundary, setBoundary] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [toast, setToast] = useState("");
  if (!order)
    return (
      <AccountPage title={ui("orderNotFound")}>
        <p>{ui("thisReferenceOrderIsNotAvailableInThisPageSession")}</p>
        <Link href="/orders">{ui("backToOrders")}</Link>
      </AccountPage>
    );
  const product = catalog.products.find((p) => p.id === order.productId);
  const data = capturedReceipts[id];
  const displayOrderNumber = data?.displayOrderNumber ?? order.id;
  const itemAmount = data?.itemAmount ?? product?.price.amount ?? 0;
  const editOrder = order;
  const displayOrder: ReferenceOrder = order.statusChangedLocally
    ? order
    : sourceState === "waiting"
      ? { ...order, status: "Ordered" }
      : sourceState === "delivered"
        ? { ...order, status: "Delivered" }
        : sourceState === "in-transit"
          ? { ...order, status: "In transit" }
          : order;
  if (progress || !product)
    return (
      <>
        <TrackingDetail
          catalog={catalog}
          order={displayOrder}
          onEdit={() => setEdit(true)}
        />
        {toast && (
          <p
            className="order-action-toast"
            data-toast-kind={
              toast === "Changes saved" ? "changes-saved" : undefined
            }
            role="status"
          >
            {toast}
          </p>
        )}
        <Sheet
          open={edit}
          title={ui("editTrackingDetails")}
          className={`tracking-edit-sheet ${styles.trackingEditor}`}
          onClose={() => setEdit(false)}
        >
          <ManualOrderForm
            key={`${edit}-${editOrder.name}-${editOrder.tracking}-${editOrder.carrier}`}
            initial={editOrder}
            editing
            onSave={(v) => {
              saveOrder(v);
              setEdit(false);
              setToast("Changes saved");
              window.setTimeout(() => setToast(""), 1800);
            }}
          />
        </Sheet>
      </>
    );
  return (
    <AccountPage className={styles.detail} dockFade>
      {toast && (
        <p
          className="order-action-toast"
          data-toast-kind={
            toast === "Changes saved" ? "changes-saved" : undefined
          }
          role="status"
        >
          {toast}
        </p>
      )}
      <section className="order-hero">
        <button
          className="order-more"
          onClick={() => setMenu(true)}
          aria-label={ui("orderOptions")}
          data-ui-label="orderOptions"
        >
          <Icon name="more" />
        </button>
        <OrderBrand number={displayOrderNumber} />
      </section>
      {displayOrder.status === "Delivered" && (
        <SourceLink
          className="account-panel review-invitation"
          href={`/orders/${id}/review`}
        >
          <span>
            <strong>{ui("reviewYourOrder")}</strong>
            <small>{ui("tellUsAboutYourPurchase")}</small>
          </span>
          <span className="review-stars" aria-hidden="true">
            <ReviewStars rating={0} />
          </span>
        </SourceLink>
      )}
      <button
        className="account-panel order-status"
        data-status={displayOrder.status}
        onClick={setProgress}
      >
        <span>
          <strong>
            {displayOrder.status === "Delivered"
              ? ui("deliveredAug1")
              : displayOrder.status === "In transit"
                ? ui("arrivesJul31Aug1")
                : ui("expectedByAug3")}
          </strong>
          <small>
            {displayOrder.status === "Delivered"
              ? ui("arrivedAt804AM")
              : displayOrder.status === "In transit"
                ? ui("inTransit")
                : ui("waitingForDetails")}
          </small>
        </span>
        {product && <img src={product.images[0]} alt="" />}
        {displayOrder.status !== "Delivered" && (
          <OrderProgress
            carrier={displayOrder.carrier}
            phase={displayOrder.status === "Ordered" ? "waiting" : "transit"}
          />
        )}
      </button>
      <div className="account-panel">
        <div className="order-item">
          {product && <img src={product.images[0]} alt="" />}
          <div>
            <strong>{order.name}</strong>
            <p>
              {product
                ? formatMoney(
                    { amount: itemAmount, currency: "USD" },
                    intlLocale,
                  )
                : ui("trackedPackage")}
            </p>
          </div>
          {product && displayOrder.status === "Delivered" && (
            <SourceLink className="pill" href={`/products/${product.id}`}>
              {ui("buyAgain")}
            </SourceLink>
          )}
        </div>
        <button className="muted-button" onClick={() => setBoundary(true)}>
          <ManageOrderIcon /> {ui("manageYourOrder")}
        </button>
        <SourceLink className="muted-button" href={`/orders/${id}/receipt`}>
          {ui("viewReceipt")}
        </SourceLink>
      </div>
      <OrderRecommendations catalog={catalog} />
      <Sheet
        open={menu}
        title={ui("yourOrder")}
        className={`source-order-menu ${styles.orderMenu}`}
        onClose={() => setMenu(false)}
      >
        <OrderAction
          label={
            displayOrder.status === "Delivered"
              ? ui("unmarkAsDelivered")
              : ui("markOrderAsDelivered")
          }
          onClick={() => {
            const next =
              displayOrder.status === "Delivered" ? "In transit" : "Delivered";
            saveOrder({ ...order, status: next, statusChangedLocally: true });
            const query = new URLSearchParams(params.toString());
            query.delete("state");
            commitSheetQuery(query);
            setMenu(false);
            setToast(
              next === "Delivered"
                ? "Marked as delivered"
                : "Unmarked as delivered",
            );
            window.setTimeout(() => setToast(""), 1800);
          }}
        />
        <OrderAction
          label={ui("contactMerchant")}
          onClick={() => {
            setMenu(false);
            setBoundary(true);
          }}
        />
        <OrderAction
          label={ui("copyOrderNumber")}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(displayOrderNumber);
              setToast("Order number copied");
            } catch {
              setToast(`Order number: ${displayOrderNumber}`);
            }
            setMenu(false);
            window.setTimeout(() => setToast(""), 1800);
          }}
        />
        <OrderAction
          label={order.archived ? ui("unarchiveOrder") : ui("archiveOrder")}
          onClick={() => {
            saveOrder({ ...order, archived: !order.archived });
            setMenu(false);
          }}
        />
        <OrderAction
          label={ui("reportAnIssueWithThisOrder")}
          onClick={() => {
            setMenu(false);
            setBoundary(true);
          }}
        />
        <OrderAction
          label={ui("reportThisOrderAsFraudulent")}
          onClick={() => {
            setMenu(false);
            setBoundary(true);
          }}
        />
        <OrderAction
          label={ui("delete")}
          onClick={() => {
            setMenu(false);
            setDeleteConfirm(true);
          }}
        />
      </Sheet>
      <Sheet
        open={edit}
        title={ui("editTrackingDetails")}
        className={`tracking-edit-sheet ${styles.trackingEditor}`}
        onClose={() => setEdit(false)}
      >
        <ManualOrderForm
          key={`${edit}-${editOrder.name}-${editOrder.tracking}-${editOrder.carrier}`}
          initial={editOrder}
          editing
          onSave={(v) => {
            saveOrder(v);
            setEdit(false);
            setToast("Changes saved");
            window.setTimeout(() => setToast(""), 1800);
          }}
        />
      </Sheet>
      <Sheet
        open={deleteConfirm}
        title={ui("deleteThisOrder")}
        onClose={() => setDeleteConfirm(false)}
      >
        <p className="form-note">
          {ui("removeThisOrderFromYourLocalPreviewYouCanUndo")}
        </p>
        <button
          className="primary form-submit"
          onClick={() => {
            consumeSheetHistory();
            deleteOrder(id);
            setDeleteConfirm(false);
            router.replace("/orders");
          }}
        >
          {ui("deleteOrder")}
        </button>
        <button className="form-cancel" onClick={() => setDeleteConfirm(false)}>
          {ui("keepOrder")}
        </button>
      </Sheet>
      <Boundary
        open={boundary}
        onClose={() => setBoundary(false)}
        kind="Order action"
      />
    </AccountPage>
  );
}
const manualCarriers = [
  ["DHL Active Tracing", "active-tracing"],
  ["DHL Benelux", "benelux"],
  ["DHL 2_Mann_Handling", "two-man"],
  ["DHL eCommerce", "ecommerce"],
  ["DHL eCommerce Vietnam", null],
  ["DHL Spain Domestic", "spain"],
  ["DHL Express", null],
  ["Amazon Logistics", null],
  ["USPS", null],
  ["FedEx", null],
  ["UPS", null],
  ["Other", null],
] as const;

function ManualOrderForm({
  initial,
  onSave,
  editing = false,
}: {
  editing?: boolean;
  initial: ReferenceOrder;
  onSave: (o: ReferenceOrder) => void;
}) {
  const caption = useCaption();
  const ui = useTranslations("commerceUI");
  const [editValue, setEditValue] = useState(initial);
  const draft = useManualOrderDraft(!editing);
  const value = editing ? editValue : { ...initial, ...draft.value };
  const setValue = (
    change: Partial<Pick<ReferenceOrder, "tracking" | "name" | "carrier">>,
  ) => {
    if (editing) setEditValue((previous) => ({ ...previous, ...change }));
    else draft.update(change);
  };
  const [carrierQuery, setCarrierQuery] = useState("");
  const [carrierOpen, setCarrierOpen] = useState(false);
  const [emailBoundary, setEmailBoundary] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const carrierInput = useRef<HTMLInputElement>(null);
  const carrierListId = useId();
  const matchingCarriers = manualCarriers.filter(([name]) =>
    name.toLowerCase().includes(carrierQuery.trim().toLowerCase()),
  );
  return (
    <>
      <form
        className={`account-form ${styles.manualForm}`}
        onKeyDown={(event) => {
          if (event.key === "Escape" && carrierOpen) {
            event.preventDefault();
            event.stopPropagation();
            carrierInput.current?.focus();
            setCarrierOpen(false);
          }
        }}
        onBlur={(event) => {
          if (
            carrierOpen &&
            !(
              event.relatedTarget instanceof Element &&
              event.relatedTarget.closest(".carrier-selector, .carrier-search")
            )
          )
            setCarrierOpen(false);
        }}
        onSubmit={(e) => {
          e.preventDefault();
          if (
            carrierOpen ||
            !value.tracking.trim() ||
            !value.name.trim() ||
            !value.carrier.trim()
          )
            return;
          onSave(value);
        }}
      >
        {!editing && <h2>{ui("manuallyAddOrder")}</h2>}
        <label className="form-field">
          <span>{ui("trackingNumber")}</span>
          <input
            placeholder={ui("trackingNumber")}
            aria-label={ui("trackingNumber")}
            required
            maxLength={80}
            value={value.tracking}
            onChange={(e) => setValue({ tracking: e.target.value })}
            data-ui-label="trackingNumber"
          />
        </label>
        <label className="form-field">
          <span>{ui("packageName")}</span>
          <input
            placeholder={ui("packageName")}
            aria-label={ui("packageName")}
            required
            maxLength={100}
            value={value.name}
            onChange={(e) => setValue({ name: e.target.value })}
            data-ui-label="packageName"
          />
        </label>
        <label className="form-field carrier-selector">
          <span>{ui("carrier")}</span>
          <input
            placeholder={ui("carrier")}
            ref={carrierInput}
            aria-label={ui("carrier")}
            aria-controls={carrierOpen ? carrierListId : undefined}
            autoComplete="off"
            value={carrierOpen ? carrierQuery : value.carrier}
            onFocus={() => {
              setCarrierQuery(value.carrier);
              setCarrierOpen(true);
            }}
            onChange={(e) => {
              setCarrierQuery(e.target.value);
              setCarrierOpen(true);
            }}
            data-ui-label="carrier"
          />
        </label>
        {carrierOpen && (
          <div className="carrier-search" id={carrierListId}>
            <h3>{ui("recommendedCarriers")}</h3>
            {matchingCarriers.map(([c, logo]) => (
              <button
                type="button"
                className="account-row"
                key={c}
                onClick={() => {
                  setValue({ carrier: c });
                  setCarrierOpen(false);
                  carrierInput.current?.blur();
                }}
              >
                {caption(c)}
                {logo ? (
                  <img
                    aria-hidden="true"
                    className="dhl-mark"
                    src={`/api/reference-media/order-carrier-${logo}`}
                    alt=""
                  />
                ) : !c.startsWith("DHL") ? (
                  <span aria-hidden="true">›</span>
                ) : null}
              </button>
            ))}
            {matchingCarriers.length === 0 && (
              <div className={styles.carrierEmpty}>
                <p role="status">{ui("noMatchingCarriers")}</p>
                <button
                  type="button"
                  onClick={() => {
                    setCarrierQuery("");
                    carrierInput.current?.focus();
                  }}
                >
                  {ui("showAllCarriers")}
                </button>
              </div>
            )}
          </div>
        )}
        <button
          className="primary form-submit"
          hidden={carrierOpen}
          disabled={
            !value.tracking.trim() ||
            !value.name.trim() ||
            !value.carrier.trim() ||
            (editing &&
              value.tracking === initial.tracking &&
              value.name === initial.name &&
              value.carrier === initial.carrier)
          }
        >
          {editing ? ui("updateTrackingDetails") : ui("addOrder")}
        </button>
        {!editing && !carrierOpen && (
          <div className="forward-orders">
            <p>{ui("or")}</p>
            <h2>{ui("forwardShippingEmails")}</h2>
            <button
              type="button"
              className={styles.forwardAddress}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    "track-q6uoeuhu57@my.shop.app",
                  );
                  setCopyStatus("Email address copied");
                } catch {
                  setCopyStatus(
                    "Copy unavailable. Select the address to copy it manually.",
                  );
                }
              }}
            >
              track-q6uoeuhu57@my.shop.app
            </button>
            {copyStatus && (
              <p className={styles.copyStatus} role="status">
                {copyStatus}
              </p>
            )}
            <p>
              {ui("copyYourUniqueAddressToForwardShippingEmailsAndShop")}{" "}
              <SourceLink href="/support/help">{ui("learnMore")}</SourceLink>
            </p>
            <button
              type="button"
              className="primary form-submit"
              onClick={() => setEmailBoundary(true)}
            >
              {ui("openEmailApp")}
            </button>
            <SourceLink href="/account/connections">
              {ui("trackOrdersAutomaticallyInstead")}
            </SourceLink>
          </div>
        )}
      </form>
      <Boundary
        open={emailBoundary}
        kind="Email forwarding"
        onClose={() => setEmailBoundary(false)}
      />
    </>
  );
}
export function NewOrder() {
  const ui = useTranslations("commerceUI");
  const { orders, saveOrder } = useAccount();
  const router = useRouter();
  const pending = useRef<{ key: string; id: string } | null>(null);
  return (
    <AccountPage
      title={ui("addOrderManually")}
      dock={false}
      className={styles.newOrder}
    >
      <ManualOrderForm
        initial={{
          id: "",
          productId: "",
          name: "",
          carrier: "",
          tracking: "",
          status: "Ordered",
          archived: false,
          rating: 0,
          review: "",
        }}
        onSave={(o) => {
          const key = `${o.carrier.trim().toLowerCase()}:${o.tracking.trim()}`;
          const existing = orders.find(
            (order) =>
              !order.productId &&
              `${order.carrier.trim().toLowerCase()}:${order.tracking.trim()}` ===
                key,
          );
          // Re-adding a manually tracked package restores its one identity.
          // A pending local navigation must not let a second click duplicate it.
          const id =
            existing?.id ??
            (pending.current?.key === key
              ? pending.current.id
              : `REF-${crypto.randomUUID().slice(0, 8)}`);
          pending.current = { key, id };
          saveOrder({ ...o, id });
          router.push("/orders?view=manual");
        }}
      />
    </AccountPage>
  );
}
export function OrderReview({ id, catalog }: { id: string; catalog: Catalog }) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("commerceUI");
  const { orders, saveOrder } = useAccount();
  const order = orders.find((o) => o.id === id);
  const product = catalog.products.find((p) => p.id === order?.productId);
  const [rating, setRating] = useState(
    order?.rating || (id === "REF-1001" ? 5 : 0),
  );
  const [review, setReview] = useState(order?.review ?? "");
  const [saved, setSaved] = useState(false);
  const editing = !!order?.rating;
  const [reviewMenu, setReviewMenu] = useState(false);
  const [identityHelp, setIdentityHelp] = useState(false);
  return (
    <AccountPage dock={false} className={`order-review-page ${styles.review}`}>
      <ContextualCloseLink
        className="review-close"
        href={`/orders/${id}`}
        aria-label={ui("closeReview")}
        data-ui-label="closeReview"
      >
        <Icon name="close" />
      </ContextualCloseLink>
      {editing && (
        <button
          className={styles.reviewMore}
          aria-label={ui("reviewOptions")}
          onClick={() => setReviewMenu(true)}
          data-ui-label="reviewOptions"
        >
          <Icon name="more" />
        </button>
      )}
      <h1>{editing ? ui("editYourReview") : ui("reviewYourOrder")}</h1>
      {!editing && <p className="review-count">{ui("text1Of1Products")}</p>}
      {order && product ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveOrder({ ...order, rating, review });
            setSaved(true);
          }}
        >
          <div className="review-product">
            <img src={product.images[0]} alt={order.name} />
            <div>
              <small>KITSCH</small>
              <p>{order.name}</p>
              <span>
                {formatMoney(
                  {
                    amount:
                      capturedReceipts[id]?.itemAmount ?? product.price.amount,
                    currency: "USD",
                  },
                  intlLocale,
                )}
              </span>
              <div className="rating-picker">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    type="button"
                    aria-label={ui("value1Stars", { value1: n ?? "" })}
                    aria-pressed={rating >= n}
                    className={rating >= n ? "selected" : ""}
                    onClick={() => setRating(n)}
                    key={n}
                  >
                    <RatingStar />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="review-text">
            <strong>{ui("tellUsAboutTheProduct")}</strong>
            <textarea
              aria-label={ui("tellUsAboutTheProduct")}
              placeholder={ui("whatDidYouLikeOrDislike")}
              value={review}
              onChange={(e) => setReview(e.target.value)}
              maxLength={2000}
              data-ui-label="tellUsAboutTheProduct"
            />
          </label>
          <p className="review-identity">
            {ui("reviewingAs")} {shopSourceBuyer.firstName}{" "}
            <button
              type="button"
              aria-label={ui("aboutYourReviewName")}
              onClick={() => setIdentityHelp(true)}
              data-ui-label="aboutYourReviewName"
            >
              ?
            </button>
          </p>
          <button className="primary review-submit" disabled={!rating}>
            {editing ? ui("updateReview") : ui("submit")}
          </button>
          {saved && (
            <p role="status" className={styles.reviewStatus}>
              {ui("reviewSavedLocallyItHasNotBeenPublished")}
            </p>
          )}
        </form>
      ) : (
        <p>{ui("orderNotFound_9204be")}</p>
      )}
      <Sheet
        open={identityHelp}
        title={ui("yourReviewName")}
        onClose={() => setIdentityHelp(false)}
      >
        <p className="form-note">
          {ui("yourReviewUsesTheFirstNameInYourProfileThis")}
        </p>
      </Sheet>
      <Sheet
        open={reviewMenu}
        title={ui("yourReview")}
        onClose={() => setReviewMenu(false)}
      >
        <OrderAction
          label={ui("delete")}
          onClick={() => {
            if (order) saveOrder({ ...order, rating: 0, review: "" });
            setRating(0);
            setReview("");
            setSaved(false);
            setReviewMenu(false);
          }}
        />
      </Sheet>
    </AccountPage>
  );
}
export function Receipt({ catalog, id }: { catalog: Catalog; id: string }) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("commerceUI");
  const { orders } = useAccount();
  const order = orders.find((o) => o.id === id),
    data = capturedReceipts[id];
  const product = catalog.products.find((p) => p.id === order?.productId);
  const money = (amount: number) =>
    formatMoney({ amount, currency: "USD" }, intlLocale);
  const [shareMessage, setShareMessage] = useState("");
  const [paymentInfo, setPaymentInfo] = useState(false);
  return (
    <AccountPage
      title={ui("receipt")}
      className="receipt-page"
      action={
        <button
          className="receipt-share"
          aria-label={ui("shareReceipt")}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setShareMessage(ui("receiptLinkCopied"));
            } catch {
              setShareMessage(ui("sharingIsNotAvailableInThisBrowser"));
            }
          }}
          data-ui-label="shareReceipt"
        >
          <Icon name="share" />
        </button>
      }
    >
      {order && data ? (
        <>
          <div className="receipt-order-meta">
            <strong>
              {ui("order")}
              {data.displayOrderNumber}
            </strong>
            <p>{data.date}</p>
          </div>
          {shareMessage && <p role="status">{shareMessage}</p>}
          <div className="receipt-product">
            {product && (
              <img
                src={
                  product.id === "shampoo-bag"
                    ? "/api/reference-media/receipt-shampoo-bag-photo"
                    : product.images[0]
                }
                alt=""
              />
            )}
            <strong>{order.name}</strong>
            <span>{money(data.itemAmount)}</span>
          </div>
          <div className="receipt-totals">
            <p>
              <span>{ui("subtotal")}</span>
              <span>{money(data.itemAmount)}</span>
            </p>
            <p>
              <span>{ui("discount")}</span>
              <span>
                {data.discount ? "-" : ""}
                {money(data.discount)}
              </span>
            </p>
            <p>
              <span>{ui("shipping")}</span>
              <span>{money(data.shipping)}</span>
            </p>
            <p>
              <span>{ui("tax")}</span>
              <span>{money(data.tax)}</span>
            </p>
            <p className="receipt-total">
              <strong>{ui("total")}</strong>
              <strong>{money(data.total)}</strong>
            </p>
          </div>
          <section className="receipt-section receipt-method">
            <h2>{ui("paymentMethod")}</h2>
            <p className="receipt-payment">
              <strong>Shop Pay</strong>
              <span>{money(data.total)}</span>
            </p>
            <p className="receipt-card-line">
              <b>VISA</b>
              <span className="receipt-card-number">
                <span aria-hidden="true">···· ···· ···· </span>
                <span className="sr-only">{ui("visaEnding")} </span>
                {data.cardLast4}
              </span>
              <button
                type="button"
                className="receipt-payment-info"
                aria-label={ui("aboutThisPaymentMethod")}
                onClick={() => setPaymentInfo(true)}
                data-ui-label="aboutThisPaymentMethod"
              >
                <Icon name="info" />
              </button>
            </p>
          </section>
          <section className="receipt-section">
            <h2>{ui("shippingAddress")}</h2>
            <p>
              {data.name}
              <br />
              {data.street}
              <br />
              {data.city},{" "}
              {data.region === "CA" ? ui("california") : data.region}{" "}
              {data.postalCode}
              <br />
              {data.country}
              <br />
              {data.phone}
            </p>
          </section>
          <section className="receipt-section">
            <h2>{ui("billingAddress")}</h2>
            <p>{ui("sameAsShippingAddress")}</p>
          </section>
          <section className="receipt-section">
            <h2>{ui("shippingMethod")}</h2>
            <p>{data.shippingMethod}</p>
          </section>
          <section className="receipt-section">
            <h2>{ui("emailAddress")}</h2>
            <p>{data.email}</p>
          </section>
          <section className="receipt-section">
            <h2>KITSCH</h2>
            <SourceLink
              className="receipt-seller"
              href="/stores/kitsch"
              startAtTop
            >
              <img src="/api/reference-media/kitsch-logo" alt="" />
              <span>KITSCH</span>
            </SourceLink>
          </section>
          <Sheet
            open={paymentInfo}
            title={ui("paymentMethod")}
            onClose={() => setPaymentInfo(false)}
          >
            <p className="form-note">
              {ui("shopPayVisaEnding")} {data.cardLast4}
            </p>
            <p className="form-note">
              {ui("capturedPaymentTotal")} {money(data.total)}
            </p>
            <p className="form-note">
              {ui("noAdditionalPaymentDetailsWereRecordedForThisReceipt")}
            </p>
          </Sheet>
        </>
      ) : (
        <p>{ui("noReceiptIsAvailableForThisTrackedOrder")}</p>
      )}
    </AccountPage>
  );
}
export function OrderConfirmation({
  id,
  catalog,
}: {
  id: string;
  catalog: Catalog;
}) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("commerceUI");
  const confirmationStage = useCapturedConfirmation(id);
  const detailsPending = confirmationStage === 1;
  const recommendationsPending = confirmationStage !== 0;
  const { orders } = useAccount();
  const order = orders.find((o) => o.id === id),
    data = capturedReceipts[id];
  const product = catalog.products.find((p) => p.id === order?.productId);
  const money = (amount: number) =>
    formatMoney({ amount, currency: "USD" }, intlLocale);
  return (
    <AccountPage
      className={`order-confirmation-page ${detailsPending ? "is-confirmation-loading" : ""}`}
      back={false}
      dockFade
    >
      <Link
        className="review-close"
        href={`/orders/${id}`}
        aria-label={ui("closeConfirmation")}
        data-ui-label="closeConfirmation"
      >
        <Icon name="close" />
      </Link>
      {order && data ? (
        <>
          <header
            className="confirmation-heading"
            data-confirmation-stage={confirmationStage}
          >
            <div>
              <h1>{ui("orderConfirmed")}</h1>
              {!detailsPending && (
                <small>
                  {ui("orderNo")}
                  {data.displayOrderNumber}
                </small>
              )}
            </div>
            {detailsPending ? (
              <span
                className="confirmation-brand-placeholder"
                aria-hidden="true"
              >
                K
              </span>
            ) : (
              <img src="/api/reference-media/kitsch-logo" alt="KITSCH" />
            )}
          </header>
          {detailsPending ? (
            <div
              className="confirmation-details-skeleton"
              role="status"
              aria-label={ui("loadingCapturedOrderDetails")}
              data-ui-label="loadingCapturedOrderDetails"
            >
              <div className="confirmation-address-skeleton" aria-hidden="true">
                <i />
                <i />
                <b />
              </div>
              <p>{ui("total")}</p>
              <i aria-hidden="true" />
              <button className="muted-button" disabled>
                {ui("viewOrderReceipt")}
              </button>
            </div>
          ) : (
            <>
              <section className="confirmation-destination">
                <small>{ui("shipsTo")}</small>
                <div>
                  <strong>
                    {data.street} {data.city}, {data.region}, {data.postalCode}
                    {ui("uS")}
                  </strong>
                  {product && <img src={product.images[0]} alt="" />}
                </div>
              </section>
              <section className="confirmation-delivery">
                <small>{ui("estimatedDelivery")}</small>
                <strong>{ui("expectedByAug3")}</strong>
              </section>
              <div className="confirmation-total">
                <p>
                  <span>{ui("total")}</span>
                  <span>{money(data.total)}</span>
                </p>
                <p>
                  <span>Shop Pay ···· {data.cardLast4}</span>
                  <span>{money(data.total)}</span>
                </p>
              </div>
              <SourceLink
                className="muted-button"
                href={`/orders/${id}/receipt`}
                startAtTop
              >
                {ui("viewOrderReceipt")}
              </SourceLink>
            </>
          )}
          {recommendationsPending ? (
            <div
              className="confirmation-shelves-skeleton"
              role="status"
              aria-label={ui("loadingCapturedRecommendations")}
              data-ui-label="loadingCapturedRecommendations"
            >
              {[0, 1].map((shelf) => (
                <div key={shelf} aria-hidden="true">
                  <i />
                  <div>
                    <b />
                    <b />
                    <b />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <h2>
                <SourceLink href="/stores/kitsch" startAtTop>
                  {ui("popularAtKITSCH")} <span aria-hidden="true">›</span>
                </SourceLink>
              </h2>
              <div className="product-rail">
                {["black-conditioner-bag", "chocolate-body-bag", "shower-caddy"]
                  .map((id) => catalog.products.find((p) => p.id === id))
                  .filter((p) => !!p)
                  .map((p) => (
                    <ProductCard
                      key={p.id}
                      ratingStars={
                        p.id === "black-conditioner-bag" ? 4.5 : undefined
                      }
                      product={{
                        ...p,
                        images:
                          p.id === "black-conditioner-bag"
                            ? [
                                "/api/reference-media/confirmation-black-conditioner-photo",
                              ]
                            : p.id === "chocolate-body-bag"
                              ? [
                                  "/api/reference-media/confirmation-chocolate-body-photo",
                                ]
                              : p.images,
                        title:
                          p.id === "chocolate-body-bag"
                            ? "Chocolate Body Wash Bar B…"
                            : p.title,
                        ratingCount:
                          p.id === "black-conditioner-bag"
                            ? "2.8K"
                            : p.id === "chocolate-body-bag"
                              ? "749"
                              : p.ratingCount,
                      }}
                    />
                  ))}
              </div>
              <SourceLink
                href="/deals"
                className="confirmation-deals"
                startAtTop
              >
                {ui("yourDeals")} <span aria-hidden="true">›</span>
              </SourceLink>
            </>
          )}
        </>
      ) : (
        <p>{ui("noConfirmationIsAvailableForThisTrackedOrder")}</p>
      )}
    </AccountPage>
  );
}
