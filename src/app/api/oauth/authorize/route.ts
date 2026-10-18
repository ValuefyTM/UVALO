import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { context } from "@/lib/access";
import { checkAuthorize, issueCode } from "@/lib/oauth";
import { track } from "@/lib/track";

/** The consent form of /oauth/authorize: "Permite" → a code sent back to the app; "Refuză" → error=access_denied. */
export async function POST(req: Request) {
  const db = await getDb();
  if (!db) return new Response("Baza de date nu este disponibilă.", { status: 503 });
  const c = await context(db);
  const f = await req.formData();
  const q = new URLSearchParams();
  for (const k of ["client_id", "redirect_uri", "response_type", "code_challenge", "code_challenge_method", "state", "scope"]) {
    const v = f.get(k);
    if (typeof v === "string") q.set(k, v);
  }
  if (!c) redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${q}`)}`);
  const a = await checkAuthorize(db, q);
  if ("error" in a) return new Response(a.error, { status: 400 });
  const back = new URL(a.redirect);
  if (a.state) back.searchParams.set("state", a.state);
  if (f.get("decision") !== "allow") {
    back.searchParams.set("error", "access_denied");
    redirect(back.toString());
  }
  back.searchParams.set("code", await issueCode(db, { clientId: a.client.id, userId: c.user.id, redirect: a.redirect, challenge: a.challenge, scope: a.scope }));
  await track(db, c, "auth", "oauth_allow", a.client.name ?? a.client.id);
  redirect(back.toString());
}
