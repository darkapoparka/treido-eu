import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { referencePreviewEnabled } from "@/features/catalog/queries.server";

// Installed Shop / emulator-5560, 2026-09-26. Reference-only private inputs;
// no typeface binaries are included in source control or release assets.
const faces = {
  regular: [
    "gt_standard_m_regular",
    "ea553fd20ca3175c24dd645f55d4eb24fdfae568802d695d7983fd334072f787",
  ],
  medium: [
    "gt_standard_m_medium",
    "92fb6873259adfc8a780b18f1b4dba839f272911eb88df342ead4aac79d015a5",
  ],
  semibold: [
    "gt_standard_m_semibold",
    "164b2eae26ff273cec2e0e4488eec487878c4f1cca4266e43c3ad78b41a08ba8",
  ],
  bold: [
    "gt_standard_m_bold",
    "32893b477d5644952bf0dcbbc7fe8722d1ef12894cd3052e08c237e0a4a2cf8b",
  ],
  display: [
    "gt_standard_l_heavy",
    "05e6c616d8f30381ad3d37c47611f65b1051d996eebcdcbd2cdab37e363289b5",
  ],
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ face: string }> },
) {
  if (!referencePreviewEnabled()) return new Response(null, { status: 404 });
  const { face } = await params;
  if (!Object.hasOwn(faces, face)) return new Response(null, { status: 404 });
  const [name, hash] = faces[face as keyof typeof faces];
  try {
    // Reference font files must not enter the production asset graph.
    const input =
      process.env.NODE_ENV === "production"
        ? undefined
        : await readFile(
            resolve(
              process.cwd(),
              "../../.local/shop-reference/live/android-typefaces-20260926",
              `${name}.otf`,
            ),
          );
    if (!input) return new Response(null, { status: 404 });
    if (createHash("sha256").update(input).digest("hex") !== hash)
      return new Response(null, { status: 503 });
    return new Response(new Uint8Array(input), {
      headers: {
        "Content-Type": "font/otf",
        "Cache-Control": "private, max-age=3600",
        "X-Robots-Tag": "noindex",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
