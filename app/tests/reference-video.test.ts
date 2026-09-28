import { describe, expect, test } from "vitest";
import { referenceVideoResponse } from "../apps/web/src/features/catalog/reference/video-response";

const bytes = new Uint8Array([0, 1, 2, 3, 4, 5]);
function response(range?: string, method = "GET") {
  return referenceVideoResponse(
    bytes,
    new Request("http://localhost/api/reference-video/test", {
      method,
      headers: range ? { Range: range } : undefined,
    }),
  );
}

describe("native video byte seeking", () => {
  test("full reads and HEAD have consistent lengths without a HEAD body", async () => {
    const full = response();
    expect(full.status).toBe(200);
    expect(full.headers.get("content-type")).toBe("video/mp4");
    expect(full.headers.get("accept-ranges")).toBe("bytes");
    expect(full.headers.get("content-length")).toBe("6");
    expect(new Uint8Array(await full.arrayBuffer())).toEqual(bytes);
    const head = response(undefined, "HEAD");
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe("6");
    expect((await head.arrayBuffer()).byteLength).toBe(0);
  });

  test.each([
    ["bytes=1-3", "bytes 1-3/6", [1, 2, 3]],
    ["bytes=4-", "bytes 4-5/6", [4, 5]],
    ["bytes=-2", "bytes 4-5/6", [4, 5]],
    ["bytes=4-500", "bytes 4-5/6", [4, 5]],
    ["bytes=-500", "bytes 0-5/6", [0, 1, 2, 3, 4, 5]],
  ])(
    "returns the exact requested range %s",
    async (range, contentRange, values) => {
      const result = response(range);
      expect(result.status).toBe(206);
      expect(result.headers.get("content-range")).toBe(contentRange);
      expect(result.headers.get("content-length")).toBe(String(values.length));
      expect([...new Uint8Array(await result.arrayBuffer())]).toEqual(values);
      const head = response(range, "HEAD");
      expect(head.status).toBe(206);
      expect(head.headers.get("content-range")).toBe(contentRange);
      expect((await head.arrayBuffer()).byteLength).toBe(0);
    },
  );

  test.each([
    "bytes=6-",
    "bytes=5-2",
    "bytes=-0",
    "bytes=-",
    "bytes=0-1,3-4",
    "bytes=NaN-3",
    "items=0-3",
    "bytes=999999999999999999-",
  ])("rejects invalid or unsatisfiable ranges %s", async (range) => {
    const result = response(range);
    expect(result.status).toBe(416);
    expect(result.headers.get("content-range")).toBe("bytes */6");
    expect((await result.arrayBuffer()).byteLength).toBe(0);
  });
});
