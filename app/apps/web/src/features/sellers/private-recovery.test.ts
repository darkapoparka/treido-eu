import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPrivateBuffers, registerPrivateBuffer } from "./private-recovery";
const values = new Map<string, string>();
beforeEach(() => {
  values.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());
describe("scoped private buffer recovery", () => {
  const a = `treido-draft:${"a".repeat(64)}`,
    b = `treido-draft:${"b".repeat(64)}`,
    c = `treido-draft:${"c".repeat(64)}`;
  it("revocation clears only registered buffers for that human and seller", () => {
    registerPrivateBuffer("user_one", a, "business-a");
    registerPrivateBuffer("user_one", b, "business-b");
    registerPrivateBuffer("user_two", c, "business-a");
    for (const key of [a, b, c]) values.set(key, "private input");
    values.set("guest-preparation", "guest input");
    clearPrivateBuffers("user_one", "business-a");
    expect(values.has(a)).toBe(false);
    expect(values.get(b)).toBe("private input");
    expect(values.get(c)).toBe("private input");
    expect(values.get("guest-preparation")).toBe("guest input");
  });
  it("logout clears the human's buffers across sellers", () => {
    registerPrivateBuffer("user_one", a, null);
    registerPrivateBuffer("user_one", b, "business-b");
    registerPrivateBuffer("user_two", c, null);
    for (const key of [a, b, c]) values.set(key, "input");
    clearPrivateBuffers("user_one");
    expect(values.has(a)).toBe(false);
    expect(values.has(b)).toBe(false);
    expect(values.has(c)).toBe(true);
  });
  it("ignores corrupted registry entries and storage failures", () => {
    values.set(
      "treido-private-buffers:user_one",
      JSON.stringify([{ key: "unrelated", sellerId: null }]),
    );
    values.set("unrelated", "preserve");
    clearPrivateBuffers("user_one");
    expect(values.get("unrelated")).toBe("preserve");
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("storage denied");
      },
    });
    expect(() => clearPrivateBuffers("user_one")).not.toThrow();
  });
});
