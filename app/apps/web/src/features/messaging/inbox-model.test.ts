import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createTranslator } from "next-intl";
import {
  parseInboxQuery,
  parseInboxScope,
  parseContactCommand,
  parseConversationQuery,
  inboxHref,
} from "./inbox-model";
import { parseMessagingContinuation } from "./navigation-model";
import messages from "./messages.json";
import trust from "../trust/messages.json";
describe("inbox scope and bounded commands", () => {
  const sellerId = randomUUID(),
    threadId = randomUUID();
  it("keeps the buying inbox separate from an operating seller", () => {
    expect(parseInboxScope({ sellerId: null })).toEqual({ sellerId: null });
    expect(parseInboxScope({ sellerId: sellerId.toUpperCase() })).toEqual({
      sellerId,
    });
    expect(parseInboxScope({ seller: "business" })).toBeNull();
    expect(inboxHref({ sellerId: null }, "bg", threadId)).toBe(
      "/messages/" + threadId + "?lang=bg",
    );
    expect(inboxHref({ sellerId }, "en")).toBe(
      "/app/sellers/" + sellerId + "/inbox?lang=en",
    );
  });
  it.each([
    { sellerId: null, q: "x".repeat(121) },
    { sellerId: null, q: "bad\ninput" },
    { sellerId: null, filter: "foreign" },
    { sellerId: null, cursor: "=" },
    { sellerId: null, cursor: "a".repeat(1025) },
    { sellerId: null, role: "owner" },
  ])("rejects malformed filters %#", (input) =>
    expect(parseInboxQuery(input)).toBeNull(),
  );
  it("bounds message history and contact revisions", () => {
    expect(
      parseConversationQuery({ sellerId: null, threadId, before: 0 }),
    ).toBeNull();
    expect(
      parseConversationQuery({ sellerId: null, threadId, before: 51 })?.before,
    ).toBe(51);
    const command = {
      sellerId,
      threadId,
      blocked: true,
      requestId: randomUUID(),
      expectedRevision: 1,
    };
    expect(parseContactCommand(command)).toEqual(command);
    for (const change of [
      { blocked: "true" },
      { expectedRevision: 0 },
      { expectedRevision: 2147483647 },
      { requestId: "" },
      { actorId: randomUUID() },
    ])
      expect(parseContactCommand({ ...command, ...change })).toBeNull();
  });
  it("allows only the exact local conversation/report continuation", () => {
    for (const route of [
      "/messages",
      "/messages/" + threadId,
      "/messages/reports/" + threadId,
      "/messages/new?listing=" + threadId,
      "/messages/report?kind=message&id=" + threadId,
      "/app/sellers/" + sellerId + "/inbox/" + threadId,
    ])
      expect(parseMessagingContinuation(route)).toBe(route);
    for (const route of [
      "//example.invalid",
      "https://example.invalid/messages",
      "/messages/unknown",
      "/messages?role=owner",
      "/messages?lang=bg&lang=en",
      "/messages/new",
      "/messages/report?kind=message",
      "/messages/%2e%2e/app",
      "/messages\n",
    ])
      expect(parseMessagingContinuation(route)).toBeNull();
  });
});
describe("new inbox and trust copy", () => {
  for (const [name, catalogue] of Object.entries({ messages, trust }))
    it(name + " has paired BG/EN valid messages", () => {
      expect(Object.keys(catalogue.bg).sort()).toEqual(
        Object.keys(catalogue.en).sort(),
      );
      for (const locale of ["en", "bg"] as const) {
        const errors: unknown[] = [];
        const t = createTranslator({
          locale,
          messages: catalogue[locale] as Record<string, string>,
          onError: (error) => errors.push(error),
        });
        for (const key of Object.keys(catalogue[locale]))
          expect(t(key, { count: 2 }).length).toBeGreaterThan(0);
        expect(errors).toEqual([]);
      }
    });
});
