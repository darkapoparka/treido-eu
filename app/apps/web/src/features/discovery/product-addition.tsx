"use client";
/* eslint-disable @next/next/no-img-element -- The flight reuses the selected product photograph. */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./product-addition.css";

type Flight = { id: number; image: string; x: number; y: number };
type Phase = "idle" | "flying" | "confirmed";

// Flow 20 recording: the photograph grows above the purchase controls, then
// contracts into the cart; the confirmation subsequently returns to Add to cart.
// These are presentation durations, never a simulated inventory/network request.
const FLIGHT_MS = 700;
const CONFIRM_MS = 450;
const RESET_MS = 1800;

export function useProductAddition() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [flight, setFlight] = useState<Flight | null>(null);
  const [announcement, setAnnouncement] = useState({ id: 0, text: "" });
  const cleanup = useRef<() => void>(() => undefined);
  const busy = useRef(false);
  const serial = useRef(0);

  useEffect(() => () => cleanup.current(), []);

  function begin(image: string, title: string, quantity: number) {
    // Ignore repeat activation during the same flight, not subsequent additions.
    if (busy.current) return false;
    cleanup.current();
    busy.current = true;
    const operation = ++serial.current;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const trigger = document.activeElement;
    const bounds =
      trigger instanceof HTMLElement ? trigger.getBoundingClientRect() : null;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let frame = 0;
    setAnnouncement({
      id: operation,
      text: `${quantity} ${title} added to cart`,
    });
    setPhase(reduced ? "confirmed" : "flying");
    setFlight(null);
    if (!reduced) {
      // The cart mutation and dock render occur before measuring the destination.
      frame = requestAnimationFrame(() => {
        setFlight({
          id: operation,
          image,
          x: bounds ? bounds.left + bounds.width / 2 : innerWidth / 2,
          y: Math.min(
            innerHeight - 180,
            Math.max(90, (bounds?.top ?? 100) + 80),
          ),
        });
      });
      timers.push(setTimeout(() => setPhase("confirmed"), CONFIRM_MS));
    }
    timers.push(
      setTimeout(
        () => {
          setFlight(null);
          busy.current = false;
        },
        reduced ? 0 : FLIGHT_MS,
      ),
      setTimeout(() => setPhase("idle"), RESET_MS),
    );
    cleanup.current = () => {
      cancelAnimationFrame(frame);
      for (const timer of timers) clearTimeout(timer);
      busy.current = false;
    };
    return true;
  }

  return {
    phase,
    flight,
    announcement: announcement.text,
    announcementId: announcement.id,
    begin,
  };
}

export function ProductAdditionFlight({ flight }: { flight: Flight | null }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const image = ref.current;
    if (!image || !flight) return;
    const cart = document.querySelector<HTMLElement>(".dock-cart");
    if (!cart) return;
    const target = cart.getBoundingClientRect();
    const x = target.left + target.width / 2 - flight.x;
    const y = target.top + target.height / 2 - flight.y;
    const animation = image.animate(
      [
        { transform: "translate(0, 0) scale(0.3)", opacity: 0, offset: 0 },
        { transform: "translate(0, 0) scale(1)", opacity: 1, offset: 0.2 },
        { transform: "translate(0, 0) scale(1)", opacity: 1, offset: 0.5 },
        {
          transform: `translate(${x * 0.12}px, ${y * 0.24}px) scale(0.8)`,
          opacity: 1,
          offset: 0.74,
        },
        { transform: `translate(${x}px, ${y}px) scale(0.04)`, opacity: 0 },
      ],
      { duration: FLIGHT_MS, easing: "ease-in-out", fill: "both" },
    );
    // Cancellation is expected on navigation, another addition or reduced motion.
    void animation.finished.catch(() => undefined);
    return () => animation.cancel();
  }, [flight]);
  if (!flight) return null;
  return createPortal(
    <img
      ref={ref}
      className="product-addition-flight"
      src={flight.image}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ left: flight.x - 87, top: flight.y - 87 }}
    />,
    document.body,
  );
}
