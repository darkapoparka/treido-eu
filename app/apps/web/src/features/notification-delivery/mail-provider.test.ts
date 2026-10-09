import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  notificationMailPayload,
  notificationMailKey,
  serializeNotificationMailPayload,
  canReplayMail,
  MAIL_REPLAY_MS,
} from "./mail-model";
import { createNotificationMailProvider } from "./mail-provider.server";
import {
  notificationMailBinding,
  type NotificationMailConfig,
} from "./config.server";
const id = "401250b0-c622-43fd-aed7-ccf4fb4924d7";
const config: NotificationMailConfig = {
  purpose: "buyer.notification-email",
  environment: "test",
  applicationId: "synthetic-notification",
  jobEnvironment: "test",
  origin: "http://127.0.0.1",
  sender: "notice@example.test",
  domain: "example.test",
  domainId: "92d784b0-a3c8-4f85-85d9-5e66bb3b6465",
  accountBinding: "synthetic-mail-account",
  recipients: ["buyer@example.test"],
  apiKey: "SYNTHETIC-NO-PROVIDER-CALL",
};
const binding = notificationMailBinding(config),
  payload = notificationMailPayload(
    binding,
    "buyer@example.test",
    "/messages/" + id + "?lang=en",
    id,
    "en",
  );
describe("notification mail protocol on an injected local transport", () => {
  it("keeps retry bytes and key stable across JSONB object-key order", async () => {
    const request = vi.fn<typeof fetch>(async () => Response.json({ id }));
    const provider = createNotificationMailProvider(config, request),
      key = notificationMailKey(binding, id);
    await provider.send(payload, key);
    await provider.send(
      {
        tags: payload.tags.map((tag) => ({ value: tag.value, name: tag.name })),
        text: payload.text,
        subject: payload.subject,
        to: payload.to,
        from: payload.from,
      },
      key,
    );
    expect(request.mock.calls[0][1]?.body).toBe(
      serializeNotificationMailPayload(payload),
    );
    expect(request.mock.calls[1][1]?.body).toBe(request.mock.calls[0][1]?.body);
    expect(request.mock.calls[1][1]?.headers).toMatchObject({
      "Idempotency-Key": key,
    });
    expect(payload.text).not.toContain("private listing");
    expect(payload.text).toContain("/account/notifications?lang=en");
  });
  it("denies a development recipient outside the explicit allowlist before transport", async () => {
    const request = vi.fn<typeof fetch>();
    await expect(
      createNotificationMailProvider(config, request).send(
        { ...payload, to: ["foreign@example.test"] },
        notificationMailKey(binding, id),
      ),
    ).rejects.toMatchObject({ outcome: "unavailable" });
    expect(request).not.toHaveBeenCalled();
  });
  it("holds unknown POST acknowledgement as uncertain", async () => {
    const request = vi.fn<typeof fetch>(async () => {
      throw Error("Synthetic lost ack");
    });
    await expect(
      createNotificationMailProvider(config, request).send(
        payload,
        notificationMailKey(binding, id),
      ),
    ).rejects.toMatchObject({ outcome: "uncertain" });
  });
  it("rejects a provider observation for another recipient/payload", async () => {
    const request = vi.fn<typeof fetch>(async () =>
      Response.json({
        id,
        ...payload,
        to: ["foreign@example.test"],
        last_event: "delivered",
      }),
    );
    await expect(
      createNotificationMailProvider(config, request).retrieve(id, payload),
    ).rejects.toMatchObject({ outcome: "unavailable" });
  });
  it("requires the exact verified sending domain", async () => {
    const request = vi.fn<typeof fetch>(async () =>
      Response.json({
        id: config.domainId,
        name: config.domain,
        status: "verified",
        capabilities: { sending: "disabled" },
      }),
    );
    await expect(
      createNotificationMailProvider(config, request).verifySender(),
    ).rejects.toMatchObject({ outcome: "unavailable" });
  });
  it("stops unknown-ack POST retries strictly before the provider key expiry", () => {
    const first = new Date("2026-10-01T00:00:00Z");
    expect(
      canReplayMail(first, new Date(first.getTime() + MAIL_REPLAY_MS - 1)),
    ).toBe(true);
    expect(
      canReplayMail(first, new Date(first.getTime() + MAIL_REPLAY_MS)),
    ).toBe(false);
    expect(canReplayMail(first, new Date(first.getTime() - 1))).toBe(false);
  });
});
