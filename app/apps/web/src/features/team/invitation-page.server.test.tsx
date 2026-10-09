import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  recipient: vi.fn(),
  invitations: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../locale/page-locale.server", () => ({
  pageLocale: async () => "en",
}));
vi.mock("../sellers/backend-status.server", () => ({
  backendConfigured: () => true,
}));
vi.mock("../sellers/page-context.server", () => ({
  requirePageIdentity: mocks.identity,
}));
vi.mock("../../server/db/database", () => ({
  getDatabase: () => ({ synthetic: true }),
}));
vi.mock("./recipient.server", () => ({
  readVerifiedRecipient: mocks.recipient,
}));
vi.mock("./persistence.server", () => ({
  readIncomingInvitations: mocks.invitations,
}));
vi.mock("./invitations", () => ({ Invitations: () => null }));
import { InvitationPage } from "./invitation-page.server";
import { SellerError } from "../sellers/errors";
const invitation = {
  id: "10000000-0000-4000-8000-000000000001",
  sellerId: "20000000-0000-4000-8000-000000000002",
  name: "Synthetic invited business",
  role: "member" as const,
  grants: ["seller.read"],
  expiresAt: "2026-12-01T00:00:00.000Z",
  status: "pending" as const,
  canAccept: true,
  canDecline: true,
  canOpen: false,
};
const read = (selectedId?: string) =>
  InvitationPage({ searchParams: Promise.resolve({ lang: "en" }), selectedId });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.identity.mockResolvedValue({ subject: "synthetic-human" });
  mocks.recipient.mockResolvedValue({
    subject: "synthetic-human",
    verifiedEmails: ["synthetic@example.invalid"],
  });
  mocks.invitations.mockResolvedValue([invitation]);
});
describe("actual invitation page island key and current recipient handoff", () => {
  it("preserves the island for an unchanged semantic server projection", async () => {
    const first = await read();
    mocks.invitations.mockResolvedValue([
      { ...invitation, grants: [...invitation.grants] },
    ]);
    const fresh = await read();
    expect(fresh.key).toBe(first.key);
    expect(fresh.props.initial).toEqual([invitation]);
  });
  it("replaces retained invitation state when the same human's current recipient loses the former invitations", async () => {
    const before = await read();
    mocks.invitations.mockResolvedValue([]);
    const after = await read();
    expect(after.key).not.toBe(before.key);
    expect(after.props.actorSubject).toBe(before.props.actorSubject);
    expect(after.props.initial).toEqual([]);
  });
  it("replaces former names, grants and actions when their current server projection changes", async () => {
    const before = await read(invitation.id);
    mocks.invitations.mockResolvedValue([
      {
        ...invitation,
        grants: [],
        status: "declined",
        canAccept: false,
        canDecline: false,
      },
    ]);
    const after = await read(invitation.id);
    expect(after.key).not.toBe(before.key);
    expect(after.props.selectedId).toBe(invitation.id);
    expect(after.props.initial[0].canAccept).toBe(false);
  });
  it("replaces former success with a truthful unavailable projection without exposing provider errors", async () => {
    const before = await read();
    mocks.recipient.mockRejectedValue(
      new Error("private provider diagnostics"),
    );
    const unavailable = await read();
    expect(unavailable.key).not.toBe(before.key);
    expect(unavailable.props.initial).toEqual([]);
    expect(unavailable.props.initialError).toBe("NOT_AVAILABLE");
    expect(unavailable.key).not.toContain("private provider");
  });
  it("retires the island for a changed actor or selected invitation even with identical content", async () => {
    const before = await read();
    const selected = await read(invitation.id);
    expect(selected.key).not.toBe(before.key);
    mocks.identity.mockResolvedValue({ subject: "synthetic-other-human" });
    const other = await read();
    expect(other.key).not.toBe(before.key);
  });
  it("does not keep a prior list when current recipient verification is forbidden", async () => {
    mocks.recipient.mockRejectedValue(new SellerError("FORBIDDEN"));
    const denied = await read();
    expect(denied.props.initial).toEqual([]);
    expect(denied.props.initialError).toBe("FORBIDDEN");
    expect(mocks.invitations).not.toHaveBeenCalled();
  });
});
