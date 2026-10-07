import { api } from "@/lib/api";

/** Profile picture of an account, for signed-in people. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await api();
  if ("res" in a) return new Response(null, { status: 401 });
  const r = await a.db.prepare("SELECT avatar FROM users WHERE id = ?").bind((await params).id).first<{ avatar: string | null }>();
  const m = r?.avatar?.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) return new Response(null, { status: 404 });
  return new Response(Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)), { headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=300" } });
}
