// Server-only: Web Push for the phone app (Inspecții). The VAPID keys are made on first use and kept in app_settings
// ("vapid"); a message is encrypted for each phone (RFC 8291, aes128gcm) and signed (RFC 8292, ES256), all with WebCrypto.
import { now, uuid } from "./db";

const te = new TextEncoder();
const b64u = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const bs = (u: Uint8Array) => u as unknown as BufferSource;
const cat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };

type Vapid = { pub: string; jwk: JsonWebKey };
let cached: Vapid | null = null;

/** The VAPID key pair (public key in base64url, as the phone needs it to subscribe). */
export async function vapid(db: D1Database): Promise<Vapid> {
  if (cached) return cached;
  const row = await db.prepare("SELECT value FROM app_settings WHERE key = 'vapid'").first<{ value: string }>();
  if (row) return (cached = JSON.parse(row.value) as Vapid);
  const kp = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const v: Vapid = { pub: b64u((await crypto.subtle.exportKey("raw", kp.publicKey)) as ArrayBuffer), jwk: (await crypto.subtle.exportKey("jwk", kp.privateKey)) as JsonWebKey };
  await db.prepare("INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES ('vapid', ?, ?)").bind(JSON.stringify(v), now()).run();
  const again = await db.prepare("SELECT value FROM app_settings WHERE key = 'vapid'").first<{ value: string }>();
  return (cached = JSON.parse(again!.value) as Vapid);
}

async function jwt(v: Vapid, aud: string) {
  const enc = (o: object) => b64u(te.encode(JSON.stringify(o)));
  const data = `${enc({ typ: "JWT", alg: "ES256" })}.${enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:office@uvalo.ro" })}`;
  const key = await crypto.subtle.importKey("jwk", v.jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  return `${data}.${b64u(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(data)))}`;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const k = await crypto.subtle.importKey("raw", bs(ikm), "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: bs(salt), info: bs(info) }, k, bytes * 8));
}

/** The message encrypted for one phone (aes128gcm, one record). */
async function encrypt(payload: string, p256dh: string, auth: string) {
  const ua = unb64u(p256dh), secret = unb64u(auth);
  const eph = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const as = new Uint8Array((await crypto.subtle.exportKey("raw", eph.publicKey)) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey("raw", bs(ua), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(secret, shared, cat(te.encode("WebPush: info\0"), ua, as), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", bs(cek), "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: bs(nonce) }, key, bs(cat(te.encode(payload), new Uint8Array([2])))));
  const head = new Uint8Array(21); head.set(salt); new DataView(head.buffer).setUint32(16, 4096); head[20] = as.length;
  return cat(head, as, ct);
}

export type PushMsg = { title: string; body: string; url?: string; tag?: string };
type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

/** Sends to one phone. A subscription the push service no longer knows (404 / 410) is removed. */
async function sendOne(db: D1Database, v: Vapid, s: Sub, msg: PushMsg) {
  try {
    const res = await fetch(s.endpoint, {
      method: "POST",
      headers: { Authorization: `vapid t=${await jwt(v, new URL(s.endpoint).origin)}, k=${v.pub}`, "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "high" },
      body: bs(await encrypt(JSON.stringify(msg), s.p256dh, s.auth)),
    });
    if (res.status === 404 || res.status === 410) await db.prepare("DELETE FROM insp_push WHERE id = ?").bind(s.id).run();
    else if (res.ok) await db.prepare("UPDATE insp_push SET last_ok_at = ?, fails = 0 WHERE id = ?").bind(now(), s.id).run();
    else await db.prepare("UPDATE insp_push SET fails = fails + 1 WHERE id = ?").bind(s.id).run();
    return res.ok;
  } catch { return false; }
}

/** Sends a notification to every phone of a person. Returns how many phones got it. */
export async function notifyUser(db: D1Database, userId: string, msg: PushMsg) {
  const { results } = await db.prepare("SELECT id, endpoint, p256dh, auth FROM insp_push WHERE user_id = ? AND fails < 20").bind(userId).all<Sub>();
  if (!results.length) return 0;
  const v = await vapid(db);
  return (await Promise.all(results.map((s) => sendOne(db, v, s, msg)))).filter(Boolean).length;
}

export async function saveSubscription(db: D1Database, userId: string, sub: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }, ua: string) {
  const ep = typeof sub.endpoint === "string" ? sub.endpoint : "", p = sub.keys?.p256dh, a = sub.keys?.auth;
  if (!/^https:\/\//.test(ep) || ep.length > 1000 || typeof p !== "string" || typeof a !== "string" || p.length > 200 || a.length > 100) return false;
  await db.prepare(`INSERT INTO insp_push (id, user_id, endpoint, p256dh, auth, ua) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua, fails = 0`)
    .bind(uuid(), userId, ep, p, a, ua.slice(0, 300)).run();
  return true;
}

export async function removeSubscription(db: D1Database, userId: string, endpoint: string) {
  await db.prepare("DELETE FROM insp_push WHERE user_id = ? AND endpoint = ?").bind(userId, endpoint).run();
}

/** Marks a scheduled notification as sent; false when it already was (so it goes out once). */
export async function once(db: D1Database, key: string) {
  const r = await db.prepare("INSERT OR IGNORE INTO insp_push_sent (key) VALUES (?)").bind(key).run();
  return (r.meta.changes ?? 0) > 0;
}
