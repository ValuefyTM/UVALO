// The UVALO MCP server (Model Context Protocol, Streamable HTTP, stateless JSON-RPC over POST), for Claude and other
// assistants: for now the cadastral locator's tools (src/lib/mcp-localizare.ts). Authentication = the firm's API key from
// "Firma mea → Integrare", as `Authorization: Bearer uvk_…` or, for clients that cannot send headers (claude.ai connectors),
// in the path: /api/mcp/uvk_…  The firm's plan decides the modules (the locator, Google address search).
import { NextResponse } from "next/server";
import { getDb, now } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { ORG_SQL, orgBlock, type Org } from "@/lib/access";
import { toolSettings } from "@/lib/tools";
import { track } from "@/lib/track";
import { callTool, mcpContext, ToolError, TOOLS } from "@/lib/mcp-localizare";

const VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
const err = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
const unauthorized = (error: string) => NextResponse.json({ error }, { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="UVALO MCP"' } });

/** The key (header or path) → the firm and the modules of its plan. */
async function auth(req: Request, path: string[]) {
  const db = await getDb();
  if (!db) return { res: NextResponse.json({ error: "Baza de date nu este disponibilă." }, { status: 503 }) };
  const raw = ((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim() || path[0] || "").trim();
  if (!/^uvk_[A-Za-z0-9_-]{20,80}$/.test(raw)) return { res: unauthorized("Cheie API lipsă sau greșită: trimite „Authorization: Bearer uvk_…” (cheia din Firma mea → Integrare).") };
  const key = await db.prepare(`SELECT k.id, k.org_id, k.created_by, k.name FROM api_keys k JOIN orgs o ON o.id = k.org_id WHERE k.key_hash = ? AND k.revoked_at IS NULL`)
    .bind(await sha256(raw)).first<{ id: string; org_id: string; created_by: string; name: string }>();
  if (!key) return { res: unauthorized("Cheie API necunoscută sau revocată.") };
  const org = await db.prepare(`${ORG_SQL} WHERE o.id = ?`).bind(key.org_id).first<Org>();
  const block = org ? orgBlock(org) : "Firma cheii nu mai există.";
  const { off } = await toolSettings(db);
  const modules = org && !block ? org.modules.split(",").map((x) => x.trim()).filter((m) => !off.includes(m)) : [];
  await db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").bind(now(), key.id).run();
  return { db, key, org, block, modules };
}

export async function POST(req: Request, { params }: { params: Promise<{ key?: string[] }> }) {
  const a = await auth(req, (await params).key ?? []);
  if ("res" in a) return a.res;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json(err(null, -32700, "JSON invalid."), { status: 400 }); }
  const batch = Array.isArray(body), msgs = (batch ? body : [body]) as Rpc[];
  if (!msgs.length) return NextResponse.json(err(null, -32600, "Cerere goală."), { status: 400 });
  const c = await mcpContext(a.modules);
  const out: unknown[] = [];
  for (const m of msgs) {
    if (!m || typeof m !== "object" || typeof m.method !== "string") { out.push(err(m?.id, -32600, "Cerere JSON-RPC invalidă.")); continue; }
    if (m.id === undefined) continue; // a notification (notifications/initialized…): nothing to answer
    const p = m.params ?? {};
    switch (m.method) {
      case "initialize": {
        const v = String(p.protocolVersion ?? "");
        out.push({ jsonrpc: "2.0", id: m.id, result: {
          protocolVersion: VERSIONS.includes(v) ? v : VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "uvalo", title: "UVALO", version: "1.0.0" },
          instructions: `UVALO — platforma evaluatorilor autorizați din România. Firma: ${a.org?.name ?? "—"}.${a.block ? ` Atenție: ${a.block}` : ""} Instrumentele de aici sunt ale Localizatorului cadastral (planurile ANCPI din județul Timiș): imobile după nr. cadastral, după coordonate sau adresă, grila notarială 2026, conversii Stereo 70 ↔ GPS. Răspunde în română; datele sunt orientative și nu înlocuiesc extrasul CF.`,
        } });
        break;
      }
      case "ping": out.push({ jsonrpc: "2.0", id: m.id, result: {} }); break;
      case "tools/list": out.push({ jsonrpc: "2.0", id: m.id, result: { tools: TOOLS } }); break;
      case "resources/list": out.push({ jsonrpc: "2.0", id: m.id, result: { resources: [] } }); break;
      case "prompts/list": out.push({ jsonrpc: "2.0", id: m.id, result: { prompts: [] } }); break;
      case "tools/call": {
        const name = String(p.name ?? ""), args = (p.arguments && typeof p.arguments === "object" ? p.arguments : {}) as Record<string, unknown>;
        if (!TOOLS.some((t) => t.name === name)) { out.push(err(m.id, -32602, `Instrument necunoscut: ${name}.`)); break; }
        try {
          const data = await callTool(req, c, name, args);
          out.push({ jsonrpc: "2.0", id: m.id, result: { content: [{ type: "text", text: JSON.stringify(data, null, 1) }] } });
          await track(a.db, { user: { id: a.key.created_by }, session: { id: null }, org: { id: a.key.org_id } } as unknown as Parameters<typeof track>[1], "localizare", `mcp_${name}`.slice(0, 40), String(args.nr ?? args.adresa ?? args.localitate ?? "").slice(0, 120) || null, { key: a.key.id });
        } catch (e) {
          if (e instanceof ToolError) out.push({ jsonrpc: "2.0", id: m.id, result: { content: [{ type: "text", text: e.message }], isError: true } });
          else { console.error("[mcp]", e); out.push(err(m.id, -32603, "Eroare internă.")); }
        }
        break;
      }
      default: out.push(err(m.id, -32601, `Metodă necunoscută: ${m.method}.`));
    }
  }
  if (!out.length) return new Response(null, { status: 202 });
  return NextResponse.json(batch ? out : out[0], { headers: { "Cache-Control": "no-store" } });
}

/** No server-initiated stream (stateless server): clients that open one get 405 and carry on with POST. */
export function GET() {
  return NextResponse.json({ error: "Serverul MCP UVALO răspunde la POST (Streamable HTTP, fără sesiuni)." }, { status: 405, headers: { Allow: "POST" } });
}
export const DELETE = GET;
