// Packs the UVALO pentru Chrome extension (extensions/chrome) into public/chrome/uvalo-chrome.zip, the file people
// download from /chrome. Run after every change to the extension (and raise "version" in its manifest.json).
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const out = resolve("public/chrome/uvalo-chrome.zip");
mkdirSync("public/chrome", { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "uvalo-chrome-"));
cpSync("extensions/chrome", join(tmp, "uvalo-chrome"), { recursive: true });
rmSync(out, { force: true });
execFileSync("zip", ["-qr9", out, "uvalo-chrome", "-x", "*.DS_Store"], { cwd: tmp });
rmSync(tmp, { recursive: true, force: true });
console.log("chrome-zip:", out);
