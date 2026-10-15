// Phone app: what waits to be sent (photos, signatures, finished sheets) is kept in IndexedDB, so nothing is lost without signal.

export type QPhoto = { id: string; insp: string; kind: "photo" | "signature"; room: string; name: string; taken_at: string; lat: number | null; lng: number | null; blob: Blob };
export type QFinish = { id: string; insp: string; body: Record<string, unknown> };

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open("uvalo-insp", 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("files", { keyPath: "id" }); r.result.createObjectStore("finish", { keyPath: "id" }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(store: string, mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => {
    const r = f(db.transaction(store, mode).objectStore(store));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export const putFile = (x: QPhoto) => tx("files", "readwrite", (s) => s.put(x));
export const delFile = (id: string) => tx("files", "readwrite", (s) => s.delete(id));
export const allFiles = () => tx<QPhoto[]>("files", "readonly", (s) => s.getAll() as IDBRequest<QPhoto[]>).catch(() => [] as QPhoto[]);
export const putFinish = (x: QFinish) => tx("finish", "readwrite", (s) => s.put(x));
export const delFinish = (id: string) => tx("finish", "readwrite", (s) => s.delete(id));
export const allFinish = () => tx<QFinish[]>("finish", "readonly", (s) => s.getAll() as IDBRequest<QFinish[]>).catch(() => [] as QFinish[]);

/** Upload progress for the page: "prep" = photos being prepared on the phone, "send" = being sent. */
export type UploadProgress = { phase: "prep" | "send"; done: number; total: number } | null;
export const progress = (p: UploadProgress) => { try { window.dispatchEvent(new CustomEvent("insp-upload", { detail: p })); } catch {} };

let running: Promise<number> | null = null;

/**
 * Sends everything waiting: photos first, then the finished sheets. Returns how many items are still waiting.
 * One run at a time (the timer, the network coming back and a new photo may all ask at once; two runs would send a photo twice).
 */
export function flush(): Promise<number> {
  if (running) return running.then(() => flush()); // what was added meanwhile goes in the next run
  running = doFlush().finally(() => { running = null; progress(null); });
  return running;
}

async function doFlush(): Promise<number> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return (await allFiles()).length + (await allFinish()).length;
  const files = await allFiles();
  let done = 0;
  if (files.length) progress({ phase: "send", done, total: files.length });
  for (const f of files) {
    const fd = new FormData();
    fd.append("id", f.insp); fd.append("kind", f.kind); fd.append("file", new File([f.blob], f.name, { type: f.blob.type || "image/jpeg" }));
    fd.append("name", f.name); fd.append("room", f.room); fd.append("taken_at", f.taken_at);
    if (f.lat != null) { fd.append("lat", String(f.lat)); fd.append("lng", String(f.lng)); }
    try {
      const r = await fetch("/api/inspectii/files", { method: "POST", body: fd });
      if (r.ok || r.status === 400 || r.status === 404) await delFile(f.id); // 400/404: will never succeed (wrong type, inspection gone)
    } catch { break; }
    progress({ phase: "send", done: ++done, total: files.length });
  }
  for (const x of await allFinish()) {
    if ((await allFiles()).some((f) => f.insp === x.insp)) continue; // its photos first
    try {
      const r = await fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x.body) });
      if (r.ok || r.status === 400) await delFinish(x.id);
    } catch { break; }
  }
  const left = (await allFiles()).length + (await allFinish()).length;
  if (!left) { try { localStorage.setItem("insp-sync", new Date().toISOString()); } catch {} }
  return left;
}

/** Photos are reduced on the phone (max. 2000 px, JPEG) before they are kept and sent. */
export async function shrink(f: Blob, max = 2000): Promise<Blob> {
  const url = URL.createObjectURL(f);
  try {
    const im = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const cv = document.createElement("canvas");
    cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
    cv.getContext("2d")!.drawImage(im, 0, 0, cv.width, cv.height);
    return await new Promise<Blob>((res) => cv.toBlob((b) => res(b ?? f), "image/jpeg", 0.85));
  } catch { return f; } finally { URL.revokeObjectURL(url); }
}

/**
 * When and where a photo was taken, from its EXIF (JPEG): DateTimeOriginal and the GPS position. Photos chosen from the
 * gallery keep their own time and place this way; null when the file has none (or the phone removed it when sharing).
 */
export async function readExif(f: Blob): Promise<{ taken_at: string | null; lat: number | null; lng: number | null } | null> {
  try {
    const v = new DataView(await f.slice(0, 256 * 1024).arrayBuffer());
    if (v.getUint16(0) !== 0xffd8) return null;
    let o = 2;
    while (o + 4 < v.byteLength) {
      const marker = v.getUint16(o), len = v.getUint16(o + 2);
      if (marker === 0xffe1 && v.getUint32(o + 4) === 0x45786966) return parseTiff(v, o + 10);
      if ((marker & 0xff00) !== 0xff00) return null;
      o += 2 + len;
    }
  } catch {}
  return null;
}

function parseTiff(v: DataView, t: number) {
  const le = v.getUint16(t) === 0x4949;
  const u16 = (p: number) => v.getUint16(p, le), u32 = (p: number) => v.getUint32(p, le);
  const ifd = (p: number) => {
    const out = new Map<number, number>(); // tag → offset of the entry
    const n = u16(t + p);
    for (let i = 0; i < n; i++) { const e = t + p + 2 + i * 12; out.set(u16(e), e); }
    return out;
  };
  const ascii = (e: number) => { const n = u32(e + 4), at = n > 4 ? t + u32(e + 8) : e + 8; let s = ""; for (let i = 0; i < n - 1; i++) s += String.fromCharCode(v.getUint8(at + i)); return s; };
  const rat3 = (e: number) => { const at = t + u32(e + 8); const r = (i: number) => u32(at + i * 8) / (u32(at + i * 8 + 4) || 1); return r(0) + r(1) / 60 + r(2) / 3600; };
  const ifd0 = ifd(u32(t + 4));
  let taken_at: string | null = null, lat: number | null = null, lng: number | null = null;
  const exifP = ifd0.get(0x8769);
  if (exifP != null) {
    const ex = ifd(u32(exifP + 8)), d = ex.get(0x9003) ?? ex.get(0x9004);
    const m = d != null ? ascii(d).match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/) : null;
    if (m) taken_at = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).toISOString(); // the phone's local time
  }
  const gpsP = ifd0.get(0x8825);
  if (gpsP != null) {
    const g = ifd(u32(gpsP + 8));
    const la = g.get(2), lo = g.get(4), laR = g.get(1), loR = g.get(3);
    if (la != null && lo != null) {
      lat = rat3(la) * (laR != null && String.fromCharCode(v.getUint8(laR + 8)) === "S" ? -1 : 1);
      lng = rat3(lo) * (loR != null && String.fromCharCode(v.getUint8(loR + 8)) === "W" ? -1 : 1);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) { lat = null; lng = null; }
    }
  }
  return { taken_at, lat, lng };
}
