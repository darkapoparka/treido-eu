import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Workspace } from "./workspace";

function backHref(props: { language?: "bg" | "en"; back?: string }) {
  const markup = renderToStaticMarkup(
    <Workspace title="Test workspace" {...props}>
      {null}
    </Workspace>,
  );
  const label = props.language === "bg" ? "Назад" : "Back";
  const links = [
    ...markup.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g),
  ];
  return links.find(([, , text]) => text === label)?.[1].replace(/&amp;/g, "&");
}

describe("workspace Back navigation", () => {
  it.each(["en", "bg"] as const)(
    "carries %s to the default workspace return without relying on cookies",
    (language) => {
      expect(backHref({ language })).toBe(`/app?lang=${language}`);
    },
  );

  it("uses English for the default language and return", () => {
    expect(backHref({})).toBe("/app?lang=en");
  });

  it.each([
    "/sell",
    "/app?lang=bg",
    "/app/sellers/10000000-0000-4000-8000-000000000001/listings?lang=bg&page=2#saved",
  ])("preserves the caller's exact Back target %s", (back) => {
    expect(backHref({ language: "en", back })).toBe(back);
  });
});
