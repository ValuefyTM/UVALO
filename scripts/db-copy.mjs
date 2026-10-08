// Copies the production D1 (valuefy-tools-db) into the local database or into staging, with the personal data made
// anonymous on the way (emails and phones of evaluators, requests and recommendations; sessions and login codes are
// dropped). VALUEFY administrators (is_superadmin) keep their email, so they can sign in.
//
//   npm run db:pull                     production → local      (needs `npx wrangler login` or CLOUDFLARE_API_TOKEN)
//   npm run db:pull:staging             production → staging
//   node scripts/db-copy.mjs --from-file dump.sql --to local     an export made before (wrangler d1 export … --output)
//   --raw                               no anonymisation (only when really needed: real personal data on the target)
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const to = opt("--to") ?? "local";
const raw = args.includes("--raw");
const fromFile = opt("--from-file");
if (!["local", "staging"].includes(to)) throw new Error("--to local | staging");

const PROD_DB = "valuefy-tools-db";
const STAGING_DB = "valuefy-tools-staging-db";
const tmp = mkdtempSync(join(tmpdir(), "tools-db-"));
const wr = (...a) => execFileSync("npx", ["wrangler", ...a], { stdio: ["ignore", "pipe", "inherit"], encoding: "utf8", maxBuffer: 1 << 30 });
const step = (m) => console.log(`\n▸ ${m}`);

// Personal data of evaluators and of people who asked for an account, replaced with test values.
const ANON = `
DELETE FROM sessions; DELETE FROM auth_codes; DELETE FROM email_changes;
UPDATE users SET email = 'user-' || substr(id, 1, 8) || '@test.invalid', phone = CASE WHEN phone IS NULL THEN NULL ELSE '0700 ' || printf('%03d %03d', abs(random()) % 1000, abs(random()) % 1000) END, avatar = NULL
  WHERE is_superadmin = 0;
UPDATE invites SET email = 'invite-' || substr(id, 1, 8) || '@test.invalid' WHERE email NOT IN (SELECT email FROM users WHERE is_superadmin = 1);
UPDATE account_requests SET email = 'request-' || substr(id, 1, 8) || '@test.invalid', phone = CASE WHEN phone IS NULL THEN NULL ELSE '0700 000 000' END,
  message = NULL, ip = NULL, user_agent = NULL;
UPDATE referrals SET email = 'ref-' || substr(id, 1, 8) || '@test.invalid', note = NULL;
`;

/**
 * D1 exports list tables in the order they were created; a table altered later to point to a newer one (account_requests
 * → referrals) is then filled before the table it points to, and the import fails. The tables (each with its rows) are
 * put in dependency order; the header and the indexes stay where they are.
 */
function ordered(sql) {
  const lines = sql.split("\n");
  const head = [], blocks = [], tail = [];
  let cur = null;
  for (const l of lines) {
    if (/^CREATE TABLE /i.test(l)) { cur = { lines: [l] }; blocks.push(cur); continue; }
    if (/^CREATE (UNIQUE )?INDEX |^CREATE TRIGGER |^CREATE VIEW /i.test(l)) { cur = null; tail.push(l); continue; }
    if (cur) cur.lines.push(l); else if (blocks.length) tail.push(l); else head.push(l);
  }
  for (const b of blocks) {
    const text = b.lines.join("\n");
    b.name = text.match(/^CREATE TABLE (?:IF NOT EXISTS )?"?([\w]+)"?/i)[1];
    b.deps = [...text.matchAll(/REFERENCES\s+"?(\w+)"?/gi)].map((m) => m[1]).filter((d) => d !== b.name);
  }
  const done = new Set(), out = [];
  const visit = (b, seen = new Set()) => {
    if (done.has(b.name) || seen.has(b.name)) return;
    seen.add(b.name);
    for (const d of b.deps) { const p = blocks.find((x) => x.name === d); if (p) visit(p, seen); }
    done.add(b.name); out.push(b);
  };
  blocks.forEach((b) => visit(b));
  return [...head, ...out.flatMap((b) => b.lines), ...tail].join("\n");
}

try {
  // 1. The production database as SQL
  let dump = fromFile;
  if (!dump) {
    step(`Export ${PROD_DB} (producție)`);
    dump = join(tmp, "prod.sql");
    wr("d1", "export", PROD_DB, "--remote", "--output", dump);
  }
  if (!existsSync(dump)) throw new Error(`Nu găsesc ${dump}`);
  const sorted = join(tmp, "prod-ordered.sql");
  writeFileSync(sorted, ordered(readFileSync(dump, "utf8")));
  dump = sorted;

  // 2. Anonymised in a throwaway local database, then exported again: personal data never reaches the target
  let out = dump;
  if (!raw) {
    step("Anonimizare (într-o bază temporară)");
    // its own configuration in the temporary folder, so this database lives there (.wrangler/ next to it)
    const conf = join(tmp, "wrangler.json");
    writeFileSync(conf, JSON.stringify({ name: "tools-anon", compatibility_date: "2026-09-25", d1_databases: [{ binding: "DB", database_name: "anon", database_id: "anon" }] }));
    writeFileSync(join(tmp, "anon.sql"), ANON);
    out = join(tmp, "anon-export.sql");
    const cfg = ["--config", conf];
    wr("d1", "execute", "DB", "--local", ...cfg, "--file", dump, "--yes");
    wr("d1", "execute", "DB", "--local", ...cfg, "--file", join(tmp, "anon.sql"), "--yes");
    wr("d1", "export", "DB", "--local", ...cfg, "--output", out);
  }

  // 3. Into the target, which is emptied first
  if (to === "local") {
    step("Înlocuiesc baza locală");
    rmSync(".wrangler/state/v3/d1", { recursive: true, force: true });
    wr("d1", "execute", "DB", "--local", "--file", out, "--yes");
  } else {
    step(`Golesc ${STAGING_DB} (staging)`);
    const tables = JSON.parse(wr("d1", "execute", "DB", "--env", "staging", "--remote", "--json", "--command",
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"))[0].results.map((r) => r.name);
    if (tables.length) {
      writeFileSync(join(tmp, "drop.sql"), `PRAGMA defer_foreign_keys = on;\n${tables.map((t) => `DROP TABLE IF EXISTS "${t}";`).join("\n")}\n`);
      wr("d1", "execute", "DB", "--env", "staging", "--remote", "--file", join(tmp, "drop.sql"), "--yes");
    }
    step(`Import în ${STAGING_DB}`);
    wr("d1", "execute", "DB", "--env", "staging", "--remote", "--file", out, "--yes");
  }

  // 4. Migrations newer than production (work in progress) on top
  step("Migrări noi (dacă sunt)");
  if (to === "local") wr("d1", "migrations", "apply", "DB", "--local");
  else wr("d1", "migrations", "apply", "DB", "--env", "staging", "--remote");

  const sizeKb = Math.round(readFileSync(out).length / 1024);
  console.log(`\n✓ Gata: producție → ${to}${raw ? " (fără anonimizare!)" : " (anonimizat)"} · ${sizeKb} KB SQL`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
