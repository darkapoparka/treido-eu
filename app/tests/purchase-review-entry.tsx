import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { PurchaseReviewDetail } from "../apps/web/src/features/purchase-reviews/detail";
import { ReservationsPanel } from "../apps/web/src/features/purchase-reviews/reservations";
import {
  CreateReviewButton,
  PrivatePurchaseBoundary,
} from "../apps/web/src/features/purchase-reviews/controls";
import messages from "../apps/web/src/features/purchase-reviews/messages.json";
import styles from "../apps/web/src/features/purchase-reviews/reviews.module.css";
function App() {
  const [data, setData] = useState(window.__purchaseInitial);
  useEffect(() => {
    window.__purchaseRefresh = async () => {
      const response = await fetch(location.href, {
        headers: { "x-purchase-data": "1" },
      });
      const next = await response.json();
      window.__purchaseInitial = next;
      setData(next);
    };
    return () => {
      delete window.__purchaseRefresh;
    };
  }, []);
  return (
    <NextIntlClientProvider
      locale={data.language}
      messages={{ purchaseReviews: messages[data.language] }}
      timeZone="Europe/Sofia"
    >
      <main
        className={
          styles.page + " " + (data.view === "merchant" ? styles.merchant : "")
        }
      >
        <h1>
          {
            messages[data.language][
              data.view === "review"
                ? "detail"
                : data.view === "create"
                  ? "title"
                  : "reservations"
            ]
          }
        </h1>
        <PrivatePurchaseBoundary actorSubject={data.actor}>
          {data.view === "review" ? (
            <PurchaseReviewDetail
              initial={data.review}
              actorKey={data.actorKey}
              actorSubject={data.actor}
            />
          ) : data.view === "create" ? (
            <CreateReviewButton source={data.source} actorKey={data.actorKey} />
          ) : (
            <ReservationsPanel
              data={data.queue}
              actorSubject={data.actor}
              view={data.history ? "history" : "active"}
              q=""
            />
          )}
        </PrivatePurchaseBoundary>
      </main>
    </NextIntlClientProvider>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
