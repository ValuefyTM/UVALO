// Server-only: updating the cadastral plans of the locator from the admin panel. The DXF exported from ANCPI is
// compressed in the browser and attached here to a draft GitHub release ("plan-uploads"); the "Plan cadastral"
// workflow (.github/workflows/plan.yml) converts it with tools/dxf/convert.py into a branch plan/<id> whose commit
// message is the summary of the changes. "Publică" runs the workflow again: the plan goes into main and is deployed.
// Needs PLANS_GITHUB_TOKEN: a fine-grained token for the repository with Contents and Actions read / write.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { now, uuid } from "./db";
import type { Ctx } from "./access";
import { locatorAsset } from "./locator";
import { track } from "./track";

const API = "https://api.github.com";
const WORKFLOW = "plan.yml";
const RELEASE_TAG = "plan-uploads";
export const KEY_RE = /^[a-z]+(?:-[a-z]+)*$/;
const ACTIVE = ["converting", "ready", "publishing"];

export type PlanUpload = {
  id: string; uat_key: string; uat_name: string; new_uat: number; file_name: string; size: number; plan_date: string | null; asset_id: number | null;
  status: "converting" | "ready" | "publishing" | "published" | "failed" | "discarded";
  summary: string | null; error: string | null; run_url: string | null; created_by: string; created_at: string; updated_at: string; published_at: string | null;
  by_name?: string | null;
};
export type Uat = { key: string; name: string; n: number; nb?: number; date?: string };

export class PlanError extends Error {}

async function env() {
  const { env } = await getCloudflareContext({ async: true });
  const e = env as unknown as Record<string, unknown>;
  const s = (k: string) => (typeof e[k] === "string" ? (e[k] as string).trim() : "") || (process.env[k] ?? "").trim();
  return { token: s("PLANS_GITHUB_TOKEN"), repo: s("PLANS_GITHUB_REPO") || "ValuefyTM/tools", branch: s("PLANS_GITHUB_BRANCH") || "main" };
}

export async function githubReady() {
  return !!(await env()).token;
}

async function gh<T = unknown>(method: string, path: string, body?: unknown, base = API): Promise<T> {
  const { token, repo } = await env();
  if (!token) throw new PlanError("Lipsește PLANS_GITHUB_TOKEN din setările Cloudflare ale Tools (vezi README, „Planuri cadastrale din admin”).");
  const raw = body instanceof Blob || body instanceof ArrayBuffer;
  const res = await fetch(`${base}/repos/${repo}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "valuefy-tools",
      ...(body === undefined ? {} : { "Content-Type": raw ? "application/gzip" : "application/json" }),
    },
    body: body === undefined ? undefined : raw ? (body as BodyInit) : JSON.stringify(body),
  }).catch(() => null);
  if (!res) throw new PlanError("GitHub nu răspunde. Încearcă din nou peste câteva minute.");
  if (res.status === 204) return undefined as T;
  const d = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) {
    if (res.status === 401) throw new PlanError("GitHub a refuzat tokenul PLANS_GITHUB_TOKEN (expirat sau greșit).");
    if (res.status === 403 || res.status === 404) throw new PlanError(`Tokenul GitHub nu are acces la ${repo} (trebuie Contents și Actions: read and write). ${d.message ?? ""}`.trim());
    throw new PlanError(`GitHub: ${d.message ?? `HTTP ${res.status}`}`);
  }
  return d;
}

/** The UATs of the locator, from its page (the list it shows), with their plan dates. */
export async function uats(req: Request): Promise<Uat[]> {
  const page = await locatorAsset("index.html", req);
  if (!page) return [];
  const html = await page.text();
  const at = html.indexOf("const UATS=");
  const end = html.indexOf("].map(u=>", at);
  if (at < 0 || end < 0) return [];
  try {
    const list = JSON.parse(html.slice(at + "const UATS=".length, end + 1)) as Uat[];
    return list.map(({ key, name, n, nb, date }) => ({ key, name, n, nb, date })).sort((a, b) => a.name.localeCompare(b.name, "ro"));
  } catch {
    return [];
  }
}

export async function listUploads(db: D1Database) {
  const { results } = await db.prepare(`SELECT p.*, COALESCE(NULLIF(u.name, ''), u.email) AS by_name FROM plan_uploads p LEFT JOIN users u ON u.id = p.created_by
    ORDER BY p.created_at DESC LIMIT 40`).all<PlanUpload>();
  return results;
}

async function release(): Promise<number> {
  const list = await gh<{ id: number; tag_name: string; draft: boolean }[]>("GET", "/releases?per_page=100");
  const r = list.find((x) => x.tag_name === RELEASE_TAG);
  if (r) return r.id;
  const made = await gh<{ id: number }>("POST", "/releases", { tag_name: RELEASE_TAG, name: "Planuri cadastrale încărcate (temporar)", draft: true,
    body: "Fișierele DXF încărcate din panoul admin, până la conversie. Se șterg automat." });
  return made.id;
}

export type CheckStep = { label: string; ok: boolean; detail: string };

/** "Verifică legătura cu GitHub": the token, access to the repository, the workflow, the upload release (Contents write). */
export async function githubCheck(): Promise<CheckStep[]> {
  const { token, repo } = await env();
  const steps: CheckStep[] = [];
  const step = async (label: string, run: () => Promise<string>) => {
    if (steps.some((x) => !x.ok)) return;
    try { steps.push({ label, ok: true, detail: await run() }); } catch (e) { steps.push({ label, ok: false, detail: e instanceof PlanError ? e.message : String(e) }); }
  };
  await step("Token în Cloudflare (PLANS_GITHUB_TOKEN)", async () => {
    if (!token) throw new PlanError("Lipsește. Pune-l în Cloudflare → Workers → tools → Settings → Variables and Secrets, apoi fă deploy.");
    return `găsit (${token.slice(0, 11)}…)`;
  });
  await step(`Acces la ${repo}`, async () => {
    const r = await gh<{ full_name: string; permissions?: { push?: boolean } }>("GET", "");
    if (r.permissions && r.permissions.push === false) throw new PlanError("Tokenul poate doar citi: dă-i Contents: Read and write.");
    return r.full_name;
  });
  await step("Fluxul de conversie (.github/workflows/plan.yml)", async () => {
    const w = await gh<{ state: string }>("GET", `/actions/workflows/${WORKFLOW}`);
    if (w.state !== "active") throw new PlanError(`Workflow-ul este ${w.state}: activează-l în GitHub → Actions.`);
    return "activ (Actions: citire OK)";
  });
  await step("Locul pentru fișierele încărcate (Contents: scriere)", async () => `release „${RELEASE_TAG}” #${await release()}`);
  return steps;
}

async function dispatch(inputs: Record<string, string>) {
  const { branch } = await env();
  await gh("POST", `/actions/workflows/${WORKFLOW}/dispatches`, { ref: branch, inputs });
}

/** A new plan: the compressed DXF goes to GitHub and the conversion starts. */
export async function startUpload(db: D1Database, c: Ctx, f: { key: string; name: string; isNew: boolean; fileName: string; size: number; date: string | null; body: Blob }) {
  const busy = await db.prepare(`SELECT id FROM plan_uploads WHERE uat_key = ? AND status IN (${ACTIVE.map(() => "?").join(",")})`).bind(f.key, ...ACTIVE).first();
  if (busy) throw new PlanError("Pentru acest UAT există deja un plan în lucru: publică-l sau renunță la el înainte de unul nou.");
  const id = uuid().slice(0, 8);
  const rel = await release();
  const asset = await gh<{ id: number }>("POST", `/releases/${rel}/assets?name=${id}.dxf.gz`, f.body, "https://uploads.github.com");
  const t = now();
  await db.prepare(`INSERT INTO plan_uploads (id, uat_key, uat_name, new_uat, file_name, size, plan_date, asset_id, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'converting', ?, ?, ?)`).bind(id, f.key, f.name, f.isNew ? 1 : 0, f.fileName, f.size, f.date, asset.id, c.user.id, t, t).run();
  try {
    await dispatch({ mode: "convert", id, key: f.key, name: f.isNew ? f.name : "", asset: String(asset.id) });
  } catch (e) {
    await db.prepare("UPDATE plan_uploads SET status = 'failed', error = ?, updated_at = ? WHERE id = ?").bind(String((e as Error).message), now(), id).run();
    throw e;
  }
  await track(db, c, "admin", "plan_upload", f.key, { id, file: f.fileName, size: f.size });
  return id;
}

type Run = { id: number; display_title: string; status: string; conclusion: string | null; html_url: string; created_at: string };

/** Brings the uploads in progress up to date with their GitHub runs. */
export async function refresh(db: D1Database) {
  const open = (await db.prepare("SELECT * FROM plan_uploads WHERE status IN ('converting', 'publishing')").all<PlanUpload>()).results;
  if (!open.length || !(await githubReady())) return;
  const runs = (await gh<{ workflow_runs: Run[] }>("GET", `/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=50`)).workflow_runs;
  for (const u of open) {
    const mode = u.status === "converting" ? "convert" : "publish";
    const run = runs.find((r) => r.display_title === `plan ${mode} ${u.id}`);
    if (!run) {
      // never started (e.g. the workflow file is not on GitHub yet)
      if (Date.now() - new Date(u.updated_at).getTime() > 15 * 60e3)
        await db.prepare("UPDATE plan_uploads SET status = 'failed', error = ?, updated_at = ? WHERE id = ?")
          .bind("Conversia nu a pornit pe GitHub (verifică fișierul .github/workflows/plan.yml și tokenul).", now(), u.id).run();
      continue;
    }
    if (run.status !== "completed") {
      if (u.run_url !== run.html_url) await db.prepare("UPDATE plan_uploads SET run_url = ? WHERE id = ?").bind(run.html_url, u.id).run();
      continue;
    }
    const t = now();
    if (run.conclusion !== "success") {
      await db.prepare("UPDATE plan_uploads SET status = 'failed', error = ?, run_url = ?, updated_at = ? WHERE id = ?")
        .bind(mode === "convert" ? "Conversia a eșuat. Detaliile sunt în jurnalul de pe GitHub." : "Publicarea a eșuat. Detaliile sunt în jurnalul de pe GitHub.", run.html_url, t, u.id).run();
    } else if (mode === "convert") {
      const commit = await gh<{ commit: { message: string } }>("GET", `/commits/plan/${u.id}`).catch(() => null);
      const summary = commit?.commit.message.split("\n").slice(2).join("\n").trim() || null;
      await db.prepare("UPDATE plan_uploads SET status = 'ready', summary = ?, run_url = ?, updated_at = ? WHERE id = ?").bind(summary, run.html_url, t, u.id).run();
    } else {
      await db.prepare("UPDATE plan_uploads SET status = 'published', published_at = ?, run_url = ?, updated_at = ? WHERE id = ?").bind(t, run.html_url, t, u.id).run();
    }
  }
}

export async function publish(db: D1Database, c: Ctx, id: string) {
  const u = await db.prepare("SELECT * FROM plan_uploads WHERE id = ?").bind(id).first<PlanUpload>();
  if (!u) throw new PlanError("Planul nu există.");
  // a failed publication (the conversion had worked: there is a summary) can be tried again
  if (u.status !== "ready" && !(u.status === "failed" && u.summary)) throw new PlanError("Doar un plan convertit se poate publica.");
  await dispatch({ mode: "publish", id: u.id, key: u.uat_key, name: u.uat_name, asset: "" });
  await db.prepare("UPDATE plan_uploads SET status = 'publishing', error = NULL, updated_at = ? WHERE id = ?").bind(now(), id).run();
  await track(db, c, "admin", "plan_publish", u.uat_key, { id });
}

export async function discard(db: D1Database, c: Ctx, id: string) {
  const u = await db.prepare("SELECT * FROM plan_uploads WHERE id = ?").bind(id).first<PlanUpload>();
  if (!u) throw new PlanError("Planul nu există.");
  if (!["ready", "failed"].includes(u.status)) throw new PlanError("Planul nu se mai poate anula acum.");
  await gh("DELETE", `/git/refs/heads/plan/${u.id}`).catch(() => null);
  if (u.asset_id) await gh("DELETE", `/releases/assets/${u.asset_id}`).catch(() => null);
  await db.prepare("UPDATE plan_uploads SET status = 'discarded', updated_at = ? WHERE id = ?").bind(now(), id).run();
  await track(db, c, "admin", "plan_discard", u.uat_key, { id });
}
