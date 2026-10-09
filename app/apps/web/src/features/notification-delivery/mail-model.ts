import type { NotificationMailBinding } from "./config.server";
import type { NotificationLanguage } from "./model";
import {
  canReplayMail,
  providerMailState,
  MAIL_REPLAY_MS,
} from "../team/mail-model";
export { canReplayMail, providerMailState, MAIL_REPLAY_MS };
export type NotificationMailPayload = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  tags: { name: string; value: string }[];
};
export function notificationMailKey(
  binding: NotificationMailBinding,
  id: string,
) {
  return `${binding.applicationId}/${binding.jobEnvironment}/buyer.notification-email/${id}`;
}
export function notificationMailPayload(
  binding: NotificationMailBinding,
  recipient: string,
  link: string,
  id: string,
  language: NotificationLanguage,
): NotificationMailPayload {
  const target = new URL(link, binding.origin),
    settings = `${binding.origin}/account/notifications?lang=${language}`;
  if (
    target.origin !== binding.origin ||
    !link.startsWith("/") ||
    link.startsWith("//")
  )
    throw new Error("Invalid notification destination.");
  return {
    from: binding.sender,
    to: [recipient],
    subject:
      language === "bg" ? "Ново известие в Treido" : "New Treido notification",
    text:
      language === "bg"
        ? `Имаш ново известие в Treido. Влез в профила си, за да го прегледаш:\n${target.href}\n\nНастройки и спиране на имейл известията:\n${settings}`
        : `You have a new Treido notification. Sign in to your account to view it:\n${target.href}\n\nEmail preferences and opt-out:\n${settings}`,
    tags: [
      { name: "application", value: binding.applicationId },
      { name: "environment", value: binding.environment },
      { name: "purpose", value: "notification-email" },
      { name: "delivery", value: id },
    ],
  };
}
export function serializeNotificationMailPayload(
  payload: NotificationMailPayload,
) {
  return JSON.stringify({
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    tags: payload.tags.map((tag) => ({ name: tag.name, value: tag.value })),
  });
}
