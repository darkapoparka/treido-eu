import "server-only";
import {
  invitationMailConfig,
  type InvitationMailConfig,
} from "../team/mail-model";
import { requireJobBindings } from "../../server/jobs/config.server";
import { normalizeRecipient } from "../team/model";
export type NotificationMailBinding = Omit<
  InvitationMailConfig,
  "apiKey" | "purpose"
> & { purpose: "buyer.notification-email" };
export type NotificationMailConfig = NotificationMailBinding & {
  apiKey: string;
};
/** Separate purpose with explicit enablement; only the intended existing mail resource is reused. */
export function notificationMailConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): NotificationMailConfig | null {
  if (env.TREIDO_NOTIFICATION_MAIL_ENABLED !== "1") return null;
  let jobs;
  try {
    jobs = requireJobBindings();
  } catch {
    return null;
  }
  const existing = invitationMailConfig(env, jobs);
  return existing ? { ...existing, purpose: "buyer.notification-email" } : null;
}
export function notificationMailBinding(
  config: NotificationMailConfig,
): NotificationMailBinding {
  const { apiKey: _private, ...binding } = config;
  void _private;
  return binding;
}
export function notificationRecipientAllowed(
  binding: NotificationMailBinding,
  recipient: string,
) {
  return (
    normalizeRecipient(recipient) === recipient &&
    (binding.environment === "production" ||
      binding.recipients.includes(recipient))
  );
}
