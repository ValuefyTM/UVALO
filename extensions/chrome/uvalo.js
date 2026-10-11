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
      ? `<h2>Nu este inclus în abonament</h2><p>${msg || "Planul firmei tale nu include UVALO pentru Chrome."} Scrie-ne la <a href="mailto:office@valuefy.ro">office@valuefy.ro</a>.</p>${retry}`
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
