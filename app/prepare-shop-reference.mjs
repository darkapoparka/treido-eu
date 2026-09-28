import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import process from "node:process";
import {
  readVideoMetadata,
  decorativeVideoArguments,
} from "./scripts/shop-parity/video-metadata.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const targetRoot = resolve(root, "reference-assets/shop/products");
const reviewRoot = resolve(root, ".qa/shop-parity/media-review");
const { assets } = JSON.parse(
  await readFile(
    resolve(root, "references/shop/product-media-provenance.json"),
    "utf8",
  ),
);
const verifyOnly = process.argv.includes("--verify");
const selected = process.argv
  .find((argument) => argument.startsWith("--only="))
  ?.slice("--only=".length)
  .split(",");
if (selected?.some((id) => !assets.some((asset) => asset.id === id)))
  throw new Error("Unknown reference asset in --only selection");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sharp = createRequire(resolve(root, "apps/web/package.json"))("sharp");
const matches = async (bytes, asset) => {
  if (hash(bytes) === asset.sha256) return true;
  // PNG encoders can differ while preserving every decoded pixel.
  return (
    Boolean(asset.pixelSha256) &&
    hash(await sharp(bytes).ensureAlpha().raw().toBuffer()) ===
      asset.pixelSha256
  );
};
const failures = [];
const reviews = [];

for (const asset of assets) {
  if (selected && !selected.includes(asset.id)) continue;
  try {
    const destination = resolve(root, asset.localFile);
    const child = relative(targetRoot, destination);
    if (!child || child.startsWith("..") || isAbsolute(child))
      throw new Error(`Invalid asset destination: ${asset.id}`);
    let bytes;
    let sourceSha256;
    let prepared = false;
    try {
      bytes = await readFile(destination);
    } catch (error) {
      if (error.code !== "ENOENT" || verifyOnly) throw error;
    }
    if (!bytes) {
      let localSource;
      if (asset.sourceFile) {
        const captureRoot = resolve(root, "references/shop");
        localSource = resolve(root, asset.sourceFile);
        const captureChild = relative(captureRoot, localSource);
        if (
          !captureChild ||
          captureChild.startsWith("..") ||
          isAbsolute(captureChild)
        )
          throw new Error(`Invalid inherited source: ${asset.id}`);
        bytes = await readFile(localSource);
        if (hash(bytes) !== asset.sourceSha256)
          throw new Error(`${asset.id}: inherited video checksum mismatch`);
      } else {
        const url = new URL(asset.sourceUrl);
        if (url.protocol !== "https:" || url.username || url.password)
          throw new Error(`Invalid source: ${asset.id}`);
        const response = await globalThis.fetch(url, {
          signal: globalThis.AbortSignal.timeout(60_000),
        });
        if (!response.ok)
          throw new Error(`${asset.id}: download returned ${response.status}`);
        bytes = Buffer.from(await response.arrayBuffer());
      }
      sourceSha256 = hash(bytes);
      if (
        asset.mediaType === "video/mp4" &&
        sourceSha256 !== asset.sourceSha256
      )
        throw new Error(`${asset.id}: original video checksum mismatch`);
      prepared = true;
      await mkdir(targetRoot, { recursive: true });
      if (asset.mediaType === "video/mp4" && asset.cropPixels) {
        if (!localSource)
          throw new Error(
            "Decorative video requires an inherited local source",
          );
        const candidate = `${destination}.candidate.mp4`;
        try {
          await promisify(execFile)(
            process.env.FFMPEG_PATH || "ffmpeg",
            decorativeVideoArguments(localSource, candidate, asset.cropPixels),
            { windowsHide: true },
          );
          bytes = await readFile(candidate);
        } finally {
          await unlink(candidate).catch((error) => {
            if (error.code !== "ENOENT") throw error;
          });
        }
      }
      if (asset.frameSeconds !== undefined || asset.sourceFrame !== undefined) {
        const video = localSource ?? `${destination}.source.mp4`;
        const frame = `${destination}.frame.png`;
        if (!localSource) await writeFile(video, bytes, { flag: "wx" });
        try {
          await promisify(execFile)(
            process.env.FFMPEG_PATH || "ffmpeg",
            [
              "-nostdin",
              "-v",
              "error",
              ...(asset.sourceFrame === undefined
                ? ["-ss", String(asset.frameSeconds)]
                : []),
              "-i",
              video,
              ...(asset.sourceFrame === undefined
                ? []
                : ["-vf", `select=eq(n\\,${asset.sourceFrame})`]),
              "-frames:v",
              "1",
              frame,
            ],
            { windowsHide: true },
          );
          bytes = await readFile(frame);
        } finally {
          if (!localSource) await unlink(video);
          await unlink(frame).catch((error) => {
            if (error.code !== "ENOENT") throw error;
          });
        }
      }
      if (asset.cropPixels && asset.mediaType !== "video/mp4") {
        const [left, top, width, height] = asset.cropPixels;
        bytes = await sharp(bytes)
          .extract({ left, top, width, height })
          .png()
          .toBuffer();
      }
    }
    if (asset.mediaType === "video/mp4") {
      const metadata = readVideoMetadata(bytes);
      if (hash(bytes) !== asset.sha256)
        throw new Error(
          `${asset.id}: video checksum mismatch; existing files preserved`,
        );
      if (
        metadata.width !== asset.width ||
        metadata.height !== asset.height ||
        metadata.frames !== asset.frames ||
        Math.abs(metadata.durationSeconds - asset.durationSeconds) > 0.001
      )
        throw new Error(`${asset.id}: video dimensions or timing changed`);
      if (prepared) await writeFile(destination, bytes, { flag: "wx" });
      process.stdout.write(`${asset.id}: verified video\n`);
      continue;
    }
    const metadata = await sharp(bytes).metadata();
    if (!(await matches(bytes, asset))) {
      // Failed candidates are inspection evidence, never served as verified assets.
      // Keep only screenshot-sized images, not full-resolution product originals.
      await mkdir(reviewRoot, { recursive: true });
      const review = {
        id: asset.id,
        sourceSha256,
        sha256: hash(bytes),
        pixelSha256: hash(await sharp(bytes).ensureAlpha().raw().toBuffer()),
        expectedSha256: asset.sha256,
        expectedPixelSha256: asset.pixelSha256,
        width: metadata.width,
        height: metadata.height,
      };
      reviews.push(review);
      const name = asset.id.replace(/[^a-z0-9-]/gi, "_");
      await sharp(bytes)
        .resize({
          width: 393,
          height: 480,
          fit: "inside",
          withoutEnlargement: true,
        })
        .png()
        .toFile(resolve(reviewRoot, `${name}.png`));
      process.stderr.write(`${JSON.stringify(review)}\n`);
      throw new Error(
        `${asset.id}: checksum mismatch; candidate retained for inspection only. Existing files were preserved.`,
      );
    }
    if (metadata.width !== asset.width || metadata.height !== asset.height)
      throw new Error(`${asset.id}: dimensions changed`);
    if (prepared) await writeFile(destination, bytes, { flag: "wx" });
    process.stdout.write(`${asset.id}: verified\n`);
  } catch (error) {
    failures.push(`${asset.id}: ${error.message}`);
    process.stderr.write(`${asset.id}: ${error.message}\n`);
  }
}
if (reviews.length) {
  await writeFile(
    resolve(reviewRoot, "report.json"),
    JSON.stringify(
      { commit: process.env.GITHUB_SHA ?? null, reviews },
      null,
      2,
    ),
  );
}
if (failures.length) {
  throw new Error(
    `Reference media preparation failed:\n${failures.join("\n")}`,
  );
}
