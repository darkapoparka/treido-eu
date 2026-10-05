"use client";

import { useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { clearPrivateBuffers } from "./private-recovery";
import styles from "./workspace.module.css";

/** Explicitly ends the current session; rendering never changes authentication. */
export function SessionExit({
  actorSubject,
  language,
}: {
  actorSubject: string;
  language: "bg" | "en";
}) {
  const clerk = useClerk();
  const router = useRouter();
  const auth = useAuth({ treatPendingAsSignedOut: true });
  const [status, setStatus] = useState<"ready" | "pending" | "failed">("ready");
  const bg = language === "bg";
  const current =
    auth.isLoaded && auth.isSignedIn && auth.userId === actorSubject;
  async function signOut() {
    const sessionId = clerk.session?.id;
    if (!current || clerk.user?.id !== actorSubject || !sessionId) return;
    setStatus("pending");
    try {
      await clerk.signOut({ sessionId });
      clearPrivateBuffers(actorSubject);
      router.replace(`/?lang=${language}`);
      router.refresh();
    } catch {
      setStatus("failed");
    }
  }
  return (
    <div className={styles.form}>
      <button
        type="button"
        className={styles.link}
        disabled={!current || status === "pending"}
        onClick={() => void signOut()}
      >
        {status === "pending"
          ? bg
            ? "Излизане…"
            : "Signing out…"
          : bg
            ? "Изход"
            : "Sign out"}
      </button>
      {status === "failed" && (
        <p role="alert" className="form-error">
          {bg
            ? "Излизането не беше потвърдено. Опитайте отново."
            : "Sign-out could not be confirmed. Try again."}
        </p>
      )}
    </div>
  );
}
