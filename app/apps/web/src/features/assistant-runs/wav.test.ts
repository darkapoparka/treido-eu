import { expect, it } from "vitest";
import { encodeInputWav } from "./wav";
it("encodes only PCM16 header/data with correct byte count and clips finite samples", () => {
  const buffer = Buffer.from(
    encodeInputWav([new Float32Array([-2, 0, 2])], 16000, 1),
  );
  expect(buffer.length).toBe(50);
  expect(buffer.toString("ascii", 0, 4)).toBe("RIFF");
  expect(buffer.readUInt32LE(4)).toBe(42);
  expect(buffer.toString("ascii", 36, 40)).toBe("data");
  expect(buffer.readUInt32LE(40)).toBe(6);
  expect(buffer.readInt16LE(44)).toBe(-32768);
  expect(buffer.readInt16LE(48)).toBe(32767);
});
it("refuses empty/nonfinite/unsupported-rate/overduration audio rather than relabeling it", () => {
  for (const [chunks, rate, max] of [
    [[], 16000, 1],
    [[new Float32Array([NaN])], 16000, 1],
    [[new Float32Array([1])], 22050, 1],
    [[new Float32Array(16001)], 16000, 1],
    [[new Float32Array([1])], 16000, 61],
  ] as [Float32Array[], number, number][])
    expect(() => encodeInputWav(chunks, rate, max)).toThrow(
      "Invalid recording",
    );
});
