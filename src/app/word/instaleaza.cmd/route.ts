import { origin } from "@/lib/site";
import { installer } from "@/lib/word";

// /word/instaleaza.cmd — installs UVALO in Word for the current Windows user (no admin rights).
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(installer(await origin()), {
    headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-cache", "Content-Disposition": 'attachment; filename="Instaleaza-UVALO-Word.cmd"' },
  });
}
