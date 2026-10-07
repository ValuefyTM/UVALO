// Server-only: the ANEVAR list in the administration, with accounts and activity (who signs in, who never did).
export type TablouFilter = { judet?: string; spec?: string; cont?: string; q?: string; vechi?: string; sort?: string; page?: string };
export type TablouRow = {
  legit: string; name: string; county: string | null; specs: string | null; in_current: number; tablou_date: string | null;
  user_id: string | null; user_status: string | null; email: string | null; last_login_at: string | null; last_seen_at: string | null; events_30: number; request: string | null;
};

export const CONT_FILTERS: [string, string][] = [
  ["", "Toți membrii"], ["cu", "Cu cont activ"], ["activi", "Activi în ultimele 30 de zile"], ["inactivi", "Cu cont, inactivi 30 de zile"],
  ["niciodata", "Cu cont, neautentificați niciodată"], ["invitati", "Invitați (cont neactivat)"], ["solicitari", "Solicitare în așteptare"], ["fara", "Fără cont"],
];
export const SPECS = ["EPI", "EBM", "EI", "EIF", "VE-EPI", "VE-EBM", "VE-EI", "VE-EIF"];
export const PAGE_SIZE = 100;

const since30 = () => new Date(Date.now() - 30 * 864e5).toISOString();

function where(f: TablouFilter, withCounty = true) {
  const w: string[] = [], p: unknown[] = [];
  if (f.vechi !== "1") w.push("m.in_current = 1");
  if (withCounty && f.judet) { w.push("m.county = ?"); p.push(f.judet); }
  if (f.spec && SPECS.includes(f.spec)) { w.push("(',' || COALESCE(m.specs, '') || ',') LIKE ?"); p.push(`%,${f.spec},%`); }
  const q = (f.q ?? "").trim();
  if (q) {
    if (/^\d+$/.test(q)) { w.push("m.legit LIKE ?"); p.push(`${q}%`); }
    else { w.push("m.name LIKE ?"); p.push(`%${q.replace(/[%_]/g, "")}%`); }
  }
  const s30 = since30();
  switch (f.cont) {
    case "cu": w.push("u.status = 'active'"); break;
    case "activi": w.push("u.status = 'active' AND u.last_seen_at > ?"); p.push(s30); break;
    case "inactivi": w.push("u.status = 'active' AND (u.last_seen_at IS NULL OR u.last_seen_at <= ?)"); p.push(s30); break;
    case "niciodata": w.push("u.status = 'active' AND u.last_login_at IS NULL"); break;
    case "invitati": w.push("u.status = 'invited'"); break;
    case "solicitari": w.push("EXISTS (SELECT 1 FROM account_requests r WHERE r.legit = m.legit AND r.status = 'pending')"); break;
    case "fara": w.push("u.id IS NULL"); break;
  }
  return { sql: w.length ? `WHERE ${w.join(" AND ")}` : "", p };
}

// One account per card number (the most recent one that is not disabled, else any).
const FROM = `FROM anevar_members m LEFT JOIN users u ON u.id = (SELECT x.id FROM users x WHERE x.anevar_no = m.legit ORDER BY x.status = 'disabled', x.created_at DESC LIMIT 1)`;

export async function tablou(db: D1Database, f: TablouFilter, all = false) {
  const { sql, p } = where(f);
  const order = f.sort === "judet" ? "m.county, m.name" : f.sort === "login" ? "u.last_seen_at IS NULL, u.last_seen_at DESC, m.name" : f.sort === "legit" ? "CAST(m.legit AS INTEGER)" : "m.name";
  const page = Math.max(1, Number(f.page) || 1);
  const [total, rows] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n ${FROM} ${sql}`).bind(...p).first<{ n: number }>(),
    db.prepare(`SELECT m.legit, m.name, m.county, m.specs, m.in_current, m.tablou_date, u.id AS user_id, u.status AS user_status, u.email, u.last_login_at, u.last_seen_at,
        (SELECT COUNT(*) FROM events e WHERE e.user_id = u.id AND e.at > ?) AS events_30,
        (SELECT r.status FROM account_requests r WHERE r.legit = m.legit ORDER BY r.created_at DESC LIMIT 1) AS request
      ${FROM} ${sql} ORDER BY ${order} ${all ? "LIMIT 10000" : `LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`}`).bind(since30(), ...p).all<TablouRow>(),
  ]);
  return { total: total?.n ?? 0, rows: rows.results, page };
}

/** Per county, with the same filters except the county: members, accounts, active in 30 days. */
export async function byCounty(db: D1Database, f: TablouFilter) {
  const { sql, p } = where(f, false);
  const { results } = await db.prepare(`SELECT m.county, COUNT(*) AS members, SUM(u.status = 'active') AS accounts, SUM(u.status = 'active' AND u.last_seen_at > ?) AS active
      ${FROM} ${sql} GROUP BY m.county ORDER BY members DESC`).bind(since30(), ...p).all<{ county: string | null; members: number; accounts: number | null; active: number | null }>();
  return results;
}

export async function counties(db: D1Database) {
  const { results } = await db.prepare("SELECT county, COUNT(*) AS n FROM anevar_members WHERE in_current = 1 GROUP BY county ORDER BY county").all<{ county: string; n: number }>();
  return results;
}
