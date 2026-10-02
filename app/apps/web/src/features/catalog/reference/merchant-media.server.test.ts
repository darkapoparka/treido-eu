import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const files = vi.hoisted(() => ({ readFile: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile: files.readFile }));
import { readMerchantMedia, readMerchantVideo } from "./merchant-media.server";
import { liveMerchantMedia } from "./live-merchant-media";
import { liveMerchantVideo } from "./live-merchant-video";
afterEach(() => vi.clearAllMocks());

it("rejects arbitrary paths and prototype keys before reading private files", () => {
  for (const key of [
    "../secret",
    "..%2Fsecret",
    "constructor",
    "__proto__",
    "unknown",
  ]) {
    expect(readMerchantMedia(key)).toBeUndefined();
    expect(readMerchantVideo(key)).toBeUndefined();
  }
  expect(files.readFile).not.toHaveBeenCalled();
});

it("rejects changed image bytes and permits a fresh read after failure", async () => {
  const key = Object.keys(liveMerchantMedia)[0];
  files.readFile.mockResolvedValue(Buffer.from("corrupt image bytes"));
  await expect(readMerchantMedia(key)).rejects.toThrow("checksum mismatch");
  await expect(readMerchantMedia(`${key}-3x`)).rejects.toThrow(
    "checksum mismatch",
  );
  expect(files.readFile).toHaveBeenCalledTimes(2);
});

it("rejects changed video bytes instead of returning sample video success", async () => {
  const key = Object.keys(liveMerchantVideo)[0];
  files.readFile.mockResolvedValue(Buffer.from("corrupt video bytes"));
  await expect(readMerchantVideo(key)).rejects.toThrow("checksum mismatch");
});
