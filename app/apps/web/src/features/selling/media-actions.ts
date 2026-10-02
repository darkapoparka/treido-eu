"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { requireMediaStorage } from "../../server/media/storage.server";
import { requireJobBindings } from "../../server/jobs/config.server";
import {
  createMediaIntent,
  completeMediaUpload,
  listDraftMedia,
  changeDraftMedia,
} from "./media.server";
import { SellerError } from "../sellers/errors";
import type {
  MediaUploadInput,
  MediaUploadIntent,
  MediaView,
  MediaResult,
} from "./media-model";

async function run<T>(
  action: (
    identity: Awaited<ReturnType<typeof requireVerifiedIdentity>>,
  ) => Promise<T>,
): Promise<MediaResult<T>> {
  try {
    return { ok: true, data: await action(await requireVerifiedIdentity()) };
  } catch (error) {
    if (error instanceof SellerError && error.code === "UNAUTHENTICATED")
      return { ok: false, code: "FORBIDDEN" };
    const code =
      error instanceof SellerError &&
      [
        "INVALID_INPUT",
        "FORBIDDEN",
        "NOT_FOUND",
        "CONFLICT",
        "QUOTA_EXCEEDED",
      ].includes(error.code)
        ? (error.code as Exclude<MediaResult<never>, { ok: true }>["code"])
        : "NOT_AVAILABLE";
    return { ok: false, code };
  }
}
export async function listMediaAction(input: {
  sellerId: string;
  draftId: string;
}): Promise<MediaResult<MediaView[]>> {
  return run((identity) =>
    listDraftMedia(getDatabase(), identity, input.sellerId, input.draftId),
  );
}
export async function createMediaIntentAction(
  input: MediaUploadInput,
): Promise<MediaResult<MediaUploadIntent>> {
  return run((identity) => {
    requireJobBindings();
    return createMediaIntent(
      getDatabase(),
      identity,
      input,
      requireMediaStorage(),
    );
  });
}
export async function completeMediaAction(input: {
  sellerId: string;
  draftId: string;
  assetId: string;
}) {
  return run((identity) => {
    requireJobBindings();
    return completeMediaUpload(
      getDatabase(),
      identity,
      input,
      requireMediaStorage(),
    );
  });
}
export async function changeMediaAction(
  input: Parameters<typeof changeDraftMedia>[2],
) {
  return run((identity) => changeDraftMedia(getDatabase(), identity, input));
}
