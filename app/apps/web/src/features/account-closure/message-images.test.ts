import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  messageImageTargets,
  type MessageImageReview,
} from "./message-images.server";
import { snapshotSection, buildSnapshot } from "../account-privacy/snapshot";
const review: MessageImageReview = {
  version: "message-image-lifecycle-v1",
  rule: {
    id: "synthetic",
    handling: "remove",
    delay_seconds: 17,
    description: { en: "Reviewed test only", bg: "Прегледан тест" },
  },
  resources: [
    null,
    "business",
    "case",
    "commerce",
    "legal-hold",
    "unknown-authority",
  ].map((retentionReason, index) => ({
    target: { ownerKind: "message-image", assetId: String(index) },
    retentionReason,
  })),
};
describe("explicit message-image review and private projection", () => {
  it("no extension or a retain rule produces no removal authority", () => {
    expect(messageImageTargets(null)).toEqual([]);
    expect(
      messageImageTargets({
        ...review,
        rule: { ...review.rule, handling: "retain", delay_seconds: null },
      }),
    ).toEqual([]);
  });
  it("only explicitly unheld personal resources receive the reviewed delay", () => {
    expect(messageImageTargets(review)).toEqual([
      {
        kind: "media.delete",
        target: review.resources[0].target,
        dueSeconds: 17,
      },
    ]);
  });
  it.each([null, -1, 1.2, Number.NaN])(
    "never invents a delay for %s",
    (delay_seconds) => {
      expect(() =>
        messageImageTargets({
          ...review,
          rule: { ...review.rule, delay_seconds },
        }),
      ).toThrow("POLICY_REQUIRED");
    },
  );
  it("metadata allowlist drops raw text, names, URLs, bytes and provider identity", () => {
    const section = snapshotSection("account", [
      {
        kind: "ownMessageImageMetadataV1",
        id: "own",
        threadId: "thread",
        state: "unavailable",
        width: 12,
        height: 8,
        body: "private text",
        filename: "raw.jpg",
        objectKey: "private/key",
        url: "https://private.invalid",
        providerId: "provider",
        bytes: Buffer.from("secret"),
      },
    ]);
    const text = JSON.stringify(section);
    for (const value of [
      "private text",
      "raw.jpg",
      "private/key",
      "https://",
      "provider",
      "secret",
    ])
      expect(text).not.toContain(value);
    expect(text).toContain("unavailable");
  });
  it("metadata shares existing limits and preserves v1 snapshot shape", () => {
    const section = snapshotSection(
      "account",
      Array.from({ length: 51 }, (_, i) => ({
        id: String(i),
        kind: "ownCommunicationMetadataV1",
      })),
    );
    expect(section.records).toHaveLength(50);
    expect(section.limited).toBe(true);
    expect(buildSnapshot("own", "2026-10-05T00:00:00Z", [section]).format).toBe(
      "treido-personal-data-v1",
    );
  });
});
