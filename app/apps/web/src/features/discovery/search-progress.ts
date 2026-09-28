// Frozen flow 44's local answer-preview sequence, measured from the visible
// submit transition at 8.30–8.35s. These labels are not provider activity.
export const capturedJeansProgress = [
  { id: "thinking", label: "Thinking", until: 2600 },
  { id: "researching", label: "Researching categories", until: 4600 },
  { id: "browsing", label: "Browsing results", until: 6600 },
  { id: "comparing", label: "Comparing products", until: 8600 },
  { id: "finishing", label: "Thinking", until: 10000 },
] as const;

export type CapturedJeansProgress = (typeof capturedJeansProgress)[number];

export function jeansProgressAt(startedAt: number, now: number) {
  const elapsed = now - startedAt;
  if (!Number.isFinite(elapsed) || startedAt <= 0 || elapsed < 0) return null;
  return capturedJeansProgress.find((phase) => elapsed < phase.until) ?? null;
}
