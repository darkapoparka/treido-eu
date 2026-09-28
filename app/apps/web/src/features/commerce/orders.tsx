"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
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
export function OrdersPage({
  catalog,
  archive = false,
  history = false,
}: {
  catalog: Catalog;
  archive?: boolean;
  history?: boolean;
}) {
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
    <AccountPage
      android={native}
      back={archive || history || forcedView === "manual"}
      cart={!archive && !history ? () => setCartOpen(true) : undefined}
      showCartWhenEmpty={
        !native &&
        !archive &&
        !history &&
        (forcedView === "empty" || !orders.some((order) => !order.archived))
      }
      title={history ? "Order history" : archive ? "Archived" : "Orders"}
      className={`${archive ? "archive-page" : "source-orders-page"} ${forcedView === "manual" ? "manual-order-result" : ""} ${styles.list} ${native ? "android-orders" : ""}`}
      action={
        !archive && (
          <div className="order-actions">
            {!history && (
              <button
                aria-label="Search orders"
                onClick={() => setSearch(!search)}
              >
                <Icon name="search" />
              </button>
            )}
            <button
              aria-label="More order options"
              onClick={() => {
                rememberSourcePosition('[aria-label="More order options"]');
                setMenu(true);
              }}
            >
              <Icon name="more" />
            </button>
          </div>
        )
      }
    >
      {deletedOrder && (
        <div className={styles.deletedOrderNotice} role="status">
          <span>Order deleted from this preview.</span>
          <button onClick={restoreOrder}>Undo</button>
        </div>
      )}
      {search && (
        <label className="form-field">
          Search orders
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your orders"
          />
        </label>
      )}
      {history && historyConnect && (
        <div className="history-connect-banner">
          <img src="/api/reference-media/onboarding-package" alt="" />
          <SourceLink href="/account/connections">
            <strong>Connect email to see more deliveries</strong>
            <small>Track more of your packages with Shop</small>
          </SourceLink>
          <button
            aria-label="Dismiss email connection"
            onClick={() => setHistoryConnect(false)}
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
                <strong>{receipt ? "Ordered Jul 27" : o.name}</strong>
                <small>
                  {seller?.name ?? o.carrier}
                  {receipt
                    ? ` · 1 item · ${formatMoney({ amount: receipt.total, currency: "USD" })}`
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
                <small>{kitsch ? "Order placed" : "On the way"}</small>
              </span>
              {kitsch && p && (
                <img
                  className="history-product-thumb"
                  src={p.images[0]}
                  alt=""
                />
              )}
              {kitsch && <b>1 item · $10.82</b>}
              <small className="history-order-date">Jul 27</small>
            </SourceLink>
          );
        }
        return (
          <SourceLink
            className={`account-panel tracking-card ${!p ? "manual-tracking-card" : ""}`}
            sourceKey={`order-card:${o.id}`}
            data-order-status={o.status}
            href={
              o.status === "Delivered" && p
                ? `/orders/${o.id}/review`
                : o.id === "REF-1001"
                  ? `/orders/${o.id}?state=${sourceWaiting ? "waiting" : o.status === "Delivered" ? "delivered" : "in-transit"}`
                  : `/orders/${o.id}`
            }
            key={o.id}
          >
            <div>
              <strong className="order-seller-label">
                {p && <img src="/api/reference-media/kitsch-logo" alt="" />}
                {p ? "KITSCH" : o.name}
              </strong>
              <h2>
                {o.status === "Delivered"
                  ? p
                    ? "Review your order"
                    : "Delivered today"
                  : sourceWaiting
                    ? "Expected by Aug 3"
                    : o.status === "Ordered"
                      ? p
                        ? "Order placed"
                        : "Label created"
                      : "Arrives Jul 31–Aug 1"}
              </h2>
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
            </div>
            <img
              src={p ? p.images[0] : "/api/reference-media/order-manual-parcel"}
              alt={p ? o.name : "Tracked package"}
            />
          </SourceLink>
        );
      })}
      {!visible.length && (
        <div
          className={
            archive || query ? "notification-empty" : "order-empty-source"
          }
        >
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
          <h2>
            {query
              ? "No orders found"
              : archive
                ? "No archived orders yet"
                : "Track all your orders here"}
          </h2>
          <p>
            {query
              ? "Try another name or order number."
              : archive
                ? "Clean up your orders tab, by moving your past orders to the archive."
                : guest
                  ? "Sign in to connect your account and Shop will automatically track your orders."
                  : "Connect your account, and Shop will automatically track your orders."}
          </p>
          {!archive && !query && (
            <>
              <SourceLink
                className="primary form-submit"
                href={
                  guest
                    ? "/login?journey=new&returnTo=/orders"
                    : "/account/connections"
                }
              >
                {guest ? "Sign in" : "Connect account"}
              </SourceLink>
              {!guest && (
                <SourceLink className="form-cancel" href="/orders/new">
                  Add a package manually
                </SourceLink>
              )}
            </>
          )}
        </div>
      )}
      {!history &&
        !archive &&
        forcedView !== "waiting" &&
        forcedView !== "manual" &&
        visible.some((o) => o.status !== "Ordered") && (
          <>
            <section className="orders-deals">
              <OrderSectionHeading label="Deals based on your orders" />
              <div className="orders-deal-grid">
                {deals.map((entry, i) => (
                  <button
                    key={i}
                    aria-label={`View deal ${i + 1}`}
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
              <OrderSectionHeading label="Past orders" />
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
                        ? "Delivered yesterday"
                        : "Delivered Jul 28"}
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
        title="Your deal"
        onClose={() => setDeal(null)}
      >
        {deal !== null && (
          <img
            className="deal-preview-image"
            src={`/api/reference-media/${deals[deal].photo}`}
            alt="Selected deal"
          />
        )}
        <Link className="primary form-submit" href="/search">
          Shop products
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
                <OrderSectionHeading label="Buy again" />
                {(() => {
                  const product = catalog.products.find(
                    (entry) => entry.id === "shampoo-bag",
                  );
                  return product ? (
                    <SourceLink href={`/products/${product.id}`}>
                      <img src={product.images[0]} alt="Shampoo Bar Bag" />
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
              View archived orders
            </SourceLink>
          </>
        )}
      <Sheet
        open={menu}
        title="More options"
        className={styles.orderMenu}
        onClose={() => setMenu(false)}
      >
        <OrderAction label="View order archive" href="/orders/archived" />
        <OrderAction
          label="Connect email accounts"
          href="/account/connections"
        />
        <OrderAction label="Add order manually" href="/orders/new" />
      </Sheet>
    </AccountPage>
  );
}
export function OrderDetail({ catalog, id }: { catalog: Catalog; id: string }) {
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
      <AccountPage title="Order not found">
        <p>This reference order is not available in this page session.</p>
        <Link href="/orders">Back to orders</Link>
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
          title="Edit tracking details"
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
          aria-label="Order options"
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
            <strong>Review your order</strong>
            <small>Tell us about your purchase</small>
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
              ? "Delivered Aug 1"
              : displayOrder.status === "In transit"
                ? "Arrives Jul 31–Aug 1"
                : "Expected by Aug 3"}
          </strong>
          <small>
            {displayOrder.status === "Delivered"
              ? "Arrived at 8:04 AM"
              : displayOrder.status === "In transit"
                ? "In transit"
                : "Waiting for details"}
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
                ? formatMoney({ amount: itemAmount, currency: "USD" })
                : "Tracked package"}
            </p>
          </div>
          {product && displayOrder.status === "Delivered" && (
            <SourceLink className="pill" href={`/products/${product.id}`}>
              Buy again
            </SourceLink>
          )}
        </div>
        <button className="muted-button" onClick={() => setBoundary(true)}>
          <ManageOrderIcon /> Manage your order
        </button>
        <SourceLink className="muted-button" href={`/orders/${id}/receipt`}>
          View receipt
        </SourceLink>
      </div>
      <OrderRecommendations catalog={catalog} />
      <Sheet
        open={menu}
        title="Your order"
        className={`source-order-menu ${styles.orderMenu}`}
        onClose={() => setMenu(false)}
      >
        <OrderAction
          label={
            displayOrder.status === "Delivered"
              ? "Unmark as delivered"
              : "Mark order as delivered"
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
          label="Contact merchant"
          onClick={() => {
            setMenu(false);
            setBoundary(true);
          }}
        />
        <OrderAction
          label="Copy order number"
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
          label={order.archived ? "Unarchive order" : "Archive order"}
          onClick={() => {
            saveOrder({ ...order, archived: !order.archived });
            setMenu(false);
          }}
        />
        <OrderAction
          label="Report an issue with this order"
          onClick={() => {
            setMenu(false);
            setBoundary(true);
          }}
        />
        <OrderAction
          label="Report this order as fraudulent"
          onClick={() => {
            setMenu(false);
            setBoundary(true);
          }}
        />
        <OrderAction
          label="Delete"
          onClick={() => {
            setMenu(false);
            setDeleteConfirm(true);
          }}
        />
      </Sheet>
      <Sheet
        open={edit}
        title="Edit tracking details"
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
        title="Delete this order?"
        onClose={() => setDeleteConfirm(false)}
      >
        <p className="form-note">
          Remove this order from your local preview. You can undo this from
          Orders. This does not cancel a purchase or contact the merchant.
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
          Delete order
        </button>
        <button className="form-cancel" onClick={() => setDeleteConfirm(false)}>
          Keep order
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
        {!editing && <h2>Manually add order</h2>}
        <label className="form-field">
          <span>Tracking number</span>
          <input
            placeholder="Tracking number"
            aria-label="Tracking number"
            required
            maxLength={80}
            value={value.tracking}
            onChange={(e) => setValue({ tracking: e.target.value })}
          />
        </label>
        <label className="form-field">
          <span>Package name</span>
          <input
            placeholder="Package name"
            aria-label="Package name"
            required
            maxLength={100}
            value={value.name}
            onChange={(e) => setValue({ name: e.target.value })}
          />
        </label>
        <label className="form-field carrier-selector">
          <span>Carrier</span>
          <input
            placeholder="Carrier"
            ref={carrierInput}
            aria-label="Carrier"
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
          />
        </label>
        {carrierOpen && (
          <div className="carrier-search" id={carrierListId}>
            <h3>Recommended carriers</h3>
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
                {c}
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
                <p role="status">No matching carriers</p>
                <button
                  type="button"
                  onClick={() => {
                    setCarrierQuery("");
                    carrierInput.current?.focus();
                  }}
                >
                  Show all carriers
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
          {editing ? "Update tracking details" : "Add order"}
        </button>
        {!editing && !carrierOpen && (
          <div className="forward-orders">
            <p>or</p>
            <h2>Forward shipping emails</h2>
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
              Copy your unique address to forward shipping emails and Shop will
              track your orders.{" "}
              <SourceLink href="/support/help">Learn more</SourceLink>
            </p>
            <button
              type="button"
              className="primary form-submit"
              onClick={() => setEmailBoundary(true)}
            >
              Open email app
            </button>
            <SourceLink href="/account/connections">
              Track orders automatically instead
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
  const { orders, saveOrder } = useAccount();
  const router = useRouter();
  const pending = useRef<{ key: string; id: string } | null>(null);
  return (
    <AccountPage
      title="Add order manually"
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
        aria-label="Close review"
      >
        <Icon name="close" />
      </ContextualCloseLink>
      {editing && (
        <button
          className={styles.reviewMore}
          aria-label="Review options"
          onClick={() => setReviewMenu(true)}
        >
          <Icon name="more" />
        </button>
      )}
      <h1>{editing ? "Edit your review" : "Review your order"}</h1>
      {!editing && <p className="review-count">1 of 1 products</p>}
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
                {formatMoney({
                  amount:
                    capturedReceipts[id]?.itemAmount ?? product.price.amount,
                  currency: "USD",
                })}
              </span>
              <div className="rating-picker">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    type="button"
                    aria-label={`${n} stars`}
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
            <strong>Tell us about the product</strong>
            <textarea
              aria-label="Tell us about the product"
              placeholder="What did you like or dislike?"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              maxLength={2000}
            />
          </label>
          <p className="review-identity">
            Reviewing as {shopSourceBuyer.firstName}{" "}
            <button
              type="button"
              aria-label="About your review name"
              onClick={() => setIdentityHelp(true)}
            >
              ?
            </button>
          </p>
          <button className="primary review-submit" disabled={!rating}>
            {editing ? "Update review" : "Submit"}
          </button>
          {saved && (
            <p role="status" className={styles.reviewStatus}>
              Review saved locally. It has not been published.
            </p>
          )}
        </form>
      ) : (
        <p>Order not found.</p>
      )}
      <Sheet
        open={identityHelp}
        title="Your review name"
        onClose={() => setIdentityHelp(false)}
      >
        <p className="form-note">
          Your review uses the first name in your profile. This preview saves
          reviews locally and does not publish them.
        </p>
      </Sheet>
      <Sheet
        open={reviewMenu}
        title="Your review"
        onClose={() => setReviewMenu(false)}
      >
        <OrderAction
          label="Delete"
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
  const { orders } = useAccount();
  const order = orders.find((o) => o.id === id),
    data = capturedReceipts[id];
  const product = catalog.products.find((p) => p.id === order?.productId);
  const money = (amount: number) => formatMoney({ amount, currency: "USD" });
  const [shareMessage, setShareMessage] = useState("");
  const [paymentInfo, setPaymentInfo] = useState(false);
  return (
    <AccountPage
      title="Receipt"
      className="receipt-page"
      action={
        <button
          className="receipt-share"
          aria-label="Share receipt"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setShareMessage("Receipt link copied");
            } catch {
              setShareMessage("Sharing is not available in this browser.");
            }
          }}
        >
          <Icon name="share" />
        </button>
      }
    >
      {order && data ? (
        <>
          <div className="receipt-order-meta">
            <strong>Order #{data.displayOrderNumber}</strong>
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
              <span>Subtotal</span>
              <span>{money(data.itemAmount)}</span>
            </p>
            <p>
              <span>Discount</span>
              <span>
                {data.discount ? "-" : ""}
                {money(data.discount)}
              </span>
            </p>
            <p>
              <span>Shipping</span>
              <span>{money(data.shipping)}</span>
            </p>
            <p>
              <span>Tax</span>
              <span>{money(data.tax)}</span>
            </p>
            <p className="receipt-total">
              <strong>Total</strong>
              <strong>{money(data.total)}</strong>
            </p>
          </div>
          <section className="receipt-section receipt-method">
            <h2>Payment method</h2>
            <p className="receipt-payment">
              <strong>Shop Pay</strong>
              <span>{money(data.total)}</span>
            </p>
            <p className="receipt-card-line">
              <b>VISA</b>
              <span className="receipt-card-number">
                <span aria-hidden="true">···· ···· ···· </span>
                <span className="sr-only">Visa ending </span>
                {data.cardLast4}
              </span>
              <button
                type="button"
                className="receipt-payment-info"
                aria-label="About this payment method"
                onClick={() => setPaymentInfo(true)}
              >
                <Icon name="info" />
              </button>
            </p>
          </section>
          <section className="receipt-section">
            <h2>Shipping address</h2>
            <p>
              {data.name}
              <br />
              {data.street}
              <br />
              {data.city}, {data.region === "CA" ? "California" : data.region}{" "}
              {data.postalCode}
              <br />
              {data.country}
              <br />
              {data.phone}
            </p>
          </section>
          <section className="receipt-section">
            <h2>Billing address</h2>
            <p>Same as shipping address</p>
          </section>
          <section className="receipt-section">
            <h2>Shipping method</h2>
            <p>{data.shippingMethod}</p>
          </section>
          <section className="receipt-section">
            <h2>Email address</h2>
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
            title="Payment method"
            onClose={() => setPaymentInfo(false)}
          >
            <p className="form-note">Shop Pay · Visa ending {data.cardLast4}</p>
            <p className="form-note">
              Captured payment total: {money(data.total)}
            </p>
            <p className="form-note">
              No additional payment details were recorded for this receipt.
            </p>
          </Sheet>
        </>
      ) : (
        <p>No receipt is available for this tracked order.</p>
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
  const confirmationStage = useCapturedConfirmation(id);
  const detailsPending = confirmationStage === 1;
  const recommendationsPending = confirmationStage !== 0;
  const { orders } = useAccount();
  const order = orders.find((o) => o.id === id),
    data = capturedReceipts[id];
  const product = catalog.products.find((p) => p.id === order?.productId);
  const money = (amount: number) => formatMoney({ amount, currency: "USD" });
  return (
    <AccountPage
      className={`order-confirmation-page ${detailsPending ? "is-confirmation-loading" : ""}`}
      back={false}
      dockFade
    >
      <Link
        className="review-close"
        href={`/orders/${id}`}
        aria-label="Close confirmation"
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
              <h1>Order confirmed</h1>
              {!detailsPending && (
                <small>Order No. #{data.displayOrderNumber}</small>
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
              aria-label="Loading captured order details"
            >
              <div className="confirmation-address-skeleton" aria-hidden="true">
                <i />
                <i />
                <b />
              </div>
              <p>Total</p>
              <i aria-hidden="true" />
              <button className="muted-button" disabled>
                View order receipt
              </button>
            </div>
          ) : (
            <>
              <section className="confirmation-destination">
                <small>Ships to</small>
                <div>
                  <strong>
                    {data.street} {data.city}, {data.region}, {data.postalCode},
                    US
                  </strong>
                  {product && <img src={product.images[0]} alt="" />}
                </div>
              </section>
              <section className="confirmation-delivery">
                <small>Estimated delivery</small>
                <strong>Expected by Aug 3</strong>
              </section>
              <div className="confirmation-total">
                <p>
                  <span>Total</span>
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
                View order receipt
              </SourceLink>
            </>
          )}
          {recommendationsPending ? (
            <div
              className="confirmation-shelves-skeleton"
              role="status"
              aria-label="Loading captured recommendations"
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
                  Popular at KITSCH <span aria-hidden="true">›</span>
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
                Your deals <span aria-hidden="true">›</span>
              </SourceLink>
            </>
          )}
        </>
      ) : (
        <p>No confirmation is available for this tracked order.</p>
      )}
    </AccountPage>
  );
}
