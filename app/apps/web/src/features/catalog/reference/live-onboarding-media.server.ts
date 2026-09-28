import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { livePreferencePhotos } from "./live-onboarding-media";

// The existing endpoint owns preview authorization. New live captures stay
// private; only these measured photograph crops can be requested.
const sourceHash =
  "2d5900a098426532c1d3b06a590d7c9c47116f0e1aca7a0e7cb610d5c758428b";
// Private, source-verified native decorative fields; no embedded controls.
const nativeImages: Record<string, { file: string; sha256: string }> = {
  "live-onboarding-track-parcel": {
    file: "track-order-parcel-native.png",
    sha256: "0fc886eebb3748cc00f2d70d2eddc3c5d226cbbc730de9442d0bdbe14985d9fc",
  },
  "live-onboarding-shoe": {
    file: "smart_onboarding_allbirds.png",
    sha256: "cd0a2389f0ef5f992f3b6e1e7f11f49697cf770fee894c7ae4e5c5d4908be7df",
  },
  "live-welcome-orbit-poster": {
    file: "welcome-orbit-native.png",
    sha256: "35a35a2ed918fc4320213d9b2e3afad17972903191468c99d4736b5e3161d8e0",
  },
  "live-onboarding-parcel": {
    file: "smart_onboarding_cardboard_box.png",
    sha256: "51286125bf10517f9edf7faed036a8cc3afe826fdfff600c853638113896173a",
  },
  "live-onboarding-delivered": {
    file: "smart_onboarding_delivered_end.png",
    sha256: "9a6a0c680533ffc4c81eb25fd795320af71b89bd872a8a396deaaacd2f5dbb27",
  },
};
const pending = new Map<string, Promise<Buffer>>();
export function readLiveOnboardingMedia(
  key: string,
): Promise<Buffer> | undefined {
  const sourceKey = key.endsWith("-3x") ? key.slice(0, -3) : key;
  if (Object.hasOwn(nativeImages, sourceKey)) {
    if (!pending.has(sourceKey)) {
      const image = nativeImages[sourceKey];
      const job = readFile(
        resolve(
          process.cwd(),
          "../../.local/shop-reference/live/android-onboarding-20260927",
          image.file,
        ),
      ).then((bytes) => {
        if (createHash("sha256").update(bytes).digest("hex") !== image.sha256)
          throw new Error("Native onboarding media checksum mismatch");
        return sharp(bytes).webp({ lossless: true }).toBuffer();
      });
      pending.set(sourceKey, job);
      void job.catch(() => pending.delete(sourceKey));
    }
    return pending.get(sourceKey)!;
  }
  const photo = livePreferencePhotos.find(
    ([name]) => key === `live-preference-${name}`,
  );
  if (!photo) return undefined;
  const existing = pending.get(key);
  if (existing) return existing;
  const job = (async () => {
    const input = await readFile(
      resolve(
        process.cwd(),
        "../../.local/shop-reference/live/android-20260926/preferences.png",
      ),
    );
    if (createHash("sha256").update(input).digest("hex") !== sourceHash) {
      throw new Error(
        "Live Android preference source does not match its capture",
      );
    }
    const metadata = await sharp(input).metadata();
    if (metadata.width !== 1280 || metadata.height !== 2856) {
      throw new Error("Live Android preference source dimensions do not match");
    }

    // Remove native status/gesture chrome, retaining the complete app field.
    const normalized = await sharp(input)
      .extract({ left: 0, top: 156, width: 1280, height: 2628 })
      .resize(427, 876, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
    const [, x, top, width, height] = photo;
    return sharp(normalized)
      .extract({ left: x + 16, top, width, height })
      .webp({ lossless: true })
      .toBuffer();
  })();
  pending.set(key, job);
  void job.catch(() => pending.delete(key));
  return job;
}
