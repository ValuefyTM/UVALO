import { uninstaller } from "@/lib/word";

// /word/dezinstaleaza.cmd — removes UVALO from Word for the current Windows user.
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(uninstaller(), {
    headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-cache", "Content-Disposition": 'attachment; filename="Dezinstaleaza-UVALO-Word.cmd"' },
  });
}
