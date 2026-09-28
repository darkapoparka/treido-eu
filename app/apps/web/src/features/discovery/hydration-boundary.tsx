"use client";
import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { useSourceReturn } from "./return-navigation";
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
const Ready = createContext(true);
export const useSurfaceReady = () => useContext(Ready);

// Readiness belongs to each client page, not the root layout: streamed routes
// can hydrate later. Fieldset protects form values; inert also protects links.
export function HydrationBoundary({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  useSourceReturn(ready);
  return (
    <Ready value={ready}>
      <fieldset
        role="presentation"
        disabled={!ready}
        inert={!ready}
        data-shop-interactive={ready}
        style={{ display: "contents" }}
      >
        {children}
      </fieldset>
    </Ready>
  );
}
export function ShopSurface(props: ComponentPropsWithoutRef<"main">) {
  return (
    <HydrationBoundary>
      <main {...props} />
    </HydrationBoundary>
  );
}
