/* ═══════════════════════════════════════════════════════════════
   Comparabile — panou lateral
   Captură full-page prin chrome.debugger (CDP), feliată pe pagini
   A4 portrait, apoi export .docx cu antet URL + data capturii.
   ═══════════════════════════════════════════════════════════════ */

"use strict";

/* ── Constante de geometrie ─────────────────────────────────────
   Captura se face la lățime CSS fixă de 850 px (layout compact,
   lizibil în portrait). În Word, pagina A4 cu margini de 0,5"
   are zona utilă de ~698 px × ~1026 px (la 96 dpi).
   Factor de scalare captură→Word: 698/850 ≈ 0,821.
   ⇒ o felie plină = 1240 px CSS; prima felie e mai scurtă,
   ca să lase loc antetului (titlu + sursă + dată).            */
const CAPTURE_WIDTH = 850;          // px CSS
const FIRST_SLICE_H = 1000;         // px CSS (lasă loc generos antetului)
const SLICE_H = 1200;               // px CSS (pagină A4 cu rezervă de siguranță)
const MAX_SLICES = 14;              // plafon de siguranță (~17.000 px)
const IMG_SCALE = 2;                // factor de claritate al capturii
const JPEG_QUALITY = 88;

const WORD_CONTENT_W_PX = 698;      // lățimea zonei utile A4 în Word
const WORD_MAX_H_FIRST = 850;       // înălțime max. prima felie (sub antet)
const WORD_MAX_H_FULL = 1005;       // înălțime max. felie plină (cu rezervă)

/* ── Stare ──────────────────────────────────────────────────── */
let state = { groups: [], settings: { revealContacts: true, captureMap: true } };
let stopRequested = false;
let busy = false;

const $ = (id) => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadState() {
  const data = await chrome.storage.local.get("state");
  if (data.state && Array.isArray(data.state.groups)) state = data.state;
  if (!state.settings) state.settings = {};
  if (typeof state.settings.revealContacts !== "boolean") state.settings.revealContacts = true;
  if (typeof state.settings.captureMap !== "boolean") state.settings.captureMap = true;
  if (state.groups.length === 0) {
    state.groups.push({ id: uid(), name: "Comparabile", items: [] });
  }
}
async function saveState() {
  await chrome.storage.local.set({ state });
}

function allItems() {
  return state.groups.flatMap((g) => g.items);
}
function findItem(itemId) {
  for (const g of state.groups) {
    const it = g.items.find((i) => i.id === itemId);
    if (it) return { group: g, item: it };
  }
  return null;
}

/* ── IndexedDB pentru imaginile capturate ───────────────────── */
const DB_NAME = "comparabile-capturi";
let dbPromise = null;
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("slices");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
async function putSlice(itemId, index, blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("slices", "readwrite");
    tx.objectStore("slices").put(blob, `${itemId}:${index}`);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function getSlices(itemId, count) {
  const db = await openDB();
  const out = [];
  for (let i = 0; i < count; i++) {
    const blob = await new Promise((resolve, reject) => {
      const req = db.transaction("slices").objectStore("slices").get(`${itemId}:${i}`);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    if (blob) out.push(blob);
  }
  return out;
}
async function deleteSlices(itemId, count) {
  const db = await openDB();
  const tx = db.transaction("slices", "readwrite");
  for (let i = 0; i < Math.max(count, MAX_SLICES); i++) {
    tx.objectStore("slices").delete(`${itemId}:${i}`);
  }
  return new Promise((r) => (tx.oncomplete = r));
}
async function clearAllSlices() {
  const db = await openDB();
  const tx = db.transaction("slices", "readwrite");
  tx.objectStore("slices").clear();
  return new Promise((r) => (tx.oncomplete = r));
}

/* ── Randare UI ─────────────────────────────────────────────── */
function fmtDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function render() {
  const wrap = $("groups");
  wrap.innerHTML = "";
  const total = allItems().length;
  $("empty").classList.toggle("hidden", total > 0);

  state.groups.forEach((g, gi) => {
    const groupEl = document.createElement("section");
    groupEl.className = "group";
    groupEl.dataset.groupId = g.id;

    const head = document.createElement("div");
    head.className = "group-head";

    const name = document.createElement("input");
    name.className = "group-name";
    name.value = g.name;
    name.title = "Numele grupului (apare ca titlu în Word)";
    name.addEventListener("change", () => {
      g.name = name.value.trim() || "Grup";
      saveState();
    });

    const count = document.createElement("span");
    count.className = "group-count";
    const done = g.items.filter((i) => i.status === "captured").length;
    count.textContent = `${done}/${g.items.length}`;

    head.append(
      name,
      count,
      iconBtn("▲", "Mută grupul mai sus", () => moveGroup(gi, -1), gi === 0),
      iconBtn("▼", "Mută grupul mai jos", () => moveGroup(gi, 1), gi === state.groups.length - 1),
      iconBtn("✕", "Șterge grupul și anunțurile lui", () => deleteGroup(g.id), false, true)
    );

    const list = document.createElement("ul");
    list.className = "items";
    list.dataset.groupId = g.id;
    attachDropZone(list, g);

    g.items.forEach((it, ii) => list.appendChild(renderItem(g, it, ii)));

    groupEl.append(head, list);
    wrap.appendChild(groupEl);
  });

  const captured = allItems().filter((i) => i.status === "captured").length;
  $("stats").textContent = total
    ? `${total} anunțuri · ${captured} capturate`
    : "";
}

function iconBtn(label, title, onClick, disabled = false, danger = false, extraClass = "") {
  const b = document.createElement("button");
  b.className = "icon-btn" + (danger ? " danger" : "") + (extraClass ? " " + extraClass : "");
  b.textContent = label;
  b.title = title;
  b.disabled = disabled;
  b.addEventListener("click", onClick);
  return b;
}

function renderItem(g, it, ii) {
  const li = document.createElement("li");
  li.className = "item";
  li.dataset.itemId = it.id;
  li.dataset.status = it.status;

  // tragerea pornește doar de pe mâner, ca să nu blocheze editarea numelui
  const handle = document.createElement("span");
  handle.className = "drag-handle";
  handle.textContent = "⠿";
  handle.title = "Trage pentru a muta anunțul";
  handle.addEventListener("mousedown", () => (li.draggable = true));
  li.addEventListener("mouseup", () => (li.draggable = false));
  li.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", it.id);
    li.classList.add("dragging");
  });
  li.addEventListener("dragend", () => {
    li.classList.remove("dragging");
    li.draggable = false;
  });

  const dot = document.createElement("span");
  dot.className = "status-dot";

  const main = document.createElement("div");
  main.className = "item-main";

  const labelRow = document.createElement("div");
  labelRow.className = "item-label-row";
  const label = document.createElement("input");
  label.className = "item-label";
  label.value = it.label || "";
  label.placeholder = "Nume (ex. Comparabila 1)";
  label.title = "Numele apare ca titlu bold în Word, înaintea linkului";
  label.addEventListener("change", () => {
    it.label = label.value.trim();
    saveState();
  });
  const labelClear = document.createElement("button");
  labelClear.className = "icon-btn danger label-clear";
  labelClear.textContent = "✕";
  labelClear.title = "Șterge numele (nu apare în Word)";
  labelClear.addEventListener("click", () => {
    it.label = "";
    saveState();
    render();
  });
  labelRow.append(label, labelClear);

  const title = document.createElement("div");
  title.className = "item-title";
  title.textContent = it.title || it.url;
  title.title = it.url;
  const sub = document.createElement("div");
  sub.className = "item-sub";
  if (it.status === "captured") {
    sub.innerHTML = `${hostOf(it.url)} · <span class="stamp">📄 ${it.slices} pag · ${fmtDate(it.capturedAt)}</span>`;
  } else if (it.status === "error") {
    sub.innerHTML = `${hostOf(it.url)} · <span class="err">eroare: ${escapeHtml(it.error || "necunoscută")}</span>`;
  } else if (it.status === "working") {
    sub.textContent = `${hostOf(it.url)} · se capturează…`;
  } else {
    sub.textContent = `${hostOf(it.url)} · în așteptare`;
  }
  main.append(labelRow, title, sub);

  const btns = document.createElement("div");
  btns.className = "item-btns";
  btns.append(
    iconBtn("📷", it.status === "captured" ? "Re-capturează anunțul" : "Capturează anunțul", () => captureOne(it.id), busy),
    iconBtn("👁", "Vezi și editează paginile capturii", () => openViewer(it.id), it.status !== "captured"),
    iconBtn("W", "Exportă Word doar cu acest anunț", () => exportItemDocs(it.id, ["word"]).catch((e) => {
      setProgress(false);
      alert("Eroare la export: " + e.message);
    }), it.status !== "captured", false, "mini-word"),
    iconBtn("PDF", "Exportă PDF doar cu acest anunț", () => exportItemDocs(it.id, ["pdf"]).catch((e) => {
      setProgress(false);
      alert("Eroare la export: " + e.message);
    }), it.status !== "captured", false, "mini-pdf"),
    iconBtn("W+P", "Exportă Word și PDF doar cu acest anunț", () => exportItemDocs(it.id, ["word", "pdf"]).catch((e) => {
      setProgress(false);
      alert("Eroare la export: " + e.message);
    }), it.status !== "captured", false, "mini-both"),
    iconBtn("▲", "Mută mai sus", () => moveItem(g, ii, -1), ii === 0),
    iconBtn("▼", "Mută mai jos", () => moveItem(g, ii, 1), ii === g.items.length - 1),
    iconBtn("✕", "Șterge anunțul", () => deleteItem(it.id), false, true)
  );

  li.append(handle, dot, main, btns);
  return li;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/* Drag & drop între grupuri și în interiorul lor */
function attachDropZone(list, group) {
  list.addEventListener("dragover", (e) => {
    e.preventDefault();
    list.classList.add("dragover");
  });
  list.addEventListener("dragleave", () => list.classList.remove("dragover"));
  list.addEventListener("drop", (e) => {
    e.preventDefault();
    list.classList.remove("dragover");
    const itemId = e.dataTransfer.getData("text/plain");
    const found = findItem(itemId);
    if (!found) return;
    // scoate din grupul sursă
    found.group.items = found.group.items.filter((i) => i.id !== itemId);
    // calculează poziția de inserare după elementul de sub cursor
    const after = [...list.querySelectorAll(".item:not(.dragging)")].find(
      (el) => e.clientY < el.getBoundingClientRect().top + el.offsetHeight / 2
    );
    const idx = after
      ? group.items.findIndex((i) => i.id === after.dataset.itemId)
      : group.items.length;
    group.items.splice(idx < 0 ? group.items.length : idx, 0, found.item);
    saveState();
    render();
  });
}

/* ── Operații pe listă ──────────────────────────────────────── */
function moveGroup(index, dir) {
  const j = index + dir;
  if (j < 0 || j >= state.groups.length) return;
  [state.groups[index], state.groups[j]] = [state.groups[j], state.groups[index]];
  saveState();
  render();
}
function moveItem(group, index, dir) {
  const j = index + dir;
  if (j < 0 || j >= group.items.length) return;
  [group.items[index], group.items[j]] = [group.items[j], group.items[index]];
  saveState();
  render();
}
async function deleteGroup(groupId) {
  const g = state.groups.find((x) => x.id === groupId);
  if (!g) return;
  if (g.items.length && !confirm(`Ștergi grupul „${g.name}” cu ${g.items.length} anunțuri?`)) return;
  for (const it of g.items) await deleteSlices(it.id, it.slices || 0);
  state.groups = state.groups.filter((x) => x.id !== groupId);
  if (state.groups.length === 0) state.groups.push({ id: uid(), name: "Comparabile", items: [] });
  saveState();
  render();
}
async function deleteItem(itemId) {
  const found = findItem(itemId);
  if (!found) return;
  await deleteSlices(itemId, found.item.slices || 0);
  found.group.items = found.group.items.filter((i) => i.id !== itemId);
  saveState();
  render();
}

function nextComparabilaLabel() {
  let max = 0;
  for (const it of allItems()) {
    const m = /^Comparabila\s+(\d+)$/i.exec((it.label || "").trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `Comparabila ${max + 1}`;
}

function addItem(url, title) {
  if (!/^https?:\/\//i.test(url)) {
    alert("Adresa trebuie să înceapă cu http:// sau https://");
    return;
  }
  if (allItems().some((i) => i.url === url)) {
    if (!confirm("Anunțul e deja în listă. Îl adaugi încă o dată?")) return;
  }
  const g = state.groups[state.groups.length - 1];
  g.items.push({
    id: uid(),
    label: nextComparabilaLabel(),
    url,
    title: (title || "").trim() || url,
    status: "pending",
    slices: 0,
    capturedAt: null,
    error: null,
  });
  saveState();
  render();
}

/* ── Motorul de captură (CDP) ───────────────────────────────── */
function cdp(target, method, params) {
  return chrome.debugger.sendCommand(target, method, params);
}

function waitForTabComplete(tabId, timeoutMs = 45000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") finish();
    };
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((t) => {
      if (t.status === "complete") finish();
    }).catch(finish);
    setTimeout(finish, timeoutMs);
  });
}

/* Injectat în pagină: apasă butoanele „Afișează numărul / Vezi telefon / Arată telefonul”
   ca datele de contact să fie vizibile în captură. Întoarce {clicks, phones, noted}.
   Caută: selectoare cunoscute, text / aria-label / title (și pe elemente simple span / div, apăsând strămoșul
   clickabil), numere ascunse („07xx xxx xxx”, „0722 ***”). Elementul e adus în vedere înainte de apăsare (unele
   site-uri, ca imobiliare.ro, activează butoanele abia când sunt vizibile) și primește secvența completă de evenimente.
   Dacă numărul apare doar într-o fereastră / bară fixă (pe care captura o ascunde), îl scrie într-o notă la începutul paginii. */
async function pageRevealContacts() {
  const verb = /(afi[sșş]eaz[ăa]|arat[ăa]|vezi|vede[țţt]i|dezv[ăa]luie|show|reveal|view|display)/i;
  const noun = /(num[ăa]r|telefon|tel\.?\b|phone|contact)/i;
  const masked = /(\+?40|0)\s*7?\d[\d\s.\-]{0,4}[x*•…·.]{2,}|\d{2,4}\s*[x*•]{2,}\s*[x*•]{2,}/i;
  const bad = /(trimite|mesaj|email|e-mail|whatsapp|programeaz|vizionare|raporteaz|salveaz|partajeaz|distribuie|anun[țţt]uri)/i;
  const phoneRe = /(?:\+?40|0)[\s.\-]?(?:7\d{2}|[23]\d{1,2})[\s.\-]?\d{3}[\s.\-]?\d{3}\b/g;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const seen = new Set();
  let clicks = 0;
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const clickable = (el) => el.closest("button, a, [role='button'], [onclick], label") || el;

  const fire = async (el) => {
    if (!el || seen.has(el) || clicks >= 5) return;
    seen.add(el);
    if (el.tagName === "A") { // nu apăsa linkuri care ar naviga către altă pagină
      const href = el.getAttribute("href") || "";
      if (href && !/^(#|tel:|javascript:)/i.test(href)) return;
    }
    if (!visible(el)) return;
    try { el.scrollIntoView({ block: "center" }); } catch (e) {}
    await sleep(350);
    const r = el.getBoundingClientRect(), o = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    try {
      el.dispatchEvent(new PointerEvent("pointerdown", o)); el.dispatchEvent(new MouseEvent("mousedown", o));
      el.dispatchEvent(new PointerEvent("pointerup", o)); el.dispatchEvent(new MouseEvent("mouseup", o));
      el.click(); clicks++;
    } catch (e) {}
    await sleep(250);
  };

  const label = (el) => [el.textContent, el.getAttribute("aria-label"), el.getAttribute("title"), el.getAttribute("data-cy"), el.getAttribute("data-testid")]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

  const pass = async () => {
    // selectoare cunoscute (OLX / Storia / Imobiliare.ro / platforme comune)
    const selectors = [
      "[data-testid='show-phone']", "[data-testid*='phone'] button", "[data-testid*='phone' i][role='button']",
      "button[data-cy*='phone' i]", "a[data-cy*='phone' i]", "[data-cy*='show-phone' i]", "[data-cy*='telefon' i]",
      "button[class*='phone' i]", "button[class*='telefon' i]", "[class*='show-phone' i]", "[class*='showPhone' i]",
      "[aria-label*='telefon' i][role='button']", "button[aria-label*='telefon' i]", "button[aria-label*='phone' i]",
    ];
    for (const sel of selectors) for (const el of document.querySelectorAll(sel)) {
      if (bad.test(label(el))) continue;
      await fire(clickable(el));
    }
    // după text, aria-label sau title — și pe elemente simple (span / div), apăsând strămoșul clickabil
    for (const el of document.querySelectorAll("button, a, [role='button'], span, div, p, strong")) {
      if (clicks >= 5) break;
      if (el.children.length > 3) continue;
      const t = label(el);
      if (!t || t.length > 70 || bad.test(t)) continue;
      if ((verb.test(t) && noun.test(t)) || masked.test(t)) await fire(clickable(el));
    }
  };

  const key = (x) => x.replace(/[^\d+]/g, "").replace(/^(\+?40)/, "0");
  const found = () => {
    const out = new Map();
    document.querySelectorAll("a[href^='tel:']").forEach((a) => { const n = key(decodeURIComponent(a.getAttribute("href").slice(4))); if (n.length >= 9) out.set(n, a); });
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const m = (n.nodeValue || "").match(phoneRe);
      if (m) m.forEach((x) => { const k = key(x); if (!out.has(k)) out.set(k, n.parentElement); });
    }
    return out;
  };

  const before = found();
  await pass();
  if (clicks) await sleep(1800);
  let after = found();
  if (clicks && after.size <= before.size) { await pass(); await sleep(1500); after = found(); }

  // numerele apărute doar în ferestre / bare fixe → notă statică sus, ca să rămână în captură
  const inFixed = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === "fixed") return true; } return false; };
  const fresh = [...after.entries()].filter(([k]) => !before.has(k));
  const hidden = fresh.filter(([, el]) => el && (inFixed(el) || !visible(el))).map(([k]) => k);
  let noted = false;
  if (hidden.length && !document.getElementById("uvalo-contact-note")) {
    const fmt = (k) => k.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3");
    const box = document.createElement("div");
    box.id = "uvalo-contact-note";
    box.style.cssText = "position:static;margin:12px auto;max-width:820px;padding:10px 14px;border:1px solid #E0AD4F;background:#FFF8E8;border-radius:8px;font:600 15px/1.4 Arial,sans-serif;color:#141414";
    box.textContent = "Telefon afișat pe site: " + hidden.map(fmt).join(", ");
    document.body.insertBefore(box, document.body.firstChild);
    noted = true;
  }
  window.scrollTo(0, 0);
  return { clicks, phones: after.size, fresh: fresh.length, noted };
}

/* Injectat în pagină: extinde descrierea anunțului („Vezi mai mult”,
   „Citește mai mult” etc.), ca textul complet să apară în captură */
function pageExpandDescriptions() {
  // [șşs] acoperă și ș-virgulă și ş-sedilă (site-urile le amestecă)
  const expandRe = /(vezi|cite[șşs]te|afi[șşs]eaz[ăa]|arat[ăa]|show|read)\s*(mai\s*mult|tot(ul)?|more|descrierea?)|^\s*mai mult\s*[….]*\s*$/i;
  // exclude butoane care ar încărca alte anunțuri/rezultate sau harta
  const excludeRe = /(anun[țţt]|ofert|rezultat|propriet|imobil|foto|imagini|comentari|recenzi|hart[ăa])/i;
  let clicks = 0;
  const seen = new Set();
  // scanăm și span/div/p simple: pe unele site-uri „Citește mai mult”
  // nu e un <button>, ci un element obișnuit cu handler de click
  const candidates = document.querySelectorAll(
    "button, a, [role='button'], span, div, p"
  );
  for (const el of candidates) {
    if (clicks >= 3) break;
    if (el.children.length > 2) continue; // doar elemente-frunză
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!t || t.length > 45) continue;
    if (!expandRe.test(t) || excludeRe.test(t)) continue;
    // apasă pe strămoșul clickabil dacă există, altfel pe element
    const target = el.closest("button, a, [role='button']") || el;
    if (seen.has(target)) continue;
    seen.add(target);
    if (target.tagName === "A") {
      const href = target.getAttribute("href") || "";
      if (href && !/^(#|javascript:)/i.test(href)) continue; // ar naviga
    }
    try { target.click(); clicks++; } catch (e) {}
  }
  return clicks;
}

/* Injectat în pagină: deschide harta localizării (dacă există) și
   returnează coordonatele ei pentru captură */
async function pageOpenAndLocateMap() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const findMapEl = () => {
    const sels = [
      ".gm-style",                          // Google Maps JS
      ".leaflet-container",                 // Leaflet / OpenStreetMap
      ".mapboxgl-map",                      // Mapbox
      "iframe[src*='google.com/maps']",     // embed Google Maps
      "iframe[src*='maps.google']",
      "[class*='map' i] canvas",
    ];
    for (const s of sels) {
      for (const el of document.querySelectorAll(s)) {
        const r = el.getBoundingClientRect();
        if (r.width >= 250 && r.height >= 180) return el;
      }
    }
    return null;
  };

  let map = findMapEl();

  if (!map) {
    // caută butonul de tip „Vezi harta / Vezi pe hartă / Afișează harta”
    let btn = null;
    for (const el of document.querySelectorAll(
      "button, a, span[role='button'], div[role='button']"
    )) {
      const t = (el.textContent || "").trim();
      if (!t || t.length > 60 || !/hart[ăa]/i.test(t)) continue;
      if (el.tagName === "A") {
        const href = el.getAttribute("href") || "";
        if (href && !/^(#|javascript:)/i.test(href)) continue; // ar naviga
      }
      btn = el;
      break;
    }
    if (btn) {
      btn.scrollIntoView({ block: "center" });
      await sleep(300);
      try { btn.click(); } catch (e) {}
    }
    for (let i = 0; i < 20 && !map; i++) {
      await sleep(300);
      map = findMapEl();
    }
  }

  if (!map) return { found: false };

  map.scrollIntoView({ block: "center" });
  await sleep(400);
  await sleep(2200); // așteaptă încărcarea tile-urilor

  // e harta într-un container fix (modal)?
  let inFixed = false;
  for (let e = map; e && e !== document.body; e = e.parentElement) {
    try { if (getComputedStyle(e).position === "fixed") { inFixed = true; break; } }
    catch (err) { break; }
  }

  const r = map.getBoundingClientRect();
  const doc = document.scrollingElement || document.documentElement;
  return {
    found: true,
    fixed: inFixed,
    x: Math.max(0, r.left + doc.scrollLeft - 10),
    y: Math.max(0, r.top + doc.scrollTop - 10),
    w: Math.min(r.width + 20, 850),
    h: Math.min(r.height + 20, 1100),
  };
}

/* Injectat în pagină: închide bannere de consimțământ cunoscute */
function pagePrepConsent() {
  const selectors = [
    "#onetrust-accept-btn-handler",                       // OneTrust (OLX, Storia)
    "#didomi-notice-agree-button",                        // Didomi (Imobiliare.ro)
    ".fc-button.fc-cta-consent",                          // Google Funding Choices
    ".qc-cmp2-summary-buttons button[mode='primary']",    // Quantcast (Publi24 ș.a.)
    "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll", // Cookiebot
    "button[data-testid='uc-accept-all-button']",         // Usercentrics
    "#cookiescript_accept",
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) { try { el.click(); } catch (e) {} }
  }
}

/* Injectat în pagină: derulează ca să declanșeze lazy-load, apoi revine sus */
async function pageAutoScroll() {
  const doc = document.scrollingElement || document.documentElement;
  const step = 800;
  let y = 0;
  const limit = Math.min(doc.scrollHeight, 60000);
  while (y < limit) {
    y += step;
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 220));
  }
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 500));
  return doc.scrollHeight;
}

/* Injectat în pagină: ascunde elementele plutitoare rămase (chat, modale) */
function pageHideFloating() {
  const vw = window.innerWidth, vh = window.innerHeight;
  for (const el of document.querySelectorAll("body *")) {
    let cs;
    try { cs = getComputedStyle(el); } catch (e) { continue; }
    if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const area = r.width * r.height;
    const coversScreen = area > vw * vh * 0.5;               // modal / backdrop rămas
    const isWidget = r.width < 420 && r.height < 420 &&
      (r.bottom > vh - 200 || r.top < 12);                   // chat / bare plutitoare
    if (coversScreen || isWidget) el.style.setProperty("display", "none", "important");
  }
  document.documentElement.style.overflow = "visible";
}

function dataUrlToBlob(base64, mime) {
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function captureItemInTab(item, onStep) {
  const tab = await chrome.tabs.create({ url: item.url, active: true });
  const target = { tabId: tab.id };
  let attached = false;
  try {
    onStep("se încarcă pagina…");
    await waitForTabComplete(tab.id);
    await sleep(1200);

    await chrome.debugger.attach(target, "1.3");
    attached = true;
    await cdp(target, "Page.enable");

    // Lățime fixă → layout compact, potrivit pentru A4 portrait
    await cdp(target, "Emulation.setDeviceMetricsOverride", {
      width: CAPTURE_WIDTH, height: 1200, deviceScaleFactor: 1, mobile: false,
    });
    await sleep(700);

    onStep("închid bannere…");
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: pagePrepConsent });
    await sleep(600);

    onStep("derulez pentru imagini…");
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: pageAutoScroll });

    onStep("extind descrierea…");
    const [exp] = await chrome.scripting.executeScript({
      target: { tabId: tab.id }, func: pageExpandDescriptions,
    });
    if (exp && exp.result > 0) await sleep(700); // lasă textul să se desfășoare

    if (state.settings && state.settings.revealContacts) {
      onStep("afișez datele de contact…");
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: tab.id }, func: pageRevealContacts,
      });
      const rv = (res && res.result) || {};
      onStep(rv.fresh ? "date de contact afișate (" + rv.fresh + (rv.fresh === 1 ? " număr" : " numere") + ")…"
        : rv.clicks ? "am apăsat butonul de contact, dar numărul nu a apărut…" : "nu am găsit butonul de contact…");
      await sleep(rv.clicks ? 600 : 200);
    }

    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: pageHideFloating });
    await sleep(400);

    const metrics = await cdp(target, "Page.getLayoutMetrics");
    const size = metrics.cssContentSize || metrics.contentSize;
    const fullH = Math.ceil(size.height);

    // Plan de feliere: prima felie mai scurtă (loc pentru antet), restul pline
    const plan = [];
    let y = 0;
    plan.push({ y: 0, h: Math.min(FIRST_SLICE_H, fullH) });
    y = plan[0].h;
    while (y < fullH && plan.length < MAX_SLICES) {
      const h = Math.min(SLICE_H, fullH - y);
      if (h < 60) break; // ignoră resturi neglijabile
      plan.push({ y, h });
      y += h;
    }

    const dims = [];
    for (let i = 0; i < plan.length; i++) {
      onStep(`captură pagina ${i + 1}/${plan.length}…`);
      const shot = await cdp(target, "Page.captureScreenshot", {
        format: "jpeg",
        quality: JPEG_QUALITY,
        captureBeyondViewport: true,
        fromSurface: true,
        clip: { x: 0, y: plan[i].y, width: CAPTURE_WIDTH, height: plan[i].h, scale: IMG_SCALE },
      });
      const blob = dataUrlToBlob(shot.data, "image/jpeg");
      await putSlice(item.id, i, blob);
      dims.push({ w: CAPTURE_WIDTH * IMG_SCALE, h: plan[i].h * IMG_SCALE });
    }

    let sliceCount = plan.length;

    // Pagina suplimentară cu harta localizării (dacă e activată și există)
    if (state.settings && state.settings.captureMap) {
      onStep("caut harta localizării…");
      try {
        const [res] = await chrome.scripting.executeScript({
          target: { tabId: tab.id }, func: pageOpenAndLocateMap,
        });
        const m = res && res.result;
        if (m && m.found) {
          onStep("captură harta…");
          let shot;
          if (m.fixed) {
            // hartă în fereastră modală: capturăm viewportul curent
            shot = await cdp(target, "Page.captureScreenshot", {
              format: "jpeg", quality: JPEG_QUALITY, fromSurface: true,
            });
          } else {
            shot = await cdp(target, "Page.captureScreenshot", {
              format: "jpeg", quality: JPEG_QUALITY,
              captureBeyondViewport: true, fromSurface: true,
              clip: { x: m.x, y: m.y, width: m.w, height: m.h, scale: IMG_SCALE },
            });
          }
          const blob = dataUrlToBlob(shot.data, "image/jpeg");
          await putSlice(item.id, sliceCount, blob);
          sliceCount++;
        }
      } catch (e) {
        // harta e opțională: dacă eșuează, captura rămâne validă fără ea
      }
    }

    // Titlul real al paginii, dacă e mai bun decât URL-ul
    try {
      const t = await chrome.tabs.get(tab.id);
      if (t.title && t.title.length > 3) item.title = t.title;
    } catch (e) {}

    item.slices = sliceCount;
    item.capturedAt = Date.now();
    item.status = "captured";
    item.error = null;
  } catch (err) {
    item.status = "error";
    item.error = (err && err.message) || String(err);
  } finally {
    if (attached) { try { await chrome.debugger.detach(target); } catch (e) {} }
    try { await chrome.tabs.remove(tab.id); } catch (e) {}
  }
}

/* ── Orchestrare: unul / toate ──────────────────────────────── */
function setProgress(visible, text = "", frac = 0) {
  $("progress").classList.toggle("hidden", !visible);
  $("progressText").textContent = text;
  $("progressFill").style.width = `${Math.round(frac * 100)}%`;
}

async function captureOne(itemId) {
  if (busy) return;
  const found = findItem(itemId);
  if (!found) return;
  busy = true;
  stopRequested = false;
  const it = found.item;
  await deleteSlices(it.id, it.slices || 0);
  it.status = "working";
  render();
  setProgress(true, `„${it.title}”`, 0.2);
  await captureItemInTab(it, (msg) => setProgress(true, `„${shorten(it.title)}” — ${msg}`, 0.5));
  await saveState();
  uvTrack("capture", it.url, { pages: it.slices || 0 });
  busy = false;
  setProgress(false);
  render();
}

async function captureAll() {
  if (busy) return;
  const queue = allItems().filter((i) => i.status !== "captured");
  if (queue.length === 0) {
    alert("Toate anunțurile din listă sunt deja capturate. Folosește 📷 pe un anunț pentru a-l re-captura.");
    return;
  }
  busy = true;
  stopRequested = false;
  for (let i = 0; i < queue.length; i++) {
    if (stopRequested) break;
    const it = queue[i];
    await deleteSlices(it.id, it.slices || 0);
    it.status = "working";
    render();
    setProgress(true, `${i + 1}/${queue.length}: „${shorten(it.title)}”`, i / queue.length);
    await captureItemInTab(it, (msg) =>
      setProgress(true, `${i + 1}/${queue.length}: ${msg}`, (i + 0.5) / queue.length)
    );
    await saveState();
    uvTrack("capture", it.url, { pages: it.slices || 0 });
    render();
    if (i < queue.length - 1) await sleep(2000); // pauză anti-blocare
  }
  busy = false;
  setProgress(false);
  render();
}

function shorten(s, n = 42) {
  s = s || "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/* ── Viewer ─────────────────────────────────────────────────── */
function openViewer(itemId) {
  chrome.tabs.create({ url: chrome.runtime.getURL(`viewer.html?item=${itemId}`) });
}

/* ── Generare Word ──────────────────────────────────────────── */
async function blobDims(blob) {
  const bmp = await createImageBitmap(blob);
  const d = { w: bmp.width, h: bmp.height };
  bmp.close();
  return d;
}

/* Construiește blocul Word al unui anunț: antet + feliile A4 */
async function buildItemBlocks(item, { groupName = null, pageBreak = false } = {}) {
  const {
    Paragraph, TextRun, ImageRun, ExternalHyperlink, BorderStyle,
  } = docx;

  const blobs = await getSlices(item.id, item.slices);
  if (blobs.length === 0) return [];

  const blocks = [];
  let breakPlaced = false;

  if (groupName !== null) {
    blocks.push(new Paragraph({
      pageBreakBefore: pageBreak,
      spacing: { after: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "E0AD4F" } },
      children: [new TextRun({
        text: groupName.toUpperCase(),
        font: "Arial", size: 24, bold: true, color: "141414",
      })],
    }));
    breakPlaced = true;
  }

  const shortTitle = (item.title || "").length > 110
    ? item.title.slice(0, 109) + "…"
    : (item.title || "");

  const nameRuns = [];
  if (item.label) {
    nameRuns.push(new TextRun({
      text: item.label, font: "Arial", size: 22, bold: true, color: "141414",
    }));
    if (shortTitle) {
      nameRuns.push(new TextRun({
        text: ` — ${shortTitle}`, font: "Arial", size: 18, color: "444444",
      }));
    }
  } else {
    nameRuns.push(new TextRun({
      text: shortTitle || item.url, font: "Arial", size: 20, bold: true,
    }));
  }

  blocks.push(new Paragraph({
    pageBreakBefore: pageBreak && !breakPlaced,
    spacing: { after: 40 },
    children: nameRuns,
  }));

  blocks.push(new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: "Sursă: ", font: "Arial", size: 16, color: "555555" }),
      new ExternalHyperlink({
        link: item.url,
        children: [new TextRun({
          text: item.url, font: "Arial", size: 16, color: "1155CC", underline: {},
        })],
      }),
      new TextRun({
        text: `   •   Data capturii: ${fmtDate(item.capturedAt)}`,
        font: "Arial", size: 16, color: "555555",
      }),
    ],
  }));

  for (let si = 0; si < blobs.length; si++) {
    const blob = blobs[si];
    const dims = await blobDims(blob);
    // Încadrare proporțională în cutia de siguranță a paginii:
    // prima felie stă sub antet, feliile pline păstrează o rezervă
    // ca să nu împingă niciodată conținutul pe o pagină nouă goală.
    const maxH = si === 0 ? WORD_MAX_H_FIRST : WORD_MAX_H_FULL;
    let w = WORD_CONTENT_W_PX;
    let h = Math.round(w * dims.h / dims.w);
    if (h > maxH) {
      w = Math.round(maxH * dims.w / dims.h);
      h = maxH;
    }
    const buf = await blob.arrayBuffer();
    blocks.push(new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [new ImageRun({ type: "jpg", data: buf, transformation: { width: w, height: h } })],
    }));
  }

  return blocks;
}

function buildDoc(children) {
  const { Document } = docx;
  return new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 20 } } },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },       // A4 portrait (twips)
          margin: { top: 720, bottom: 720, left: 720, right: 720 }, // 0,5"
        },
      },
      children,
    }],
  });
}

function sanitizeFilename(s) {
  return (s || "")
    .replace(/[ăâ]/gi, (c) => (c === c.toLowerCase() ? "a" : "A"))
    .replace(/[îí]/gi, (c) => (c === c.toLowerCase() ? "i" : "I"))
    .replace(/[șş]/gi, (c) => (c === c.toLowerCase() ? "s" : "S"))
    .replace(/[țţ]/gi, (c) => (c === c.toLowerCase() ? "t" : "T"))
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60) || "Comparabila";
}

function downloadDocx(blob, fname) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fname;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function dateSuffix() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function collectCaptured() {
  return state.groups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.status === "captured") }))
    .filter((g) => g.items.length > 0);
}

/* Validare comună: rulează o singură dată, indiferent câte formate se exportă */
function validateExport() {
  const captured = collectCaptured();
  if (captured.length === 0) {
    alert("Nu există încă nicio captură. Capturează anunțurile mai întâi (📷).");
    return null;
  }
  const missing = allItems().filter((i) => i.status !== "captured").length;
  if (missing > 0 && !confirm(`${missing} anunțuri nu sunt capturate și nu vor apărea în document. Continui?`)) {
    return null;
  }
  return captured;
}

async function buildWordChildren(captured) {
  const children = [];
  let firstBlock = true;
  for (const g of captured) {
    let firstInGroup = true;
    for (const item of g.items) {
      const blocks = await buildItemBlocks(item, {
        groupName: firstInGroup ? g.name : null,
        pageBreak: !firstBlock,
      });
      if (blocks.length === 0) continue;
      children.push(...blocks);
      firstBlock = false;
      firstInGroup = false;
    }
  }
  return children;
}

/* ── Generare PDF ───────────────────────────────────────────── */
const PDF_MARGIN = 12.7;                       // mm (0,5")
const PDF_PAGE_W = 210, PDF_PAGE_H = 297;      // A4 portrait, mm
const PDF_CONTENT_W = PDF_PAGE_W - 2 * PDF_MARGIN;

function newPdf() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  pdf.addFileToVFS("DejaVuSans.ttf", PDF_FONT_REGULAR);
  pdf.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  pdf.addFileToVFS("DejaVuSans-Bold.ttf", PDF_FONT_BOLD);
  pdf.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");
  pdf.setFont("DejaVu", "normal");
  return pdf;
}

/* Adaugă un anunț în PDF: antet + feliile A4, câte una pe pagină */
async function addItemToPdf(pdf, item, { groupName = null, firstInDoc = false } = {}) {
  const blobs = await getSlices(item.id, item.slices);
  if (blobs.length === 0) return false;

  if (!firstInDoc) pdf.addPage();
  let y = PDF_MARGIN;

  if (groupName) {
    pdf.setFont("DejaVu", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(20, 20, 20);
    pdf.text(groupName.toUpperCase(), PDF_MARGIN, y + 4);
    y += 6.5;
    pdf.setDrawColor(224, 173, 79);
    pdf.setLineWidth(0.7);
    pdf.line(PDF_MARGIN, y, PDF_PAGE_W - PDF_MARGIN, y);
    y += 4;
  }

  const shortTitle = (item.title || "").length > 110
    ? item.title.slice(0, 109) + "…"
    : (item.title || "");

  if (item.label) {
    pdf.setFont("DejaVu", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(20, 20, 20);
    pdf.text(item.label, PDF_MARGIN, y + 4);
    y += 6;
  }
  if (shortTitle) {
    pdf.setFont("DejaVu", item.label ? "normal" : "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(68, 68, 68);
    const lines = pdf.splitTextToSize(shortTitle, PDF_CONTENT_W);
    pdf.text(lines, PDF_MARGIN, y + 3.5);
    y += lines.length * 4.2 + 1;
  }

  pdf.setFont("DejaVu", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(85, 85, 85);
  pdf.text("Sursă:", PDF_MARGIN, y + 3);
  const urlX = PDF_MARGIN + pdf.getTextWidth("Sursă:") + 1.5;
  pdf.setTextColor(17, 85, 204);
  const urlLines = pdf.splitTextToSize(item.url, PDF_CONTENT_W - (urlX - PDF_MARGIN));
  pdf.text(urlLines, urlX, y + 3);
  const urlH = urlLines.length * 3.6;
  pdf.link(urlX, y, PDF_CONTENT_W - (urlX - PDF_MARGIN), urlH, { url: item.url });
  y += urlH + 0.8;
  pdf.setTextColor(85, 85, 85);
  pdf.text(`Data capturii: ${fmtDate(item.capturedAt)}`, PDF_MARGIN, y + 3);
  y += 6;

  for (let i = 0; i < blobs.length; i++) {
    const dims = await blobDims(blobs[i]);
    if (i > 0) {
      pdf.addPage();
      y = PDF_MARGIN;
    }
    const maxH = PDF_PAGE_H - PDF_MARGIN - y;
    let w = PDF_CONTENT_W;
    let h = w * dims.h / dims.w;
    if (h > maxH) {
      w = maxH * dims.w / dims.h;
      h = maxH;
    }
    const u8 = new Uint8Array(await blobs[i].arrayBuffer());
    pdf.addImage(u8, "JPEG", PDF_MARGIN, y, w, h);
  }
  return true;
}

function downloadPdf(pdf, fname) {
  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fname;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function buildPdfFromCaptured(captured) {
  const pdf = newPdf();
  let first = true;
  for (const g of captured) {
    let firstInGroup = true;
    for (const item of g.items) {
      const ok = await addItemToPdf(pdf, item, {
        groupName: firstInGroup ? g.name : null,
        firstInDoc: first,
      });
      if (ok) { first = false; firstInGroup = false; }
    }
  }
  return pdf;
}

/* Export general: unul sau ambele formate, cu o singură validare */
async function generateDocs(formats) {
  const captured = validateExport();
  if (!captured) return;
  uvTrack("export", null, { formats: formats.join("+"), n: captured.length });
  try {
    if (formats.includes("word")) {
      setProgress(true, "Se generează documentul Word…", formats.length > 1 ? 0.25 : 0.4);
      const children = await buildWordChildren(captured);
      const blob = await docx.Packer.toBlob(buildDoc(children));
      downloadDocx(blob, `Comparabile_${dateSuffix()}.docx`);
    }
    if (formats.includes("pdf")) {
      // pauză scurtă între cele două descărcări succesive
      if (formats.length > 1) await sleep(700);
      setProgress(true, "Se generează documentul PDF…", 0.7);
      const pdf = await buildPdfFromCaptured(captured);
      downloadPdf(pdf, `Comparabile_${dateSuffix()}.pdf`);
    }
  } finally {
    setProgress(false);
  }
}

/* Export individual: unul sau ambele formate pentru un singur anunț */
async function exportItemDocs(itemId, formats) {
  const found = findItem(itemId);
  if (!found || found.item.status !== "captured") return;
  const item = found.item;
  const base = sanitizeFilename(item.label || item.title);
  uvTrack("export", item.url, { formats: formats.join("+"), n: 1 });
  setProgress(true, `Se exportă „${shorten(item.label || item.title)}”…`, 0.3);
  try {
    if (formats.includes("word")) {
      const blocks = await buildItemBlocks(item, { groupName: null, pageBreak: false });
      if (blocks.length === 0) {
        alert("Anunțul nu mai are pagini capturate. Re-capturează-l (📷).");
        return;
      }
      const blob = await docx.Packer.toBlob(buildDoc(blocks));
      downloadDocx(blob, `${base}_${dateSuffix()}.docx`);
    }
    if (formats.includes("pdf")) {
      if (formats.length > 1) await sleep(700);
      setProgress(true, `Se exportă PDF „${shorten(item.label || item.title)}”…`, 0.7);
      const pdf = newPdf();
      const ok = await addItemToPdf(pdf, item, { groupName: null, firstInDoc: true });
      if (!ok) {
        alert("Anunțul nu mai are pagini capturate. Re-capturează-l (📷).");
        return;
      }
      downloadPdf(pdf, `${base}_${dateSuffix()}.pdf`);
    }
  } finally {
    setProgress(false);
  }
}

/* ── Evenimente UI ──────────────────────────────────────────── */
$("btnAddCurrent").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !/^https?:/i.test(tab.url)) {
    alert("Deschide mai întâi un anunț (o pagină web obișnuită) în tabul activ.");
    return;
  }
  addItem(tab.url, tab.title);
});

$("btnAddUrl").addEventListener("click", () => {
  const url = prompt("Adresa anunțului (URL):");
  if (url) addItem(url.trim(), "");
});

$("btnAddGroup").addEventListener("click", () => {
  const name = prompt("Numele grupului (apare ca titlu în Word):", `Grup ${state.groups.length + 1}`);
  if (name === null) return;
  state.groups.push({ id: uid(), name: name.trim() || "Grup", items: [] });
  saveState();
  render();
});

$("btnCaptureAll").addEventListener("click", captureAll);
$("btnStop").addEventListener("click", () => { stopRequested = true; });
const genErr = (e) => { setProgress(false); alert("Eroare la generarea documentului: " + e.message); };
$("btnWord").addEventListener("click", () => generateDocs(["word"]).catch(genErr));
$("btnPdf").addEventListener("click", () => generateDocs(["pdf"]).catch(genErr));
$("btnBoth").addEventListener("click", () => generateDocs(["word", "pdf"]).catch(genErr));

async function resetAll() {
  if (busy) return;
  if (!confirm("Reset complet: șterge toate grupurile, anunțurile și capturile salvate. Continui?")) return;
  await clearAllSlices();
  state = { groups: [{ id: uid(), name: "Comparabile", items: [] }], settings: state.settings };
  await saveState();
  render();
}

$("chkReveal").addEventListener("change", () => {
  state.settings.revealContacts = $("chkReveal").checked;
  saveState();
});

$("chkMap").addEventListener("change", () => {
  state.settings.captureMap = $("chkMap").checked;
  saveState();
});

$("btnReset").addEventListener("click", resetAll);
$("btnClear").addEventListener("click", resetAll);

/* Sincronizare: dacă viewer-ul șterge pagini, reîncarcă starea */
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.state && !busy) {
    state = changes.state.newValue || state;
    render();
  }
});

/* ── Init ───────────────────────────────────────────────────── */
loadState().then(() => {
  $("chkReveal").checked = !!state.settings.revealContacts;
  $("chkMap").checked = !!state.settings.captureMap;
  render();
});
