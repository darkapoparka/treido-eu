import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
import { validateJobIntent, parseJobEvent } from "./model";
import { validateJobBindings } from "./bindings";
import { authorizedService, boundedJson } from "./http.server";
import { createJobExecutor } from "./inngest.server";
import type { NextRequest } from "next/server";

const configuration = {
  TREIDO_ENV: "test",
  TREIDO_INNGEST_APP_ID: "treido-test",
  INNGEST_ENV: "treido-isolated",
  TREIDO_INNGEST_PURPOSE: "test",
  TREIDO_APP_ORIGIN: "http://127.0.0.1:6419",
  INNGEST_EVENT_KEY: "testeventkey0000000000000000000000",
  INNGEST_SIGNING_KEY: `signkey-test-${"a".repeat(64)}`,
  INNGEST_DEV: "false",
  INNGEST_SERVE_ORIGIN: "https://treido-development.example.com",
  TREIDO_OUTBOX_SERVICE_ID: "test-repair",
  CRON_SECRET: "repairsecret0000000000000000000000",
};
afterEach(() => vi.unstubAllEnvs());
describe("job authority and provider boundary", () => {
  it("rejects media service authority and unbounded/private event additions", () => {
    const intent = {
      kind: "media.process" as const,
      sellerId: randomUUID(),
      resourceId: randomUUID(),
      operationKey: randomUUID(),
      authority: "service" as const,
      actorId: null,
    };
    expect(() => validateJobIntent(intent)).toThrow("INVALID_INPUT");
    expect(() =>
      validateJobIntent({
        ...intent,
        authority: "member",
        actorId: randomUUID(),
      }),
    ).not.toThrow();
    const event = {
      jobId: randomUUID(),
      sellerId: randomUUID(),
      generation: 1,
      schemaVersion: 1,
      environment: "test",
      applicationId: "treido-test",
    };
    expect(parseJobEvent(event)).toEqual(event);
    expect(parseJobEvent({ ...event, signedUrl: "secret" })).toBeNull();
    expect(parseJobEvent({ ...event, generation: -1 })).toBeNull();
  });
  it("requires explicit isolated bindings and keeps signature verification on", () => {
    expect(validateJobBindings(configuration).ok).toBe(true);
    for (const override of [
      { INNGEST_DEV: "true" },
      { TREIDO_INNGEST_PURPOSE: "production" },
      { INNGEST_BASE_URL: "http://attacker" },
      { INNGEST_SIGNING_KEY: "" },
      { NEXT_PUBLIC_INNGEST_SIGNING_KEY: "private" },
      { TREIDO_OUTBOX_REDRIVE_SECRET: configuration.CRON_SECRET },
    ])
      expect(validateJobBindings({ ...configuration, ...override }).ok).toBe(
        false,
      );
    const unbound = validateJobBindings({});
    expect(unbound.ok).toBe(false);
    expect(JSON.stringify(unbound)).not.toContain(
      configuration.INNGEST_SIGNING_KEY,
    );
  });
  it("advertises the explicit HTTPS callback while retaining the local browser origin", () => {
    const result = validateJobBindings(configuration);
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.bindings.origin).toBe(configuration.INNGEST_SERVE_ORIGIN);
    expect(configuration.TREIDO_APP_ORIGIN).toBe("http://127.0.0.1:6419");
  });
  it.each([
    "",
    "http://callback.example.com",
    "https://localhost",
    "https://127.0.0.1",
    "https://10.0.0.1",
    "https://[::1]",
    "https://callback.local",
    "https://callback.internal",
    "https://callback.invalid",
    "https://callback.test",
    "https://user:password@callback.example.com",
    "https://callback.example.com/",
    "https://callback.example.com/api/inngest",
    "https://callback.example.com?token=secret",
    "https://callback.example.com#fragment",
  ])("rejects a missing, local or non-origin cloud callback: %s", (origin) => {
    const result = validateJobBindings({
      ...configuration,
      INNGEST_SERVE_ORIGIN: origin,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing).toContain("INNGEST_SERVE_ORIGIN");
  });
  it("keeps hosted callbacks on their configured application origin", () => {
    const hosted = {
      ...configuration,
      TREIDO_ENV: "preview",
      TREIDO_INNGEST_PURPOSE: "preview",
      TREIDO_APP_ORIGIN: "https://preview.example.com",
      INNGEST_SERVE_ORIGIN: "",
    };
    const result = validateJobBindings(hosted);
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.bindings.origin).toBe(hosted.TREIDO_APP_ORIGIN);
    expect(
      validateJobBindings({
        ...hosted,
        INNGEST_SERVE_ORIGIN: configuration.INNGEST_SERVE_ORIGIN,
      }).ok,
    ).toBe(false);
  });
  it("authenticates service bearer credentials and rejects query-string or browser authority", () => {
    const secret = configuration.CRON_SECRET;
    expect(
      authorizedService(
        new Request("http://localhost/api/internal/outbox", {
          headers: { authorization: `Bearer ${secret}` },
        }),
        secret,
      ),
    ).toBe(true);
    expect(
      authorizedService(
        new Request(`http://localhost/api/internal/outbox?secret=${secret}`),
        secret,
      ),
    ).toBe(false);
    expect(
      authorizedService(
        new Request("http://localhost/api/internal/outbox", {
          headers: { authorization: "Bearer bad", cookie: "owner=true" },
        }),
        secret,
      ),
    ).toBe(false);
    expect(
      authorizedService(
        new Request("http://localhost/api/internal/outbox"),
        undefined,
      ),
    ).toBe(false);
  });
  it("bounds the actual streamed body independently from a claimed Content-Length", async () => {
    const input = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "1" },
      body: JSON.stringify({ value: "a".repeat(3000) }),
    });
    await expect(boundedJson(input)).rejects.toThrow("too large");
    await expect(
      boundedJson(
        new Request("http://localhost", { method: "POST", body: "{}" }),
      ),
    ).rejects.toThrow("content type");
  });
  it("the actual Inngest SDK rejects an unsigned invocation before database access", async () => {
    vi.stubEnv("INNGEST_SIGNING_KEY", configuration.INNGEST_SIGNING_KEY);
    vi.stubEnv("INNGEST_EVENT_KEY", configuration.INNGEST_EVENT_KEY);
    const database = vi.fn(() => {
      throw new Error("Database must not be reached");
    });
    const executor = createJobExecutor(
      {
        applicationId: "treido-test",
        environment: "test",
        origin: "http://localhost",
        repairServiceId: "test-repair",
      },
      {},
      database,
    );
    const request = new Request(
      "http://localhost/api/inngest?fnId=treido-test-durable-job-v1",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
    ) as NextRequest;
    const response = await executor.http.POST(request, {});
    expect(response.status).toBe(401);
    expect(database).not.toHaveBeenCalled();
  });
});
