import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import type {
  DeclarationReviewAcknowledgement,
  DeclarationReviewView,
  ReviewDeclarationInput,
} from "../../apps/web/src/features/seller-declarations/model";

type Subject = "operator-A" | "operator-B";
type Kind = "read" | "write";
type Failure = "NOT_AVAILABLE" | "FORBIDDEN" | "CONFLICT";
type Pending = {
  id: number;
  kind: Kind;
  subject: string | null;
  binding: Subject;
  args: {
    actorKey: string;
    declarationId?: string;
    input?: ReviewDeclarationInput;
  };
  done: boolean;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};
const params = new URLSearchParams(window.location.search);
const listeners = new Set<() => void>();
const pending: Pending[] = [];
const receipts = new Map<
  string,
  { input: string; data: DeclarationReviewAcknowledgement }
>();
const decided = new Map<Subject, DeclarationReviewAcknowledgement>();
let sequence = 0;
let state = {
  subject: "operator-A" as Subject | null,
  loaded: true,
  binding: "operator-A" as Subject,
  language: (params.get("lang") === "bg" ? "bg" : "en") as "bg" | "en",
  long: params.get("long") === "1",
  readMode: params.get("auto") === "0" ? "deferred" : "automatic",
  failSessionStorage: false,
  failLocalStorage: false,
  setupRevision: 1,
  reviewAllowed: true,
  remount: 0,
  version: 0,
  committed: 0,
  refreshes: 0,
};
function notify(patch: Partial<typeof state> = {}) {
  state = { ...state, ...patch, version: state.version + 1 };
  flushSync(() => listeners.forEach((listener) => listener()));
}
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const snapshot = () => state;
export function useFixtureState() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
export const syntheticClerk = {
  get user() {
    return state.loaded && state.subject ? { id: state.subject } : null;
  },
};
export function useSyntheticUser() {
  const current = useFixtureState();
  return { isLoaded: current.loaded, user: syntheticClerk.user };
}
export function actorKey(subject: Subject) {
  return (subject === "operator-A" ? "a" : "b").repeat(64);
}
function fixtureId(subject: Subject, part: number) {
  return `${subject === "operator-A" ? "a" : "b"}0000000-0000-4000-8000-${String(part).padStart(12, "0")}`;
}
export function viewFor(
  subject: Subject,
  stale = false,
): DeclarationReviewView {
  const receipt = decided.get(subject);
  const marker = subject + "-PRIVATE-";
  return {
    id: fixtureId(subject, 2),
    sellerId: fixtureId(subject, 1),
    sellerName: (
      marker +
      (state.long ? "Дълго тестово наименование ".repeat(8) : "test business")
    ).slice(0, 80),
    revision: 1,
    setupRevision: Math.max(state.setupRevision, receipt?.revision ?? 0),
    requirementVersion: 1,
    status: "review_required",
    facts: {
      country: "BG",
      legalName: (
        marker +
        (state.long ? "Юридическо наименование ".repeat(10) : "legal name")
      ).slice(0, 160),
      registrationNumber: (
        marker + (state.long ? "12345".repeat(8) : "12345")
      ).slice(0, 40),
      contactEmail:
        marker.toLowerCase() +
        (state.long ? "m".repeat(220) : "controlled") +
        "@example.invalid",
      contactAddress: (
        marker +
        (state.long
          ? "Синтетичен адрес без реални лични данни ".repeat(20)
          : "controlled test address")
      ).slice(0, 500),
      accurate: true,
    },
    submittedAt: "2026-10-08T03:00:00.000Z",
    currentDeclarationId:
      receipt?.reviewedDeclarationId ?? fixtureId(subject, stale ? 3 : 2),
    isCurrent: !receipt && !stale,
    canReview: state.reviewAllowed && !receipt && !stale,
    history: receipt
      ? [{ ...receipt, reason: "SYNTHETIC recorded reason" }]
      : [],
  };
}
function commit(request: Pending) {
  if (!request.args.input) throw Error("Fixture write has no input");
  const input = request.args.input;
  const key = request.subject + ":" + input.requestId;
  const encoded = JSON.stringify(input);
  const existing = receipts.get(key);
  if (existing) {
    if (existing.input !== encoded) return { ok: false, code: "CONFLICT" };
    return { ok: true, data: existing.data };
  }
  const data: DeclarationReviewAcknowledgement = {
    id: fixtureId(request.binding, 4),
    sourceDeclarationId: input.declarationId,
    reviewedDeclarationId: fixtureId(request.binding, 3),
    revision: input.expectedSetupRevision + 1,
    decision: input.decision,
    reviewedAt: "2026-10-08T03:01:00.000Z",
  };
  receipts.set(key, { input: encoded, data });
  decided.set(request.binding, data);
  notify({ committed: state.committed + 1 });
  storageSet.call(
    window.sessionStorage,
    "synthetic-declaration-fixture-model",
    JSON.stringify({
      receipts: [...receipts],
      decided: [...decided],
      committed: state.committed,
    }),
  );
  return { ok: true, data };
}
function request(kind: Kind, args: Pending["args"]) {
  return new Promise((resolve, reject) => {
    const call: Pending = {
      id: ++sequence,
      kind,
      args: structuredClone(args),
      subject: state.subject,
      binding: state.binding,
      resolve,
      reject,
      done: false,
    };
    pending.push(call);
    queueMicrotask(() => {
      notify();
      if (kind === "read" && state.readMode === "automatic")
        fixture.settle(call.id, "success");
    });
  });
}
const storageSet = Storage.prototype.setItem;
const storageGet = Storage.prototype.getItem;
const storageRemove = Storage.prototype.removeItem;
function storageDenied(storage: Storage) {
  return (
    (storage === window.sessionStorage && state.failSessionStorage) ||
    (storage === window.localStorage && state.failLocalStorage)
  );
}
Storage.prototype.setItem = function (key, value) {
  if (storageDenied(this))
    throw new DOMException(
      "SYNTHETIC storage write denied",
      "QuotaExceededError",
    );
  storageSet.call(this, key, value);
};
Storage.prototype.getItem = function (key) {
  if (storageDenied(this))
    throw new DOMException("SYNTHETIC storage read denied", "SecurityError");
  return storageGet.call(this, key);
};
Storage.prototype.removeItem = function (key) {
  if (storageDenied(this))
    throw new DOMException("SYNTHETIC storage removal denied", "SecurityError");
  storageRemove.call(this, key);
};
export const fixture = {
  snapshot,
  viewFor,
  actorKey,
  requests: () =>
    pending.map(({ id, kind, subject, binding, args, done }) => ({
      id,
      kind,
      subject,
      binding,
      args,
      done,
    })),
  read: (args: Pending["args"]) => request("read", args),
  write: (args: Pending["args"]) => request("write", args),
  setAuth(subject: Subject | null, loaded = true) {
    notify({ subject, loaded });
  },
  open(subject: Subject) {
    notify({
      subject,
      binding: subject,
      loaded: true,
      remount: state.remount + 1,
    });
  },
  configure(
    patch: Partial<
      Pick<
        typeof state,
        | "language"
        | "long"
        | "readMode"
        | "failSessionStorage"
        | "failLocalStorage"
        | "reviewAllowed"
      >
    >,
  ) {
    notify({
      ...patch,
      ...("long" in patch || "reviewAllowed" in patch
        ? { remount: state.remount + 1 }
        : {}),
    });
  },
  remount() {
    notify({ remount: state.remount + 1 });
  },
  changeSetup() {
    notify({
      setupRevision:
        Math.max(
          state.setupRevision,
          decided.get(state.binding)?.revision ?? 0,
        ) + 1,
    });
  },
  refresh() {
    notify({ refreshes: state.refreshes + 1 });
  },
  settle(
    id: number,
    outcome:
      | "success"
      | Failure
      | "transport-failed"
      | "committed-unconfirmed"
      | "stale",
  ) {
    const call = pending.find((item) => item.id === id && !item.done);
    if (!call) throw Error("Missing SYNTHETIC request " + id);
    call.done = true;
    if (outcome === "transport-failed" || outcome === "committed-unconfirmed") {
      if (outcome === "committed-unconfirmed") commit(call);
      call.reject(Error("SYNTHETIC deferred transport failed"));
    } else if (["NOT_AVAILABLE", "FORBIDDEN", "CONFLICT"].includes(outcome)) {
      call.resolve({ ok: false, code: outcome });
    } else if (call.kind === "read") {
      call.resolve({
        ok: true,
        data: viewFor(call.binding, outcome === "stale"),
      });
    } else {
      call.resolve(commit(call));
    }
    notify();
  },
  corruptRecovery() {
    const key =
      "treido-contact-v1:treido-declaration-review:" +
      actorKey(state.binding) +
      ":" +
      fixtureId(state.binding, 2);
    storageSet.call(window.sessionStorage, key, '{"forged":true}');
    window.dispatchEvent(
      new StorageEvent("storage", { key, storageArea: window.sessionStorage }),
    );
    notify({ remount: state.remount + 1 });
  },
};
try {
  const saved = storageGet.call(
    window.sessionStorage,
    "synthetic-declaration-fixture-model",
  );
  if (saved && saved.length <= 50000) {
    const model = JSON.parse(saved);
    if (
      Array.isArray(model.receipts) &&
      Array.isArray(model.decided) &&
      Number.isSafeInteger(model.committed)
    ) {
      for (const [key, value] of model.receipts) receipts.set(key, value);
      for (const [key, value] of model.decided) decided.set(key, value);
      state = { ...state, committed: model.committed };
    }
  }
} catch {
  // The fixture model can start empty. This is never a production fallback.
}
declare global {
  interface Window {
    __declarationFixture: typeof fixture;
  }
}
window.__declarationFixture = fixture;
