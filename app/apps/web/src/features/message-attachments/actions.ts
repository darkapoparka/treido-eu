"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError } from "../sellers/errors";
import {
  stageAttachment,
  attachmentStatus,
  removeAttachment,
} from "./commands.server";
async function run(
  kind: "stage" | "status" | "remove",
  raw: unknown,
  expectedSubject: string,
) {
  let subject: string | null = null;
  try {
    const identity = await requireVerifiedIdentity();
    subject = identity.subject;
    if (subject !== expectedSubject) throw new SellerError("FORBIDDEN");
    const db = getDatabase();
    return {
      ok: true as const,
      subject,
      data: await (kind === "stage"
        ? stageAttachment(db, identity, raw)
        : kind === "status"
          ? attachmentStatus(db, identity, raw)
          : removeAttachment(db, identity, raw)),
    };
  } catch (error) {
    return {
      ok: false as const,
      subject,
      code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
    };
  }
}
export async function stageAttachmentAction(
  raw: unknown,
  expectedSubject: string,
) {
  return run("stage", raw, expectedSubject);
}
export async function attachmentStatusAction(
  raw: unknown,
  expectedSubject: string,
) {
  return run("status", raw, expectedSubject);
}
export async function removeAttachmentAction(
  raw: unknown,
  expectedSubject: string,
) {
  return run("remove", raw, expectedSubject);
}
