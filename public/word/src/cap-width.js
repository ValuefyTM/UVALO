/* UVALO pentru Word – setările capturilor inserate (Comparabile din Chrome, harta Comparabilelor):
   lățimea paginii, marginile din stânga / dreapta și cât din lățimea dintre margini ocupă captura.
   Păstrate în localStorage „uvalo-word-cap”, comune panourilor. UVALO_CAP.mount(el) desenează blocul,
   UVALO_CAP.widthPt() dă lățimea capturii în puncte (1 cm = 28,3465 pt). */
(function () {
  "use strict";
  var KEY = "uvalo-word-cap", CM = 28.3465;
  var PAGES = [["21", "A4 portret (21 cm)"], ["29.7", "A4 peisaj (29,7 cm)"], ["21.59", "Letter (21,59 cm)"], ["", "Altă lățime"]];
  var DEF = { page: 21, left: 2.5, right: 2, pct: 100 };
  var num = function (v, d, lo, hi) { v = parseFloat(String(v).replace(",", ".")); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  var fmt = function (v) { return (Math.round(v * 100) / 100).toString().replace(".", ","); };

  function load() {
    var s = mem || {}; try { s = JSON.parse(localStorage.getItem(KEY) || "null") || s; } catch (e) { }
    return {
      page: num(s.page, DEF.page, 8, 60), left: num(s.left, DEF.left, 0, 10),
      right: num(s.right, DEF.right, 0, 10), pct: num(s.pct, DEF.pct, 30, 100)
    };
  }
  var mem = null; // dacă localStorage nu merge, setarea ține cât e deschis panoul
  function save(s) { mem = s; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { } }
  function usable(s) { return Math.max(3, s.page - s.left - s.right); }
  function widthCm(s) { s = s || load(); return Math.max(3, usable(s) * s.pct / 100); }

  var inp = 'style="width:64px;padding:4px 6px;border:1px solid #cfc6b3;border-radius:6px"';
  function mount(el) {
    if (!el) return;
    var s = load(), preset = PAGES.some(function (p) { return p[0] && +p[0] === s.page; }) ? String(s.page) : "";
    el.innerHTML =
      '<details class="card" id="capSet" style="display:block">' +
      '<summary style="cursor:pointer;font-weight:700">⚙ Setări captură · <span id="capSum"></span></summary>' +
      '<div style="display:grid;gap:8px;margin-top:10px">' +
      '<label style="display:flex;align-items:center;gap:8px;justify-content:space-between">Pagina <select id="capPage" style="padding:4px 6px;border:1px solid #cfc6b3;border-radius:6px">' +
      PAGES.map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === preset ? " selected" : "") + ">" + p[1] + "</option>"; }).join("") +
      '</select></label>' +
      '<label id="capCustomL" style="display:flex;align-items:center;gap:8px;justify-content:space-between"' + (preset ? " hidden" : "") + '>Lățimea paginii <span><input type="number" id="capPageW" min="8" max="60" step="0.1" value="' + s.page + '" ' + inp + '> cm</span></label>' +
      '<label style="display:flex;align-items:center;gap:8px;justify-content:space-between">Margine stânga <span><input type="number" id="capL" min="0" max="10" step="0.1" value="' + s.left + '" ' + inp + '> cm</span></label>' +
      '<label style="display:flex;align-items:center;gap:8px;justify-content:space-between">Margine dreapta <span><input type="number" id="capR" min="0" max="10" step="0.1" value="' + s.right + '" ' + inp + '> cm</span></label>' +
      '<label style="display:grid;gap:4px">Lățimea capturii: <b id="capPctL"></b><input type="range" id="capPct" min="30" max="100" step="5" value="' + s.pct + '" style="width:100%"></label>' +
      '<div id="capBar" aria-hidden="true" style="position:relative;height:26px;border:1px solid #cfc6b3;border-radius:4px;background:#fff;overflow:hidden">' +
      '<span id="capArea" style="position:absolute;top:0;bottom:0;background:#f3ead8"></span><span id="capImg" style="position:absolute;top:5px;bottom:5px;background:#E0AD4F;border-radius:2px"></span></div>' +
      '<small style="color:#6b6559">Pune marginile din „Aspect → Margini” ale documentului. Captura se centrează între margini și își păstrează proporțiile.</small>' +
      '<button type="button" class="btn ghost" id="capReset">Revino la implicit</button>' +
      '</div></details>';
    var q = function (id) { return el.querySelector("#" + id); };
    function paint() {
      var c = load(), u = usable(c), w = widthCm(c);
      q("capSum").textContent = fmt(w) + " cm, margini " + fmt(c.left) + " / " + fmt(c.right) + " cm";
      q("capPctL").textContent = fmt(w) + " cm (" + c.pct + "% din " + fmt(u) + " cm între margini)";
      var L = c.left / c.page * 100, U = u / c.page * 100, W = w / c.page * 100;
      q("capArea").style.left = L + "%"; q("capArea").style.width = U + "%";
      q("capImg").style.left = (L + (U - W) / 2) + "%"; q("capImg").style.width = W + "%";
    }
    function read() {
      var sel = q("capPage").value;
      q("capCustomL").hidden = !!sel;
      var page = sel ? +sel : num(q("capPageW").value, 21, 8, 60);
      if (sel) q("capPageW").value = page;
      save({ page: page, left: num(q("capL").value, DEF.left, 0, 10), right: num(q("capR").value, DEF.right, 0, 10), pct: num(q("capPct").value, 100, 30, 100) });
      paint();
    }
    ["capPage", "capPageW", "capL", "capR", "capPct"].forEach(function (id) { q(id).addEventListener("input", read); q(id).addEventListener("change", read); });
    q("capReset").addEventListener("click", function () { save(DEF); mount(el); });
    paint();
  }

  document.addEventListener("DOMContentLoaded", function () { mount(document.getElementById("capBox")); });
  window.UVALO_CAP = { mount: mount, widthPt: function () { return widthCm() * CM; }, widthCm: function () { return widthCm(); } };
})();
