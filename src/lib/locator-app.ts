// The cadastral locator inside the phone app (inspectii.uvalo.ro → tab „Localizator”, an iframe on /localizare?app=1&t=&b=):
// the same page as on the web, laid out for the app — the map on the whole screen, a search bar on top that opens the search form
// (cadastral number / topo, address / coordinates / Stereo 70) as an overlay, the layers and the map buttons under it, and the
// parcel sheet (#out, with everything the web locator shows) in a panel that slides up from the bottom: half the screen, the whole
// screen, or closed; dragged by its grip. t / b = the parent's top safe area and the space taken by the floating menu at the bottom.
// Links to the rest of the platform (site analysis…) open on the app domain in the browser, since this host only serves the app.

/** In <head>: the class and the insets before the first paint, and the layout. */
export const APP_HEAD = `<script>(function(){var q=new URLSearchParams(location.search),r=document.documentElement;r.classList.add("uvApp");
r.style.setProperty("--uvt",(Math.max(0,+q.get("t")||0))+"px");r.style.setProperty("--uvb",(Math.max(0,+q.get("b")||0))+"px")})()</script>
<style>
html.uvApp,html.uvApp body{height:100%;overflow:hidden;overscroll-behavior:none}
html.uvApp .app{display:block!important;height:100%!important;min-height:0!important}
html.uvApp .panel{display:contents!important}
html.uvApp .phead,html.uvApp .split,html.uvApp #full,html.uvApp .find .heads,html.uvApp #hint,html.uvApp .uvfb-btn,html.uvApp .uvfb-tip{display:none!important}
html.uvApp body .mapwrap .fullOut{display:none!important}
html.uvApp .mapwrap{position:fixed!important;inset:0!important;height:auto!important;min-height:0!important;z-index:1!important}
html.uvApp .mctl{top:calc(var(--uvt) + 70px)!important;left:12px!important}
html.uvApp .lyr,html.uvApp .lyr:not(.closed){top:calc(var(--uvt) + 70px)!important;right:12px!important;bottom:auto!important;max-height:calc(100% - var(--uvt) - var(--uvb) - 90px);overflow:auto}
html.uvApp .legend{bottom:calc(var(--uvb) + 8px)!important;left:12px!important}
html.uvApp .gpsBar{bottom:calc(var(--uvb) + 4px)!important}
html.uvApp .leaflet-bottom{bottom:var(--uvb)!important}
html.uvApp #toast{bottom:auto!important;top:calc(var(--uvt) + 70px)!important}
/* the search bar on the map and the search form over it */
.uvFind{position:fixed;z-index:1550;left:12px;right:12px;top:calc(var(--uvt) + 12px);height:48px;border:0;border-radius:16px;background:#fff;color:#6b6b6b;
  display:flex;align-items:center;gap:10px;padding:0 14px;font:600 14px 'Plus Jakarta Sans',system-ui,sans-serif;text-align:left;box-shadow:0 10px 26px -10px rgba(0,0,0,.45),0 0 0 1px rgba(0,0,0,.04);cursor:pointer}
.uvFind svg{flex:none;color:#111}
.uvFind span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
html.uvApp .find{position:fixed!important;z-index:2000;left:0;right:0;top:0;margin:0!important;max-height:100%;overflow:auto;background:#fff;
  padding:calc(var(--uvt) + 12px) 16px 18px!important;border-radius:0 0 22px 22px;box-shadow:0 24px 60px -12px rgba(0,0,0,.5);
  transform:translateY(-105%);transition:transform .26s cubic-bezier(.2,.8,.2,1);visibility:hidden}
html.uvApp body.uvSearch .find{transform:none;visibility:visible}
.uvFindTop{display:flex;align-items:center;justify-content:space-between}
.uvFindTop b{font-size:18px;letter-spacing:-.01em}
.uvFindX{width:36px;height:36px;border-radius:50%;border:0;background:#f1ece2;color:#111;font-size:22px;line-height:1;cursor:pointer}
.uvShade{position:fixed;inset:0;z-index:1990;background:rgba(0,0,0,.35);opacity:0;pointer-events:none;transition:opacity .2s}
body.uvSearch .uvShade{opacity:1;pointer-events:auto}
/* the parcel sheet, from the bottom */
.uvSheet{position:fixed;z-index:1600;left:0;right:0;bottom:0;height:52%;max-height:calc(100% - var(--uvt) - 12px);background:#fff;border-radius:22px 22px 0 0;
  box-shadow:0 -18px 44px -14px rgba(0,0,0,.45);display:flex;flex-direction:column;transform:translateY(105%);transition:transform .28s cubic-bezier(.2,.8,.2,1),height .28s cubic-bezier(.2,.8,.2,1)}
body.uvPeek .uvSheet,body.uvFull .uvSheet{transform:none}
body.uvFull .uvSheet{height:calc(100% - var(--uvt) - 12px)}
.uvGrip{flex:none;height:30px;display:flex;align-items:center;justify-content:center;touch-action:none;cursor:grab;border:0;background:none;width:100%;padding:0}
.uvGrip i{display:block;width:44px;height:5px;border-radius:999px;background:#cfc7b8}
.uvBody{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding-bottom:calc(var(--uvb) + 8px)}
html.uvApp .uvBody main#out{padding:2px 16px 12px!important}
html.uvApp .uvBody .note{padding:0 16px 12px!important}
html.uvApp .uvBody .pfoot{padding:0 16px 12px!important;position:static!important}
.uvOpen{position:fixed;z-index:1550;left:50%;transform:translateX(-50%);bottom:calc(var(--uvb) + 10px);border:0;border-radius:999px;background:#141414;color:#fff;
  font:700 13px 'Plus Jakarta Sans',system-ui,sans-serif;padding:11px 18px;box-shadow:0 10px 24px -8px rgba(0,0,0,.6);display:none;cursor:pointer;max-width:calc(100% - 24px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
body.uvRes:not(.uvPeek):not(.uvFull) .uvOpen{display:block}
</style>`;

/** At the end of <body>, after the locator's own scripts: the search bar, the sheet, the links. */
export function appScript(appUrl: string) {
  return `<script>(function(){
var APP=${JSON.stringify(appUrl.replace(/\/$/, ""))},$=function(i){return document.getElementById(i)},B=document.body;
var SEARCH='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
function relayout(){try{map.invalidateSize({pan:false})}catch(e){}}
/* the search bar → the search form over the map */
var bar=document.createElement("button");bar.type="button";bar.className="uvFind";bar.innerHTML=SEARCH+"<span>Caută adresă, coordonate sau nr. cadastral</span>";
var shade=document.createElement("div");shade.className="uvShade";
var form=$("f"),top=document.createElement("div");top.className="uvFindTop";top.innerHTML='<b>Caută un imobil</b><button type="button" class="uvFindX" aria-label="Închide căutarea">×</button>';
form.insertBefore(top,form.firstChild);
function search(on){B.classList.toggle("uvSearch",on);if(on){var adr=!$("modeAdr").hidden;setTimeout(function(){try{(adr?$("addr"):$("q")).focus()}catch(e){}},260)}else{try{document.activeElement.blur()}catch(e){}}}
bar.onclick=function(){search(true)};shade.onclick=function(){search(false)};top.querySelector("button").onclick=function(){search(false)};
B.appendChild(shade);B.appendChild(bar);
/* the sheet: #out (the parcel sheet), the note and the downloads */
var sh=document.createElement("section");sh.className="uvSheet";sh.setAttribute("aria-label","Fișa imobilului");
sh.innerHTML='<button type="button" class="uvGrip" aria-label="Mărește sau micșorează fișa (trage)"><i></i></button><div class="uvBody"></div>';
var body=sh.querySelector(".uvBody"),grip=sh.querySelector(".uvGrip");
["out","foot","pfoot"].forEach(function(i){var e=$(i);if(e)body.appendChild(e)});
B.appendChild(sh);
var open=document.createElement("button");open.type="button";open.className="uvOpen";open.textContent="Vezi fișa ↑";B.appendChild(open);
/* the selected parcel framed in the part of the map the sheet and the search bar leave free */
function fitFree(){try{var ls=sel.getLayers();if(!ls.length)throw 0;var T=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--uvt"))||0;
  map.fitBounds(L.featureGroup(ls).getBounds(),{paddingTopLeft:[24,T+76],paddingBottomRight:[24,sh.offsetHeight+24],maxZoom:Math.max(map.getZoom(),17),animate:true})}
  catch(e){try{map.panBy([0,Math.round(sh.offsetHeight/2)],{animate:true})}catch(_){}}}
function state(s){B.classList.toggle("uvPeek",s==="peek");B.classList.toggle("uvFull",s==="full")}
function cur(){return B.classList.contains("uvFull")?"full":B.classList.contains("uvPeek")?"peek":"off"}
open.onclick=function(){state("peek")};
grip.onclick=function(){state(cur()==="full"?"peek":"full")};
/* dragging the grip: the sheet follows the finger; up = whole screen, down = half, then closed */
var d=null;
grip.addEventListener("touchstart",function(e){d={y:e.touches[0].clientY,h:sh.offsetHeight,dy:0};sh.style.transition="none"},{passive:true});
grip.addEventListener("touchmove",function(e){if(!d)return;e.preventDefault();d.dy=e.touches[0].clientY-d.y;sh.style.height=Math.max(80,d.h-d.dy)+"px"},{passive:false});
function end(){if(!d)return;var dy=d.dy,c=cur();d=null;sh.style.transition="";sh.style.height="";
  if(dy<-50)state("full");else if(dy>60)state(c==="full"&&dy<260?"peek":"off")}
grip.addEventListener("touchend",end);grip.addEventListener("touchcancel",end);
/* a result in #out (a parcel, a list of parcels around an address, a message) opens the sheet and closes the search */
var out=$("out");
function check(){
  var res=!!out&&!out.querySelector(":scope > .empty")&&out.textContent.trim().length>0;
  B.classList.toggle("uvRes",res);
  if(res){search(false);var was=cur();if(was==="off")state("peek");body.scrollTop=0;
    // the parcel was framed on the whole map: move it up into the part the sheet leaves free
    if(was==="off")setTimeout(fitFree,420);var h=out.querySelector("h2,h3,.rhead b,b");open.textContent=(h&&h.textContent.trim()?h.textContent.trim().slice(0,40)+" · ":"")+"Vezi fișa ↑"}
  else state("off");
}
if(out)new MutationObserver(check).observe(out,{childList:true});
check();
/* the rest of the platform opens on the app's domain, in the browser */
document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href]");if(!a)return;var h=a.getAttribute("href");
  if(h&&h.charAt(0)==="/"&&h.indexOf("/api/")!==0&&h.indexOf("/localizare")!==0&&h.indexOf("//")!==0){e.preventDefault();window.open(APP+h,"_blank","noopener")}},true);
relayout();
})()</script>`;
}
