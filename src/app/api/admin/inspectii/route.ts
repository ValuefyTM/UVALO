import { NextResponse } from "next/server";
import { api, err, json, str } from "@/lib/api";
import { audit } from "@/lib/auth";
import { track } from "@/lib/track";
import { modeSettings, setModeSettings } from "@/lib/modmode";

/** Inspecții in the administration: mode (Dezactivat / Test / Activ) and the test users, as for Colaborări. */
export async function POST(req: Request) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const b = await json(req);
  const cur = await modeSettings(a.db, "inspectii");
  const actor = a.c.user.id;
  switch (b.action) {
    case "mode": {
      const mode = b.mode === "on" || b.mode === "test" || b.mode === "off" ? b.mode : null;
      if (!mode) return err("Alege modul.");
      await setModeSettings(a.db, "inspectii", actor, { ...cur, mode });
      await track(a.db, a.c, "admin", "insp_mode", mode);
      return NextResponse.json({ ok: true, mode });
    }
    case "add_many": {
      const ids = Array.isArray(b.user_ids) ? [...new Set((b.user_ids as unknown[]).filter((x): x is string => typeof x === "string"))].slice(0, 200) : [];
      if (!ids.length) return err("Alege cel puțin o persoană.");
      const { results } = await a.db.prepare(`SELECT id, name, email, anevar_no FROM users WHERE status = 'active' AND id IN (${ids.map(() => "?").join(",")})`).bind(...ids)
        .all<{ id: string; name: string; email: string; anevar_no: string | null }>();
      const add = results.filter((u) => !cur.users.includes(u.id));
      if (add.length) await setModeSettings(a.db, "inspectii", actor, { ...cur, users: [...cur.users, ...add.map((u) => u.id)] });
      for (const u of add) await audit(a.db, actor, "insp.test_add", "user", u.id, u.email);
      return NextResponse.json({ ok: true, users: add.map((u) => ({ id: u.id, name: u.name || u.email, email: u.email, anevar: u.anevar_no })) });
    }
    case "remove": {
      const id = str(b.user_id, 60);
      await setModeSettings(a.db, "inspectii", actor, { ...cur, users: cur.users.filter((x) => x !== id) });
      await audit(a.db, actor, "insp.test_remove", "user", id);
      return NextResponse.json({ ok: true });
    }
  }
  return err("Acțiune necunoscută.");
}
