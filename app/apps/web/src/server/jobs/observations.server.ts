import "server-only";
import { emitJobObservation } from "./observations";

/** Existing platform stdout only; SDK loggers and provider telemetry stay quiet. */
export function observeJob(input: () => unknown): void {
  emitJobObservation(input, (event) => console.info(JSON.stringify(event)));
}
