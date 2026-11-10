import { origin } from "@/lib/site";
import { manifest } from "@/lib/word";

// /word/manifest.xml — the add-in manifest for Word, with this deployment's address. Public: it holds no data, and Word
// or the Microsoft 365 admin center download it before anyone signs in.
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(manifest(await origin()), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-cache", "Content-Disposition": 'inline; filename="uvalo-word-manifest.xml"' },
  });
}
