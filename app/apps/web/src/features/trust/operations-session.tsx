"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { readOperatorSessionAction } from "./operations-actions";
import w from "../sellers/workspace.module.css";
export function OperationsSession({
  actorSubject,
  actorKey,
  children,
}: {
  actorSubject: string;
  actorKey: string;
  children: ReactNode;
}) {
  const { isLoaded, user } = useUser(),
    clerk = useClerk(),
    router = useRouter(),
    t = useTranslations("trustOperations");
  const [access, setAccess] = useState<
    "checking" | "ready" | "denied" | "unavailable"
  >("checking");
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    function read(refresh: boolean) {
      const ticket = ++generation.current;
      if (clerk.user?.id !== actorSubject) return;
      void readOperatorSessionAction(actorKey)
        .then((result) => {
          if (
            !active ||
            ticket !== generation.current ||
            clerk.user?.id !== actorSubject
          )
            return;
          setAccess(
            result.ok
              ? "ready"
              : ["UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND"].includes(
                    result.code,
                  )
                ? "denied"
                : "unavailable",
          );
          if (result.ok && refresh) router.refresh();
        })
        .catch(() => {
          if (active && ticket === generation.current) setAccess("unavailable");
        });
    }
    const refresh = () => {
      if (document.visibilityState === "visible") {
        setAccess("checking");
        read(true);
      }
    };
    const visibility = () => {
      generation.current += 1;
      setAccess("checking");
      if (document.visibilityState === "visible") read(true);
    };
    read(false);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", visibility);
    // Passive refresh keeps focused editors mounted; authority failure still hides them.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") read(true);
    }, 30000);
    return () => {
      active = false;
      generation.current += 1;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [actorSubject, actorKey, clerk, router, isLoaded, user?.id, retry]);
  if (!isLoaded || user?.id !== actorSubject || access !== "ready")
    return (
      <div className={w.page}>
        <p role="status">
          {t(
            !isLoaded || access === "checking"
              ? "checking"
              : user?.id !== actorSubject || access === "denied"
                ? "denied"
                : "failed",
          )}
        </p>
        <button
          className={w.button}
          onClick={() => {
            setAccess("checking");
            setRetry((value) => value + 1);
          }}
        >
          {t("reload")}
        </button>
      </div>
    );
  return children;
}
