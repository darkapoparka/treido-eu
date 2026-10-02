import "server-only";
import { validateBackendBindings, type BindingIssue } from "./backend-bindings";

export class BackendConfigurationError extends Error {
  constructor(readonly issues: BindingIssue[]) {
    super("Treido backend configuration is missing or invalid.");
    this.name = "BackendConfigurationError";
  }
}

/** Shared by the identity/database adapters; not a readiness or permission grant. */
export function requireBackendBindings() {
  const result = validateBackendBindings(process.env);
  if (!result.ok) throw new BackendConfigurationError(result.issues);
  return result.bindings;
}
