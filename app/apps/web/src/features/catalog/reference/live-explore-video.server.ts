import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// Bounded, silent decorative fields recorded from emulator-5560. The private
// source recordings and derived clips are not repository or release assets.
// Bedroom is intentionally absent: its inherited 110-byte WebM has no frames.
const clips: Record<string, { file: string; sha256: string }> = {
  "live-cozy-film-living": {
    file: "live-cozy-film-living.webm",
    sha256: "b6e9971890412deccdbae4c4ab2cda8d6695430ddb1e20825746ea8607ed238f",
  },
  "live-cozy-film-corner": {
    file: "live-cozy-film-corner.webm",
    sha256: "82e8c1a01d46f46aa831a0bd299dad21bc74f3a5ff67f205f011323868b94d7d",
  },
};
const pending = new Map<string, Promise<Buffer>>();
export function readLiveExploreVideo(key: string): Promise<Buffer> | null {
  if (!Object.hasOwn(clips, key)) return null;
  const cached = pending.get(key);
  if (cached) return cached;
  const clip = clips[key];
  const job = readFile(
    resolve(
      process.cwd(),
      "../../.local/shop-reference/live/android-explore-20260926",
      clip.file,
    ),
  ).then((bytes) => {
    if (createHash("sha256").update(bytes).digest("hex") !== clip.sha256)
      throw new Error("Live decorative video checksum mismatch");
    return bytes;
  });
  pending.set(key, job);
  void job.catch(() => pending.delete(key));
  return job;
}
