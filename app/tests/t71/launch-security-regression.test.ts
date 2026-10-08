import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspace = resolve(import.meta.dirname, "../..");
const web = createRequire(resolve(workspace, "apps/web/package.json"));
const mobile = createRequire(resolve(workspace, "apps/mobile/package.json"));
const native = createRequire(mobile.resolve("react-native/package.json"));
const devtools = createRequire(native.resolve("react-devtools-core"));
const shellQuote = devtools("shell-quote") as {
  quote(tokens: (string | { comment: string })[]): string;
  parse(command: string): (string | { comment: string })[];
};

describe("installed React Native devtools shell quoting", () => {
  it.each(["\n", "\r", "\u2028", "\u2029"])(
    "rejects a line terminator %j after a comment before producing shell text",
    (terminator) => {
      expect(() =>
        shellQuote.quote([
          "echo",
          "ok",
          { comment: "comment" },
          `a${terminator}id;#`,
        ]),
      ).toThrow(TypeError);
    },
  );

  it("also rejects the vulnerable parse, append and quote composition", () => {
    const parsed = shellQuote.parse("echo http://example.com/#fragment");
    expect(parsed.some((token) => typeof token === "object")).toBe(true);
    expect(() => shellQuote.quote([...parsed, "a\nid;#"])).toThrow(TypeError);
  });

  it("preserves ordinary Bulgarian, quotes, spaces and literal shell operators", () => {
    const tokens = ["echo", "София 🚗", "a'b", 'a"b', "$HOME;id", "a\\b", ""];
    expect(shellQuote.parse(shellQuote.quote(tokens))).toEqual(tokens);
    expect(shellQuote.quote(["echo", "ok", { comment: "comment" }])).toBe(
      "echo ok #comment",
    );
  });
});

describe("installed web and Next image processing", () => {
  it("uses the same patched Sharp through the application and Next", async () => {
    const next = createRequire(web.resolve("next"));
    expect(next.resolve("sharp")).toBe(web.resolve("sharp"));
    const packageInfo = JSON.parse(
      readFileSync(
        resolve(dirname(web.resolve("sharp")), "../package.json"),
        "utf8",
      ),
    ) as { version: string };
    expect(packageInfo.version).toBe("0.35.5");
    const sharp = web(
      "sharp",
    ) as typeof import("../../apps/web/node_modules/sharp");
    const input = await sharp({
      create: { width: 1280, height: 960, channels: 3, background: "#467ca5" },
    })
      .png()
      .toBuffer();
    const output = await sharp(input).resize({ width: 640 }).webp().toBuffer();
    expect(await sharp(output).metadata()).toMatchObject({
      format: "webp",
      width: 640,
      height: 480,
    });
    await expect(
      sharp(Buffer.from("invalid image")).webp().toBuffer(),
    ).rejects.toThrow();
  });
});
