import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { actualPhotoContentType, validateCanonicalWav } from "./media.server";
import { encodeInputWav } from "./wav";
it("voice accepts exact actual PCM header/data and rejects chunks, sizes, formats and excessive duration", () => {
  const wav = Buffer.from(encodeInputWav([new Float32Array(16000)], 16000, 1));
  expect(validateCanonicalWav(wav, 1)).toMatchObject({ duration: 1 });
  const withMetadata = Buffer.concat([wav, Buffer.from("LISTprivate")]);
  withMetadata.writeUInt32LE(withMetadata.length - 8, 4);
  const wrongAlign = Buffer.from(wav);
  wrongAlign.writeUInt16LE(4, 32);
  const wrongRate = Buffer.from(wav);
  wrongRate.writeUInt32LE(0, 24);
  for (const bytes of [
    withMetadata,
    wrongAlign,
    wrongRate,
    Buffer.from("Typed text mislabeled audio"),
  ])
    expect(() => validateCanonicalWav(bytes, 1)).toThrow("INVALID_INPUT");
  expect(() => validateCanonicalWav(wav, 0)).toThrow("INVALID_INPUT");
});
it("claimed image type must match actual signature before original Sharp validation", () => {
  expect(
    actualPhotoContentType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  ).toBe("image/png");
  expect(actualPhotoContentType(Buffer.from([255, 216, 255]))).toBe(
    "image/jpeg",
  );
  expect(actualPhotoContentType(Buffer.from("RIFF0000WEBP"))).toBe(
    "image/webp",
  );
  for (const data of ["<svg></svg>", "data:image/png;base64,AAAA", ""])
    expect(() => actualPhotoContentType(Buffer.from(data))).toThrow(
      "INVALID_INPUT",
    );
});
