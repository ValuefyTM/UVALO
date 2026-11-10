/* UVALO pentru Chrome: legătura cu contul UVALO.
   La deschiderea panoului verifică dacă ești conectat în UVALO și dacă planul firmei include extensia
   (/api/chrome/status, cu cookie-ul sesiunii UVALO din Chrome). Folosirea (capturi, exporturi) apare în
   statisticile UVALO; capturile rămân doar în acest browser. */
const UVALO = "https://app.uvalo.ro";
const UV_VERSION = chrome.runtime.getManifest().version;
let uvOk = false;

function uvTrack(action, target, meta) {
  if (!uvOk) return;
  fetch(UVALO + "/api/track", {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ module: "chrome", events: [{ action, target: target ? String(target).slice(0, 300) : undefined, meta }] }),
  }).catch(() => {});
}

function uvGate(kind, msg) {
  let g = document.getElementById("uvGate");
  if (!kind) { if (g) g.remove(); return; }
  if (!g) { g = document.createElement("div"); g.id = "uvGate"; g.className = "gate"; document.body.appendChild(g); }
  const login = `<button class="btn btn-primary" id="uvLogin">Conectează-te la UVALO</button>`;
  const retry = `<button class="btn btn-ghost" id="uvRetry">Am făcut, verifică din nou</button>`;
  const body = kind === "login"
    ? `<h2>Conectează-te cu contul UVALO</h2><p>Extensia funcționează cu contul tău UVALO. Se deschide pagina de conectare într-un tab nou; după ce intri în cont, revino aici.</p>${login}${retry}`
    : kind === "plan"
      ? `<h2>Nu este inclus în abonament</h2><p>${msg || "Planul firmei tale nu include UVALO pentru Chrome."} Scrie-ne la <a href="mailto:office@uvalo.ro">office@uvalo.ro</a>.</p>${retry}`
      : `<h2>UVALO este în mentenanță</h2><p>${msg || "Revenim în curând."}</p>${retry}`;
  g.innerHTML = `<div class="gate-top"><img src="icons/uvalo-lockup.svg" alt="UVALO"></div><div class="gate-body">${body}</div>`;
  const l = document.getElementById("uvLogin");
  if (l) l.onclick = () => chrome.tabs.create({ url: UVALO + "/login?next=" + encodeURIComponent("/chrome?conectat=1") });
  document.getElementById("uvRetry").onclick = uvCheck;
}

async function uvCheck() {
  const foot = document.getElementById("uvFoot");
  try {
    const r = await fetch(UVALO + "/api/chrome/status?v=" + UV_VERSION, { credentials: "include", cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) { uvOk = false; return uvGate("login"); }
    if (r.status === 403) { uvOk = false; return uvGate("plan", d.error); }
    if (r.status === 503) { uvOk = false; return uvGate("maint", d.error); }
    if (!r.ok) throw new Error(String(r.status));
    uvOk = true; uvGate(null);
    if (foot) foot.innerHTML = `UVALO · ${escapeHtml(d.name || "")} · v${UV_VERSION}${d.latest && d.latest !== UV_VERSION ? ` · <a href="${UVALO}/chrome#instalare" target="_blank">versiune nouă</a>` : ""}`;
  } catch (e) {
    // fără internet sau UVALO indisponibil: extensia merge mai departe (capturile sunt locale)
    uvOk = false; uvGate(null);
    if (foot) foot.textContent = `UVALO indisponibil acum · v${UV_VERSION}`;
  }
}

document.addEventListener("DOMContentLoaded", uvCheck);
window.addEventListener("focus", () => { if (!uvOk) uvCheck(); });

/* ── „Trimite în Word”: comparabilele capturate ajung în contul UVALO, de unde add-in-ul Word le inserează ── */
const UV_MAX = 1800000; // o imagine păstrată de UVALO are cel mult ~1,9 MB

async function uvShrink(blob) {
  // anunțurile foarte încărcate pot da felii prea mari: le recomprimăm (și micșorăm, la nevoie)
  if (blob.size <= UV_MAX) return blob;
  const bmp = await createImageBitmap(blob);
  let scale = 1, q = 0.82, out = blob;
  for (let k = 0; k < 6 && out.size > UV_MAX; k++) {
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    out = await new Promise((r) => c.toBlob(r, "image/jpeg", q));
    if (k % 2) scale *= 0.85; else q = Math.max(0.6, q - 0.08);
  }
  bmp.close();
  return out;
}

async function uvSendToWord() {
  if (busy) return;
  if (!uvOk) { await uvCheck(); if (!uvOk) return; }
  const groups = state.groups
    .map((g) => ({ name: g.name, items: g.items.filter((i) => i.status === "captured" && i.slices) }))
    .filter((g) => g.items.length);
  const items = groups.flatMap((g) => g.items);
  if (!items.length) { alert("Nu ai încă nicio comparabilă capturată. Capturează anunțurile (📷), apoi trimite-le în Word."); return; }
  busy = true;
  try {
    setProgress(true, "Se pregătește trimiterea în Word…", 0.02);
    const body = { groups: groups.map((g) => ({ name: g.name, items: g.items.map((i) => ({ id: i.id, label: i.label || "", title: i.title || "", url: i.url, capturedAt: i.capturedAt || null, slices: i.slices })) })) };
    const r = await fetch(UVALO + "/api/chrome/batch", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "UVALO nu a primit lista (" + r.status + ").");
    const total = items.reduce((n, i) => n + i.slices, 0);
    let done = 0;
    for (const it of items) {
      const blobs = await getSlices(it.id, it.slices);
      if (blobs.length !== it.slices) throw new Error(`Capturile pentru „${it.label || it.title}” nu mai sunt complete. Re-capturează anunțul (📷).`);
      for (let k = 0; k < blobs.length; k++) {
        setProgress(true, `Se trimite în Word: ${shorten(it.label || it.title, 30)} · imaginea ${k + 1}/${blobs.length}`, 0.05 + 0.9 * (done / total));
        const img = await uvShrink(blobs[k]);
        const dims = await blobDims(img);
        const u = `${UVALO}/api/chrome/batch/${d.id}/${encodeURIComponent(it.id)}/${k}?w=${dims.w}&h=${dims.h}`;
        let ok = false, last = "";
        for (let tr = 0; tr < 3 && !ok; tr++) {
          const p = await fetch(u, { method: "PUT", credentials: "include", headers: { "Content-Type": img.type || "image/jpeg" }, body: img }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: e.message }) }));
          ok = p.ok; if (!ok) { last = ((await p.json().catch(() => ({}))).error) || String(p.status); await sleep(800); }
        }
        if (!ok) throw new Error("O imagine nu a ajuns în UVALO: " + last);
        done++;
      }
    }
    const f = await fetch(`${UVALO}/api/chrome/batch/${d.id}/done`, { method: "POST", credentials: "include" });
    if (!f.ok) throw new Error(((await f.json().catch(() => ({}))).error) || "Trimiterea nu s-a încheiat.");
    setProgress(false);
    alert(`Gata: ${items.length} ${items.length === 1 ? "comparabilă trimisă" : "comparabile trimise"} în Word.\n\nÎn Word: tab-ul UVALO → Instrumente → „Comparabile din Chrome” → Inserează.\nTrimiterea rămâne disponibilă 7 zile; o trimitere nouă o înlocuiește.`);
  } catch (e) {
    setProgress(false);
    alert("Nu am putut trimite în Word: " + (e && e.message ? e.message : e));
  } finally {
    busy = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const b = document.getElementById("btnSendWord");
  if (b) b.addEventListener("click", uvSendToWord);
});
