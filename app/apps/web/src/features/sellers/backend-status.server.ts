import "server-only";
import { validateBackendBindings } from "../../server/config/backend-bindings";
export function backendConfigured() {
  return validateBackendBindings(process.env).ok;
}
