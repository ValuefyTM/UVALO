// Server-only: OAuth 2.1 authorization server for the MCP endpoint (/api/mcp), so Claude connects with "sign in to UVALO"
// instead of a copied key: discovery documents (RFC 8414 / 9728), dynamic client registration (RFC 7591), authorization
// code + PKCE S256, opaque tokens `uvt_…` (sha256 in oauth_tokens) and refresh tokens `uvr_…`. Scopes: for now only
// "localizare" (the cadastral locator); the tokens act for the person, with their plan.
import { getUser, type User } from "./auth";
import { randomToken, sha256 } from "./crypto";
import { now, uuid } from "./db";

export const SCOPES = ["localizare"];
const ACCESS_DAYS = 30, REFRESH_DAYS = 180, CODE_MINUTES = 10;

export type OAuthClient = { id: string; name: string | null; redirect_uris: string };
export type OAuthToken = { id: string; client_id: string; client_name: string | null; user_id: string; scope: string | null; created_at: string; expires_at: string; last_used_at: string | null };

export const authServerMeta = (origin: string) => ({
  issuer: origin,
  authorization_endpoint: `${origin}/oauth/authorize`,
  token_endpoint: `${origin}/api/oauth/token`,
  registration_endpoint: `${origin}/api/oauth/register`,
  response_types_supported: ["code"],
  response_modes_supported: ["query"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
  scopes_supported: SCOPES,
  service_documentation: `${origin}/cont#claude`,
});
export const resourceMeta = (origin: string) => ({
  resource: `${origin}/api/mcp`,
  authorization_servers: [origin],
  scopes_supported: SCOPES,
  bearer_methods_supported: ["header"],
  resource_name: "UVALO",
  resource_documentation: `${origin}/cont#claude`,
});

const okRedirect = (u: string) => {
  try {
    const x = new URL(u);
    return (x.protocol === "https:" || (x.protocol === "http:" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(x.hostname))) && !x.hash;
  } catch { return false; }
};

/** Dynamic client registration: the client's name and redirect URIs; no secret (public clients with PKCE). */
export async function registerClient(db: D1Database, b: Record<string, unknown>) {
  const uris = (Array.isArray(b.redirect_uris) ? b.redirect_uris : []).filter((u): u is string => typeof u === "string" && u.length < 500 && okRedirect(u)).slice(0, 10);
  if (!uris.length) return { error: "invalid_redirect_uri", error_description: "redirect_uris: cel puțin o adresă https (sau http://localhost)." };
  const id = `uvc_${randomToken().slice(0, 24)}`, name = typeof b.client_name === "string" ? b.client_name.trim().slice(0, 120) : null;
  await db.prepare("INSERT INTO oauth_clients (id, name, redirect_uris) VALUES (?, ?, ?)").bind(id, name, JSON.stringify(uris)).run();
  return {
    client_id: id, client_name: name ?? undefined, redirect_uris: uris, token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], client_id_issued_at: Math.floor(Date.now() / 1000),
  };
}

export const getClient = (db: D1Database, id: string) => db.prepare("SELECT id, name, redirect_uris FROM oauth_clients WHERE id = ?").bind(id).first<OAuthClient>();
export const clientAllows = (c: OAuthClient, uri: string) => (JSON.parse(c.redirect_uris) as string[]).includes(uri);

/** Parameters of /oauth/authorize, checked; `error` is shown to the person (the redirect URI is not trusted yet). */
export async function checkAuthorize(db: D1Database, q: URLSearchParams) {
  const clientId = q.get("client_id") ?? "", redirect = q.get("redirect_uri") ?? "", challenge = q.get("code_challenge") ?? "";
  const client = clientId ? await getClient(db, clientId) : null;
  if (!client) return { error: "Aplicația nu este înregistrată (client_id necunoscut). Încearcă din nou conectarea din Claude." };
  if (!redirect || !clientAllows(client, redirect)) return { error: "Adresa de întoarcere (redirect_uri) nu este cea înregistrată de aplicație." };
  if ((q.get("response_type") ?? "code") !== "code") return { error: "Doar response_type=code este acceptat." };
  if (!challenge || (q.get("code_challenge_method") ?? "S256") !== "S256") return { error: "Lipsește code_challenge (PKCE S256)." };
  const scope = (q.get("scope") ?? "").split(/[\s+]+/).filter((s) => SCOPES.includes(s));
  return { client, redirect, challenge, state: q.get("state") ?? "", scope: (scope.length ? scope : SCOPES).join(" ") };
}

/** A single-use code for the person who allowed the client. */
export async function issueCode(db: D1Database, a: { clientId: string; userId: string; redirect: string; challenge: string; scope: string }) {
  const code = randomToken();
  await db.prepare("INSERT INTO oauth_codes (code_hash, client_id, user_id, redirect_uri, challenge, scope, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(await sha256(code), a.clientId, a.userId, a.redirect, a.challenge, a.scope, new Date(Date.now() + CODE_MINUTES * 60_000).toISOString()).run();
  return code;
}

const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

async function newTokens(db: D1Database, clientId: string, clientName: string | null, userId: string, scope: string | null) {
  const access = `uvt_${randomToken()}`, refresh = `uvr_${randomToken()}`;
  await db.prepare("INSERT INTO oauth_tokens (id, token_hash, refresh_hash, client_id, client_name, user_id, scope, expires_at, refresh_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(uuid(), await sha256(access), await sha256(refresh), clientId, clientName, userId, scope,
      new Date(Date.now() + ACCESS_DAYS * 864e5).toISOString(), new Date(Date.now() + REFRESH_DAYS * 864e5).toISOString()).run();
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_DAYS * 86400, refresh_token: refresh, scope: scope ?? undefined };
}

/** The token endpoint: authorization_code (with PKCE) or refresh_token (rotated). Errors in the OAuth form. */
export async function exchange(db: D1Database, b: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  const bad = (error: string, error_description: string, status = 400) => ({ status, body: { error, error_description } });
  const grant = s(b.grant_type), clientId = s(b.client_id);
  if (grant === "authorization_code") {
    const code = s(b.code), verifier = s(b.code_verifier);
    if (!code || !verifier) return bad("invalid_request", "Lipsește code sau code_verifier.");
    const row = await db.prepare("SELECT code_hash, client_id, user_id, redirect_uri, challenge, scope, expires_at, used_at FROM oauth_codes WHERE code_hash = ?").bind(await sha256(code))
      .first<{ code_hash: string; client_id: string; user_id: string; redirect_uri: string; challenge: string | null; scope: string | null; expires_at: string; used_at: string | null }>();
    if (!row || row.used_at || row.expires_at < now()) return bad("invalid_grant", "Codul este necunoscut, folosit sau expirat.");
    if (clientId && clientId !== row.client_id) return bad("invalid_grant", "Codul aparține altui client.");
    if (b.redirect_uri !== undefined && s(b.redirect_uri) !== row.redirect_uri) return bad("invalid_grant", "redirect_uri diferă de cel de la autorizare.");
    if (b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))) !== row.challenge) return bad("invalid_grant", "code_verifier nu se potrivește (PKCE).");
    await db.prepare("UPDATE oauth_codes SET used_at = ? WHERE code_hash = ?").bind(now(), row.code_hash).run();
    const client = await getClient(db, row.client_id);
    const user = await getUser(db, row.user_id);
    if (!user || user.status !== "active") return bad("invalid_grant", "Contul nu mai este activ.");
    return { status: 200, body: await newTokens(db, row.client_id, client?.name ?? null, row.user_id, row.scope) };
  }
  if (grant === "refresh_token") {
    const refresh = s(b.refresh_token);
    if (!refresh) return bad("invalid_request", "Lipsește refresh_token.");
    const row = await db.prepare("SELECT id, client_id, client_name, user_id, scope, refresh_expires_at, revoked_at FROM oauth_tokens WHERE refresh_hash = ?").bind(await sha256(refresh))
      .first<{ id: string; client_id: string; client_name: string | null; user_id: string; scope: string | null; refresh_expires_at: string | null; revoked_at: string | null }>();
    if (!row || row.revoked_at || (row.refresh_expires_at && row.refresh_expires_at < now())) return bad("invalid_grant", "refresh_token necunoscut, revocat sau expirat.");
    if (clientId && clientId !== row.client_id) return bad("invalid_grant", "Tokenul aparține altui client.");
    const user = await getUser(db, row.user_id);
    if (!user || user.status !== "active") return bad("invalid_grant", "Contul nu mai este activ.");
    await db.prepare("UPDATE oauth_tokens SET revoked_at = ? WHERE id = ?").bind(now(), row.id).run();
    return { status: 200, body: await newTokens(db, row.client_id, row.client_name, row.user_id, row.scope) };
  }
  return bad("unsupported_grant_type", "Doar authorization_code și refresh_token.");
}

/** The person behind `Authorization: Bearer uvt_…`, or null. */
export async function tokenUser(db: D1Database, raw: string): Promise<{ user: User; token: OAuthToken } | null> {
  if (!/^uvt_[A-Za-z0-9_-]{20,80}$/.test(raw)) return null;
  const t = await db.prepare("SELECT id, client_id, client_name, user_id, scope, created_at, expires_at, last_used_at FROM oauth_tokens WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?")
    .bind(await sha256(raw), now()).first<OAuthToken>();
  if (!t) return null;
  const user = await getUser(db, t.user_id);
  if (!user || user.status !== "active") return null;
  if (!t.last_used_at || Date.now() - new Date(t.last_used_at).getTime() > 5 * 60_000) await db.prepare("UPDATE oauth_tokens SET last_used_at = ? WHERE id = ?").bind(now(), t.id).run();
  return { user, token: t };
}

/** The apps a person connected (one row per live token), for "Contul meu". */
export const listApps = (db: D1Database, userId: string) =>
  db.prepare("SELECT id, client_id, client_name, user_id, scope, created_at, expires_at, last_used_at FROM oauth_tokens WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC")
    .bind(userId, now()).all<OAuthToken>().then((r) => r.results);
export const revokeApp = (db: D1Database, userId: string, id: string) =>
  db.prepare("UPDATE oauth_tokens SET revoked_at = ? WHERE user_id = ? AND id = ? AND revoked_at IS NULL").bind(now(), userId, id).run();
