import "server-only";
import { validateMediaBindings } from "./bindings";
import { validateJobBindings } from "../jobs/bindings";
export function mediaConfigured() {
  return (
    validateMediaBindings(process.env).ok && validateJobBindings(process.env).ok
  );
}
