// Copies the cadastral locator page and its data into the worker's static assets, under /_localizare/.
// They are not in public/ on purpose: wrangler.jsonc routes /_localizare/* to the worker (run_worker_first),
// so nobody can open them directly — the worker serves them only to signed-in users with access to the module.
// It also writes, per UAT, the centre of every parcel in GPS coordinates (/_localizare/c/<uat>.json), for the
// lookup API used by the CRM (/api/localizare/centroid).
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { centroid, decodeRing, stereo70ToWgs84 } from "./stereo70.mjs";

const out = ".open-next/assets";
if (!existsSync(out)) {
  console.error("copy-localizare: run the OpenNext build first (.open-next/assets is missing).");
  process.exit(1);
}
cpSync("localizare-data", `${out}/_localizare`, { recursive: true });
console.log("copy-localizare: localizare-data → .open-next/assets/_localizare");

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
  for (const parcel of d.parcels ?? []) {
    if (!parcel.id || !Array.isArray(parcel.z) || parcel.z.length < 6) continue;
    const [E, N] = centroid(decodeRing(parcel.z));
    const [lat, lng] = stereo70ToWgs84(E, N);
    p[String(parcel.id)] = [Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6];
  }
  writeFileSync(`${out}/_localizare/c/${key}.json`, JSON.stringify({ uat: d.uat, p }));
  const m = meta[key] ?? {};
  index.push({ key, name: d.uat, county: m.county ?? "Timiș", n: Object.keys(p).length, v: m.v ?? null, bb: m.bb ?? null });
  total += Object.keys(p).length;
}
writeFileSync(`${out}/_localizare/c/index.json`, JSON.stringify(index));
console.log(`copy-localizare: centres of ${total} parcels in ${index.length} UATs → _localizare/c/`);
