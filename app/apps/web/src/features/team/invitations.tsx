"use client";
import { capabilityMessageKey } from "./model";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  acceptInvitationAction,
  declineInvitationAction,
  readInvitationsAction,
} from "./actions";
import type { IncomingInvitation } from "./model";
import a from "../sellers/admin.module.css";
import s from "./team.module.css";

export function Invitations({
  initial,
  actorSubject,
  language,
  selectedId,
  initialError = null,
}: {
  initial: IncomingInvitation[];
  actorSubject: string;
  language: "bg" | "en";
  selectedId?: string;
  initialError?: string | null;
}) {
  const t = useTranslations("team"),
    format = useFormatter(),
    auth = useAuth(),
    clerk = useClerk(),
    router = useRouter();
  const [items, setItems] = useState(initial),
    [pending, setPending] = useState<string | null>(null),
    [error, setError] = useState<string | null>(initialError),
    [confirmDecline, setConfirmDecline] = useState<string | null>(null);
  const life = useRef(true),
    busy = useRef(false);
  useEffect(() => {
    life.current = true;
    return () => {
      life.current = false;
    };
  }, []);
  const sameActor =
    auth.isLoaded && auth.isSignedIn && auth.userId === actorSubject;
  async function run(
    id: string | null,
    decision: "accept" | "decline" = "accept",
  ) {
    if (busy.current || !sameActor) return;
    busy.current = true;
    setPending(id ?? "refresh");
    setError(null);
    const path = location.pathname;
    const here = () =>
      life.current &&
      clerk.user?.id === actorSubject &&
      location.pathname === path;
    try {
      if (id && decision === "decline") {
        const result = await declineInvitationAction(id);
        if (!here()) return;
        if (!result.ok) {
          setError(result.code);
          return;
        }
        setConfirmDecline(null);
        setItems((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: "declined",
                  canAccept: false,
                  canDecline: false,
                  canOpen: false,
                }
              : item,
          ),
        );
      } else if (id) {
        const result = await acceptInvitationAction(id);
        if (!here()) return;
        if (!result.ok) {
          setError(result.code);
          return;
        }
        router.push(
          "/app/sellers/" + result.data.sellerId + "?lang=" + language,
        );
        router.refresh();
      } else {
        const result = await readInvitationsAction();
        if (!here()) return;
        if (result.ok) setItems(result.data);
        else setError(result.code);
      }
    } catch {
      if (here()) setError("NOT_AVAILABLE");
    } finally {
      busy.current = false;
      if (life.current) setPending(null);
    }
  }
  const visible = selectedId ? items.filter((i) => i.id === selectedId) : items;
  return (
    <main>
      <header className={a.pageBar}>
        <h1>{t("incoming")}</h1>
        <button
          className={a.secondary}
          disabled={!!pending || !sameActor}
          onClick={() => void run(null)}
        >
          {t("retry")}
        </button>
      </header>
      <div className={a.pageBody}>
        {!sameActor ? (
          <section className={s.card} role="status">
            {t(auth.isLoaded ? "denied" : "checking")}
          </section>
        ) : (
          <div className={s.stack}>
            <p className={s.notice}>{t("acceptNote")}</p>
            {error && (
              <p className={s.notice} role="alert">
                {t(
                  error === "CONFLICT"
                    ? "conflict"
                    : error === "QUOTA_EXCEEDED"
                      ? "quota"
                      : ["FORBIDDEN", "UNAUTHENTICATED"].includes(error)
                        ? "emptyIncoming"
                        : "unavailable",
                )}
              </p>
            )}
            {!visible.length && (
              <section className={s.card}>
                <p>{t(selectedId ? "noMatches" : "emptyIncoming")}</p>
                <Link href={"/app/invitations?lang=" + language}>
                  {t("incoming")}
                </Link>
              </section>
            )}
            {visible.map((invitation) => (
              <section className={s.card} key={invitation.id}>
                <div className={s.toolbar}>
                  <h2>{invitation.name}</h2>
                  <span>{t(invitation.status)}</span>
                </div>
                <p>
                  {t(invitation.role)} ·{" "}
                  {t("expires", {
                    date: format.dateTime(new Date(invitation.expiresAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                  })}
                </p>
                <h3>{t("permissions")}</h3>
                <ul className={s.permissions}>
                  {invitation.grants.map((c) => (
                    <li key={c}>{t(capabilityMessageKey(c))}</li>
                  ))}
                </ul>
                <div className={s.actions}>
                  {invitation.canAccept && (
                    <button
                      className={a.primary}
                      disabled={!!pending}
                      onClick={() => void run(invitation.id)}
                    >
                      {t(pending === invitation.id ? "working" : "accept")}
                    </button>
                  )}
                  {invitation.canDecline &&
                    confirmDecline !== invitation.id && (
                      <button
                        className={a.secondary}
                        disabled={!!pending}
                        onClick={() => setConfirmDecline(invitation.id)}
                      >
                        {t("decline")}
                      </button>
                    )}
                  {invitation.status === "accepted" && !invitation.canOpen && (
                    <p role="status">{t("membershipUnavailable")}</p>
                  )}
                  {invitation.canOpen && (
                    <Link
                      className={a.secondary}
                      href={
                        "/app/sellers/" +
                        invitation.sellerId +
                        "?lang=" +
                        language
                      }
                    >
                      {t("openBusiness")}
                    </Link>
                  )}
                </div>
                {confirmDecline === invitation.id && invitation.canDecline && (
                  <div className={s.notice}>
                    <p>{t("confirmDecline")}</p>
                    <div className={s.actions}>
                      <button
                        className={a.secondary}
                        disabled={!!pending}
                        onClick={() => setConfirmDecline(null)}
                      >
                        {t("cancel")}
                      </button>
                      <button
                        className={a.primary}
                        disabled={!!pending}
                        onClick={() => void run(invitation.id, "decline")}
                      >
                        {t(pending === invitation.id ? "working" : "decline")}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
