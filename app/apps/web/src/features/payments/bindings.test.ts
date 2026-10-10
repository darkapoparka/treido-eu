import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  environment: "development",
  origin: "http://127.0.0.1:6419",
  account: vi.fn(),
  endpoint: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../server/config/backend-bindings.server", () => ({
  requireBackendBindings: () => ({
    environment: state.environment,
    application: { origin: state.origin },
  }),
}));
vi.mock("stripe", () => ({
  default: class {
    accounts = { retrieve: state.account };
    webhookEndpoints = { retrieve: state.endpoint };
  },
}));

import {
  paymentBindings,
  requireWebhookBinding,
  verifiedStripe,
} from "./bindings.server";
import { SellerError } from "../sellers/errors";

const callback = "https://callback.example.com";
function endpoint() {
  return {
    livemode: false,
    status: "enabled",
    url: callback + "/api/stripe/webhook",
    metadata: {
      treido_application_id: "treido-test",
      treido_environment: state.environment,
    },
    enabled_events: ["*"],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  state.environment = "development";
  state.origin = "http://127.0.0.1:6419";
  for (const [key, value] of Object.entries({
    TREIDO_STRIPE_MODE: "test",
    STRIPE_SECRET_KEY: "rk_test_SYNTHETIC",
    STRIPE_PUBLISHABLE_KEY: "pk_test_SYNTHETIC",
    TREIDO_STRIPE_PLATFORM_ACCOUNT: "acct_SYNTHETIC",
    TREIDO_STRIPE_APPLICATION_ID: "treido-test",
    TREIDO_STRIPE_COLLECTION_ENABLED: "true",
    STRIPE_WEBHOOK_SECRET: "whsec_SYNTHETIC",
    TREIDO_STRIPE_WEBHOOK_ENDPOINT_ID: "we_SYNTHETIC",
    TREIDO_STRIPE_WEBHOOK_SCOPE: "platform",
    TREIDO_STRIPE_WEBHOOK_PLATFORM_ACCOUNT: "acct_SYNTHETIC",
    TREIDO_STRIPE_WEBHOOK_MODE: "test",
  }))
    vi.stubEnv(key, value);
  vi.stubEnv("TREIDO_STRIPE_WEBHOOK_ORIGIN", undefined);
  vi.stubEnv("VERCEL_ENV", undefined);
  state.account.mockResolvedValue({
    id: "acct_SYNTHETIC",
    country: "BG",
    charges_enabled: true,
    payouts_enabled: true,
    default_currency: "eur",
  });
  state.endpoint.mockResolvedValue(endpoint());
});
afterEach(() => vi.unstubAllEnvs());

describe("registered Stripe webhook origin (synthetic provider)", () => {
  it("allows an explicit Development test callback while retaining the loopback browser origin", async () => {
    vi.stubEnv("TREIDO_STRIPE_WEBHOOK_ORIGIN", callback);
    const binding = paymentBindings();
    expect(binding.origin).toBe(state.origin);
    await expect(verifiedStripe(binding, true)).resolves.toBeDefined();
    expect(state.endpoint).toHaveBeenCalledExactlyOnceWith("we_SYNTHETIC");
  });
  it("allows the same explicit callback for the test environment", async () => {
    state.environment = "test";
    state.endpoint.mockResolvedValue(endpoint());
    vi.stubEnv("TREIDO_STRIPE_WEBHOOK_ORIGIN", callback);
    await expect(
      verifiedStripe(paymentBindings(), true),
    ).resolves.toBeDefined();
  });
  it.each([
    "https://xn--bcher-kva.example.com",
    `https://${"a".repeat(63)}.example.com`,
    `https://callback.${"a".repeat(63)}`,
  ])("retains canonical DNS origins %s", (origin) => {
    vi.stubEnv("TREIDO_STRIPE_WEBHOOK_ORIGIN", origin);
    expect(requireWebhookBinding().origin).toBe(origin);
  });
  it("never infers the Stripe callback from an Inngest callback", async () => {
    vi.stubEnv("INNGEST_SERVE_ORIGIN", callback);
    await expect(
      verifiedStripe(paymentBindings(), true),
    ).rejects.toBeInstanceOf(SellerError);
  });
  it.each(["preview", "production"])(
    "retains the canonical %s origin without an override",
    async (environment) => {
      state.environment = environment;
      state.origin = "https://treido.example.com";
      state.endpoint.mockResolvedValue({
        ...endpoint(),
        url: state.origin + "/api/stripe/webhook",
      });
      await expect(
        verifiedStripe(paymentBindings(), true),
      ).resolves.toBeDefined();
    },
  );
  it.each(["preview", "production"])(
    "rejects a separate callback in %s",
    (environment) => {
      state.environment = environment;
      vi.stubEnv("TREIDO_STRIPE_WEBHOOK_ORIGIN", callback);
      expect(() => requireWebhookBinding()).toThrow(SellerError);
    },
  );
  it.each(["preview", "production"])(
    "rejects an override when the hosted runtime is %s",
    (environment) => {
      vi.stubEnv("VERCEL_ENV", environment);
      vi.stubEnv("TREIDO_STRIPE_WEBHOOK_ORIGIN", callback);
      expect(() => requireWebhookBinding()).toThrow(SellerError);
    },
  );
  it("rejects a Development override in live Stripe mode", () => {
    vi.stubEnv("TREIDO_STRIPE_MODE", "live");
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_live_SYNTHETIC");
    vi.stubEnv("STRIPE_PUBLISHABLE_KEY", "pk_live_SYNTHETIC");
    vi.stubEnv("TREIDO_STRIPE_WEBHOOK_MODE", "live");
    vi.stubEnv("TREIDO_STRIPE_WEBHOOK_ORIGIN", callback);
    expect(() => requireWebhookBinding()).toThrow(SellerError);
  });
  it.each([
    "",
    "http://callback.example.com",
    "https://localhost",
    "https://127.0.0.1",
    "https://[::1]",
    "https://callback.local",
    "https://callback.internal",
    "https://callback.test",
    "https://callback.invalid",
    "https://callback.lan",
    "https://home.arpa",
    "https://callback.home.arpa",
    "https://callback.onion",
    "https://callback.com-",
    "https://-callback.example.com",
    "https://callback-.example.com",
    `https://${"a".repeat(64)}.example.com`,
    `https://callback.${"a".repeat(64)}`,
    "https://callback.example.com/",
    "https://callback.example.com/api/stripe/webhook",
    "https://callback.example.com?key=value",
    "https://callback.example.com#fragment",
    "https://user:password@callback.example.com",
    "https://callback.example.com:8443",
    " https://callback.example.com",
    "https://callback.example.com\\path",
  ])("rejects an unsafe or non-origin callback %s", (origin) => {
    vi.stubEnv("TREIDO_STRIPE_WEBHOOK_ORIGIN", origin);
    expect(() => requireWebhookBinding()).toThrow(SellerError);
  });
  it.each([
    { livemode: true },
    { status: "disabled" },
    { url: callback + "/other" },
    { url: callback + "/api/stripe/webhook?override=1" },
    {
      metadata: {
        treido_application_id: "foreign-app",
        treido_environment: "development",
      },
    },
    {
      metadata: {
        treido_application_id: "treido-test",
        treido_environment: "preview",
      },
    },
    { enabled_events: ["payment_intent.succeeded"] },
  ])("retains registered endpoint verification %j", async (change) => {
    vi.stubEnv("TREIDO_STRIPE_WEBHOOK_ORIGIN", callback);
    state.endpoint.mockResolvedValue({ ...endpoint(), ...change });
    await expect(
      verifiedStripe(paymentBindings(), true),
    ).rejects.toBeInstanceOf(SellerError);
  });
  it.each([
    ["STRIPE_WEBHOOK_SECRET", "invalid"],
    ["TREIDO_STRIPE_WEBHOOK_ENDPOINT_ID", "invalid"],
    ["TREIDO_STRIPE_WEBHOOK_SCOPE", "connected"],
    ["TREIDO_STRIPE_WEBHOOK_PLATFORM_ACCOUNT", "acct_FOREIGN"],
    ["TREIDO_STRIPE_WEBHOOK_MODE", "live"],
  ])("retains the signing/account/mode binding gate %s", (key, value) => {
    vi.stubEnv("TREIDO_STRIPE_WEBHOOK_ORIGIN", callback);
    vi.stubEnv(key, value);
    expect(() => requireWebhookBinding()).toThrow(SellerError);
  });
  it.each([
    { id: "acct_FOREIGN" },
    { country: "FR" },
    { charges_enabled: false },
    { payouts_enabled: false },
    { default_currency: "usd" },
  ])("retains actual platform collection eligibility %j", async (change) => {
    vi.stubEnv("TREIDO_STRIPE_WEBHOOK_ORIGIN", callback);
    state.account.mockResolvedValue({ ...(await state.account()), ...change });
    await expect(
      verifiedStripe(paymentBindings(), true),
    ).rejects.toBeInstanceOf(SellerError);
  });
});
