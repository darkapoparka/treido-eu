import "server-only";
import { requireBackendBindings } from "../config/backend-bindings.server";
import { validateJobBindings } from "./bindings";
import { JobError } from "./model";
export function requireJobBindings() {
  requireBackendBindings();
  const configured = validateJobBindings(process.env);
  if (!configured.ok) throw new JobError("NOT_AVAILABLE");
  return configured.bindings;
}
