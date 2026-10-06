import { generateKeyPairSync, sign } from "node:crypto";
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  gatewayAuthenticationFromEnvironment,
  oidcBindingFingerprint,
  qualifyGatewayAuthentication,
  verifyGatewayOidcHeaders,
} from "./gateway-auth.server";
import { isolatedKey, isolatedPolicy } from "./test-fixtures";
import type { RuntimePolicy } from "./policy.server";

const auth = {
  mode: "vercel-oidc",
  issuer: "https://oidc.vercel.com",
  audience: "https://vercel.com/isolated",
  subject: "owner:isolated:project:treido:environment:production",
} as const;
const policy: RuntimePolicy = {
  ...isolatedPolicy,
  environment: "production",
  config: { ...isolatedPolicy.config },
};
policy.config.gatewayCredentialFingerprint = oidcBindingFingerprint(
  policy,
  auth,
);
const env = {
  TREIDO_AI_GATEWAY_AUTH_MODE: "vercel-oidc",
  VERCEL: "1",
  VERCEL_ENV: "production",
  VERCEL_ORG_ID: policy.config.gatewayAccountId,
  VERCEL_PROJECT_ID: policy.config.gatewayProjectId,
  TREIDO_AI_GATEWAY_OIDC_ISSUER: auth.issuer,
  TREIDO_AI_GATEWAY_OIDC_AUDIENCE: auth.audience,
  TREIDO_AI_GATEWAY_OIDC_SUBJECT: auth.subject,
};
const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = {
  ...pair.publicKey.export({ format: "jwk" }),
  kid: "isolated-key",
  alg: "RS256",
  use: "sig",
};
function jwt(
  change: Record<string, unknown> = {},
  headerChange: Record<string, unknown> = {},
) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ typ: "JWT", alg: "RS256", kid: jwk.kid, ...headerChange }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: auth.issuer,
      aud: auth.audience,
      sub: auth.subject,
      owner: "isolated",
      project: "treido",
      owner_id: policy.config.gatewayAccountId,
      project_id: policy.config.gatewayProjectId,
      environment: "production",
      iat: now - 1,
      nbf: now - 1,
      exp: now + 3600,
      ...change,
    }),
  ).toString("base64url");
  return `${header}.${payload}.${sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), pair.privateKey).toString("base64url")}`;
}
const headers = (token: string) => ({
  authorization: `Bearer ${token}`,
  "ai-gateway-auth-method": "oidc",
});
function transport(
  discovery: unknown = {
    issuer: auth.issuer,
    jwks_uri: `${auth.issuer}/.well-known/jwks`,
  },
  keys: unknown = { keys: [jwk] },
) {
  return vi.fn<typeof fetch>(async (url, init) => {
    expect(init?.method).toBe("GET");
    expect(init?.redirect).toBe("error");
    expect(init?.cache).toBe("no-store");
    expect(init).not.toHaveProperty("headers");
    const value = String(url).endsWith("openid-configuration")
      ? discovery
      : keys;
    return Response.json(value);
  });
}
it("keeps exact key fingerprints and explicitly selects approved hosted OIDC without a key", () => {
  expect(qualifyGatewayAuthentication(isolatedPolicy, isolatedKey)).toEqual({
    mode: "api-key",
    key: isolatedKey,
  });
  expect(gatewayAuthenticationFromEnvironment(policy, env)).toEqual(auth);
  expect(() => qualifyGatewayAuthentication(isolatedPolicy, auth)).toThrow(
    "NOT_AVAILABLE",
  );
  expect(() => qualifyGatewayAuthentication(policy, isolatedKey)).toThrow(
    "NOT_AVAILABLE",
  );
});
it.each([
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_ORG_ID",
  "VERCEL_PROJECT_ID",
  "TREIDO_AI_GATEWAY_AUTH_MODE",
  "TREIDO_AI_GATEWAY_OIDC_ISSUER",
  "TREIDO_AI_GATEWAY_OIDC_AUDIENCE",
  "TREIDO_AI_GATEWAY_OIDC_SUBJECT",
])("refuses missing or foreign runtime %s before provider access", (key) => {
  expect(() =>
    gatewayAuthenticationFromEnvironment(policy, { ...env, [key]: "foreign" }),
  ).toThrow("NOT_AVAILABLE");
  const missing: Record<string, string | undefined> = { ...env };
  delete missing[key];
  expect(() => gatewayAuthenticationFromEnvironment(policy, missing)).toThrow(
    "NOT_AVAILABLE",
  );
});
it("does not silently let SDK API-key precedence replace an OIDC policy", () => {
  expect(() =>
    gatewayAuthenticationFromEnvironment(policy, {
      ...env,
      AI_GATEWAY_API_KEY: isolatedKey,
    }),
  ).toThrow("NOT_AVAILABLE");
});
it("signature-verified rotating tokens use the same stable approved identity", async () => {
  const request = transport();
  const first = jwt(),
    second = jwt({ iat: Math.floor(Date.now() / 1000) - 2 });
  expect(first).not.toBe(second);
  await verifyGatewayOidcHeaders(policy, auth, headers(first), request);
  await verifyGatewayOidcHeaders(policy, auth, headers(second), request);
  expect(request).toHaveBeenCalledTimes(4);
  expect(
    request.mock.calls.every(([url]) =>
      String(url).startsWith(auth.issuer + "/.well-known/"),
    ),
  ).toBe(true);
  expect(oidcBindingFingerprint(policy, auth)).toBe(
    policy.config.gatewayCredentialFingerprint,
  );
});
it.each([
  { owner_id: "team_foreign" },
  { project_id: "prj_foreign" },
  { environment: "preview" },
  { sub: "owner:isolated:project:foreign:environment:production" },
  { iss: "https://attacker.invalid" },
  { aud: "https://vercel.com/foreign" },
  { owner: "foreign" },
  { project: "foreign" },
  { exp: 1 },
  { nbf: 9999999999 },
  { iat: 9999999999 },
  { exp: "9999999999" },
])("denies wrong scope or time without any network for %j", async (change) => {
  const request = transport();
  await expect(
    verifyGatewayOidcHeaders(policy, auth, headers(jwt(change)), request),
  ).rejects.toThrow("NOT_AVAILABLE");
  expect(request).not.toHaveBeenCalled();
});
it("rejects unsigned, foreign-key, tampered and wrong-auth-method tokens", async () => {
  for (const token of [
    jwt({}, { alg: "none" }),
    jwt({}, { kid: "foreign-key" }),
    jwt().replace(/\.[^.]+$/, ".AAAA"),
  ])
    await expect(
      verifyGatewayOidcHeaders(policy, auth, headers(token), transport()),
    ).rejects.toThrow("NOT_AVAILABLE");
  const request = transport();
  await expect(
    verifyGatewayOidcHeaders(
      policy,
      auth,
      { ...headers(jwt()), "ai-gateway-auth-method": "api-key" },
      request,
    ),
  ).rejects.toThrow("NOT_AVAILABLE");
  expect(request).not.toHaveBeenCalled();
});
it("does not follow discovery redirects, injected key URLs, duplicate keys or unbounded documents", async () => {
  const retargeted = transport({
    issuer: auth.issuer,
    jwks_uri: "https://attacker.invalid/keys",
  });
  await expect(
    verifyGatewayOidcHeaders(policy, auth, headers(jwt()), retargeted),
  ).rejects.toThrow("NOT_AVAILABLE");
  expect(retargeted).toHaveBeenCalledTimes(1);
  await expect(
    verifyGatewayOidcHeaders(
      policy,
      auth,
      headers(jwt()),
      transport(undefined, { keys: [jwk, jwk] }),
    ),
  ).rejects.toThrow("NOT_AVAILABLE");
  const oversized = vi.fn<typeof fetch>(
    async () =>
      new Response("x".repeat(65537), {
        headers: { "content-type": "application/json" },
      }),
  );
  await expect(
    verifyGatewayOidcHeaders(policy, auth, headers(jwt()), oversized),
  ).rejects.toThrow("NOT_AVAILABLE");
});
it("retains unavailable/aborted verification instead of returning a qualified token", async () => {
  const unavailable = vi.fn<typeof fetch>(
    async () => new Response("{}", { status: 503 }),
  );
  await expect(
    verifyGatewayOidcHeaders(policy, auth, headers(jwt()), unavailable),
  ).rejects.toThrow("NOT_AVAILABLE");
  const aborted = AbortSignal.abort();
  const request = vi.fn<typeof fetch>(async (_url, init) => {
    init?.signal?.throwIfAborted();
    return Response.json({});
  });
  await expect(
    verifyGatewayOidcHeaders(policy, auth, headers(jwt()), request, aborted),
  ).rejects.toThrow();
});
