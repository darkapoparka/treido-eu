"use client";
/* eslint-disable @next/next/no-img-element -- Existing reference brand marks. */
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { IconButton, Sheet } from "./components";
import { Icon } from "./icons";
import { useDiscovery } from "./state";
import { useSheetStages } from "./sheet-stages";
import type { Store } from "../catalog/types";
import {
  bindSourceDestination,
  rememberSourcePosition,
} from "./return-navigation";
import "./shop-options-menu.css";

export type ShopMenuStage = "menu" | "reason" | "report" | "reported";

/** The same shop actions serve a campaign and a Deals merchant. */
export function ShopOptionsMenu({
  open,
  store,
  rating,
  onStageChange,
  onClose,
  onReopen,
  onHide,
  onVisit,
}: {
  open: boolean;
  store?: Pick<Store, "id" | "name" | "logo" | "referenceStyle">;
  rating?: string;
  stage: ShopMenuStage;
  onStageChange: (stage: ShopMenuStage) => void;
  onClose: () => void;
  onReopen: () => void;
  onHide: () => void;
  onVisit?: () => void;
}) {
  const state = useDiscovery();
  const native = store?.referenceStyle === "android";
  const [reportReason, setReportReason] = useState("");
  const flow = useSheetStages<ShopMenuStage>({
    open,
    initial: "menu",
    onClose,
    onReopen,
    onStart: () => setReportReason(""),
  });
  const sourceOrigin = useRef<string | null>(null);
  const recordedOpen = useRef(false);
  useLayoutEffect(() => {
    if (!open) {
      recordedOpen.current = false;
      return;
    }
    if (recordedOpen.current) return;
    recordedOpen.current = true;
    // Capture the page button before Sheet moves focus and pushes its entry.
    // Forward retains that origin; Deals' child-shop sheet keeps its own owner.
    if (onVisit || flow.active) return;
    const opener = document.activeElement;
    const label = opener?.getAttribute("aria-label");
    if (!(opener instanceof HTMLButtonElement) || !label) return;
    if (store?.referenceStyle === "android") {
      const rect = opener.getBoundingClientRect();
      const panel = document.querySelector<HTMLElement>(
        "dialog.android-shop-menu",
      );
      panel?.style.setProperty(
        "--shop-menu-left",
        `${Math.max(16, rect.right - 240)}px`,
      );
      const top =
        rect.bottom + 4 + 208 <= window.innerHeight - 16
          ? rect.bottom + 4
          : rect.top - 212;
      panel?.style.setProperty("--shop-menu-top", `${Math.max(16, top)}px`);
    }
    const selector = `button[aria-label="${CSS.escape(label)}"]`;
    sourceOrigin.current = rememberSourcePosition(
      selector,
      [...document.querySelectorAll(selector)].indexOf(opener),
    );
  }, [open, onVisit, flow.active, store?.referenceStyle]);
  const stage = flow.stage;
  useEffect(() => onStageChange(stage), [stage, onStageChange]);
  const previousStage = useRef(stage);
  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = previousStage.current;
    previousStage.current = stage;
    if (previous === stage) return;
    const frame = requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLDialogElement>(
        "dialog.campaign-menu[open]",
      );
      const selector =
        stage === "menu"
          ? `[data-menu-stage="${previous === "reason" ? "reason" : "report"}"]`
          : stage === "report"
            ? 'input[type="radio"]'
            : stage === "reason"
              ? ".campaign-reasons button"
              : ".icon-button";
      const target =
        (stage === "report"
          ? panel?.querySelector<HTMLElement>("input:checked")
          : null) ?? panel?.querySelector<HTMLElement>(selector);
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, stage]);
  function navigate(next: ShopMenuStage) {
    flow.navigate(next);
  }
  function close() {
    flow.close();
  }
  function hide() {
    flow.close(onHide);
  }
  return (
    <Sheet
      open={open}
      title={
        stage === "reason"
          ? "Not interested"
          : stage === "report"
            ? "Report shop"
            : stage === "reported"
              ? "Report saved"
              : (store?.name ?? "Shop")
      }
      headerless={stage === "menu" || native}
      dragHandle={native && stage !== "menu"}
      className={`campaign-menu campaign-menu-${stage} ${store?.referenceStyle === "android" ? "android-shop-menu" : ""}`}
      onClose={close}
      manageHistory={false}
    >
      {native && stage !== "menu" && (
        <div className="sheet-header">
          <h2>
            {stage === "reason"
              ? "Not interested"
              : stage === "report"
                ? "Report shop"
                : "Report saved"}
          </h2>
          <IconButton icon="close" label="Close shop options" onClick={close} />
        </div>
      )}
      {stage === "menu" ? (
        <>
          <header className="campaign-menu-store">
            {store?.logo && <img src={store.logo} alt="" />}
            <span>
              <strong>{store?.name ?? "Shop"}</strong>
              {rating && <b>{rating}</b>}
            </span>
            <IconButton
              icon="close"
              label="Close shop options"
              onClick={close}
            />
          </header>
          <div className="campaign-menu-rows">
            {onVisit ? (
              <button onClick={onVisit}>
                <Icon name="storefront" />
                Visit shop
              </button>
            ) : (
              <Link
                href={store ? `/stores/${store.id}` : "/search"}
                onClick={(event) => {
                  if (event.defaultPrevented && sourceOrigin.current)
                    bindSourceDestination(
                      sourceOrigin.current,
                      store ? `/stores/${store.id}` : "/search",
                    );
                }}
              >
                <Icon name="storefront" />
                Visit shop
              </Link>
            )}
            {store && (
              <button
                aria-pressed={state.followed.includes(store.id)}
                onClick={() => state.toggleFollow(store.id)}
              >
                <Icon name="plus-circle" />
                {state.followed.includes(store.id) ? "Following" : "Follow"}
              </button>
            )}
            <button data-menu-stage="reason" onClick={() => navigate("reason")}>
              <Icon name="thumb-down" />
              Not interested
            </button>
            <button
              data-menu-stage="report"
              className="danger-text"
              onClick={() => {
                navigate("report");
              }}
            >
              <Icon name="alert" />
              Report shop
            </button>
          </div>
        </>
      ) : stage === "reason" ? (
        <>
          <p>Please select a reason</p>
          <div className="campaign-reasons">
            {[
              "I just don’t like it",
              "Products are too expensive",
              "Want to see fewer shops like this",
              `Want to see less of ${store?.name ?? "this shop"}`,
            ].map((reason) => (
              <button key={reason} onClick={hide}>
                {reason}
              </button>
            ))}
          </div>
        </>
      ) : stage === "report" ? (
        <>
          <p>Please select a reason</p>
          <div className="filter-options">
            {[
              "Misleading",
              "Inappropriate content",
              "IP Infringement",
              "Other",
            ].map((reason) => (
              <label key={reason}>
                {reason}
                <input
                  type="radio"
                  name="campaign-report"
                  checked={reportReason === reason}
                  onChange={() => setReportReason(reason)}
                />
              </label>
            ))}
          </div>
          <button
            className="primary form-submit"
            disabled={!reportReason}
            onClick={() => navigate("reported")}
          >
            Report
          </button>
        </>
      ) : (
        <p className="sheet-copy">
          This report was recorded locally. No report was sent.
        </p>
      )}
    </Sheet>
  );
}
