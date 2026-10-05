import { describe, expect, it } from "vitest";
import { parseToolIntent, toolParams } from "./intent";
import {
  beginFindNavigation,
  reviewedFindIntent,
  type FindNavigation,
} from "./find-navigation";

const intent = (raw: string) =>
  parseToolIntent(raw + "&currency=EUR", "find-for-me");
const initial: FindNavigation = { generation: 0, submitted: null };

describe("reviewed Find handoff during strict filter navigation", () => {
  it("does not replace a submitted €50 maximum with an older accepted €100 intent", () => {
    const displayed = intent("lang=en&seller=business&maxPrice=100"),
      requested = intent("lang=en&seller=business&maxPrice=50");
    let navigation = initial;
    const capturedGeneration = navigation.generation;
    const oldApply = () =>
      reviewedFindIntent(
        displayed,
        navigation,
        capturedGeneration,
        false,
        toolParams(displayed).toString(),
      );
    navigation = beginFindNavigation(navigation, requested);
    // Exercise the pre-render interval as well as an explicitly pending transition.
    expect(oldApply()).toBeNull();
    expect(
      reviewedFindIntent(
        displayed,
        navigation,
        navigation.generation,
        true,
        toolParams(displayed).toString(),
      ),
    ).toBeNull();
    expect(
      reviewedFindIntent(
        displayed,
        navigation,
        navigation.generation,
        false,
        toolParams(displayed).toString(),
      ),
    ).toBeNull();
    expect(toolParams(navigation.submitted!).get("maxPrice")).toBe("50.00");
  });
  it("allows the settled scope while preserving seller, price, handover, stock and locale", () => {
    const current = intent(
        "lang=bg&seller=business&maxPrice=50&handover=shipping&availability=known",
      ),
      proposed = { ...current, discovery: { ...current.discovery, q: "case" } },
      navigation = beginFindNavigation(initial, current),
      accepted = reviewedFindIntent(
        current,
        navigation,
        navigation.generation,
        false,
        toolParams(proposed).toString(),
      );
    expect(accepted).not.toBeNull();
    const params = toolParams(accepted!);
    expect(params.get("q")).toBe("case");
    expect(params.get("seller")).toBe("business");
    expect(params.get("maxPrice")).toBe("50.00");
    expect(params.get("handover")).toBe("shipping");
    expect(params.get("availability")).toBe("known");
    expect(params.get("lang")).toBe("bg");
  });
  it("rejects an earlier generation even when the submitted canonical filters are identical", () => {
    const current = intent("lang=en&maxPrice=50"),
      first = beginFindNavigation(initial, current),
      second = beginFindNavigation(first, current);
    expect(
      reviewedFindIntent(
        current,
        second,
        first.generation,
        false,
        toolParams(current).toString(),
      ),
    ).toBeNull();
    expect(
      reviewedFindIntent(
        current,
        second,
        second.generation,
        false,
        toolParams(current).toString(),
      ),
    ).not.toBeNull();
  });
  it("does not accept weakened reviewed filters after a settled navigation", () => {
    const current = intent("lang=en&seller=business&maxPrice=50"),
      changed = intent("lang=en&seller=business&maxPrice=100"),
      navigation = beginFindNavigation(initial, current);
    expect(() =>
      reviewedFindIntent(
        current,
        navigation,
        navigation.generation,
        false,
        toolParams(changed).toString(),
      ),
    ).toThrow();
  });
});
