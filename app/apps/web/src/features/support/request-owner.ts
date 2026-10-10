export type SupportRequestLease = {
  isCurrent: () => boolean;
  finish: () => void;
};

/** One committed support route/session owns its callbacks. Re-activating the
 * same React effect never revives an earlier read, send or acknowledgement. */
export function createSupportRequestOwner(scopeKey = "") {
  let active = false;
  let generation = 0;
  let nextToken = 0;
  let mutation: number | null = null;
  function capture() {
    if (!active) return null;
    const captured = generation;
    return () => active && generation === captured;
  }
  return {
    key: scopeKey,
    activate() {
      generation++;
      mutation = null;
      active = true;
    },
    retire() {
      generation++;
      active = false;
      mutation = null;
    },
    capture,
    busy: () => active && mutation !== null,
    begin(): SupportRequestLease | null {
      const isCurrent = capture();
      if (!isCurrent || mutation !== null) return null;
      const token = ++nextToken;
      mutation = token;
      return {
        isCurrent,
        finish() {
          if (isCurrent() && mutation === token) mutation = null;
        },
      };
    },
  };
}
