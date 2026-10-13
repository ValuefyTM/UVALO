import { NextResponse } from "next/server";
import { api, err, json, str } from "@/lib/api";
import { audit } from "@/lib/auth";
import { normEmail } from "@/lib/crypto";
import { track } from "@/lib/track";
import { collabCounts, collabSettings, purgeTest, sendLaunchEmails, setCollabSettings } from "@/lib/collab";

/** Colaborări in the administration: mode (Dezactivat / Test / Activ), the test users, deleting the test data. */
export async function POST(req: Request) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const b = await json(req);
  const cur = await collabSettings(a.db);
  const actor = a.c.user.id;
  switch (b.action) {
    case "mode": {
      const mode = b.mode === "on" || b.mode === "test" || b.mode === "off" ? b.mode : null;
      if (!mode) return err("Alege modul.");
      await setCollabSettings(a.db, actor, { ...cur, mode });
      await track(a.db, a.c, "admin", "collab_mode", mode);
      return NextResponse.json({ ok: true, mode });
    }
    case "add_many": {
      // several existing accounts chosen from the list
      const ids = Array.isArray(b.user_ids) ? [...new Set((b.user_ids as unknown[]).filter((x): x is string => typeof x === "string"))].slice(0, 200) : [];
      if (!ids.length) return err("Alege cel puțin o persoană.");
      const { results } = await a.db.prepare(`SELECT id, name, email, anevar_no FROM users WHERE status = 'active' AND id IN (${ids.map(() => "?").join(",")})`).bind(...ids)
        .all<{ id: string; name: string; email: string; anevar_no: string | null }>();
      const add = results.filter((u) => !cur.users.includes(u.id));
      if (add.length) await setCollabSettings(a.db, actor, { ...cur, users: [...cur.users, ...add.map((u) => u.id)] });
      for (const u of add) await audit(a.db, actor, "collab.test_add", "user", u.id, u.email);
      return NextResponse.json({ ok: true, users: add.map((u) => ({ id: u.id, name: u.name || u.email, email: u.email, anevar: u.anevar_no })) });
    }
    case "add": {
      const email = normEmail(str(b.email, 200));
      const u = email ? await a.db.prepare("SELECT id, name, email, anevar_no, status FROM users WHERE email = ?").bind(email).first<{ id: string; name: string; email: string; anevar_no: string | null; status: string }>() : null;
      if (!u) return err("Nu există un cont UVALO cu acest email.");
      if (u.status === "disabled" || u.status === "closed") return err("Contul nu este activ.");
      if (!cur.users.includes(u.id)) await setCollabSettings(a.db, actor, { ...cur, users: [...cur.users, u.id] });
      await audit(a.db, actor, "collab.test_add", "user", u.id, u.email);
      return NextResponse.json({ ok: true, user: { id: u.id, name: u.name || u.email, email: u.email, anevar: u.anevar_no } });
    }
    case "remove": {
      const id = str(b.user_id, 60);
      await setCollabSettings(a.db, actor, { ...cur, users: cur.users.filter((x) => x !== id) });
      await audit(a.db, actor, "collab.test_remove", "user", id);
      return NextResponse.json({ ok: true });
    }
    case "launch_mail": {
      const r = await sendLaunchEmails(a.db);
      await audit(a.db, actor, "collab.launch_mail", "collab", undefined, String(r.sent));
      return NextResponse.json({ ok: true, sent: r.sent });
    }
    case "purge": {
      const n = await purgeTest(a.db);
      await audit(a.db, actor, "collab.purge_test", "collab", undefined, String(n));
      await track(a.db, a.c, "admin", "collab_purge", null, { rows: n });
      return NextResponse.json({ ok: true, deleted: n, counts: await collabCounts(a.db) });
    }
  }
  return err("Acțiune necunoscută.");
}
