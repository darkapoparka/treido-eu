import { describe, it, expect, vi } from "vitest";
vi.mock("../../apps/web/node_modules/server-only/index.js", () => ({}));
import {
  invitationMailConfig,
  publicMailBinding,
  canReplayMail,
  MAIL_REPLAY_MS,
  providerMailState,
  invitationMailPayload,
  invitationMailKey,
} from "../../apps/web/src/features/team/mail-model";
import { createResendInvitationProvider } from "../../apps/web/src/features/team/mail-provider.server";
import messages from "../../apps/web/src/features/team/messages.json";

const domainId = "59ba606b-59e5-4916-a5df-d039d3c64439";
const deliveryId = "731b57d2-29cc-4a10-bbc6-0f25d3904e07";
const emailId = "46e1d3c7-acbc-4e67-aa8b-76d4b9d6a41f";
const jobs = {
  applicationId: "treido-mail-tests",
  environment: "test-mail",
  origin: "https://treido.example.test",
};
const env = {
  TREIDO_ENV: "test",
  TREIDO_APP_ORIGIN: jobs.origin,
  TREIDO_INVITATION_MAIL_ENV: "test",
  TREIDO_INVITATION_MAIL_APPLICATION_ID: jobs.applicationId,
  TREIDO_INVITATION_MAIL_JOB_ENV: jobs.environment,
  TREIDO_INVITATION_MAIL_ORIGIN: jobs.origin,
  TREIDO_INVITATION_MAIL_PURPOSE: "team.invitation",
  TREIDO_INVITATION_MAIL_SENDER: "team@mail.example.test",
  TREIDO_INVITATION_MAIL_DOMAIN: "mail.example.test",
  TREIDO_INVITATION_MAIL_DOMAIN_ID: domainId,
  TREIDO_INVITATION_MAIL_ACCOUNT_BINDING: "owned-mock-account",
  TREIDO_INVITATION_MAIL_TEST_RECIPIENTS: "recipient@example.test",
  RESEND_API_KEY: "re_isolated_mock_key_only",
};
const config = invitationMailConfig(env, jobs)!;
const payload = invitationMailPayload(
  config,
  {
    id: deliveryId,
    recipient: "recipient@example.test",
    language: "en",
    sellerName: "Mock business",
    expiresAt: new Date("2026-10-12T00:00:00Z"),
  },
  deliveryId,
);
describe("Resend invitation adapter (all HTTP mocked)", () => {
  it("binds exact application/environment/purpose/origin/sender/domain and rejects public credentials", () => {
    expect(config).not.toBeNull();
    for (const key of [
      "TREIDO_INVITATION_MAIL_ENV",
      "TREIDO_INVITATION_MAIL_APPLICATION_ID",
      "TREIDO_INVITATION_MAIL_JOB_ENV",
      "TREIDO_INVITATION_MAIL_ORIGIN",
      "TREIDO_INVITATION_MAIL_PURPOSE",
      "TREIDO_INVITATION_MAIL_DOMAIN",
    ])
      expect(
        invitationMailConfig({ ...env, [key]: "foreign" }, jobs),
      ).toBeNull();
    expect(
      invitationMailConfig(
        { ...env, TREIDO_INVITATION_MAIL_TEST_RECIPIENTS: "" },
        jobs,
      ),
    ).toBeNull();
    expect(
      invitationMailConfig(
        { ...env, NEXT_PUBLIC_RESEND_API_KEY: "forbidden" },
        jobs,
      ),
    ).toBeNull();
    expect(publicMailBinding(config)).not.toHaveProperty("apiKey");
  });
  it("uses recipient-bound authenticated expiring routes and plain text in both languages", () => {
    for (const language of ["bg", "en"] as const) {
      const content = invitationMailPayload(
        config,
        {
          id: deliveryId,
          recipient: payload.to[0],
          language,
          sellerName: "<unsafe html>",
          expiresAt: new Date("2026-10-12Z"),
        },
        deliveryId,
      );
      expect(content.text).toContain(
        `/app/invitations/${deliveryId}?lang=${language}`,
      );
      expect(content).not.toHaveProperty("html");
      expect(content.text).not.toContain("token=");
    }
    expect(Object.keys(messages.en).sort()).toEqual(
      Object.keys(messages.bg).sort(),
    );
  });
  it("keeps invitation links on the browser app when the signed job callback is tunneled", () => {
    const browserOrigin = "http://127.0.0.1:6419";
    const callbackJobs = {
      ...jobs,
      origin: "https://restricted-callback.example.test",
    };
    const developmentEnv = {
      ...env,
      TREIDO_ENV: "development",
      TREIDO_INVITATION_MAIL_ENV: "development",
      TREIDO_APP_ORIGIN: browserOrigin,
      TREIDO_INVITATION_MAIL_ORIGIN: browserOrigin,
    };
    const browserConfig = invitationMailConfig(developmentEnv, callbackJobs)!;
    expect(browserConfig.origin).toBe(browserOrigin);
    expect(
      invitationMailPayload(
        browserConfig,
        {
          id: deliveryId,
          recipient: payload.to[0],
          language: "en",
          sellerName: "Owned development seller",
          expiresAt: new Date("2026-10-12Z"),
        },
        deliveryId,
      ).text,
    ).toContain(`${browserOrigin}/app/invitations/${deliveryId}`);
    expect(
      invitationMailConfig(
        {
          ...developmentEnv,
          TREIDO_INVITATION_MAIL_ORIGIN: callbackJobs.origin,
        },
        callbackJobs,
      ),
    ).toBeNull();
    expect(
      invitationMailConfig(
        { ...developmentEnv, TREIDO_APP_ORIGIN: "" },
        callbackJobs,
      ),
    ).toBeNull();
    expect(
      invitationMailConfig(
        {
          ...developmentEnv,
          TREIDO_ENV: "production",
          TREIDO_INVITATION_MAIL_ENV: "production",
        },
        callbackJobs,
      ),
    ).toBeNull();
  });
  it("uses a stable key, fixed API and bounded timeout, with no implicit retry", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: emailId })));
    const provider = createResendInvitationProvider(config, request);
    const key = invitationMailKey(config, deliveryId);
    expect(await provider.send(payload, key)).toBe(emailId);
    expect(request).toHaveBeenCalledExactlyOnceWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        redirect: "error",
        cache: "no-store",
        signal: expect.any(AbortSignal),
        headers: expect.objectContaining({ "Idempotency-Key": key }),
        body: JSON.stringify(payload),
      }),
    );
  });
  it("requires the exact verified sending-enabled domain and allowlisted test recipient", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: domainId,
          name: config.domain,
          status: "verified",
          capabilities: { sending: "enabled" },
        }),
      ),
    );
    const provider = createResendInvitationProvider(config, request);
    await provider.verifySender();
    await expect(
      provider.send({ ...payload, to: ["foreign@example.test"] }, "key"),
    ).rejects.toMatchObject({ outcome: "unavailable" });
    request.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: domainId,
          name: "foreign.test",
          status: "verified",
          capabilities: { sending: "enabled" },
        }),
      ),
    );
    await expect(provider.verifySender()).rejects.toMatchObject({
      outcome: "unavailable",
    });
  });
  it.each([500, 408, 429, 409])(
    "preserves uncertainty after HTTP %s",
    async (status) => {
      const request = vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ name: "concurrent_idempotent_requests" }),
            { status },
          ),
        );
      await expect(
        createResendInvitationProvider(config, request).send(payload, "key"),
      ).rejects.toMatchObject({ outcome: "uncertain" });
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it("keeps lost acknowledgements uncertain and definite rejection distinct", async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new Error("lost acknowledgement"));
    await expect(
      createResendInvitationProvider(config, request).send(payload, "key"),
    ).rejects.toMatchObject({ outcome: "uncertain" });
    request.mockResolvedValue(
      new Response(JSON.stringify({ name: "validation_error" }), {
        status: 422,
      }),
    );
    await expect(
      createResendInvitationProvider(config, request).send(payload, "key"),
    ).rejects.toMatchObject({ outcome: "rejected" });
  });
  it("maps provider status without declaring acceptance delivered; checks foreign provider objects", async () => {
    expect(providerMailState("sent")).toBe("sent");
    expect(providerMailState("delivered")).toBe("delivered");
    expect(providerMailState("bounced")).toBe("bounced");
    expect(providerMailState("complained")).toBe("complained");
    expect(providerMailState("suppressed")).toBe("failed");
    expect(providerMailState("unknown")).toBeNull();
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ ...payload, id: emailId, last_event: "delivered" }),
        ),
      );
    expect(
      await createResendInvitationProvider(config, request).retrieve(
        emailId,
        payload,
      ),
    ).toBe("delivered");
    request.mockResolvedValue(
      new Response(
        JSON.stringify({
          ...payload,
          id: emailId,
          to: ["foreign@example.test"],
          last_event: "delivered",
        }),
      ),
    );
    await expect(
      createResendInvitationProvider(config, request).retrieve(
        emailId,
        payload,
      ),
    ).rejects.toMatchObject({ outcome: "unavailable" });
  });
  it("blocks replay at the bounded dedupe deadline and backwards clocks", () => {
    const start = new Date("2026-10-05Z");
    expect(canReplayMail(start, new Date(+start + MAIL_REPLAY_MS - 1))).toBe(
      true,
    );
    expect(canReplayMail(start, new Date(+start + MAIL_REPLAY_MS))).toBe(false);
    expect(canReplayMail(start, new Date(+start - 1))).toBe(false);
  });
});

it("preserves exact provider request bytes after JSONB reorders frozen payload keys", async () => {
  const bodies: string[] = [];
  const request: typeof fetch = async (_url, options) => {
    bodies.push(String(options?.body));
    return Response.json({ id: emailId });
  };
  const provider = createResendInvitationProvider(config, request);
  const key = invitationMailKey(config, deliveryId);
  await provider.send(payload, key);
  await provider.send(
    {
      text: payload.text,
      tags: payload.tags.map((tag) => ({ value: tag.value, name: tag.name })),
      subject: payload.subject,
      to: payload.to,
      from: payload.from,
    },
    key,
  );
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toBe(bodies[0]);
});
