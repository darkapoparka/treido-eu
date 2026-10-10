import { describe, expect, it } from "vitest";
import {
  plainTextHtml,
  sanitizeDescriptionHtml,
  safeDescriptionColor,
} from "../apps/web/src/features/sellers/preview/rich-text";
import {
  blankProduct,
  initialPreviewState,
  readPreviewState,
} from "../apps/web/src/features/sellers/preview/model";

describe("device-local rich descriptions", () => {
  it("preserves safe table cells and finite color without style effects", () => {
    const result = sanitizeDescriptionHtml(
      '<table onclick="evil()"><tbody><tr><td colspan="99"><span style="color:rgb(255, 0, 8);background-color:#FFDDCC;position:fixed">Cell</span></td></tr></tbody></table>',
    );
    expect(result).toBe(
      '<table><tbody><tr><td><span style="color:#ff0008;background-color:#ffddcc">Cell</span></td></tr></tbody></table>',
    );
    expect(sanitizeDescriptionHtml(result)).toBe(result);
    expect(safeDescriptionColor("rgb(300, 0, 0)")).toBeNull();
    expect(safeDescriptionColor("url(https://example.com)")).toBeNull();
  });
  it("preserves finite formatting and safely escaped seller text", () => {
    expect(plainTextHtml("<script>\nA & B")).toBe(
      "&lt;script&gt;<br>A &amp; B",
    );
    const html = "<p><strong>A</strong> <em>B</em></p><ul><li>C</li></ul>";
    expect(sanitizeDescriptionHtml(html)).toBe(html);
  });
  it.each([
    "<img src=x onerror=alert(1)>",
    "<svg onload=alert(1)></svg>",
    '<iframe src="https://example.com"></iframe>',
    '<a href="javascript:alert(1)" onclick="alert(1)">A</a>',
    '<div style="background:url(javascript:alert(1))">A</div>',
  ])("removes executable markup: %s", (html) => {
    expect(sanitizeDescriptionHtml(html)).not.toMatch(
      /img|svg|iframe|javascript|onerror|onload|onclick|background/,
    );
  });
  it("is stable for safe links and alignment", () => {
    const result = sanitizeDescriptionHtml(
      '<p style="text-align: center">A</p><a href="https://example.com/?a=1&b=2">B</a>',
    );
    expect(sanitizeDescriptionHtml(result)).toBe(result);
    expect(result).toContain('rel="noopener noreferrer"');
  });
  it("starts drafts without an invented condition", () =>
    expect(blankProduct("new").condition).toBe(""));
  it("round trips optional facts without losing old products", () => {
    const state = initialPreviewState(true);
    state.stores.studio.products[0] = {
      ...state.stores.studio.products[0],
      descriptionHtml: "<p><b>Local</b></p>",
      compareAt: 1200,
      cost: 400,
      weight: "1.25",
      length: "20",
      width: "10",
      height: "5",
      trackInventory: false,
      barcode: "123",
    };
    expect(readPreviewState(JSON.stringify(state))).toEqual(state);
  });
  it.each([
    { descriptionHtml: "<img src=x onerror=alert(1)>" },
    { compareAt: 1.5 },
    { cost: -1 },
    { trackInventory: "true" },
    { weight: "-1" },
    { height: "1e3" },
  ])("rejects corrupt saved optional facts %o", (fields) => {
    const state = initialPreviewState(true);
    Object.assign(state.stores.studio.products[0], fields);
    expect(readPreviewState(JSON.stringify(state))).toBeNull();
  });
});
