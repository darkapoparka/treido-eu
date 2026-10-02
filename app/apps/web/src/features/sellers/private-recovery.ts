"use client";

type RegisteredBuffer = { key: string; sellerId: string | null };
const registryKey = (subject: string) => `treido-private-buffers:${subject}`;
function registered(subject: string): RegisteredBuffer[] {
  try {
    const raw: unknown = JSON.parse(
      localStorage.getItem(registryKey(subject)) ?? "[]",
    );
    if (!Array.isArray(raw) || raw.length > 500) return [];
    return raw.filter(
      (entry): entry is RegisteredBuffer =>
        entry &&
        typeof entry === "object" &&
        /^treido-draft:[a-f0-9]{64}$/.test(entry.key) &&
        (entry.sellerId === null || typeof entry.sellerId === "string"),
    );
  } catch {
    return [];
  }
}
export function registerPrivateBuffer(
  subject: string,
  key: string,
  sellerId: string | null,
) {
  try {
    const buffers = registered(subject).filter((entry) => entry.key !== key);
    localStorage.setItem(
      registryKey(subject),
      JSON.stringify([...buffers, { key, sellerId }].slice(-500)),
    );
  } catch {
    /* Storage is convenience, never account persistence. */
  }
}
export function clearPrivateBuffers(subject: string, sellerId?: string) {
  try {
    const buffers = registered(subject);
    for (const entry of buffers)
      if (!sellerId || entry.sellerId === sellerId)
        localStorage.removeItem(entry.key);
    if (sellerId)
      localStorage.setItem(
        registryKey(subject),
        JSON.stringify(buffers.filter((entry) => entry.sellerId !== sellerId)),
      );
    else localStorage.removeItem(registryKey(subject));
    window.dispatchEvent(new Event("treido-draft-buffer-changed"));
  } catch {
    /* A storage failure cannot authorize a read or mutation. */
  }
}
