import { statfsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function selectFixtureEvidenceDirectory(
  requestedDirectory,
  environmentDirectory,
  defaultDirectory,
) {
  const explicit =
    requestedDirectory === undefined
      ? environmentDirectory
      : requestedDirectory;
  if (explicit === undefined) return defaultDirectory;
  if (
    typeof explicit !== "string" ||
    explicit.length === 0 ||
    explicit.trim() !== explicit ||
    explicit.includes("\0") ||
    !path.isAbsolute(explicit) ||
    (path.sep === "\\" && ["\\", "/"].includes(path.parse(explicit).root))
  )
    throw Error(
      "Explicit fixture evidence directory must be an absolute non-root path",
    );
  const resolved = path.resolve(explicit);
  if (resolved === path.parse(resolved).root)
    throw Error(
      "Explicit fixture evidence directory must be an absolute non-root path",
    );
  return resolved;
}

export function assertFixtureHeadroom(
  evidenceDirectory,
  { filesystem = statfsSync, freeMemory = os.freemem } = {},
) {
  let ancestor = evidenceDirectory;
  let stat;
  for (;;) {
    try {
      stat = filesystem(ancestor);
      break;
    } catch (error) {
      if (!["ENOENT", "ENOTDIR"].includes(error?.code)) throw error;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }
  if (stat.bavail * stat.bsize < 1073741824 || freeMemory() < 1610612736)
    throw Error("Insufficient headroom");
}

export async function cleanupLaunchCluster({ drains, stop, recordStopped }) {
  const failures = [];
  for (const drain of drains) {
    try {
      await drain();
    } catch (error) {
      failures.push(error);
    }
  }
  if (stop) {
    try {
      await stop();
      await recordStopped();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(failures, "Isolated PostgreSQL cleanup failed");
}

/** @returns {Promise<never>} */
export async function rethrowLaunchFailure(startupFailure, cleanup) {
  try {
    await cleanup();
  } catch (cleanupFailure) {
    throw new AggregateError(
      [startupFailure, cleanupFailure],
      "Isolated PostgreSQL startup and cleanup failed",
    );
  }
  throw startupFailure;
}
