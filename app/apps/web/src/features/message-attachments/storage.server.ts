import "server-only";
import { createHash } from "node:crypto";
import {
  requireMediaStorage,
  type MediaStorage,
} from "../../server/media/storage.server";
import { SellerError } from "../sellers/errors";
import { ATTACHMENT_PURPOSE } from "./model";
export type AttachmentStorage = Pick<
  MediaStorage,
  "read" | "put" | "remove"
> & { scope: string; purpose: typeof ATTACHMENT_PURPOSE; prefix: string };
/** Private provider reused with an explicit separate scope/purpose, never listing-media authority. */
export function createAttachmentStorage(base: MediaStorage): AttachmentStorage {
  if (!/^[a-f0-9]{64}$/.test(base.scope))
    throw new SellerError("NOT_AVAILABLE");
  const prefix = base.prefix + "message-attachments/";
  const check = (key: string) => {
    if (
      !key.startsWith(prefix) ||
      key.length > 300 ||
      !/^[a-zA-Z0-9/_-]+(?:\.webp)?$/.test(key)
    )
      throw new SellerError("INVALID_INPUT");
    return key;
  };
  return {
    scope: createHash("sha256")
      .update(JSON.stringify([base.scope, ATTACHMENT_PURPOSE]))
      .digest("hex"),
    purpose: ATTACHMENT_PURPOSE,
    prefix,
    read: (key, maximum) => base.read(check(key), maximum),
    put: (key, bytes) => base.put(check(key), bytes),
    remove: (key) => base.remove(check(key)),
  };
}
export function requireAttachmentStorage() {
  return createAttachmentStorage(requireMediaStorage());
}
