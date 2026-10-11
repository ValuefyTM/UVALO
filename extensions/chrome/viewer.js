"use strict";

const params = new URLSearchParams(location.search);
const itemId = params.get("item");
const undoStack = []; // { index, blob } — permite anularea ștergerilor

function fmtDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("comparabile-capturi", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("slices");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const req = db.transaction("slices").objectStore("slices").get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function loadMeta() {
  const data = await chrome.storage.local.get("state");
  if (!data.state) return null;
  for (const g of data.state.groups) {
    const it = g.items.find((i) => i.id === itemId);
    if (it) return { state: data.state, item: it };
  }
  return null;
}

async function readAllBlobs(count) {
  const db = await openDB();
  const out = [];
  for (let i = 0; i < count; i++) {
    const b = await idbGet(db, `${itemId}:${i}`);
    if (b) out.push(b);
  }
  return out;
}

/* Rescrie feliile secvențial și actualizează starea */
async function writeAll(blobs, prevCount) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("slices", "readwrite");
    const store = tx.objectStore("slices");
    for (let i = 0; i < Math.max(prevCount, blobs.length); i++) {
      store.delete(`${itemId}:${i}`);
    }
    blobs.forEach((b, i) => store.put(b, `${itemId}:${i}`));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  const found = await loadMeta();
  if (!found) return;
  found.item.slices = blobs.length;
  if (blobs.length === 0) {
    found.item.status = "pending";
    found.item.capturedAt = null;
  }
  await chrome.storage.local.set({ state: found.state });
}

async function deletePage(index) {
  const found = await loadMeta();
  if (!found) return;
  const blobs = await readAllBlobs(found.item.slices);
  const [removed] = blobs.splice(index, 1);
  if (removed) undoStack.push({ index, blob: removed });
  await writeAll(blobs, found.item.slices);
  await renderAll();
}

async function undoDelete() {
  const last = undoStack.pop();
  if (!last) return;
  const found = await loadMeta();
  if (!found) return;
  const blobs = await readAllBlobs(found.item.slices);
  const idx = Math.min(last.index, blobs.length);
  blobs.splice(idx, 0, last.blob);
  await writeAll(blobs, found.item.slices);
  await renderAll();
}

function openLightbox(src) {
  const lb = document.getElementById("lightbox");
  document.getElementById("lightboxImg").src = src;
  lb.classList.add("open");
}
document.getElementById("lightbox").addEventListener("click", () => {
  document.getElementById("lightbox").classList.remove("open");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.getElementById("lightbox").classList.remove("open");
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    undoDelete();
  }
});
document.getElementById("btnUndo").addEventListener("click", undoDelete);

async function renderAll() {
  const pages = document.getElementById("pages");
  const meta = document.getElementById("meta");
  const stamp = document.getElementById("stamp");
  document.getElementById("btnUndo").disabled = undoStack.length === 0;

  const found = await loadMeta();
  if (!found) {
    pages.innerHTML = '<div class="msg">Anunțul nu mai există în listă.</div>';
    return;
  }
  const item = found.item;
  document.title = item.label || item.title;
  meta.innerHTML = `<strong>${escapeHtml(item.label ? item.label + " — " : "")}${escapeHtml(item.title)}</strong>
    <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.url)}</a>`;
  stamp.textContent = item.capturedAt ? `Captură: ${fmtDate(item.capturedAt)}` : "necapturat";

  if (!item.slices) {
    pages.innerHTML = '<div class="msg">Nu mai există pagini. Re-capturează anunțul din panou (📷)' +
      (undoStack.length ? ' sau apasă „↩ Anulează ștergerea".' : '.') + '</div>';
    return;
  }

  const blobs = await readAllBlobs(item.slices);
  pages.innerHTML = "";
  blobs.forEach((blob, i) => {
    const div = document.createElement("div");
    div.className = "page";
    const img = document.createElement("img");
    const url = URL.createObjectURL(blob);
    img.src = url;
    img.alt = `Pagina ${i + 1}`;
    img.addEventListener("click", () => openLightbox(url));
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = `A4 · ${i + 1}/${blobs.length}`;
    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "🗑";
    del.title = `Șterge pagina ${i + 1} (instant, se poate anula cu ↩ sau Ctrl+Z)`;
    del.addEventListener("click", () => deletePage(i));
    div.append(img, label, del);
    pages.appendChild(div);
  });
}

renderAll().catch((e) => {
  document.getElementById("pages").innerHTML =
    `<div class="msg">Eroare: ${escapeHtml(e.message || e)}</div>`;
});
