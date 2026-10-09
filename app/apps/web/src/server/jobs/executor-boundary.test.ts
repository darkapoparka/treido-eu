import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { serializeError } from "inngest";
import { createJobExecutor } from "./inngest.server";
import type { JobBindings } from "./bindings";

const sdk = vi.hoisted(() => ({
  functions: [] as {
    options: Record<string, unknown>;
    run: (input: unknown) => Promise<unknown>;
  }[],
}));
vi.mock("server-only", () => ({}));
vi.mock("inngest/next", () => ({ serve: vi.fn(() => ({})) }));
vi.mock("inngest", async (load) => {
  const actual = await load<typeof import("inngest")>();
  return {
    ...actual,
    Inngest: class {
      createFunction(
        options: Record<string, unknown>,
        run: (input: unknown) => Promise<unknown>,
      ) {
        sdk.functions.push({ options, run });
        return {};
      }
    },
  };
});
vi.mock("./health.server", () => ({ observeJobHealth: vi.fn() }));
vi.mock("../media/storage.server", () => ({ requireMediaStorage: () => ({}) }));
vi.mock("./repair-due.server", () => ({
  withRepairDueCheckpoint: async (
    checkpoint: (operation: () => Promise<unknown>) => Promise<unknown>,
    _database: unknown,
    repair: () => Promise<unknown>,
  ) => {
    await checkpoint(async () => {
      throw Error("private-sentinel");
    });
    return repair();
  },
}));

beforeEach(() => {
  sdk.functions.length = 0;
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

it("sanitizes every original repair step before SDK error serialization without changing step identities or ordering", async () => {
  const database = vi.fn(() => {
    throw Object.assign(new Error("private-sentinel"), {
      code: "private-sentinel",
      cause: Error("private-sentinel"),
    });
  });
  createJobExecutor({} as JobBindings, {}, database);
  const repair = sdk.functions.find(
    (fn) => fn.options.id === "outbox-repair-v1",
  )!;
  expect(repair.options).toMatchObject({
    retries: 2,
    concurrency: { limit: 1 },
    triggers: { cron: "* * * * *" },
  });
  const steps: { id: string; operation: () => Promise<unknown> }[] = [];
  await repair.run({
    event: {},
    step: {
      run: async (id: string, operation: () => Promise<unknown>) => {
        steps.push({ id, operation });
      },
    },
  });
  expect(steps.map(({ id }) => id)).toEqual([
    "repair-due-work-v1",
    "schedule-seller-billing-observation-v1",
    "schedule-promotion-observation-v1",
    "schedule-order-refund-observation-v2",
    "schedule-payment-observation-v1",
    "schedule-buyer-search-matches-v1",
    "schedule-current-notification-mail-v1",
    "schedule-owned-assistant-maintenance-v1",
    "schedule-accepted-account-closure-v1",
    "schedule-original-shipping-retention-v1",
    "lease-and-handoff-v1",
    "expire-inventory-reservations-v1",
    "expire-negotiated-offers-v1",
    "expire-private-csv-uploads-v1",
    "reconcile-invitation-mail-v1",
    "cleanup-private-message-images-v1",
    "reconcile-known-notification-mail-v1",
    "expire-business-invitations-v1",
    "cleanup-registered-photo-objects-v1",
  ]);
  for (const { operation } of steps) {
    let recorded: unknown;
    try {
      await operation();
    } catch (error) {
      recorded = serializeError(error);
    }
    expect(recorded).toMatchObject({
      name: "Error",
      message:
        "Treido repair effect is unavailable; retry with the same identity.",
    });
    expect(recorded).not.toHaveProperty("code");
    expect(recorded).not.toHaveProperty("cause");
    expect(JSON.stringify(recorded)).not.toContain("private-sentinel");
  }
});
