export type EvidenceNumber = { coefficient: bigint; scale: number };
/** Treat the canonical declared decimal literally. Unit conversion must not
 * round two different dimensions into a positive agreement. This is numerical
 * field evidence, never a mechanical fit tolerance or safety calculation. */
export function evidenceNumber(
  value: number | string,
  multiplier = 1,
): EvidenceNumber | null {
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(value));
  if (!match) return null;
  const fraction = match[2] ?? "",
    exponent = Number(match[3] ?? 0),
    scale = fraction.length - exponent;
  if (
    !Number.isSafeInteger(scale) ||
    Math.abs(scale) > 400 ||
    !Number.isSafeInteger(multiplier) ||
    multiplier < 1
  )
    return null;
  return {
    coefficient: BigInt(match[1] + fraction) * BigInt(multiplier),
    scale,
  };
}
export function compareEvidenceNumbers(
  left: EvidenceNumber,
  right: EvidenceNumber,
): number {
  const scale = Math.max(left.scale, right.scale),
    a = left.coefficient * BigInt(10) ** BigInt(scale - left.scale),
    b = right.coefficient * BigInt(10) ** BigInt(scale - right.scale);
  return a < b ? -1 : a > b ? 1 : 0;
}
