export function moveProductPhoto(
  index: number,
  direction: number,
  count: number,
): number | null {
  if (count < 1) return null;
  return Math.max(0, Math.min(count - 1, index + direction));
}

export function productPhotoSwipe(
  start: { x: number; y: number },
  end: { x: number; y: number },
): -1 | 0 | 1 {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  // A tap or mainly vertical gesture must not select another photo.
  if (Math.abs(dx) <= 40 || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}
