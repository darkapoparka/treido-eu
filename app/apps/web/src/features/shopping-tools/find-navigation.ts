import { preserveConstraints } from "../assistant-runs/model";
import { parseToolIntent, toolParams, type ToolIntent } from "./intent";

export type FindNavigation = {
  generation: number;
  submitted: ToolIntent | null;
};
export function findScope(intent: ToolIntent): string {
  return toolParams({ ...intent, cursor: null }).toString();
}
export function beginFindNavigation(
  previous: FindNavigation,
  submitted: ToolIntent,
): FindNavigation {
  return { generation: previous.generation + 1, submitted };
}
/** An old mounted Apply handler cannot outrun a newer deliberate filter submit.
 * The caller advances this generation synchronously before starting the router. */
export function reviewedFindIntent(
  current: ToolIntent,
  navigation: FindNavigation,
  handlerGeneration: number,
  pending: boolean,
  canonical: string,
): ToolIntent | null {
  if (pending || navigation.generation !== handlerGeneration) return null;
  const latest = navigation.submitted ?? current;
  if (findScope(latest) !== findScope(current)) return null;
  return parseToolIntent(
    preserveConstraints(findScope(latest), canonical),
    "find-for-me",
  );
}
