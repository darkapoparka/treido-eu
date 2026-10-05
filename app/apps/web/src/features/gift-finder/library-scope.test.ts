import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryQuery } from "../library/model";

const f = vi.hoisted(() => ({
  query: {} as Partial<LibraryQuery>,
  items: [] as { listingId: string; current: null }[],
  saved: new Set<string>(),
  change: vi.fn(),
  button: null as null | { pressed?: boolean; onClick: () => void },
}));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true, userId: "user_scope_test" }),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../assistant-tools/common-ui", () => ({
  useAssistantLocale: () => "en",
  AssistantSession: ({
    children,
  }: {
    children: (subject: string) => ReactNode;
  }) => children("user_scope_test"),
  AssistantFeedback: () => null,
  AssistantNavigation: () => null,
}));
vi.mock("../assistant-tools/use-assistant-command", () => ({
  useAssistantCommand: () => ({
    status: "ready",
    busy: false,
    pending: null,
    view: { revision: 1, items: f.items, brief: null, requirements: null },
  }),
}));
// Inspect the real screen's library scope without claiming browser/provider proof.
// Descendants do not render; controls below independently exercise their actual handler.
vi.mock("../library/provider", () => ({
  LibraryProvider: ({ query }: { query: Partial<LibraryQuery> }) => {
    f.query = query;
    return null;
  },
  useBuyerLibrary: () => ({
    status: "ready",
    busy: false,
    view: {
      savedIds: (f.query.listingIds ?? []).filter((id) => f.saved.has(id)),
    },
    execute: f.change,
  }),
}));
vi.mock("../discovery/icon-button", () => ({
  IconButton: (props: { pressed?: boolean; onClick: () => void }) => {
    f.button = props;
    return null;
  },
}));
import { GiftScreen } from "./screen";
import { CompatibilityScreen } from "../assistant-tools/compatibility-screen";
import { ListingSaveButton } from "../library/controls";

const first = "00000000-0000-4000-8000-000000000001";
const second = "00000000-0000-4000-8000-000000000002";
const surfaces = [
  [
    "Gift Finder",
    () =>
      renderToStaticMarkup(
        createElement(GiftScreen, { continuation: "/minis/gift-finder" }),
      ),
  ],
  [
    "Compatibility",
    () => renderToStaticMarkup(createElement(CompatibilityScreen)),
  ],
] as const;

beforeEach(() => {
  f.query = {};
  f.items = [{ listingId: first, current: null }];
  f.saved.clear();
  f.button = null;
  f.change.mockReset();
  f.change.mockImplementation(
    (op: { kind: "save"; listingId: string; saved: boolean }) => {
      if (op.saved) f.saved.add(op.listingId);
      else f.saved.delete(op.listingId);
    },
  );
});

function control() {
  renderToStaticMarkup(
    createElement(ListingSaveButton, { id: first, title: "Test listing" }),
  );
  expect(f.button).not.toBeNull();
  return f.button!;
}

describe.each(surfaces)("%s current library query", (_name, render) => {
  it("queries current results, updates when results change and clears removed results", () => {
    render();
    expect(f.query.listingIds).toEqual([first]);
    f.items = [{ listingId: second, current: null }];
    render();
    expect(f.query.listingIds).toEqual([second]);
    f.items = [];
    render();
    expect(f.query.listingIds).toEqual([]);
  });
  it("reflects a pre-saved result and lets its next click remove the bookmark", () => {
    f.saved.add(first);
    render();
    const saved = control();
    expect(saved.pressed).toBe(true);
    saved.onClick();
    expect(f.change).toHaveBeenLastCalledWith({
      kind: "save",
      listingId: first,
      saved: false,
    });
    expect(control().pressed).toBe(false);
  });
  it("saving updates the heart and a second click sends saved:false", () => {
    render();
    const unsaved = control();
    expect(unsaved.pressed).toBe(false);
    unsaved.onClick();
    expect(f.change).toHaveBeenLastCalledWith({
      kind: "save",
      listingId: first,
      saved: true,
    });
    const saved = control();
    expect(saved.pressed).toBe(true);
    saved.onClick();
    expect(f.change).toHaveBeenLastCalledWith({
      kind: "save",
      listingId: first,
      saved: false,
    });
    expect(control().pressed).toBe(false);
  });
});
