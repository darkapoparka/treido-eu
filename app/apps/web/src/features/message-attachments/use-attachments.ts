"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import {
  stageAttachmentAction,
  attachmentStatusAction,
  removeAttachmentAction,
} from "./actions";
import {
  ATTACHMENT_LIMITS as L,
  attachmentHref,
  type AttachmentView,
  type AttachmentScope,
} from "./model";
export type Selection = {
  localId: string;
  file?: File;
  requestId: string;
  checksum: string | null;
  view: AttachmentView | null;
  busy: boolean;
  error: string | null;
};
export function useAttachments(input: AttachmentScope, actorSubject: string) {
  const clerk = useClerk(),
    auth = useAuth({ treatPendingAsSignedOut: true });
  const scope = useMemo(
    () => ({ sellerId: input.sellerId, threadId: input.threadId }),
    [input.sellerId, input.threadId],
  );
  const sessionId = auth.isLoaded && auth.isSignedIn ? auth.sessionId : null;
  const sameActor =
    auth.isLoaded && auth.isSignedIn && auth.userId === actorSubject;
  const key = JSON.stringify([
    actorSubject,
    scope.sellerId,
    scope.threadId,
    sessionId,
  ]);
  const [state, setState] = useState<{ key: string; items: Selection[] }>(
    () => ({ key, items: [] }),
  );
  const life = useRef({ mounted: false, key });
  const itemsRef = useRef<Selection[]>([]);
  const inFlight = useRef(new Set<string>());
  const items = sameActor && state.key === key ? state.items : [];
  useLayoutEffect(() => {
    life.current = { mounted: true, key };
    itemsRef.current = sameActor && state.key === key ? state.items : [];
    return () => {
      life.current.mounted = false;
    };
  }, [key, sameActor, state]);
  const current = useCallback(
    () =>
      life.current.mounted &&
      life.current.key === key &&
      sameActor &&
      clerk.user?.id === actorSubject &&
      clerk.session?.id === sessionId &&
      clerk.session?.status === "active",
    [key, sameActor, clerk, actorSubject, sessionId],
  );
  const update = useCallback(
    (fn: (values: Selection[]) => Selection[]) => {
      if (!current()) return;
      setState((previous) => {
        const values = previous.key === key ? previous.items : [];
        const next = fn(values);
        return previous.key === key && next === values
          ? previous
          : { key, items: next };
      });
    },
    [current, key],
  );
  const change = useCallback(
    (id: string, patch: Partial<Selection>) =>
      update((values) =>
        values.map((value) =>
          value.localId === id ? { ...value, ...patch } : value,
        ),
      ),
    [update],
  );
  const upload = useCallback(
    async (item: Selection) => {
      const operation = key + ":" + item.localId;
      if (
        !current() ||
        item.busy ||
        !item.file ||
        inFlight.current.has(operation)
      )
        return;
      inFlight.current.add(operation);
      change(item.localId, { busy: true, error: null });
      let view = item.view;
      try {
        const checksum =
          item.checksum ??
          Array.from(
            new Uint8Array(
              await crypto.subtle.digest(
                "SHA-256",
                await item.file.arrayBuffer(),
              ),
            ),
            (value) => value.toString(16).padStart(2, "0"),
          ).join("");
        if (!current()) return;
        change(item.localId, { checksum });
        const result = view
          ? await attachmentStatusAction(
              { ...scope, id: view.id, revision: view.revision },
              actorSubject,
            )
          : await stageAttachmentAction(
              {
                ...scope,
                requestId: item.requestId,
                bytes: item.file.size,
                contentType: item.file.type,
                checksum,
              },
              actorSubject,
            );
        if (!current()) return;
        if (!result.ok || result.subject !== actorSubject)
          throw Error(result.ok ? "FORBIDDEN" : result.code);
        view = result.data;
        change(item.localId, { view });
        if (view.retryable) {
          const response = await fetch(
            attachmentHref(scope, view.id) + "&revision=" + view.revision,
            {
              method: "PUT",
              headers: {
                "content-type": item.file.type,
                "x-treido-subject": actorSubject,
              },
              body: item.file,
              credentials: "same-origin",
              cache: "no-store",
              signal: AbortSignal.timeout(45000),
            },
          );
          const uploaded = await response.json();
          if (!current()) return;
          if (!uploaded.ok) throw Error(uploaded.code ?? "NOT_AVAILABLE");
          change(item.localId, { view: uploaded.data });
        } else if (view.state === "removed") throw Error("INVALID_INPUT");
      } catch (error) {
        change(item.localId, {
          error:
            error instanceof Error && /^[A-Z_]+$/.test(error.message)
              ? error.message
              : "NOT_AVAILABLE",
        });
      } finally {
        inFlight.current.delete(operation);
        change(item.localId, { busy: false });
      }
    },
    [current, key, change, scope, actorSubject],
  );
  const add = useCallback(
    (files: FileList | null) => {
      if (!current() || !files) return;
      const room = L.perMessage - itemsRef.current.length;
      const added: Selection[] = Array.from(files)
        .slice(0, Math.max(0, room))
        .map((file) => ({
          localId: crypto.randomUUID(),
          requestId: crypto.randomUUID(),
          file,
          checksum: null,
          view: null,
          busy: false,
          error:
            ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
            file.size > 0 &&
            file.size <= L.bytes
              ? null
              : "INVALID_INPUT",
        }));
      itemsRef.current = [...itemsRef.current, ...added].slice(0, L.perMessage);
      update((values) => [...values, ...added].slice(0, L.perMessage));
      for (const item of added) if (!item.error) void upload(item);
    },
    [current, update, upload],
  );
  const remove = useCallback(
    async (item: Selection) => {
      if (!current() || item.busy) return;
      if (!item.view) {
        update((values) =>
          values.filter((value) => value.localId !== item.localId),
        );
        return;
      }
      change(item.localId, { busy: true, error: null });
      try {
        const status = await attachmentStatusAction(
          { ...scope, id: item.view.id, revision: item.view.revision },
          actorSubject,
        );
        if (!current()) return;
        if (!status.ok || status.subject !== actorSubject)
          throw Error("NOT_AVAILABLE");
        const result = await removeAttachmentAction(
          { ...scope, id: status.data.id, revision: status.data.revision },
          actorSubject,
        );
        if (!current()) return;
        if (!result.ok || result.subject !== actorSubject)
          throw Error("NOT_AVAILABLE");
        update((values) =>
          values.filter((value) => value.localId !== item.localId),
        );
      } catch {
        change(item.localId, { busy: false, error: "NOT_AVAILABLE" });
      }
    },
    [current, update, change, scope, actorSubject],
  );
  const recover = useCallback(
    (ids: string[]) =>
      update((values) => {
        const missing = ids.filter(
          (id) => !values.some((value) => value.view?.id === id),
        );
        return missing.length
          ? [
              ...values,
              ...missing.map((id) => ({
                localId: id,
                requestId: id,
                checksum: null,
                view: {
                  id,
                  revision: 1,
                  state: "processing" as const,
                  retryable: false,
                  width: null,
                  height: null,
                },
                busy: false,
                error: null,
              })),
            ].slice(0, L.perMessage)
          : values;
      }),
    [update],
  );
  const clear = useCallback(() => {
    if (current()) {
      itemsRef.current = [];
      update((values) => (values.length ? [] : values));
    }
  }, [current, update]);
  useEffect(() => {
    let cancelled = false,
      polling = false;
    const poll = async () => {
      if (!current() || polling) return;
      polling = true;
      try {
        for (const item of itemsRef.current) {
          if (
            !item.view ||
            item.busy ||
            item.view.state === "ready" ||
            item.view.state === "removed"
          )
            continue;
          const result = await attachmentStatusAction(
            { ...scope, id: item.view.id, revision: item.view.revision },
            actorSubject,
          ).catch(() => null);
          if (cancelled || !current()) return;
          if (result?.ok && result.subject === actorSubject)
            change(item.localId, {
              view: result.data,
              error:
                result.data.state === "removed"
                  ? "INVALID_INPUT"
                  : result.data.retryable
                    ? "NOT_AVAILABLE"
                    : null,
            });
          else
            change(item.localId, {
              error: result && !result.ok ? result.code : "NOT_AVAILABLE",
            });
        }
      } finally {
        polling = false;
      }
    };
    const timer = setInterval(() => void poll(), 3000);
    void poll();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [current, change, scope, actorSubject]);
  return {
    items,
    add,
    upload,
    remove,
    recover,
    clear,
    ids: items.flatMap((item) =>
      item.view?.state === "ready" ? [item.view.id] : [],
    ),
    ready:
      sameActor &&
      items.every(
        (item) => !item.busy && !item.error && item.view?.state === "ready",
      ),
  };
}
