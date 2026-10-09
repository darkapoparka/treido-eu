import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({ users: { getUser: state.get } }),
}));
import { readNotificationRecipient } from "./recipient.server";
beforeEach(() => state.get.mockReset());
const subject = "user_synthetic_notification";
const user = () => ({
  id: subject,
  banned: false,
  locked: false,
  primaryEmailAddressId: "primary",
  emailAddresses: [
    {
      id: "other",
      emailAddress: "other@example.test",
      verification: { status: "verified" },
    },
    {
      id: "primary",
      emailAddress: "PRIMARY@example.test",
      verification: { status: "verified" },
    },
  ],
});
describe("current verified notification recipient", () => {
  it("uses only the current verified primary email", async () => {
    state.get.mockResolvedValue(user());
    expect(await readNotificationRecipient(subject)).toBe(
      "primary@example.test",
    );
    expect(state.get).toHaveBeenCalledWith(subject);
  });
  it("does not substitute another verified address for an unverified primary", async () => {
    const current = user();
    current.emailAddresses[1].verification.status = "unverified";
    state.get.mockResolvedValue(current);
    expect(await readNotificationRecipient(subject)).toBeNull();
  });
  it("does not substitute another verified address for a missing primary", async () => {
    state.get.mockResolvedValue({ ...user(), primaryEmailAddressId: null });
    expect(await readNotificationRecipient(subject)).toBeNull();
  });
  it.each(["banned", "locked"])(
    "denies a currently %s provider account",
    async (key) => {
      state.get.mockResolvedValue({ ...user(), [key]: true });
      await expect(readNotificationRecipient(subject)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    },
  );
  it("keeps provider failures unavailable and does not reuse previous recipient facts", async () => {
    state.get
      .mockResolvedValueOnce(user())
      .mockRejectedValueOnce(Error("Synthetic unavailable"));
    expect(await readNotificationRecipient(subject)).toBe(
      "primary@example.test",
    );
    await expect(readNotificationRecipient(subject)).rejects.toMatchObject({
      code: "NOT_AVAILABLE",
    });
  });
});
