import "server-only";
import { validId } from "../selling/draft-model";
import { normalizeRecipient } from "../team/model";
import {
  notificationRecipientAllowed,
  type NotificationMailConfig,
} from "./config.server";
import {
  providerMailState,
  serializeNotificationMailPayload,
  type NotificationMailPayload,
} from "./mail-model";
import type { NotificationMailState } from "./model";
export class NotificationMailProviderError extends Error {
  constructor(readonly outcome: "unavailable" | "uncertain" | "rejected") {
    super(`Notification mail ${outcome}.`);
  }
}
export type NotificationMailProvider = {
  verifySender(): Promise<void>;
  send(payload: NotificationMailPayload, key: string): Promise<string>;
  retrieve(
    id: string,
    payload: NotificationMailPayload,
  ): Promise<NotificationMailState | null>;
};
export function createNotificationMailProvider(
  config: NotificationMailConfig,
  request: typeof fetch = fetch,
): NotificationMailProvider {
  async function call(
    path: string,
    payload?: NotificationMailPayload,
    key?: string,
  ) {
    try {
      const response = await request(`https://api.resend.com${path}`, {
        method: payload ? "POST" : "GET",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          ...(key ? { "Idempotency-Key": key } : {}),
        },
        ...(payload ? { body: serializeNotificationMailPayload(payload) } : {}),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const name =
          data && typeof data === "object" && "name" in data ? data.name : null;
        throw new NotificationMailProviderError(
          !payload
            ? "unavailable"
            : response.status >= 500 ||
                [408, 429].includes(response.status) ||
                name === "concurrent_idempotent_requests" ||
                name === "invalid_idempotent_request"
              ? "uncertain"
              : "rejected",
        );
      }
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw new NotificationMailProviderError(
          payload ? "uncertain" : "unavailable",
        );
      return data as Record<string, unknown>;
    } catch (error) {
      if (error instanceof NotificationMailProviderError) throw error;
      throw new NotificationMailProviderError(
        payload ? "uncertain" : "unavailable",
      );
    }
  }
  return {
    async verifySender() {
      const domain = await call(`/domains/${config.domainId}`),
        capabilities = domain.capabilities as { sending?: string } | undefined;
      if (
        domain.id !== config.domainId ||
        domain.name !== config.domain ||
        domain.status !== "verified" ||
        capabilities?.sending !== "enabled"
      )
        throw new NotificationMailProviderError("unavailable");
    },
    async send(payload, key) {
      if (
        payload.from !== config.sender ||
        payload.to.length !== 1 ||
        normalizeRecipient(payload.to[0]) !== payload.to[0] ||
        !notificationRecipientAllowed(config, payload.to[0]) ||
        key.length > 256
      )
        throw new NotificationMailProviderError("unavailable");
      const data = await call("/emails", payload, key);
      if (!validId(data.id))
        throw new NotificationMailProviderError("uncertain");
      return data.id as string;
    },
    async retrieve(id, payload) {
      if (!validId(id)) throw new NotificationMailProviderError("unavailable");
      const data = await call(`/emails/${id}`),
        tags = data.tags;
      if (
        data.id !== id ||
        data.from !== payload.from ||
        JSON.stringify(data.to) !== JSON.stringify(payload.to) ||
        data.subject !== payload.subject ||
        data.text !== payload.text ||
        !Array.isArray(tags) ||
        !payload.tags.every((tag) =>
          tags.some(
            (value) =>
              value &&
              typeof value === "object" &&
              "name" in value &&
              "value" in value &&
              value.name === tag.name &&
              value.value === tag.value,
          ),
        )
      )
        throw new NotificationMailProviderError("unavailable");
      return providerMailState(data.last_event);
    },
  };
}
