"use client";

// These account stages are already rendered by the mounted client owner.
// Keep their URL and Back/Forward entries without requesting another page.
export function navigateAccountStage(href: string, replace = false): void {
  const target = new URL(href, window.location.href);
  if (
    target.origin !== window.location.origin ||
    target.pathname !== window.location.pathname
  ) {
    throw new Error("Account stage navigation must stay on the current page");
  }
  const state = { ...window.history.state };
  // Next copies its own routing fields. Supplying these flags bypasses the
  // public history wrapper's synchronization with useSearchParams.
  delete state.__NA;
  delete state._N;
  const method = replace ? "replaceState" : "pushState";
  window.history[method](
    state,
    "",
    `${target.pathname}${target.search}${target.hash}`,
  );
}
