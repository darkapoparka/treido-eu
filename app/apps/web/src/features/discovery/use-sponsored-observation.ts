"use client";
import { useCallback, useEffect, useRef, type MouseEvent } from "react";
import { recordPromotionMetricAction } from "../promotions/metric-actions";

/** visible-v1: half the existing card visible for one continuous second in a
 * foreground document. The server independently requires current approved policy
 * and this human's explicit optional choice; rendering never grants consent. */
export function useSponsoredObservation<T extends HTMLElement = HTMLDivElement>(
  token: string | undefined,
  listingId: string,
) {
  const ref = useRef<T>(null);
  const impression = useRef<{
    token: string;
    request: Promise<unknown>;
  } | null>(null);
  useEffect(() => {
    const card = ref.current;
    if (!token || !card || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let visible = false;
    const stop = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const update = () => {
      stop();
      if (
        !visible ||
        document.visibilityState !== "visible" ||
        impression.current?.token === token
      )
        return;
      timer = setTimeout(() => {
        timer = null;
        if (
          !visible ||
          !card.isConnected ||
          document.visibilityState !== "visible"
        )
          return;
        const request = recordPromotionMetricAction(token, "impression").catch(
          () => undefined,
        );
        impression.current = { token, request };
      }, 1000);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries.some(
          (entry) =>
            entry.target === card &&
            entry.isIntersecting &&
            entry.intersectionRatio >= 0.5,
        );
        update();
      },
      { threshold: 0.5 },
    );
    observer.observe(card);
    document.addEventListener("visibilitychange", update);
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [token]);
  const onClick = useCallback(
    (event: MouseEvent<T>) => {
      if (!token || !(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || !event.currentTarget.contains(anchor)) return;
      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        destination.pathname !== "/products/" + listingId
      )
        return;
      const prior =
        impression.current?.token === token
          ? impression.current.request
          : Promise.resolve();
      void prior
        .then(() => recordPromotionMetricAction(token, "click"))
        .catch(() => undefined);
    },
    [token, listingId],
  );
  return { ref, onClick: token ? onClick : undefined };
}
