import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  clerk: vi.fn(),
  signOut: vi.fn(),
  clear: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  status: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: () => ["ready", mocks.status],
}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: mocks.auth,
  useClerk: mocks.clerk,
}));
vi.mock("./private-recovery", () => ({ clearPrivateBuffers: mocks.clear }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
import { SessionExit } from "./session-exit";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockReturnValue({
    isLoaded: true,
    isSignedIn: true,
    userId: "human-A",
  });
  mocks.clerk.mockReturnValue({
    user: { id: "human-A" },
    session: { id: "session-A" },
    signOut: mocks.signOut,
  });
});

describe("explicit current-session logout", () => {
  it("does not change authentication on render", () => {
    SessionExit({ actorSubject: "human-A", language: "en" });
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
  });
  it("waits for Clerk confirmation before clearing private buffers and navigating", async () => {
    let confirm!: () => void;
    mocks.signOut.mockReturnValue(
      new Promise<void>((resolve) => {
        confirm = resolve;
      }),
    );
    const page = SessionExit({ actorSubject: "human-A", language: "bg" });
    page.props.children[0].props.onClick();
    expect(mocks.signOut).toHaveBeenCalledWith({ sessionId: "session-A" });
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    confirm();
    await vi.waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/?lang=bg"),
    );
    expect(mocks.clear).toHaveBeenCalledWith("human-A");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
  it("does not claim logout or erase recoverable input after a provider failure", async () => {
    mocks.signOut.mockRejectedValue(new Error("Unavailable"));
    const page = SessionExit({ actorSubject: "human-A", language: "en" });
    page.props.children[0].props.onClick();
    await vi.waitFor(() => expect(mocks.status).toHaveBeenCalledWith("failed"));
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("cannot end a different human's active session from a stale page", () => {
    mocks.clerk.mockReturnValue({
      user: { id: "human-B" },
      session: { id: "session-B" },
      signOut: mocks.signOut,
    });
    const page = SessionExit({ actorSubject: "human-A", language: "en" });
    page.props.children[0].props.onClick();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
  });
});
