// Copies the cadastral locator page and its data into the worker's static assets, under /_localizare/.
// They are not in public/ on purpose: wrangler.jsonc routes /_localizare/* to the worker (run_worker_first),
// so nobody can open them directly — the worker serves them only to signed-in users with access to the module.
import { cpSync, existsSync } from "node:fs";

const out = ".open-next/assets";
if (!existsSync(out)) {
  console.error("copy-localizare: run the OpenNext build first (.open-next/assets is missing).");
  process.exit(1);
}
cpSync("localizare-data", `${out}/_localizare`, { recursive: true });
console.log("copy-localizare: localizare-data → .open-next/assets/_localizare");
