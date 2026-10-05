import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EffectRow, LifecycleBinding } from "./storage.server";
const transport = vi.hoisted(() => ({ fetch: vi.fn(), remove: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../server/config/backend-bindings.server", () => ({
  requireBackendBindings: () => ({
    environment: "test",
    identity: { applicationId: "app_isolated" },
  }),
}));
vi.mock("aws4fetch", () => ({
  AwsClient: class {
    async sign(url: string, init: RequestInit) {
      return new Request(url, init);
    }
  },
}));
vi.mock("../../server/media/storage.server", () => ({
  requireMediaStorage: () => ({
    scope: "a".repeat(64),
    prefix: "test/owned/",
    remove: transport.remove,
  }),
}));
vi.mock("../../server/media/bindings", () => ({
  validateMediaBindings: () => ({
    ok: true,
    bindings: {
      provider: "r2",
      endpoint: "https://isolated.invalid",
      bucket: "isolated",
      region: "auto",
    },
  }),
}));
import { mediaEffectAdapter } from "./media-adapter.server";
const versionHeaders: Record<string, string>[] = [
  { "x-amz-delete-marker": "true" },
  { "x-amz-version-id": "retained-version" },
];
const binding: LifecycleBinding = {
  id: "d0f8a12b-1875-4e5b-b6b2-df082f20df2b",
  environment: "test",
  applicationId: "app_isolated",
  clerkInstanceId: "ins_isolated",
  clerkMode: "test",
  mediaScope: "a".repeat(64),
  mediaUnversioned: true,
  stripeAccount: null,
  stripeMode: null,
  stripeApplicationId: null,
  assistantLifecycleVersion: "test",
  aftercareLifecycleVersion: "test",
  securityEnabled: true,
  closureEnabled: true,
};
const effect: EffectRow = {
  id: "d8fa5108-dc5f-420b-835b-29238b05a0c8",
  userId: "e9b2c621-6d32-49ad-92ed-e6333bd5bc90",
  planId: "9f1a9284-4b02-4db0-a94d-cdaf249699b5",
  bindingId: binding.id,
  subject: "user_own",
  kind: "media.delete",
  state: "unknown",
  target: {
    storageScope: "a".repeat(64),
    objectKey: "test/owned/exact-key.webp",
  },
  operationKey: "16684edb-cc7c-46de-8cfb-160dc803bdf3",
  firstAttemptAt: new Date(),
  leaseToken: null,
  leaseUntil: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", transport.fetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
});
describe("isolated registered-media observation; no real storage acceptance", () => {
  it("an authenticated absent unversioned key is confirmed by HEAD without DELETE", async () => {
    transport.fetch.mockResolvedValue(new Response(null, { status: 404 }));
    expect((await mediaEffectAdapter(binding, effect).observe()).state).toBe(
      "confirmed",
    );
    expect(transport.fetch.mock.calls[0][0].method).toBe("HEAD");
    expect(transport.remove).not.toHaveBeenCalled();
  });
  it.each(versionHeaders)(
    "a version/deletion marker never proves reviewed physical removal",
    async (headers) => {
      transport.fetch.mockResolvedValue(
        new Response(null, { status: 404, headers }),
      );
      await expect(
        mediaEffectAdapter(binding, effect).observe(),
      ).rejects.toMatchObject({ code: "BINDING_REQUIRED" });
      expect(transport.remove).not.toHaveBeenCalled();
    },
  );
  it("permission failure does not become absence", async () => {
    transport.fetch.mockResolvedValue(new Response(null, { status: 403 }));
    await expect(
      mediaEffectAdapter(binding, effect).observe(),
    ).rejects.toMatchObject({ code: "UNKNOWN_OUTCOME" });
    expect(transport.remove).not.toHaveBeenCalled();
  });
  it("a changed scope or an unregistered-prefix key cannot reach the transport", () => {
    expect(() =>
      mediaEffectAdapter({ ...binding, environment: "production" }, effect),
    ).toThrowError("BINDING_REQUIRED");
    expect(() =>
      mediaEffectAdapter({ ...binding, mediaScope: "b".repeat(64) }, effect),
    ).toThrowError("BINDING_REQUIRED");
    expect(() =>
      mediaEffectAdapter(binding, {
        ...effect,
        target: { ...effect.target, objectKey: "foreign/key.webp" },
      }),
    ).toThrowError("FORBIDDEN");
    expect(transport.fetch).not.toHaveBeenCalled();
    expect(transport.remove).not.toHaveBeenCalled();
  });
});
