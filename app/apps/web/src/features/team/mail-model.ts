import { normalizeRecipient } from "./model";
import { validId } from "../selling/draft-model";

export const MAIL_PURPOSE = "team.invitation";
// Resend retains keys for 24h. Leave one hour for clocks and transport.
export const MAIL_REPLAY_MS = 23 * 60 * 60 * 1000;
export type MailState =
  | "pending"
  | "submitted"
  | "sent"
  | "delivered"
  | "bounced"
  | "failed"
  | "complained"
  | "unavailable"
  | "uncertain"
  | "cancelled";
export type InvitationMailBinding = {
  environment: "development" | "test" | "preview" | "production";
  applicationId: string;
  jobEnvironment: string;
  origin: string;
  sender: string;
  domain: string;
  domainId: string;
  accountBinding: string;
  purpose: typeof MAIL_PURPOSE;
  recipients: readonly string[];
};
export type InvitationMailConfig = InvitationMailBinding & { apiKey: string };
/** Explicit input only: caller supplies server configuration; never return secret values in errors. */
export function invitationMailConfig(
  env: Readonly<Record<string, string | undefined>>,
  jobs: { applicationId: string; environment: string; origin: string },
): InvitationMailConfig | null {
  const sender = normalizeRecipient(env.TREIDO_INVITATION_MAIL_SENDER);
  const domain = env.TREIDO_INVITATION_MAIL_DOMAIN ?? "";
  const recipients = (env.TREIDO_INVITATION_MAIL_TEST_RECIPIENTS ?? "")
    .split(",")
    .filter(Boolean)
    .map(normalizeRecipient);
  const environment = env.TREIDO_ENV;
  if (
    !sender ||
    sender.split("@")[1] !== domain ||
    !/^[a-z0-9.-]+$/.test(domain) ||
    !["development", "test", "preview", "production"].includes(
      environment ?? "",
    ) ||
    env.TREIDO_INVITATION_MAIL_ENV !== environment ||
    env.TREIDO_INVITATION_MAIL_APPLICATION_ID !== jobs.applicationId ||
    env.TREIDO_INVITATION_MAIL_JOB_ENV !== jobs.environment ||
    env.TREIDO_INVITATION_MAIL_ORIGIN !== jobs.origin ||
    env.TREIDO_INVITATION_MAIL_PURPOSE !== MAIL_PURPOSE ||
    !/^[a-z][a-z0-9-]{1,79}$/.test(jobs.applicationId) ||
    !/^[a-z][a-z0-9-]{1,63}$/.test(jobs.environment) ||
    !/^[a-z][a-z0-9-]{1,79}$/.test(
      env.TREIDO_INVITATION_MAIL_ACCOUNT_BINDING ?? "",
    ) ||
    !validId(env.TREIDO_INVITATION_MAIL_DOMAIN_ID) ||
    !/^re_[A-Za-z0-9_-]{16,256}$/.test(env.RESEND_API_KEY ?? "") ||
    recipients.some((r) => !r) ||
    recipients.length > 50 ||
    (environment !== "production" && !recipients.length) ||
    Object.keys(env).some(
      (key) =>
        /^NEXT_PUBLIC_.*(?:RESEND|INVITATION_MAIL)/.test(key) && env[key],
    )
  )
    return null;
  try {
    const url = new URL(jobs.origin);
    if (
      url.origin !== jobs.origin ||
      url.username ||
      url.password ||
      (environment === "production" || environment === "preview"
        ? url.protocol !== "https:"
        : !(
            url.protocol === "https:" ||
            (url.protocol === "http:" && url.hostname === "127.0.0.1")
          ))
    )
      return null;
  } catch {
    return null;
  }
  return {
    environment: environment as InvitationMailConfig["environment"],
    applicationId: jobs.applicationId,
    jobEnvironment: jobs.environment,
    origin: jobs.origin,
    sender,
    domain,
    domainId: env.TREIDO_INVITATION_MAIL_DOMAIN_ID!,
    accountBinding: env.TREIDO_INVITATION_MAIL_ACCOUNT_BINDING!,
    purpose: MAIL_PURPOSE,
    recipients: recipients as string[],
    apiKey: env.RESEND_API_KEY!,
  };
}
export function publicMailBinding(
  config: InvitationMailConfig,
): InvitationMailBinding {
  const { apiKey: _key, ...binding } = config;
  void _key;
  return binding;
}
export function mailRecipientAllowed(
  binding: InvitationMailBinding,
  recipient: string,
) {
  return (
    normalizeRecipient(recipient) === recipient &&
    (binding.environment === "production" ||
      binding.recipients.includes(recipient))
  );
}
export function canReplayMail(firstAttempt: Date | null, now: Date) {
  return (
    !firstAttempt ||
    (now.getTime() >= firstAttempt.getTime() &&
      now.getTime() - firstAttempt.getTime() < MAIL_REPLAY_MS)
  );
}
export function providerMailState(event: unknown): MailState | null {
  switch (event) {
    case "sent":
      return "sent";
    case "delivered":
    case "opened":
    case "clicked":
      return "delivered";
    case "bounced":
      return "bounced";
    case "failed":
    case "suppressed":
      return "failed";
    case "complained":
      return "complained";
    case "queued":
    case "scheduled":
      return "submitted";
    case "delivery_delayed":
      return "sent";
    default:
      return null;
  }
}
export type InvitationMailPayload = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  tags: { name: string; value: string }[];
};
export function invitationMailPayload(
  binding: InvitationMailBinding,
  invitation: {
    id: string;
    recipient: string;
    language: "bg" | "en";
    sellerName: string;
    expiresAt: Date;
  },
  deliveryId: string,
): InvitationMailPayload {
  const link = `${binding.origin}/app/invitations/${invitation.id}?lang=${invitation.language}`;
  const bg = invitation.language === "bg";
  return {
    from: binding.sender,
    to: [invitation.recipient],
    subject: bg ? "Покана за екип в Treido" : "Treido team invitation",
    text: bg
      ? `${invitation.sellerName} ви кани в своя екип в Treido.\n\nВлезте с потвърдения имейл ${invitation.recipient}, за да прегледате поканата и правата:\n${link}\n\nПоканата изтича на ${invitation.expiresAt.toISOString()}. Отварянето на връзката не я приема.`
      : `${invitation.sellerName} invites you to their Treido team.\n\nSign in with the verified email ${invitation.recipient} to review the invitation and permissions:\n${link}\n\nThe invitation expires at ${invitation.expiresAt.toISOString()}. Opening this link does not accept it.`,
    tags: [
      { name: "purpose", value: "team_invitation" },
      { name: "delivery", value: deliveryId },
      { name: "application", value: binding.applicationId },
      { name: "environment", value: binding.jobEnvironment },
    ],
  };
}
export function invitationMailKey(
  binding: InvitationMailBinding,
  deliveryId: string,
) {
  return `${binding.applicationId}/${binding.jobEnvironment}/team.invitation/${deliveryId}`;
}

/** JSONB reorders object keys. Serialize the frozen payload identically before every provider attempt. */
export function serializeInvitationMailPayload(payload: InvitationMailPayload) {
  return JSON.stringify({
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    tags: payload.tags.map((tag) => ({ name: tag.name, value: tag.value })),
  });
}
