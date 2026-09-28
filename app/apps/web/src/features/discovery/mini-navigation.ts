"use client";
import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { consumeSheetHistory } from "./components";
import { sourceReturnState } from "./return-navigation";

export function useMiniRoute(path: string) {
  const params = useSearchParams();
  const query = params.toString();
  const change = useCallback(
    (
      next: Record<string, string | null>,
      replace = false,
      data: Record<string, unknown> = {},
    ) => {
      const search = new URLSearchParams(query);
      for (const [key, value] of Object.entries(next)) {
        if (value === null) search.delete(key);
        else search.set(key, value);
      }
      const url = `${path}${search.size ? `?${search}` : ""}`;
      const consume = consumeSheetHistory();
      const historyState = sourceReturnState(data, consume || !replace);
      if (replace || consume)
        window.history.replaceState(historyState, "", url);
      else window.history.pushState(historyState, "", url);
    },
    [path, query],
  );
  return { params, change };
}
