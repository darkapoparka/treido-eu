import "server-only";
import { AwsClient } from "aws4fetch";
import { requireBackendBindings } from "../../server/config/backend-bindings.server";
import { validateMediaBindings } from "../../server/media/bindings";
import { requireMediaStorage } from "../../server/media/storage.server";
import { ClosureError } from "./model";
import type { EffectRow, LifecycleBinding } from "./storage.server";
import type { ProviderOutcome } from "./clerk-adapter.server";
/** Only an exact registered owned key under the already selected private scope. */
export function mediaEffectAdapter(
  binding: LifecycleBinding,
  effect: EffectRow,
) {
  const backend = requireBackendBindings();
  if (
    binding.environment !== backend.environment ||
    binding.applicationId !== backend.identity.applicationId
  )
    throw new ClosureError("BINDING_REQUIRED");
  const storage = requireMediaStorage(),
    configured = validateMediaBindings(process.env);
  if (
    !configured.ok ||
    !binding.mediaUnversioned ||
    !binding.mediaScope ||
    storage.scope !== binding.mediaScope ||
    effect.target.storageScope !== storage.scope
  )
    throw new ClosureError("BINDING_REQUIRED");
  const key = effect.target.objectKey;
  if (
    typeof key !== "string" ||
    key.length > 300 ||
    !key.startsWith(storage.prefix) ||
    !/^[a-zA-Z0-9/_-]+(?:\.webp)?$/.test(key)
  )
    throw new ClosureError("FORBIDDEN");
  const media = configured.bindings,
    neon = media.provider === "neon";
  const client = new AwsClient({
    accessKeyId: (neon
      ? process.env.AWS_ACCESS_KEY_ID
      : process.env.R2_ACCESS_KEY_ID)!,
    secretAccessKey: (neon
      ? process.env.AWS_SECRET_ACCESS_KEY
      : process.env.R2_SECRET_ACCESS_KEY)!,
    region: media.region ?? "auto",
    service: "s3",
    retries: 0,
  });
  const observe = async (): Promise<ProviderOutcome> => {
    const request = await client.sign(
      media.endpoint +
        "/" +
        media.bucket +
        "/" +
        key.split("/").map(encodeURIComponent).join("/"),
      { method: "HEAD" },
    );
    const response = await fetch(request, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    await response.body?.cancel();
    const version = response.headers.get("x-amz-version-id");
    if (
      response.headers.get("x-amz-delete-marker") === "true" ||
      (version && version !== "null")
    )
      throw new ClosureError("BINDING_REQUIRED");
    if (response.status === 404)
      return {
        state: "confirmed",
        evidence: {
          kind: "media.delete",
          scope: storage.scope,
          status: "absent-unversioned",
        },
      };
    if (response.status === 200)
      return {
        state: "unknown",
        evidence: {
          kind: "media.delete",
          scope: storage.scope,
          status: "present",
        },
      };
    throw new ClosureError("UNKNOWN_OUTCOME");
  };
  return {
    observe,
    execute: async (): Promise<ProviderOutcome> => {
      await storage.remove(key);
      return {
        state: "confirmed",
        evidence: {
          kind: "media.delete",
          scope: storage.scope,
          status: "deleted-unversioned",
        },
      };
    },
  };
}
