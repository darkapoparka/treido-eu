"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { usePrivateScope } from "../library/session-boundary";
import { acceptsPrivateResult } from "../library/private-session";
import { readBuyerCartAction } from "./actions";
import type { BuyerCart } from "./model";

export const cartChangedEvent = "treido-cart-changed";
export function useBuyerCartController(
  initial: BuyerCart | null,
  initialSubject: string | null,
) {
  const scope = usePrivateScope();
  const [loaded, setLoaded] = useState<{
    key: string;
    cart: BuyerCart | null;
    status: "ready" | "guest" | "error";
  } | null>(null);
  const lifetime = useRef({ key: scope.key, generation: 0 });
  const mounted = useRef(false);
  // A server projection can seed only the first scope of this mount. Do not
  // revive it after a focus, visibility or account change while a read is pending.
  const [seed] = useState(() =>
    initial && scope.subject && initialSubject === scope.subject
      ? { key: scope.key, cart: initial }
      : null,
  );
  useLayoutEffect(() => {
    const state = lifetime.current;
    if (state.key !== scope.key) {
      state.key = scope.key;
      ++state.generation;
    }
  }, [scope.key]);
  const refresh = useCallback(async () => {
    if (!scope.isCurrent() || !scope.subject) return;
    const ticket = ++lifetime.current.generation;
    let result;
    try {
      result = await readBuyerCartAction();
    } catch {
      result = {
        ok: false,
        subject: scope.subject,
        code: "NOT_AVAILABLE",
      } as const;
    }
    if (
      !mounted.current ||
      lifetime.current.key !== scope.key ||
      ticket !== lifetime.current.generation ||
      !scope.isCurrent()
    )
      return;
    if (!acceptsPrivateResult(scope, result))
      setLoaded({
        key: scope.key,
        cart: null,
        status:
          !result.ok && result.code === "UNAUTHENTICATED" ? "guest" : "error",
      });
    else if (result.ok)
      setLoaded({ key: scope.key, cart: result.data, status: "ready" });
    else
      setLoaded({
        key: scope.key,
        cart: null,
        status: result.code === "UNAUTHENTICATED" ? "guest" : "error",
      });
  }, [scope]);
  useEffect(() => {
    mounted.current = true;
    const state = lifetime.current;
    const initialRead = window.setTimeout(() => void refresh(), 0);
    const update = () => void refresh();
    window.addEventListener("online", update);
    window.addEventListener(cartChangedEvent, update);
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(cartChangedEvent);
    if (channel) channel.onmessage = update;
    return () => {
      mounted.current = false;
      ++state.generation;
      clearTimeout(initialRead);
      window.removeEventListener("online", update);
      window.removeEventListener(cartChangedEvent, update);
      channel?.close();
    };
  }, [refresh]);
  const active = scope.isCurrent() && loaded?.key === scope.key ? loaded : null;
  const initialCart =
    scope.isCurrent() && seed?.key === scope.key ? seed.cart : null;
  return {
    scopeKey: scope.key,
    subject: scope.subject,
    cart: active?.cart ?? (active ? null : initialCart),
    status:
      active?.status ??
      (scope.key === "unconfigured"
        ? "error"
        : initialCart
          ? "ready"
          : scope.isCurrent() && !scope.subject
            ? "guest"
            : "loading"),
    refresh,
  };
}
