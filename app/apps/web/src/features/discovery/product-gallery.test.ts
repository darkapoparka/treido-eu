import { describe, expect, it } from "vitest";
import { moveProductPhoto, productPhotoSwipe } from "./product-gallery";

describe("local product gallery navigation", () => {
  it.each([
    [0, -1, 5, 0],
    [4, 1, 5, 4],
    [1, 1, 5, 2],
    [3, -1, 5, 2],
    [0, 1, 1, 0],
    [0, 1, 0, null],
  ] as const)(
    "bounds photo %s moving %s across %s photos",
    (index, direction, count, result) => {
      expect(moveProductPhoto(index, direction, count)).toBe(result);
    },
  );

  it.each([
    [10, 0, 0],
    [0, 100, 0],
    [70, 90, 0],
    [41, 0, -1],
    [-41, 0, 1],
    [40, 0, 0],
    [-40, 0, 0],
    [41, 41, 0],
  ] as const)("interprets gesture delta %s/%s", (dx, dy, direction) => {
    expect(
      productPhotoSwipe({ x: 200, y: 300 }, { x: 200 + dx, y: 300 + dy }),
    ).toBe(direction);
  });
});
