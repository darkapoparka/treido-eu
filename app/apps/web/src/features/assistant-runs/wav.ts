/** Exact PCM16 RIFF header plus data; no ancillary metadata or codec dependency. */
export function encodeInputWav(
  chunks: Float32Array[],
  rate: number,
  maximumSeconds: number,
): ArrayBuffer {
  const count = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  if (
    ![16000, 24000, 44100, 48000].includes(rate) ||
    !Number.isInteger(maximumSeconds) ||
    maximumSeconds < 1 ||
    maximumSeconds > 60 ||
    count < 1 ||
    count > rate * maximumSeconds
  )
    throw new Error("Invalid recording.");
  const buffer = new ArrayBuffer(44 + count * 2),
    view = new DataView(buffer),
    write = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i++)
        view.setUint8(offset + i, value.charCodeAt(i));
    };
  write(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, count * 2, true);
  let offset = 44;
  for (const chunk of chunks)
    for (const sample of chunk) {
      if (!Number.isFinite(sample)) throw new Error("Invalid recording.");
      const clipped = Math.min(1, Math.max(-1, sample));
      view.setInt16(
        offset,
        Math.round(clipped * (clipped < 0 ? 32768 : 32767)),
        true,
      );
      offset += 2;
    }
  return buffer;
}
