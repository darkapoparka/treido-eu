import "server-only";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

let tirePhoto: Promise<Buffer> | undefined;
let orderBrandMark: Promise<Buffer> | undefined;
const parcelPhotos = new Map<string, Promise<Buffer>>();

async function isolateEventParcel(input: Buffer) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const seen = new Uint8Array(info.width * info.height);
  const queue: number[] = [];
  const visit = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= info.width || y >= info.height) return;
    const pixel = y * info.width + x;
    if (seen[pixel]) return;
    seen[pixel] = 1;
    const offset = pixel * 4;
    const channels = [data[offset], data[offset + 1], data[offset + 2]];
    if (
      Math.min(...channels) < 239 ||
      Math.max(...channels) - Math.min(...channels) > 8
    )
      return;
    data[offset + 3] = 0;
    queue.push(pixel);
  };
  // Remove only the edge-connected tile matte. The white package label is
  // enclosed by the parcel, so it remains intact (unlike a global color key).
  for (let x = 0; x < info.width; x++) {
    visit(x, 0);
    visit(x, info.height - 1);
  }
  for (let y = 0; y < info.height; y++) {
    visit(0, y);
    visit(info.width - 1, y);
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const x = queue[cursor] % info.width,
      y = Math.floor(queue[cursor] / info.width);
    visit(x - 1, y);
    visit(x + 1, y);
    visit(x, y - 1);
    visit(x, y + 1);
  }
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .webp({ lossless: true })
    .toBuffer();
}

function readOrderBrandMark() {
  if (!orderBrandMark) {
    orderBrandMark = (async () => {
      // Extract the actual brand ink from the inherited package photograph,
      // not a screenshot of the native order header or its controls.
      const input = await readFile(
        resolve(
          process.cwd(),
          "../../reference-assets/shop/products/order-hero.png",
        ),
      );
      const { data, info } = await sharp(input)
        .extract({ left: 182, top: 264, width: 360, height: 93 })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const rgba = Buffer.alloc(info.width * info.height * 4);
      for (let i = 0, j = 0; i < data.length; i += info.channels, j += 4) {
        const luma =
          0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        rgba[j] = rgba[j + 1] = rgba[j + 2] = 255;
        rgba[j + 3] = Math.round(
          Math.min(1, Math.max(0, (160 - luma) / 90)) * 255,
        );
      }
      return sharp(rgba, {
        raw: { width: info.width, height: info.height, channels: 4 },
      })
        .webp({ lossless: true })
        .toBuffer();
    })();
    void orderBrandMark.catch(() => {
      orderBrandMark = undefined;
    });
  }
  return orderBrandMark;
}

const trackingMapFiles: Record<string, string> = {
  "order-tracking-map-transit": "008.webp",
  "order-tracking-map-delivered": "009.webp",
};
const trackingMaps = new Map<string, Promise<Buffer>>();

function readTrackingMap(key: string, file: string) {
  if (!trackingMaps.has(key)) {
    const job = (async () => {
      const input = await readFile(
        resolve(
          process.cwd(),
          "../../references/shop/flows/d3bf7c94-4d9e-4298-a255-eaf177f9efd1",
          file,
        ),
      );
      const metadata = await sharp(input).metadata();
      if (!metadata.width) throw new Error("Tracking map has no dimensions");
      const scale = metadata.width / 393;
      const width = Math.round(393 * scale);
      const height = Math.round(250 * scale);
      const crop = await sharp(input)
        .extract({ left: 0, top: Math.round(59 * scale), width, height })
        .ensureAlpha()
        .png()
        .toBuffer();
      // Keep only visible geography. The two source states have different
      // maps, and neither reveals streets behind its native card/pin/panel.
      // Transparent gaps remain unknown; React supplies every overlay.
      const nativeInterface =
        Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 393 250">
        <rect x="140" y="51" width="113" height="112" rx="25" fill="white"/>
        <path d="M182 151H212L196.67 171Z" fill="white"/>
        <circle cx="196.67" cy="180.5" r="15" fill="white"/>
        ${key === "order-tracking-map-delivered" ? '<path d="M244 0L228.5 59M203.5 154L196.67 180.5" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round"/>' : ""}
        <rect x="0" y="222" width="393" height="400" rx="28" fill="white"/>
      </svg>`);
      return sharp(crop)
        .composite([{ input: nativeInterface, blend: "dest-out" }])
        .webp({ quality: 95 })
        .toBuffer();
    })();
    trackingMaps.set(key, job);
    void job.catch(() => trackingMaps.delete(key));
  }
  return trackingMaps.get(key)!;
}

function readParcelPhoto(kind: "manual" | "event") {
  if (!parcelPhotos.has(kind)) {
    const job = (async () => {
      // Flow 68 exposes the complete package photograph at 72 CSS pixels.
      // Extract only that photographic tile; every card, label and control
      // surrounding it remains live React/CSS.
      const input = await readFile(
        resolve(
          process.cwd(),
          "../../references/shop/flows/bdd3954f-d943-464a-8c57-6621ffba7fa6/006.webp",
        ),
      );
      const metadata = await sharp(input).metadata();
      if (!metadata.width)
        throw new Error("Manual parcel photograph has no width");
      const scale = metadata.width / 393;
      // The event variant keeps just the complete parcel and its shadow, not
      // the surrounding gray tile. Its source contains no navigation/ring ink.
      const [left, top, width, height] =
        kind === "event" ? [292, 154, 66, 46] : [289, 137, 72, 72];
      const crop = sharp(input).extract({
        left: Math.round(left * scale),
        top: Math.round(top * scale),
        width: Math.round(width * scale),
        height: Math.round(height * scale),
      });
      return kind === "event"
        ? isolateEventParcel(await crop.png().toBuffer())
        : crop.webp({ quality: 95 }).toBuffer();
    })();
    parcelPhotos.set(kind, job);
    void job.catch(() => parcelPhotos.delete(kind));
  }
  return parcelPhotos.get(kind)!;
}

// The same photograph appears twice. f063-002 shows its full lower edge above
// the dock. Replace only its three confetti-covered patches with the clear,
// identically aligned photograph in f061-006. No hidden pixels are generated.
export function readOrderMedia(key: string): Promise<Buffer> | undefined {
  if (key === "order-brand-mark") return readOrderBrandMark();
  if (key === "order-manual-parcel") return readParcelPhoto("manual");
  if (key === "order-event-parcel") return readParcelPhoto("event");
  if (Object.hasOwn(trackingMapFiles, key))
    return readTrackingMap(key, trackingMapFiles[key]);
  if (key !== "order-tire-trim-photo") return undefined;
  if (!tirePhoto) {
    tirePhoto = (async () => {
      const files = [
        "d3bf7c94-4d9e-4298-a255-eaf177f9efd1/006.webp",
        "e6c06e9f-26c9-476e-a3e5-d34c968eaa3d/002.webp",
      ];
      const inputs = await Promise.all(
        files.map((file) =>
          readFile(resolve(process.cwd(), "../../references/shop/flows", file)),
        ),
      );
      const metadata = await Promise.all(
        inputs.map((input) => sharp(input).metadata()),
      );
      if (!metadata[0].width || !metadata[1].width)
        throw new Error("Order photograph has no dimensions");
      const scale = metadata[1].width / 393;
      const clearScale = metadata[0].width / 393;
      const photoWidth = Math.round(171 * scale);
      const photoHeight = Math.round(171 * scale);
      const photo = await sharp(inputs[1])
        .extract({
          left: Math.round(17 * scale),
          top: Math.round(458 * scale),
          width: photoWidth,
          height: photoHeight,
        })
        .ensureAlpha()
        .png()
        .toBuffer();
      const fragments = await Promise.all(
        [
          [71, 0, 30, 10],
          [123, 0, 48, 17],
          [38, 63, 24, 24],
        ].map(async ([x, y, width, height]) => ({
          left: Math.round(x * scale),
          top: Math.round(y * scale),
          input: await sharp(inputs[0])
            .extract({
              left: Math.round((17 + x) * clearScale),
              top: Math.round((603 + y) * clearScale),
              width: Math.round(width * clearScale),
              height: Math.round(height * clearScale),
            })
            .resize(Math.round(width * scale), Math.round(height * scale), {
              fit: "fill",
            })
            .png()
            .toBuffer(),
        })),
      );
      const joined = await sharp(photo).composite(fragments).png().toBuffer();
      const interfaceMask = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${photoWidth}" height="${photoHeight}"><rect x="${10 * scale}" y="${10 * scale}" width="${57 * scale}" height="${19 * scale}" fill="white"/><circle cx="${143 * scale}" cy="${143 * scale}" r="${17 * scale}" fill="white"/></svg>`,
      );
      const photoMask = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${photoWidth}" height="${photoHeight}"><rect width="${photoWidth}" height="${photoHeight}" rx="${21 * scale}" fill="white"/></svg>`,
      );
      return sharp(joined)
        .composite([
          { input: interfaceMask, blend: "dest-out" },
          { input: photoMask, blend: "dest-in" },
        ])
        .webp({ quality: 95 })
        .toBuffer();
    })();
    void tirePhoto.catch(() => {
      tirePhoto = undefined;
    });
  }
  return tirePhoto;
}
