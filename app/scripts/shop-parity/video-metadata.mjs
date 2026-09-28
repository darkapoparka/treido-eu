// Read only the MP4 container's declared video dimensions and sample timing.
// This does not decode or execute inherited media.
export function readVideoMetadata(bytes) {
  function atoms(start, end) {
    const result = [];
    for (let offset = start; offset + 8 <= end;) {
      const size = bytes.readUInt32BE(offset);
      if (size < 8 || offset + size > end) throw new Error("Invalid MP4 atom");
      result.push({
        type: bytes.toString("ascii", offset + 4, offset + 8),
        start: offset + 8,
        end: offset + size,
      });
      offset += size;
    }
    return result;
  }
  const child = (parent, type) =>
    atoms(parent.start, parent.end).find((atom) => atom.type === type);
  const moov = child({ start: 0, end: bytes.length }, "moov");
  if (!moov) throw new Error("MP4 has no movie metadata");
  for (const track of atoms(moov.start, moov.end).filter(
    (atom) => atom.type === "trak",
  )) {
    const mdia = child(track, "mdia");
    const handler = mdia && child(mdia, "hdlr");
    if (
      !handler ||
      bytes.toString("ascii", handler.start + 8, handler.start + 12) !== "vide"
    )
      continue;
    const header = child(track, "tkhd");
    const timing = child(mdia, "mdhd");
    const minf = child(mdia, "minf");
    const samples = minf && child(minf, "stbl");
    const stts = samples && child(samples, "stts");
    if (!header || !timing || !stts || bytes[timing.start] !== 0)
      throw new Error("Unsupported MP4 metadata");
    let frames = 0;
    for (let index = 0; index < bytes.readUInt32BE(stts.start + 4); index += 1)
      frames += bytes.readUInt32BE(stts.start + 8 + index * 8);
    return {
      width: bytes.readUInt32BE(header.end - 8) / 65536,
      height: bytes.readUInt32BE(header.end - 4) / 65536,
      durationSeconds:
        bytes.readUInt32BE(timing.start + 16) /
        bytes.readUInt32BE(timing.start + 12),
      frames,
    };
  }
  throw new Error("MP4 has no video track");
}

export function decorativeVideoArguments(source, destination, crop) {
  return [
    "-nostdin",
    "-v",
    "error",
    "-i",
    source,
    "-map",
    "0:v:0",
    "-vf",
    `crop=${crop[2]}:${crop[3]}:${crop[0]}:${crop[1]},setsar=1`,
    "-an",
    "-map_metadata",
    "-1",
    "-c:v",
    "libx264",
    "-crf",
    "14",
    "-threads",
    "1",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    destination,
  ];
}
