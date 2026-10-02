import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { referencePreviewEnabled } from "@/features/catalog/queries.server";

// Use the device's existing typeface only inside the authorized local preview.
// No typeface binary is published with the repository or release assets.
export async function GET() {
  if (!referencePreviewEnabled()) return new Response(null, { status: 404 });
  try {
    // Reference font files must not enter the production asset graph.
    const input =
      process.env.NODE_ENV === "production"
        ? undefined
        : await readFile(
            resolve(
              process.cwd(),
              "../../.local/shop-reference/live/android-home-20260926/Roboto-Regular.ttf",
            ),
          );
    if (!input) return new Response(null, { status: 404 });
    if (
      createHash("sha256").update(input).digest("hex") !==
      "9ca9debb09459bf4e3e7f826f5cd0f35f253902b85684921fce2ba3f28dd0f50"
    )
      return new Response(null, { status: 503 });
    return new Response(new Uint8Array(input), {
      headers: {
        "Content-Type": "font/ttf",
        "Cache-Control": "private, max-age=3600",
        "X-Robots-Tag": "noindex",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
