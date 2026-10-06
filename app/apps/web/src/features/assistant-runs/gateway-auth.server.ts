import "server-only";
import {
  createHash,
  createPublicKey,
  verify,
  type JsonWebKey,
} from "node:crypto";
import { SellerError } from "../sellers/errors";
import type { RuntimePolicy } from "./policy.server";

export type GatewayAuthentication =
  | { mode: "api-key"; key: string }
  | { mode: "vercel-oidc"; issuer: string; audience: string; subject: string };
type OidcAuthentication = Extract<
  GatewayAuthentication,
  { mode: "vercel-oidc" }
>;
const unavailable = () => new SellerError("NOT_AVAILABLE");
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw unavailable();
  return value as Record<string, unknown>;
}
function identity(policy: RuntimePolicy, auth: OidcAuthentication) {
  const subject =
    /^owner:([a-zA-Z0-9_-]{1,100}):project:([a-zA-Z0-9._-]{1,100}):environment:([a-z0-9-]{1,64})$/.exec(
      auth.subject,
    );
  if (
    !subject ||
    subject[3] !== policy.environment ||
    auth.audience !== `https://vercel.com/${subject[1]}` ||
    ![
      "https://oidc.vercel.com",
      `https://oidc.vercel.com/${subject[1]}`,
    ].includes(auth.issuer)
  )
    throw unavailable();
  return {
    issuer: auth.issuer,
    audience: auth.audience,
    subject: auth.subject,
    ownerId: policy.config.gatewayAccountId,
    projectId: policy.config.gatewayProjectId,
    applicationId: policy.applicationId,
    environment: policy.environment,
  };
}
/** Fingerprint the reviewed stable identity, never a rotating token or fabricated approval. */
export function oidcBindingFingerprint(
  policy: RuntimePolicy,
  auth: OidcAuthentication,
) {
  return createHash("sha256")
    .update("treido-gateway-oidc-binding-v1\0")
    .update(JSON.stringify(identity(policy, auth)))
    .digest("hex");
}
export function qualifyGatewayAuthentication(
  policy: RuntimePolicy,
  input: string | GatewayAuthentication,
): GatewayAuthentication {
  const auth: GatewayAuthentication =
    typeof input === "string" ? { mode: "api-key", key: input } : input;
  if (auth.mode === "api-key") {
    if (!auth.key || auth.key.length > 4096 || /\s/.test(auth.key))
      throw unavailable();
    const fingerprint = createHash("sha256")
      .update("treido-gateway-binding-v1\0")
      .update(auth.key)
      .digest("hex");
    if (fingerprint !== policy.config.gatewayCredentialFingerprint)
      throw unavailable();
  } else if (
    auth.mode !== "vercel-oidc" ||
    oidcBindingFingerprint(policy, auth) !==
      policy.config.gatewayCredentialFingerprint
  )
    throw unavailable();
  return auth;
}
export function gatewayAuthenticationFromEnvironment(
  policy: RuntimePolicy,
  env: Readonly<Record<string, string | undefined>> = process.env,
): GatewayAuthentication {
  const mode = env.TREIDO_AI_GATEWAY_AUTH_MODE ?? "api-key";
  if (mode === "api-key")
    return qualifyGatewayAuthentication(policy, env.AI_GATEWAY_API_KEY ?? "");
  if (
    mode !== "vercel-oidc" ||
    env.AI_GATEWAY_API_KEY ||
    env.VERCEL !== "1" ||
    !["production", "preview"].includes(policy.environment) ||
    env.VERCEL_ENV !== policy.environment ||
    env.VERCEL_ORG_ID !== policy.config.gatewayAccountId ||
    env.VERCEL_PROJECT_ID !== policy.config.gatewayProjectId
  )
    throw unavailable();
  return qualifyGatewayAuthentication(policy, {
    mode,
    issuer: env.TREIDO_AI_GATEWAY_OIDC_ISSUER ?? "",
    audience: env.TREIDO_AI_GATEWAY_OIDC_AUDIENCE ?? "",
    subject: env.TREIDO_AI_GATEWAY_OIDC_SUBJECT ?? "",
  });
}
async function verificationJson(
  url: string,
  request: typeof fetch,
  signal?: AbortSignal,
) {
  const response = await request(url, {
    method: "GET",
    redirect: "error",
    cache: "no-store",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(5000)])
      : AbortSignal.timeout(5000),
  });
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("application/json")
  ) {
    await response.body?.cancel();
    throw unavailable();
  }
  const reader = response.body?.getReader();
  if (!reader) throw unavailable();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 65536) {
        await reader.cancel();
        throw unavailable();
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return object(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch {
    throw unavailable();
  }
}
/** The SDK acquires/refreshes tokens; it does not enforce Treido's reviewed identity. */
export async function verifyGatewayOidcHeaders(
  policy: RuntimePolicy,
  auth: GatewayAuthentication,
  headers: HeadersInit | undefined,
  request: typeof fetch,
  signal?: AbortSignal,
) {
  if (auth.mode === "api-key") return;
  qualifyGatewayAuthentication(policy, auth);
  const values = new Headers(headers);
  const bearer = values.get("authorization") ?? "";
  if (
    values.get("ai-gateway-auth-method") !== "oidc" ||
    !bearer.startsWith("Bearer ") ||
    bearer.length > 16384
  )
    throw unavailable();
  const token = bearer.slice(7),
    pieces = token.split(".");
  if (pieces.length !== 3 || pieces.some((p) => !/^[A-Za-z0-9_-]+$/.test(p)))
    throw unavailable();
  let header: Record<string, unknown>, claims: Record<string, unknown>;
  try {
    header = object(
      JSON.parse(Buffer.from(pieces[0], "base64url").toString("utf8")),
    );
    claims = object(
      JSON.parse(Buffer.from(pieces[1], "base64url").toString("utf8")),
    );
  } catch {
    throw unavailable();
  }
  const now = Math.floor(Date.now() / 1000),
    expected = identity(policy, auth),
    subject = auth.subject.split(":");
  if (
    header.alg !== "RS256" ||
    header.typ !== "JWT" ||
    typeof header.kid !== "string" ||
    !/^[A-Za-z0-9_-]{1,200}$/.test(header.kid) ||
    claims.iss !== expected.issuer ||
    claims.aud !== expected.audience ||
    claims.sub !== expected.subject ||
    claims.owner_id !== expected.ownerId ||
    claims.project_id !== expected.projectId ||
    claims.environment !== expected.environment ||
    claims.owner !== subject[1] ||
    claims.project !== subject[3] ||
    !Number.isSafeInteger(claims.exp) ||
    Number(claims.exp) <= now ||
    !Number.isSafeInteger(claims.nbf) ||
    Number(claims.nbf) > now ||
    !Number.isSafeInteger(claims.iat) ||
    Number(claims.iat) > now ||
    Number(claims.iat) > Number(claims.exp)
  )
    throw unavailable();
  // Only an independently pinned issuer supplies keys. JWT fields never select a URL.
  const discovery = await verificationJson(
    `${auth.issuer}/.well-known/openid-configuration`,
    request,
    signal,
  );
  const jwksUrl = `${auth.issuer}/.well-known/jwks`;
  if (discovery.issuer !== auth.issuer || discovery.jwks_uri !== jwksUrl)
    throw unavailable();
  const jwks = await verificationJson(jwksUrl, request, signal);
  if (!Array.isArray(jwks.keys) || jwks.keys.length > 32) throw unavailable();
  const matches = jwks.keys.filter(
    (raw) =>
      raw &&
      typeof raw === "object" &&
      (raw as Record<string, unknown>).kid === header.kid,
  );
  if (matches.length !== 1) throw unavailable();
  const jwk = object(matches[0]);
  if (
    jwk.kty !== "RSA" ||
    (jwk.alg !== undefined && jwk.alg !== "RS256") ||
    (jwk.use !== undefined && jwk.use !== "sig")
  )
    throw unavailable();
  try {
    const key = createPublicKey({ key: jwk as JsonWebKey, format: "jwk" });
    if (
      (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048 ||
      !verify(
        "RSA-SHA256",
        Buffer.from(`${pieces[0]}.${pieces[1]}`),
        key,
        Buffer.from(pieces[2], "base64url"),
      )
    )
      throw unavailable();
  } catch {
    throw unavailable();
  }
  signal?.throwIfAborted();
}
