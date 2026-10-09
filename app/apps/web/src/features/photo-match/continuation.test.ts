import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { parseAssistantInputContinuation } from "./continuation";
import { parseToolIntent, toolHref } from "../shopping-tools/intent";
import { InputScreen } from "./screen";

const auth = vi.hoisted(() => ({ isLoaded: true, userId: "synthetic-human" }));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => auth }));
// Render the actual screen; its shell and child boundaries expose the exact
// continuation/intent passed onward without mounting unrelated private flows.
vi.mock("../discovery/mini-frame", () => ({
  MiniShell: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../discovery/return-navigation", () => ({
  SourceLink: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));
vi.mock("../assistant-tools/common-ui", () => ({
  AssistantNavigation: () => null,
}));
vi.mock("../shopping-tools/comparison-provider", () => ({
  ComparisonProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../assistant-runs/interpreted-intent", () => ({
  AssistantInterpretInput: ({ initial }: { initial: unknown }) =>
    createElement("pre", null, JSON.stringify(initial)),
}));
it("allows only read-only photo/voice destinations and a unique BG/EN locale", () => {
  expect(parseAssistantInputContinuation("/minis/photo-match")).toBe(
    "/minis/photo-match?lang=bg",
  );
  expect(
    parseAssistantInputContinuation("/minis/find-for-me/voice?lang=en"),
  ).toBe("/minis/find-for-me/voice?lang=en");
  for (const value of [
    "https://evil.test/minis/photo-match",
    "//evil.test/minis/photo-match",
    "/minis/photo-match?runId=owned",
    "/minis/photo-match?lang=en&lang=bg",
    "/minis/photo-match?lang=de",
    "/minis/photo-match#execute",
    "/minis/find-for-me/voice/..",
    "/minis\\photo-match",
    "/minis/photo-match?confirmed=true",
  ])
    expect(parseAssistantInputContinuation(value)).toBeNull();
});

it.each(["bg", "en"] as const)(
  "retains the full %s Find scope through Voice, sign-in and keyword return",
  (locale) => {
    const params = new URLSearchParams({
      q: locale === "bg" ? "телефон с калъф" : "phone with case",
      category: "cat:electronics/phones",
      seller: "personal",
      condition: "new",
      location: "Varna",
      minPrice: "0012.5",
      maxPrice: "300.00",
      currency: "EUR",
      sort: "price_desc",
      lang: locale,
      "attr.storageGB": "0256",
      handover: "pickup",
      availability: "known",
    });
    const continuation = parseAssistantInputContinuation(
      "/minis/find-for-me/voice?" + params,
    );
    expect(continuation).not.toBeNull();
    const returned = new URL(continuation!, "https://treido.invalid"),
      intent = parseToolIntent(returned.search.slice(1), "find-for-me");
    expect(intent).toMatchObject({
      discovery: {
        q: params.get("q"),
        category: "cat:electronics/phones",
        seller: "personal",
        condition: "new",
        location: "Varna",
        minPriceMinor: 1250,
        maxPriceMinor: 30000,
        currency: "EUR",
        sort: "price_desc",
        locale,
        attributes: { storageGB: 256 },
      },
      handover: "pickup",
      availability: "known",
      cursor: null,
    });
    expect(returned.searchParams.get("minPrice")).toBe("12.50");
    expect(returned.searchParams.get("attr.storageGB")).toBe("256");
    expect(parseAssistantInputContinuation(continuation)).toBe(continuation);
    const signIn = new URL(
      "/sign-in?lang=" + locale + "&next=" + encodeURIComponent(continuation!),
      "https://treido.invalid",
    );
    expect(signIn.searchParams.get("next")).toBe(continuation);
    expect(
      toolHref("find-for-me", intent).slice("/minis/find-for-me".length),
    ).toBe(returned.search);
  },
);

it.each(["bg", "en"] as const)(
  "binds the validated %s Voice scope to the actual screen input, sign-in and keyword link",
  (locale) => {
    const continuation = parseAssistantInputContinuation(
        "/minis/find-for-me/voice?q=phone&category=cat%3Aelectronics&seller=personal&condition=new&maxPrice=300.00&currency=EUR&lang=" +
          locale +
          "&handover=pickup",
      )!,
      query = continuation.slice(continuation.indexOf("?") + 1),
      intent = parseToolIntent(query, "find-for-me"),
      props = { inputMode: "voice" as const, locale, continuation };
    auth.userId = "synthetic-human";
    const signedIn = renderToStaticMarkup(createElement(InputScreen, props));
    expect(signedIn).toContain("&quot;availability&quot;:&quot;any&quot;");
    expect(signedIn).toContain("&quot;q&quot;:&quot;phone&quot;");
    expect(signedIn).toContain("&quot;maxPriceMinor&quot;:30000");
    const hrefs = (html: string) =>
      [...html.matchAll(/href="([^"]+)"/g)].map((match) =>
        match[1].replaceAll("&amp;", "&"),
      );
    expect(hrefs(signedIn)).toContain(toolHref("find-for-me", intent));
    auth.userId = "";
    try {
      const guest = renderToStaticMarkup(createElement(InputScreen, props)),
        signIn = new URL(
          hrefs(guest).find((href) => href.startsWith("/sign-in?"))!,
          "https://treido.invalid",
        );
      expect(signIn.searchParams.get("next")).toBe(continuation);
      expect(hrefs(guest)).toContain(toolHref("find-for-me", intent));
    } finally {
      auth.userId = "synthetic-human";
    }
  },
);

it("keeps Photo's actual input default known and adds no Voice fallback link", () => {
  auth.userId = "synthetic-human";
  const html = renderToStaticMarkup(
    createElement(InputScreen, {
      inputMode: "photo",
      locale: "en",
      continuation: "/minis/photo-match?lang=en",
    }),
  );
  expect(html).toContain("&quot;availability&quot;:&quot;known&quot;");
  expect(html).not.toContain("href=");
});

it.each(["bg", "en"] as const)(
  "keeps default any availability for the actual %s Find-to-Voice URL",
  (locale) => {
    const continuation = parseAssistantInputContinuation(
      "/minis/find-for-me/voice?q=phone&category=cat%3Aelectronics&seller=personal&condition=new&maxPrice=300.00&currency=EUR&lang=" +
        locale +
        "&handover=pickup",
    );
    expect(continuation).not.toBeNull();
    const returned = new URL(continuation!, "https://treido.invalid"),
      intent = parseToolIntent(returned.search.slice(1), "find-for-me");
    expect(intent).toMatchObject({
      discovery: {
        q: "phone",
        category: "cat:electronics",
        seller: "personal",
        condition: "new",
        maxPriceMinor: 30000,
        locale,
      },
      availability: "any",
      handover: "pickup",
      cursor: null,
    });
    expect(returned.searchParams.has("availability")).toBe(false);
  },
);

it("retains explicit shipping and canonicalizes explicit any availability", () => {
  expect(
    parseAssistantInputContinuation(
      "/minis/find-for-me/voice?lang=en&handover=shipping&availability=any",
    ),
  ).toBe("/minis/find-for-me/voice?lang=en&handover=shipping");
  expect(parseAssistantInputContinuation("/minis/find-for-me/voice")).toBe(
    "/minis/find-for-me/voice?lang=bg",
  );
});

it.each([
  "sellerId=10000000-0000-4000-8000-000000000001",
  "actorKey=" + "a".repeat(64),
  "requestId=10000000-0000-4000-8000-000000000001",
  "expectedRevision=1",
  "runId=10000000-0000-4000-8000-000000000001",
  "assetId=10000000-0000-4000-8000-000000000001",
  "draftId=10000000-0000-4000-8000-000000000001",
  "confirmed=true",
  "operation=execute",
  "cursor=opaque_valid-shape",
  "cursor=",
  "%63ursor=opaque",
  "next=%2Fapp",
  "q=phone&q=case",
  "lang=en&lang=bg",
  "handover=pickup&handover=shipping",
  "availability=known&availability=any",
  "category=cat%3Aelectronics&category=cat%3Afashion",
  "seller=personal&seller=business",
  "maxPrice=300.00&maxPrice=",
  "minPrice=300&maxPrice=100",
  "maxPrice=12.345",
  "maxPrice=-1",
  "maxPrice=10000001",
  "maxPrice=300&currency=USD",
  "handover=delivery",
  "availability=available",
  "lang=de",
  "category=missing",
  "category=cat%3Aelectronics%2Fphones&attr.storageGB=unknown",
  "category=cat%3Aelectronics%2Fphones&attr.storageGB=128&attr.storageGB=256",
])("rejects private, duplicate or invalid Voice constraints: %s", (query) => {
  expect(
    parseAssistantInputContinuation("/minis/find-for-me/voice?" + query),
  ).toBeNull();
});

it.each([
  "https://evil.test/minis/find-for-me/voice?lang=en",
  "//evil.test/minis/find-for-me/voice?lang=en",
  "/minis/find-for-me/voice#execute",
  "/minis/find-for-me/voice?lang=en#",
  "/minis/find-for-me/voice/../voice?lang=en",
  "/minis/find-for-me/voice/",
  "/minis\\find-for-me\\voice?lang=en",
  "/minis/find-for-me/voice?lang=en\n",
  "/minis/find-for-me/voice?q=" + "a".repeat(6100),
  "/minis/photo-match?q=phone&lang=en",
  "/minis/photo-match?lang=en&availability=known",
  "/minis/photo-match?lang=en&handover=pickup",
  "/minis/photo-match?lang=en&cursor=opaque",
])(
  "rejects unsafe destinations and preserves the strict Photo scope: %s",
  (raw) => {
    expect(parseAssistantInputContinuation(raw)).toBeNull();
  },
);
