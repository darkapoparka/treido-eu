import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { Children, isValidElement, type ReactNode } from "react";
import { parseAssistantContinuation } from "./continuation";
import { HelperDraftForm } from "./helper-draft-form";
import { editableDraft } from "./sell-helper-model";
import { emptyDraft, type DraftPayload } from "../selling/draft-model";
const id = "10000000-0000-4000-8000-000000000001";
describe("read-only assistant continuation", () => {
  it.each([
    "/minis/compatibility",
    "/minis/sell-helper",
    "/minis/compatibility?lang=bg",
    "/minis/sell-helper?lang=en",
    `/minis/compatibility?listing=${id}`,
    `/minis/sell-helper?sellerId=${id}&draftId=${id}`,
  ])("accepts %s", (path) => {
    expect(parseAssistantContinuation(path)).toBe(path);
  });
  it.each([
    "https://other.invalid/minis/compatibility",
    "//other.invalid/minis/compatibility",
    "/minis/compatibility/extra",
    "/minis/sell-helper#accept",
    "/minis/compatibility?lang=de",
    "/minis/compatibility?lang=bg&lang=en",
    "/minis/compatibility?publish=true",
    `/minis/sell-helper?draftId=${id}`,
    `/minis/sell-helper?sellerId=${id}&sellerId=${id}`,
    `/minis/compatibility?listing=${id}&listing=${id}`,
    "/minis/compatibility?listing=foreign",
    `/minis/compatibility?categoryId=cat:electronics`,
    "/minis/sell-helper?confirm=true",
    "/minis/compatibility\\other",
    "/minis/compatibility?" + "x".repeat(1100),
  ])("rejects unsafe/ambiguous %s", (path) => {
    expect(parseAssistantContinuation(path)).toBeNull();
  });
  it("canonicalises UUID casing", () => {
    const upper = "A0000000-0000-4000-8000-000000000001";
    expect(
      parseAssistantContinuation("/minis/compatibility?listing=" + upper),
    ).toBe("/minis/compatibility?listing=" + upper.toLowerCase());
  });
  it("accepts a real leaf without storing requirements or accepting a proposal", () => {
    expect(
      parseAssistantContinuation(
        "/minis/compatibility?categoryId=cat%3Aelectronics%2Fphones",
      ),
    ).toBe("/minis/compatibility?categoryId=cat%3Aelectronics%2Fphones");
  });
});

describe("Sell Helper draft navigation", () => {
  it.each(["bg", "en"] as const)(
    "links the selected draft to existing editor and review routes in %s",
    (locale) => {
      const draftId = "10000000-0000-4000-8000-000000000002";
      const payload: DraftPayload = {
        ...emptyDraft,
        title: "Seller-entered phone",
        categoryId: "cat:electronics/phones",
      };
      const edit = editableDraft(payload);
      const screen = HelperDraftForm({
        selection: {
          draft: {
            id: draftId,
            sellerId: id,
            revision: 1,
            updatedAt: "2026-10-05T00:00:00.000Z",
            publication: "draft",
            payload,
          },
          sellerKind: "personal",
          baseHash: "a".repeat(64),
          edit,
          issues: [],
          asking: [],
          askingStatus: "insufficient",
        },
        edit,
        locale,
        disabled: false,
        confirmed: false,
        onConfirm: () => {},
        onEdit: () => {},
        onPrepare: () => {},
      });
      const navigation = Children.toArray(screen.props.children).find(
        (node) => isValidElement(node) && node.type === "nav",
      );
      if (!isValidElement<{ children: ReactNode }>(navigation))
        throw new Error("Draft navigation missing");
      const hrefs = Children.toArray(navigation.props.children).flatMap(
        (node) =>
          isValidElement<{ href: string }>(node) ? [node.props.href] : [],
      );
      const base = `/app/sellers/${id}/listings/${draftId}`;
      expect(hrefs).toEqual([
        `${base}/edit?lang=${locale}`,
        `${base}/review?lang=${locale}`,
      ]);
      for (const href of hrefs) {
        const route = new URL(href, "https://treido.invalid").pathname
          .replace(id, "[sellerId]")
          .replace(draftId, "[draftId]");
        expect(
          existsSync(new URL(`../../app${route}/page.tsx`, import.meta.url)),
        ).toBe(true);
      }
    },
  );
});
