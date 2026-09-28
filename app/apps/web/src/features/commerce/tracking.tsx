"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AccountPage, Boundary } from "../account/forms";
import { commitSheetQuery, Sheet, ProductCard } from "../discovery/components";
import { Icon } from "../discovery/icons";
import { SourceLink } from "../discovery/return-navigation";
import { useAccount, type ReferenceOrder } from "../account/state";
import type { Catalog } from "../catalog/types";
import { capturedReceipts } from "./receipt-data";
import { shopSourceAddress } from "./source-fixtures";
import {
  CarrierMark,
  ManageOrderIcon,
  OrderAction,
  OrderBrand,
  OrderProgress,
  OrderRecommendations,
} from "./order-presentation";
import { DeliveryConfetti } from "./delivery-confetti";
import {
  ManualPickedPreview,
  OrderInspiredPartial,
} from "./order-inspired-partial";
import styles from "./orders-parity.module.css";
const events = [
  ["Milpitas, CA, 95035, US · Jul 31, 6:04pm", "Successfully delivered"],
  ["Milpitas, CA, 95035, US · Jul 31, 10:56am", "Out for delivery"],
  ["Milpitas, CA, 95035, US · Jul 31, 1:45am", "Arrival at transport hub"],
  ["Oakley, CA, 94561, US · Jul 30, 8:36pm", "Departure from transport hub"],
  ["Oakley, CA, 94561, US · Jul 30, 2:44pm", "Arrival at transport hub"],
  ["Jurupa Valley, CA, US · Jul 30, 2:21am", "Departure from transport hub"],
  ["Jurupa Valley, CA, US · Jul 29, 4:26pm", "Arrival at transport hub"],
  ["Jurupa Valley, CA, US · Jul 29, 4:26pm", "Pick-up successful"],
  ["Jul 28, 4:16am", "Parcel data submitted to carrier"],
];
export function TrackingDetail({
  catalog,
  order,
  onEdit,
}: {
  catalog: Catalog;
  order: ReferenceOrder;
  onEdit: () => void;
}) {
  const { saveOrder } = useAccount(),
    router = useRouter(),
    params = useSearchParams();
  const [menu, setMenu] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );
  const [activity, setActivity] = useState(false),
    [boundary, setBoundary] = useState(""),
    [copied, setCopied] = useState(false),
    [statusToast, setStatusToast] = useState(""),
    [celebrate, setCelebrate] = useState(false);
  const product = catalog.products.find((p) => p.id === order.productId),
    delivered = order.status === "Delivered",
    waiting = order.status === "Ordered" && Boolean(product),
    manualLabel = order.status === "Ordered" && !product,
    laterManualHistory =
      !product && params.get("history") === "delivered-later",
    labelCreated =
      !delivered && (manualLabel || params.get("progress") === "label"),
    inTransit = Boolean(product) && !delivered && !waiting && !labelCreated;
  const mapAvailable = Boolean(product) && (inTransit || delivered);
  const map = mapAvailable && params.get("map") === "1";
  const StatusElement = mapAvailable ? "button" : "div";
  const sourceReceipt = capturedReceipts[order.id];
  const displayOrderNumber = sourceReceipt?.displayOrderNumber ?? order.id;
  const sourceCarrier = order.carrier;
  const sourceTracking = order.tracking;
  const visible = waiting
    ? []
    : labelCreated
      ? [events.at(-1)!]
      : delivered
        ? [events[0], events[1], events.at(-1)!]
        : [events[6], events.at(-1)!];
  const all = waiting ? [] : labelCreated ? [events.at(-1)!] : events;
  const mark = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const next = delivered ? (product ? "In transit" : "Ordered") : "Delivered";
    setCelebrate(next === "Delivered");
    saveOrder({ ...order, status: next, statusChangedLocally: true });
    const query = new URLSearchParams(params.toString());
    query.delete("state");
    query.delete("history");
    commitSheetQuery(query);
    setStatusToast(
      next === "Delivered" ? "Marked as delivered" : "Unmarked as delivered",
    );
    if (next === "Delivered") {
      const duration = matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 1400
        : 3400;
      timers.current.push(setTimeout(() => setCelebrate(false), duration));
    }
    timers.current.push(setTimeout(() => setStatusToast(""), 1800));
  };
  return (
    <AccountPage
      className={`tracking-detail ${styles.tracking} ${waiting ? styles.waitingTracking : ""} ${inTransit ? styles.inTransitTracking : ""} ${labelCreated && product ? styles.labelTracking : ""} ${!product ? styles.manualTracking : ""} ${laterManualHistory ? styles.laterManualTracking : ""} ${delivered ? styles.deliveredTracking : ""} ${map ? `tracking-map-view ${styles.mapView}` : ""}`}
      onBack={() => router.back()}
      dockFade={Boolean(product)}
    >
      {celebrate && <DeliveryConfetti />}
      {map && (
        <div
          className={`tracking-map ${styles.sourceMap}`}
          role="img"
          aria-label={`Recorded delivery map in ${delivered ? "Milpitas" : "Jurupa Valley"}`}
        >
          <img
            className={styles.mapGeography}
            src={`/api/reference-media/order-tracking-map-${delivered ? "delivered" : "transit"}`}
            width={393}
            height={250}
            alt=""
          />
          {delivered && (
            <svg
              className={styles.mapRoute}
              viewBox="0 0 393 250"
              aria-hidden="true"
            >
              <path d="M244 0L228.5 59M203.5 154L196.67 180.5" />
            </svg>
          )}
          {product && (
            <div className={styles.mapCard}>
              <img src={product.images[0]} alt="" />
            </div>
          )}
          <span className={styles.mapPin} aria-hidden="true" />
        </div>
      )}
      <div className="tracking-body">
        <button
          className={styles.trackingMore}
          aria-label="Tracking options"
          onClick={() => setMenu(true)}
        >
          <Icon name="more" />
        </button>
        <StatusElement
          className="tracking-status-card"
          onClick={
            mapAvailable
              ? () => {
                  const q = new URLSearchParams(params.toString());
                  q.set("map", map ? "0" : "1");
                  router.push(`?${q}`, { scroll: false });
                }
              : undefined
          }
        >
          <small>
            {product
              ? delivered
                ? `${order.name} KITSCH`
                : "KITSCH"
              : order.name}
          </small>
          <h1>
            {delivered
              ? product
                ? "Delivered Aug 1"
                : "Delivered today"
              : waiting
                ? "Expected by Aug 3"
                : manualLabel
                  ? "Label created"
                  : "Arrives Jul 31–Aug 1"}
          </h1>
          {!manualLabel && (
            <p>
              {delivered
                ? product
                  ? "Arrived at 8:04 AM"
                  : laterManualHistory
                    ? "Arrived at 5:09 PM"
                    : "Arrived at 7:34 PM"
                : waiting
                  ? "Waiting for details"
                  : labelCreated
                    ? "Label created"
                    : "In transit"}
            </p>
          )}
          <OrderProgress
            carrier={sourceCarrier}
            phase={
              delivered
                ? "delivered"
                : waiting
                  ? "waiting"
                  : labelCreated
                    ? "label"
                    : "transit"
            }
          />
        </StatusElement>
        {!waiting && (
          <section
            className="tracking-carrier"
            data-carrier-mark={
              sourceCarrier === "Amazon Logistics" ? "amazon" : undefined
            }
          >
            <div
              className={`${styles.carrierHeading} ${sourceCarrier.startsWith("DHL") ? styles.dhlHeading : ""}`}
            >
              <CarrierMark carrier={sourceCarrier} />
              <strong>{sourceCarrier}</strong>
            </div>
            <div className={styles.trackingNumber}>
              <span>
                <small>Tracking no.</small>
                <span>{sourceTracking}</span>
              </span>
              <button
                aria-label="Copy tracking number"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(sourceTracking);
                    setCopied(true);
                  } catch {
                    setBoundary("Clipboard");
                  }
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="8.5" y="3.5" width="11" height="12" rx="3" />
                  <path d="M8.5 9H6a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h5a3 3 0 0 0 3-3v-2.5" />
                </svg>
              </button>
              <button
                aria-label="Open carrier tracking"
                onClick={() => setBoundary("Carrier tracking")}
              >
                <ManageOrderIcon />
              </button>
            </div>
            {copied && <p role="status">Tracking number copied</p>}
          </section>
        )}
        {manualLabel && (
          <section className="tracking-empty">
            <h2>No delivery updates</h2>
            <p>
              We’re waiting to receive delivery updates from the carrier. Check
              tracking details are correct.
            </p>
            <button className="muted-button" onClick={onEdit}>
              Edit tracking details
            </button>
          </section>
        )}
        {product && (
          <section className="tracking-order-card">
            <OrderBrand number={displayOrderNumber} tracking />
            <div className="order-item">
              <img src={product.images[0]} alt="" />
              <span>
                {order.name}
                <small>
                  {sourceReceipt
                    ? `$${(sourceReceipt.itemAmount / 100).toFixed(2)}`
                    : ""}
                </small>
              </span>
            </div>
            <button
              className="muted-button"
              onClick={() => setBoundary("Order management")}
            >
              <ManageOrderIcon /> Manage your order
            </button>
            <SourceLink
              className="muted-button"
              href="/stores/kitsch"
              startAtTop
            >
              Visit store
            </SourceLink>
            <SourceLink
              className="muted-button"
              href={`/orders/${order.id}`}
              startAtTop
            >
              View order details
            </SourceLink>
          </section>
        )}
        {product && !manualLabel && (
          <section className="delivery-preview" data-waiting={waiting}>
            <h2>Delivery progress</h2>
            {!delivered && (
              <div className="delivery-destination">
                <small>Delivery to</small>
                <strong>
                  {shopSourceAddress.street}, {shopSourceAddress.city},{" "}
                  {shopSourceAddress.postalCode}
                </strong>
              </div>
            )}
            {visible.length > 0 && (
              <Activity rows={visible} submittedParcel={labelCreated} />
            )}
            {all.length > visible.length && (
              <button
                className="muted-button"
                onClick={() => setActivity(true)}
              >
                View all activity
              </button>
            )}
          </section>
        )}
        <div className="tracking-action-panel">
          {!waiting && (
            <OrderAction
              label={delivered ? "Unmark as delivered" : "Mark as delivered"}
              onClick={mark}
            />
          )}
          {!waiting && !manualLabel && !delivered && (
            <OrderAction label="Edit tracking details" onClick={onEdit} />
          )}
          <OrderAction
            label="Report incorrect information"
            onClick={() => setBoundary("Tracking report")}
          />
        </div>
        {!product && (
          <h2>
            <SourceLink
              href="/deals"
              className={styles.manualRecommendationLabel}
              startAtTop
            >
              Your deals
              <Icon name="chevron" />
            </SourceLink>
          </h2>
        )}
        {product ? (
          <OrderRecommendations catalog={catalog} />
        ) : (
          <div className={`product-rail ${styles.manualDeals}`}>
            {[
              laterManualHistory ? "home-drmtlgy-eye" : "order-tire-trim",
              "order-peach-bee",
            ].flatMap((id) => {
              const item = catalog.products.find(
                (product) => product.id === id,
              );
              if (!item) return [];
              const projected =
                id === "home-drmtlgy-eye"
                  ? {
                      ...item,
                      title: "Luminous Eye Corrector® SPF 41",
                      images: ["/api/reference-media/order-drmtlgy-eye-photo"],
                      rating: 4,
                      ratingCount: "3.2K",
                      promotion: "Save $25",
                    }
                  : item;
              return [
                <ProductCard
                  key={projected.id}
                  product={projected}
                  showPromotion
                  storeName={
                    catalog.stores.find((store) => store.id === item.storeId)
                      ?.name
                  }
                />,
              ];
            })}
          </div>
        )}
        {product && (
          <>
            <h2 className={styles.inspiredHeading}>Inspired by your order</h2>
            <OrderInspiredPartial />
          </>
        )}
        {!product && delivered && (
          <>
            <h2 className={styles.manualPicked}>
              <span className={styles.manualRecommendationLabel}>
                Picked for you
                <Icon name="chevron" />
              </span>
            </h2>
            <ManualPickedPreview />
          </>
        )}
        {statusToast && (
          <p className="order-action-toast" role="status">
            {statusToast}
          </p>
        )}
      </div>
      <Sheet
        open={activity}
        title="Delivery progress"
        className={`full-activity-sheet ${styles.activitySheet}`}
        onClose={() => setActivity(false)}
      >
        <Activity rows={all} full />
      </Sheet>
      <Sheet
        open={menu}
        title="Your order"
        className={styles.orderMenu}
        onClose={() => setMenu(false)}
      >
        <OrderAction
          label={delivered ? "Unmark as delivered" : "Mark as delivered"}
          onClick={() => {
            mark();
            setMenu(false);
          }}
        />
        <OrderAction
          label="Edit tracking details"
          onClick={() => {
            setMenu(false);
            onEdit();
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
          label="Report incorrect information"
          onClick={() => {
            setMenu(false);
            setBoundary("Tracking report");
          }}
        />
      </Sheet>
      <Boundary
        open={!!boundary}
        kind={boundary}
        onClose={() => setBoundary("")}
      />
    </AccountPage>
  );
}
function Activity({
  rows,
  submittedParcel = false,
  full = false,
}: {
  rows: string[][];
  submittedParcel?: boolean;
  full?: boolean;
}) {
  return (
    <div className={`source-activity ${styles.activity}`}>
      {rows.map(([time, label]) => {
        const kind =
          label === "Successfully delivered"
            ? "delivered"
            : label === "Parcel data submitted to carrier"
              ? submittedParcel
                ? "parcel"
                : "carrier"
              : !full && label === "Arrival at transport hub"
                ? "parcel"
                : "dot";
        return (
          <div key={`${time}-${label}`}>
            <i data-event-kind={kind}>
              {kind === "delivered" ? (
                <Icon name="location" />
              ) : kind === "carrier" ? (
                <CarrierMark carrier="Amazon Logistics" />
              ) : kind === "dot" ? (
                <span />
              ) : (
                <img src="/api/reference-media/order-event-parcel" alt="" />
              )}
            </i>
            <span>
              <small>{time}</small>
              <strong>{label}</strong>
            </span>
          </div>
        );
      })}
    </div>
  );
}
