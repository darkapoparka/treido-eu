import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { requireBackendBindings } from "../../server/config/backend-bindings.server";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import {
  CLOSURE_LIMITS,
  ClosureError,
  object,
  type SessionSummary,
} from "./model";
import {
  requireRecent,
  sessionRef,
  type EffectRow,
  type LifecycleBinding,
} from "./storage.server";
export async function qualifiedClerk(binding: LifecycleBinding) {
  const backend = requireBackendBindings();
  if (
    binding.environment !== backend.environment ||
    binding.applicationId !== backend.identity.applicationId ||
    binding.clerkMode !== backend.identity.mode
  )
    throw new ClosureError("BINDING_REQUIRED");
  const clerk = await clerkClient(),
    instance = await clerk.instance.get();
  if (
    instance.id !== binding.clerkInstanceId ||
    instance.environmentType !==
      (binding.clerkMode === "live" ? "production" : "development")
  )
    throw new ClosureError("BINDING_REQUIRED");
  return clerk;
}
export async function ownSessions(
  identity: VerifiedIdentity,
  binding: LifecycleBinding,
) {
  requireRecent(identity);
  if (!binding.securityEnabled) throw new ClosureError("BINDING_REQUIRED");
  const authState = await auth({
    acceptsToken: "session_token",
    treatPendingAsSignedOut: true,
  });
  if (
    authState.userId !== identity.subject ||
    !authState.sessionId ||
    !authState.has({ reverification: "strict" })
  )
    throw new ClosureError("RECENT_AUTH_REQUIRED");
  const clerk = await qualifiedClerk(binding),
    page = await clerk.sessions.getSessionList({
      userId: identity.subject,
      status: "active",
      limit: CLOSURE_LIMITS.sessions + 1,
    });
  if (page.data.some((session) => session.userId !== identity.subject))
    throw new ClosureError("FORBIDDEN");
  requireRecent(identity);
  const limited =
    page.totalCount > CLOSURE_LIMITS.sessions ||
    page.data.length > CLOSURE_LIMITS.sessions;
  const summaries: SessionSummary[] = page.data
    .slice(0, CLOSURE_LIMITS.sessions)
    .map((session) => ({
      ref: sessionRef(identity.subject, session.id),
      current: session.id === authState.sessionId,
      lastActiveAt: new Date(session.lastActiveAt).toISOString(),
      device: "active session",
    }));
  return {
    summaries,
    limited,
    targets: page.data.map((session) => ({
      id: session.id,
      ref: sessionRef(identity.subject, session.id),
    })),
  };
}
export type ProviderOutcome = {
  state: "confirmed" | "unknown";
  evidence: Record<string, string | boolean>;
};
function missing(error: unknown) {
  return object(error) && error.status === 404;
}
/** Provider reads verify ownership even for an immutable accepted closure effect. */
export async function clerkEffectAdapter(
  binding: LifecycleBinding,
  effect: EffectRow,
) {
  const clerk = await qualifiedClerk(binding);
  if (effect.kind === "session.revoke") {
    const id = effect.target.sessionId;
    if (typeof id !== "string" || !/^sess_[A-Za-z0-9_-]{1,160}$/.test(id))
      throw new ClosureError("INVALID_INPUT");
    const observe = async (): Promise<ProviderOutcome> => {
      try {
        const session = await clerk.sessions.getSession(id);
        if (session.userId !== effect.subject)
          throw new ClosureError("FORBIDDEN");
        return {
          state: [
            "revoked",
            "ended",
            "expired",
            "removed",
            "abandoned",
          ].includes(session.status)
            ? "confirmed"
            : "unknown",
          evidence: {
            kind: "session.revoke",
            ref: sessionRef(effect.subject, id),
            status: session.status,
          },
        };
      } catch (error) {
        if (missing(error))
          return {
            state: "confirmed",
            evidence: {
              kind: "session.revoke",
              ref: sessionRef(effect.subject, id),
              status: "absent",
            },
          };
        throw error;
      }
    };
    // Initial execution requires a genuinely owned resource, not a supplied foreign ID.
    if (!effect.firstAttemptAt) {
      try {
        const session = await clerk.sessions.getSession(id);
        if (session.userId !== effect.subject)
          throw new ClosureError("FORBIDDEN");
      } catch (error) {
        if (!missing(error)) throw error;
      }
    }
    return {
      observe,
      execute: async (): Promise<ProviderOutcome> => {
        const session = await clerk.sessions.revokeSession(id);
        if (session.userId !== effect.subject || session.status !== "revoked")
          return observe();
        return {
          state: "confirmed",
          evidence: {
            kind: "session.revoke",
            ref: sessionRef(effect.subject, id),
            status: session.status,
          },
        };
      },
    };
  }
  if (
    effect.kind !== "identity.delete" ||
    effect.target.subject !== effect.subject
  )
    throw new ClosureError("INVALID_INPUT");
  const observe = async (): Promise<ProviderOutcome> => {
    try {
      const user = await clerk.users.getUser(effect.subject);
      if (user.id !== effect.subject) throw new ClosureError("FORBIDDEN");
      return {
        state: "unknown",
        evidence: { kind: "identity.delete", status: "present" },
      };
    } catch (error) {
      if (missing(error))
        return {
          state: "confirmed",
          evidence: { kind: "identity.delete", status: "absent" },
        };
      throw error;
    }
  };
  if (!effect.firstAttemptAt) {
    try {
      const user = await clerk.users.getUser(effect.subject);
      if (user.id !== effect.subject) throw new ClosureError("FORBIDDEN");
    } catch (error) {
      if (!missing(error)) throw error;
    }
  }
  return {
    observe,
    execute: async (): Promise<ProviderOutcome> => {
      const removed = await clerk.users.deleteUser(effect.subject);
      if (removed.id !== effect.subject)
        throw new ClosureError("UNKNOWN_OUTCOME");
      return observe();
    },
  };
}
