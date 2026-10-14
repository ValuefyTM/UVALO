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

/** Sends everything waiting: photos first, then the finished sheets. Returns how many items are still waiting. */
export async function flush(): Promise<number> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return (await allFiles()).length + (await allFinish()).length;
  for (const f of await allFiles()) {
    const fd = new FormData();
    fd.append("id", f.insp); fd.append("kind", f.kind); fd.append("file", new File([f.blob], f.name, { type: f.blob.type || "image/jpeg" }));
    fd.append("name", f.name); fd.append("room", f.room); fd.append("taken_at", f.taken_at);
    if (f.lat != null) { fd.append("lat", String(f.lat)); fd.append("lng", String(f.lng)); }
    try {
      const r = await fetch("/api/inspectii/files", { method: "POST", body: fd });
      if (r.ok || r.status === 400 || r.status === 404) await delFile(f.id); // 400/404: will never succeed (wrong type, inspection gone)
    } catch { break; }
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
