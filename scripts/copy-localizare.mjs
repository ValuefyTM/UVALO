// Copies the cadastral locator page and its data into the worker's static assets, under /_localizare/.
// They are not in public/ on purpose: wrangler.jsonc routes /_localizare/* to the worker (run_worker_first),
// so nobody can open them directly — the worker serves them only to signed-in users with access to the module.
// It also writes, per UAT:
//  - the centre of every parcel in GPS coordinates (/_localizare/c/<uat>.json: id → [lat, lng, area, reach]; reach = the
//    farthest corner from the centre, in metres), for the lookup API used by the CRM (/api/localizare/centroid) and for
//    finding the parcel under a point (MCP);
//  - the parcels in 32 shards by number (/_localizare/s/<uat>/<nn>.json, with their buildings), so the worker can read one
//    parcel without parsing a whole plan (Timișoara is 8.5 MB).
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { centroid, decodeRing, stereo70ToWgs84 } from "./stereo70.mjs";

const out = ".open-next/assets";
if (!existsSync(out)) {
  console.error("copy-localizare: run the OpenNext build first (.open-next/assets is missing).");
  process.exit(1);
}
cpSync("localizare-data", `${out}/_localizare`, { recursive: true });
console.log("copy-localizare: localizare-data → .open-next/assets/_localizare");

/** Shard of a parcel number (same function as src/lib/mcp-localizare.ts). */
const SHARDS = 32;
const shardOf = (id) => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return (h % SHARDS).toString(16).padStart(2, "0"); };

mkdirSync(`${out}/_localizare/c`, { recursive: true });
// the county, data version and bounds of each UAT, from the list of the locator page
const html = readFileSync("localizare-data/index.html", "utf8");
const at = html.indexOf("const UATS=") + "const UATS=".length;
const meta = Object.fromEntries(JSON.parse(html.slice(at, html.indexOf("].map(u=>", at) + 1)).map((u) => [u.key, u]));
const index = [];
let total = 0;
for (const file of readdirSync("localizare-data").filter((f) => f.endsWith(".json")).sort()) {
  const key = file.replace(/\.json$/, "");
  const d = JSON.parse(readFileSync(`localizare-data/${file}`, "utf8"));
  const p = {};
  const shards = Array.from({ length: SHARDS }, () => []);
  const blds = new Map(); // parcel index → [[name, z]]
  for (const b of d.b ?? []) if (b[1] >= 0) (blds.get(b[1]) ?? blds.set(b[1], []).get(b[1])).push([b[0], b[2]]);
  (d.parcels ?? []).forEach((parcel, i) => {
    if (!parcel.id || !Array.isArray(parcel.z) || parcel.z.length < 6) return;
    const ring = decodeRing(parcel.z);
    const [E, N] = centroid(ring);
    const [lat, lng] = stereo70ToWgs84(E, N);
    const reach = Math.ceil(Math.max(...ring.map(([x, y]) => Math.hypot(x - E, y - N))));
    p[String(parcel.id)] = [Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6, Math.round(parcel.a ?? 0), reach];
    const rec = { id: String(parcel.id), a: parcel.a, n: parcel.n ?? [], z: parcel.z };
    if (parcel.t?.length) rec.t = parcel.t;
    if (parcel.f?.length) rec.f = parcel.f;
    if (parcel.o) rec.o = 1;
    if (parcel.iv?.length) rec.iv = parcel.iv;
    const b = blds.get(i);
    if (b) rec.b = b;
    shards[parseInt(shardOf(rec.id), 16)].push(rec);
  });
  writeFileSync(`${out}/_localizare/c/${key}.json`, JSON.stringify({ uat: d.uat, p }));
  mkdirSync(`${out}/_localizare/s/${key}`, { recursive: true });
  shards.forEach((list, i) => writeFileSync(`${out}/_localizare/s/${key}/${i.toString(16).padStart(2, "0")}.json`, JSON.stringify({ uat: d.uat, p: list })));
  const m = meta[key] ?? {};
  index.push({ key, name: d.uat, county: m.county ?? "Timiș", n: Object.keys(p).length, v: m.v ?? null, bb: m.bb ?? null, date: d.date ?? null, b: (d.b ?? []).length });
  total += Object.keys(p).length;
}
writeFileSync(`${out}/_localizare/c/index.json`, JSON.stringify(index));
console.log(`copy-localizare: centres of ${total} parcels in ${index.length} UATs → _localizare/c/, shards → _localizare/s/`);
