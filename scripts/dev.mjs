// npm run dev — the app as it runs in Cloudflare (OpenNext build + wrangler dev = the workerd runtime), with the local
// D1 database. .dev.vars is created from .dev.vars.example the first time. Sign-in links appear at /dev/mail.
//   npm run dev -- --no-build     start again without building (when only the database changed)
import { execSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
if (!existsSync(".dev.vars")) {
  copyFileSync(".dev.vars.example", ".dev.vars");
  console.log("Am creat .dev.vars din .dev.vars.example: pune adresa ta în TOOLS_SUPERADMINS.");
}
run("npx wrangler d1 migrations apply DB --local");
if (!process.argv.includes("--no-build")) run("npm run cf:build");
console.log("\n→ http://localhost:8787  (emailuri: http://localhost:8787/dev/mail)\n");
run("npx wrangler dev --port 8787 --ip 127.0.0.1");
