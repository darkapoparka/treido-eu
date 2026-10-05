import "server-only";
import { validId } from "../selling/draft-model";
import {
  mailRecipientAllowed,
  serializeInvitationMailPayload,
  providerMailState,
  type InvitationMailConfig,
  type InvitationMailPayload,
  type MailState,
} from "./mail-model";

export class InvitationMailProviderError extends Error {
  constructor(readonly outcome: "unavailable" | "uncertain" | "rejected") {
    super(`Invitation mail ${outcome}.`);
  }
}
export type InvitationMailProvider = {
  verifySender(): Promise<void>;
  send(payload: InvitationMailPayload, key: string): Promise<string>;
  retrieve(
    id: string,
    payload: InvitationMailPayload,
  ): Promise<MailState | null>;
};
/** Fixed official API, no redirects, SDK retries or caller-selected endpoints. */
export function createResendInvitationProvider(
  config: InvitationMailConfig,
  request: typeof fetch = fetch,
): InvitationMailProvider {
  async function call(
    path: string,
    body?: InvitationMailPayload,
    key?: string,
  ) {
    try {
      const response = await request(`https://api.resend.com${path}`, {
        method: body ? "POST" : "GET",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          ...(key ? { "Idempotency-Key": key } : {}),
        },
        ...(body ? { body: serializeInvitationMailPayload(body) } : {}),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const name =
          data && typeof data === "object" && "name" in data ? data.name : null;
        throw new InvitationMailProviderError(
          !body
            ? "unavailable"
            : response.status >= 500 ||
                response.status === 408 ||
                response.status === 429 ||
                name === "concurrent_idempotent_requests" ||
                name === "invalid_idempotent_request"
              ? "uncertain"
              : "rejected",
        );
      }
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw new InvitationMailProviderError(
          body ? "uncertain" : "unavailable",
        );
      return data as Record<string, unknown>;
    } catch (error) {
      if (error instanceof InvitationMailProviderError) throw error;
      throw new InvitationMailProviderError(body ? "uncertain" : "unavailable");
    }
  }
  return {
    async verifySender() {
      const domain = await call(`/domains/${config.domainId}`);
      const capabilities = domain.capabilities as
        { sending?: string } | undefined;
      if (
        domain.id !== config.domainId ||
        domain.name !== config.domain ||
        domain.status !== "verified" ||
        capabilities?.sending !== "enabled"
      )
        throw new InvitationMailProviderError("unavailable");
    },
    async send(payload, key) {
      if (
        payload.from !== config.sender ||
        payload.to.length !== 1 ||
        !mailRecipientAllowed(config, payload.to[0]) ||
        key.length > 256
      )
        throw new InvitationMailProviderError("unavailable");
      const data = await call("/emails", payload, key);
      if (!validId(data.id)) throw new InvitationMailProviderError("uncertain");
      return data.id as string;
    },
    async retrieve(id, payload) {
      if (!validId(id)) throw new InvitationMailProviderError("unavailable");
      const data = await call(`/emails/${id}`);
      const tags = data.tags;
      if (
        data.id !== id ||
        data.from !== payload.from ||
        JSON.stringify(data.to) !== JSON.stringify(payload.to) ||
        data.subject !== payload.subject ||
        data.text !== payload.text ||
        !Array.isArray(tags) ||
        !payload.tags.every((tag) =>
          tags.some(
            (value: unknown) =>
              value &&
              typeof value === "object" &&
              "name" in value &&
              "value" in value &&
              value.name === tag.name &&
              value.value === tag.value,
          ),
        )
      )
        throw new InvitationMailProviderError("unavailable");
      return providerMailState(data.last_event);
    },
  };
}
