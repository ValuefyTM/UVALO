"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtWhen, STATUS, type InspRow, type Question, type Template } from "@/lib/insp-shared";
import { allFiles, allFinish, flush, putFile, putFinish, shrink, type QPhoto } from "./store";
import { InstallHint } from "./InstallHint";

type Insp = InspRow & {
  cf_nr: string | null; area_util: number | null; area_land: number | null; rooms: { n: string; a: number | null }[]; template: Template; template_name: string | null;
  contact_phone: string | null; contact_role: string | null; answers: Record<string, string | string[]>; room_answers: Room[];
  findings: { diff?: string; defects?: string; notes?: string }; started_at: string | null; notes: string | null;
  files: { id: string; kind: string; name: string | null; room: string | null; taken_at: string | null }[];
};
type Room = { n: string; a: number | null; floor?: string; walls?: string; state?: string };
type Draft = { answers: Record<string, string | string[]>; rooms: Room[]; findings: { diff: string; defects: string; notes: string }; started_at: string };
type View = { v: "home" } | { v: "detail"; id: string } | { v: "form"; id: string; sec: number } | { v: "rooms"; id: string } | { v: "photos"; id: string } | { v: "sign"; id: string } | { v: "queue" } | { v: "account" };

const FLOORS = ["Parchet", "Gresie", "Laminat", "Mochetă", "Beton"];
const WALLS = ["Vopsea lavabilă", "Faianță", "Tapet", "Tencuieli simple"];
const STATES = ["Foarte bună", "Bună", "Satisfăcătoare", "Necesită reparații"];
const DAYS = ["DUM", "LUN", "MAR", "MIE", "JOI", "VIN", "SÂM"];
const MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
const WEEKDAYS = ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"];

const J = async (r: Response) => (await r.json().catch(() => ({}))) as Record<string, unknown>;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const loadDraft = (id: string): Draft | null => { try { return JSON.parse(localStorage.getItem(`insp-draft-${id}`) || "null"); } catch { return null; } };
const saveDraft = (id: string, d: Draft) => { try { localStorage.setItem(`insp-draft-${id}`, JSON.stringify(d)); } catch {} };
const answered = (v: unknown) => (Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim() !== "");
function distM(a: [number, number], b: [number, number]) {
  const r = (x: number) => (x * Math.PI) / 180, dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

const Back = ({ onClick }: { onClick: () => void }) => (
  <button type="button" className="mbBack" aria-label="Înapoi" onClick={onClick}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
  </button>
);

/** UVALO Inspecții, the phone app (PWA on inspectii.uvalo.ro): sign-in, the assigned inspections, the sheet, rooms, photos, signature. */
export function MobileApp() {
  const [me, setMe] = useState<{ name: string; email: string } | null>(null);
  const [state, setState] = useState<"boot" | "login" | "noaccess" | "app">("boot");
  const [items, setItems] = useState<InspRow[]>([]);
  const [cur, setCur] = useState<Insp | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [view, setViewState] = useState<View>({ v: "home" });
  const [pending, setPending] = useState<QPhoto[]>([]);
  const [finishQ, setFinishQ] = useState(0);
  const [online, setOnline] = useState(true);
  const [toast, setToast] = useState("");
  const pos = useRef<[number, number] | null>(null);

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3500); };
  const go = useCallback((v: View) => { setViewState(v); history.pushState({ mbv: v }, ""); window.scrollTo(0, 0); }, []);
  // the phone's Back button moves between the app's screens; caught before the Next.js router, which would reload the page
  useEffect(() => {
    const on = (e: PopStateEvent) => { e.stopImmediatePropagation(); setViewState((e.state?.mbv as View) ?? { v: "home" }); };
    window.addEventListener("popstate", on, true);
    return () => window.removeEventListener("popstate", on, true);
  }, []);

  const refreshQueue = useCallback(async () => { setPending(await allFiles()); setFinishQ((await allFinish()).length); }, []);
  const load = useCallback(async () => {
    const r = await fetch("/api/m/state", { cache: "no-store" }).catch(() => null);
    if (!r) { setState((s) => (s === "boot" ? "app" : s)); return; } // offline: keep what we have
    if (r.status === 401) { setState("login"); return; }
    const j = await J(r);
    setMe(j.user as { name: string; email: string });
    if (!j.allowed) { setState("noaccess"); return; }
    setItems(j.items as InspRow[]);
    try { localStorage.setItem("insp-items", JSON.stringify(j.items)); } catch {}
    setState("app");
  }, []);

  // start: pairing code from the QR (?pair=), the service worker (only on the app's own domain), the queue
  useEffect(() => {
    try { const c = JSON.parse(localStorage.getItem("insp-items") || "[]"); if (Array.isArray(c)) setItems(c); } catch {}
    const sp = new URLSearchParams(location.search), code = sp.get("pair");
    const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    (async () => {
      if (code) {
        history.replaceState(null, "", location.pathname);
        const r = await fetch("/api/m/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, standalone }) });
        if (!r.ok) say(String((await J(r)).error || "Codul nu a mers."));
      } else void fetch("/api/m/device", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ standalone }) }).catch(() => {});
      await load();
    })();
    if ("serviceWorker" in navigator && !location.pathname.startsWith("/m")) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    setOnline(navigator.onLine);
    const up = () => { setOnline(true); void flush().then(refreshQueue); };
    const down = () => setOnline(false);
    window.addEventListener("online", up); window.addEventListener("offline", down);
    void refreshQueue();
    const t = setInterval(() => { void flush().then(refreshQueue); }, 30000);
    if ("geolocation" in navigator) navigator.geolocation.watchPosition((p) => { pos.current = [p.coords.latitude, p.coords.longitude]; }, () => {}, { enableHighAccuracy: true, maximumAge: 30000 });
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); clearInterval(t); };
  }, [load, refreshQueue]);

  const curId = useRef<string | null>(null);
  async function fetchInsp(id: string) {
    const r = await fetch(`/api/m/insp/${id}`, { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return null;
    const x = (await r.json()) as Insp;
    try { localStorage.setItem(`insp-${id}`, JSON.stringify(x)); } catch {}
    return x;
  }
  // after sending: the photos that reached the server are shown from there
  const sendAll = useCallback(async () => {
    const n = await flush();
    await refreshQueue();
    const id = curId.current;
    if (id) { const x = await fetchInsp(id); if (x && curId.current === id) setCur(x); }
    return n;
  }, [refreshQueue]);

  async function open(id: string, then: View) {
    let x = await fetchInsp(id);
    if (!x) { try { x = JSON.parse(localStorage.getItem(`insp-${id}`) || "null"); } catch {} }
    if (!x) { say("Inspecția nu se poate deschide fără semnal. Deschide-o o dată cu internet."); return; }
    setCur(x); curId.current = id;
    const d = loadDraft(id) ?? {
      answers: Object.keys(x.answers).length ? x.answers : Object.fromEntries(x.template.groups.flatMap((g) => g.qs.filter((q) => q.def).map((q) => [q.id, q.kind === "many" ? [q.def!] : q.def!]))),
      rooms: x.room_answers.length ? x.room_answers : x.rooms.map((r) => ({ ...r })), findings: { diff: x.findings.diff ?? "", defects: x.findings.defects ?? "", notes: x.findings.notes ?? "" },
      started_at: x.started_at ?? "",
    };
    setDraft(d);
    go(then);
  }

  // every change: kept on the phone at once; sent to the server (in progress) a few seconds later
  const syncT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const change = (f: (d: Draft) => Draft) => {
    if (!cur || !draft) return;
    const d = f(structuredClone(draft));
    if (!d.started_at) d.started_at = new Date().toISOString();
    setDraft(d); saveDraft(cur.id, d);
    if (syncT.current) clearTimeout(syncT.current);
    const id = cur.id, lat = cur.lat, lng = cur.lng;
    syncT.current = setTimeout(() => {
      const near = pos.current && lat != null && lng != null ? distM(pos.current, [lat, lng]) : undefined;
      void fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "progress", id, answers: d.answers, room_answers: d.rooms, findings: d.findings, started_at: d.started_at, near }) }).catch(() => {});
    }, 4000);
  };

  async function addPhoto(file: File, room: string, kind: "photo" | "signature" = "photo") {
    if (!cur) return;
    const blob = kind === "photo" ? await shrink(file) : file;
    const p = pos.current;
    await putFile({ id: crypto.randomUUID(), insp: cur.id, kind, room, name: `${room || "foto"}-${Date.now()}.jpg`.replace(/[^\w.\-]+/g, "_"),
      taken_at: new Date().toISOString(), lat: p?.[0] ?? null, lng: p?.[1] ?? null, blob });
    await refreshQueue();
    void sendAll();
  }

  async function finish(signed: string, sig: Blob | null) {
    if (!cur || !draft) return;
    if (sig) await putFile({ id: crypto.randomUUID(), insp: cur.id, kind: "signature", room: "", name: "semnatura.png", taken_at: new Date().toISOString(),
      lat: pos.current?.[0] ?? null, lng: pos.current?.[1] ?? null, blob: sig });
    await putFinish({ id: cur.id, insp: cur.id, body: { action: "finish", id: cur.id, answers: draft.answers, room_answers: draft.rooms, findings: draft.findings,
      started_at: draft.started_at, signed_name: signed } });
    try { localStorage.removeItem(`insp-draft-${cur.id}`); } catch {}
    const left = await flush();
    await refreshQueue();
    say(left ? "Salvat pe telefon. Se trimite singur când ai semnal." : "Inspecția a fost trimisă.");
    await load();
    go({ v: "home" });
  }

  if (state === "boot") return <div className="mb mbBoot"><img src="/uvalo-logo.svg" alt="UVALO" /><span className="mbSpin" /></div>;
  if (state === "login") return <Login onDone={load} />;
  if (state === "noaccess") return (
    <div className="mb mbCenter">
      <img src="/uvalo-logo.svg" alt="UVALO" className="mbLogo" />
      <h1>Inspecțiile nu sunt încă disponibile pentru contul tău</h1>
      <p>Modulul este în test. Te anunțăm când îl poți folosi.</p>
      <button type="button" className="mbBtn" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); location.reload(); }}>Ieși din cont</button>
    </div>
  );

  const queueN = pending.length + finishQ;
  const nav = view.v === "home" || view.v === "queue" || view.v === "account";
  return (
    <div className={`mb${nav ? " withNav" : ""}`}>
      {!online && <div className="mbOffline">Fără semnal · lucrezi pe telefon, se trimite când revine rețeaua</div>}
      {view.v === "home" && <Home me={me} items={items} queueN={queueN} onOpen={(id) => open(id, { v: "detail", id })} onStart={(id) => open(id, { v: "form", id, sec: 0 })} onRefresh={load} />}
      {view.v === "detail" && cur && <Detail x={cur} draft={draft} onBack={() => history.back()} onStart={() => go({ v: "form", id: cur.id, sec: 0 })} />}
      {view.v === "form" && cur && draft && (
        <Form x={cur} d={draft} sec={view.sec} photos={pending.filter((p) => p.insp === cur.id).length + cur.files.filter((f) => f.kind === "photo").length}
          onBack={() => go({ v: "detail", id: cur.id })} onSec={(s) => setViewState({ v: "form", id: cur.id, sec: s })} change={change} onPhoto={addPhoto}
          onRooms={() => go({ v: "rooms", id: cur.id })} onPhotos={() => go({ v: "photos", id: cur.id })} onSign={() => go({ v: "sign", id: cur.id })} />
      )}
      {view.v === "rooms" && cur && draft && <Rooms d={draft} change={change} onBack={() => history.back()} onPhoto={addPhoto} />}
      {view.v === "photos" && cur && draft && <Photos x={cur} d={draft} pending={pending.filter((p) => p.insp === cur.id && p.kind === "photo")} onBack={() => history.back()} onPhoto={addPhoto} />}
      {view.v === "sign" && cur && draft && <Sign x={cur} d={draft} photos={pending.filter((p) => p.insp === cur.id).length + cur.files.filter((f) => f.kind === "photo").length} change={change} onBack={() => history.back()} onFinish={finish} />}
      {view.v === "queue" && <Queue pending={pending} finishN={finishQ} items={items} online={online} onSend={async () => { const n = await sendAll(); say(n ? "Mai sunt elemente de trimis." : "Totul a fost trimis."); }} />}
      {view.v === "account" && <Account me={me} />}
      {nav && (
        <nav className="mbNav" aria-label="Meniu">
          <button type="button" aria-current={view.v === "home" ? "page" : undefined} onClick={() => go({ v: "home" })}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 11l9-7 9 7v9H3z" /></svg>Acasă</button>
          <button type="button" aria-current={view.v === "queue" ? "page" : undefined} onClick={() => go({ v: "queue" })}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>De trimis{queueN > 0 && <i>{queueN}</i>}</button>
          <button type="button" aria-current={view.v === "account" ? "page" : undefined} onClick={() => go({ v: "account" })}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>Contul meu</button>
        </nav>
      )}
      {toast && <div className="mbToast" role="status">{toast}</div>}
    </div>
  );
}

/* ---------- sign-in: email code (as on the platform) or the code / QR from the web ---------- */

function Login({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<"email" | "code" | "pair">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const post = async (url: string, body: unknown) => {
    setBusy(true); setMsg("");
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await J(r);
      if (!r.ok) throw new Error(String(j.error || "Nu a mers."));
      return true;
    } catch (e) { setMsg((e as Error).message); return false; } finally { setBusy(false); }
  };
  const standalone = typeof window !== "undefined" && (matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
  return (
    <div className="mb mbLogin">
      <div className="mbLoginTop">
        <img src="/uvalo-logo.svg" alt="UVALO" className="mbLogo" />
        <span className="mbEyebrow">INSPECȚII</span>
        <h1>Inspecțiile tale, pe teren</h1>
        <p>Fișa, fotografiile cu ora și locul, semnătura. Te conectezi cu contul UVALO.</p>
      </div>
      <InstallHint compact />
      <div className="mbCard">
        {step === "email" && (
          <form onSubmit={async (e) => { e.preventDefault(); if (await post("/api/auth/request", { email })) setStep("code"); }}>
            <label className="mbField">Emailul contului UVALO<input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <button className="mbBtn gold big" disabled={busy}>Trimite-mi codul</button>
          </form>
        )}
        {step === "code" && (
          <form onSubmit={async (e) => { e.preventDefault(); if (await post("/api/auth/verify", { email, code })) { await fetch("/api/m/device", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ standalone }) }); onDone(); } }}>
            <p className="mbNote">Ți-am trimis un cod de 6 cifre pe <b>{email}</b>.</p>
            <label className="mbField">Codul din email<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required /></label>
            <button className="mbBtn gold big" disabled={busy || code.length < 6}>Intră</button>
            <button type="button" className="mbLink" onClick={() => { setStep("email"); setCode(""); }}>Alt email</button>
          </form>
        )}
        {step === "pair" && (
          <form onSubmit={async (e) => { e.preventDefault(); if (await post("/api/m/pair", { code, standalone })) onDone(); }}>
            <p className="mbNote">Pe calculator, în UVALO → <b>Inspecții</b>, apasă „Arată codul de conectare”. Scanează codul QR cu camera telefonului sau scrie aici cele 6 cifre.</p>
            <label className="mbField">Codul de conectare<input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required /></label>
            <button className="mbBtn gold big" disabled={busy || code.length < 6}>Conectează telefonul</button>
          </form>
        )}
        {msg && <p className="mbErr" role="alert">{msg}</p>}
      </div>
      {step !== "pair" ? <button type="button" className="mbLink" onClick={() => { setStep("pair"); setCode(""); setMsg(""); }}>Am un cod de conectare de pe calculator</button>
        : <button type="button" className="mbLink" onClick={() => { setStep("email"); setCode(""); setMsg(""); }}>Intră cu emailul</button>}
    </div>
  );
}

/* ---------- home ---------- */

function Home({ me, items, queueN, onOpen, onStart, onRefresh }: { me: { name: string } | null; items: InspRow[]; queueN: number; onOpen: (id: string) => void; onStart: (id: string) => void; onRefresh: () => void }) {
  const [f, setF] = useState<"week" | "prog" | "done" | "all">("week");
  const now = new Date(), today = ymd(now);
  const wkEnd = ymd(new Date(now.getTime() + 7 * 864e5));
  const active = items.filter((i) => i.status !== "gata" && i.status !== "pred");
  const next = active.filter((i) => i.scheduled_at && i.scheduled_at >= today).sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!))[0] ?? active.find((i) => i.status === "lucru");
  const inWeek = active.filter((i) => i.scheduled_at && i.scheduled_at.slice(0, 10) >= today && i.scheduled_at.slice(0, 10) <= wkEnd);
  const list = f === "week" ? [...active.filter((i) => i.status === "lucru"), ...inWeek.filter((i) => i.status !== "lucru")] : f === "prog" ? active.filter((i) => !i.scheduled_at)
    : f === "done" ? items.filter((i) => i.status === "gata" || i.status === "pred") : items;
  const first = (me?.name ?? "").split(/\s+/)[0];
  const mins = next?.scheduled_at ? Math.round((new Date(next.scheduled_at).getTime() - now.getTime()) / 60000) : null;
  return (
    <>
      <header className="mbHead">
        <div className="mbHeadRow">
          <span><small>{WEEKDAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]}</small><b>Bună{first ? `, ${first}` : ""}!</b></span>
          <button type="button" className="mbAv" onClick={onRefresh} aria-label="Reîncarcă">{initials(me?.name ?? "U")}</button>
        </div>
        {next ? (
          <div className="mbNext">
            <span className="mbNextTop"><small>{next.status === "lucru" ? "ÎN LUCRU" : mins != null && mins >= 0 && mins < 24 * 60 ? `URMĂTOAREA · ÎN ${mins < 60 ? `${mins} MIN` : `${Math.round(mins / 60)} H`}` : "URMĂTOAREA"}</small></span>
            <button type="button" className="mbNextMain" onClick={() => onOpen(next.id)}>
              <span className="mbTime"><b>{next.scheduled_at?.slice(11, 16) ?? "—"}</b><small>{next.duration_min} min</small></span>
              <span><b>{next.address}</b><small>{[next.prop_type, next.contact_name].filter(Boolean).join(" · ")}</small></span>
            </button>
            <span className="mbNextBtns">
              <a className="mbBtn" href={next.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${next.lat},${next.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(next.address)}`} target="_blank" rel="noopener">Navighează</a>
              <button type="button" className="mbBtn" onClick={() => onOpen(next.id)}>Detalii</button>
              <button type="button" className="mbBtn gold" onClick={() => onStart(next.id)}>{next.status === "lucru" ? "Continuă" : "Începe fișa"}</button>
            </span>
          </div>
        ) : <div className="mbNext mbNextNone"><b>Nicio inspecție programată</b><small>Inspecțiile pregătite pentru tine pe web apar aici.</small></div>}
      </header>
      <InstallHint />
      <div className="mbStats">
        <span><b>{active.filter((i) => i.scheduled_at?.startsWith(today)).length}</b><small>azi</small></span>
        <span><b>{inWeek.length}</b><small>săptămâna asta</small></span>
        <span><b className={queueN ? "red" : ""}>{queueN}</b><small>de trimis</small></span>
        <span><b className="green">{items.filter((i) => i.status === "gata" || i.status === "pred").length}</b><small>finalizate</small></span>
      </div>
      <div className="mbSecHead"><b>Inspecțiile mele</b></div>
      <div className="mbChips" role="group" aria-label="Filtru">
        {([["week", `Săptămâna asta · ${inWeek.length + active.filter((i) => i.status === "lucru" && !inWeek.includes(i)).length}`], ["prog", `Neprogramate · ${active.filter((i) => !i.scheduled_at).length}`], ["done", "Finalizate"], ["all", "Toate"]] as const).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>
        ))}
      </div>
      <div className="mbList">
        {list.map((i) => {
          const d = i.scheduled_at ? new Date(i.scheduled_at) : null, isToday = i.scheduled_at?.startsWith(today);
          return (
            <button key={i.id} type="button" className="mbItem" onClick={() => onOpen(i.id)}>
              <span className={`mbDay${isToday ? " today" : ""}`}><small>{d ? (isToday ? "AZI" : DAYS[d.getDay()]) : "—"}</small><b>{i.scheduled_at?.slice(11, 16) ?? "?"}</b></span>
              <span className="mbItemTxt">
                <span><em>{(i.prop_type ?? "IMOBIL").toUpperCase()}</em><i style={{ color: STATUS[i.status].fg }}>● {STATUS[i.status].label}</i></span>
                <b>{i.address}</b>
                <small>{[i.contact_name, i.cad_nr && `nr. cad. ${i.cad_nr}`].filter(Boolean).join(" · ") || fmtWhen(i.scheduled_at)}</small>
              </span>
            </button>
          );
        })}
        {!list.length && <p className="mbEmpty">Nimic aici. Inspecțiile se pregătesc pe web, în UVALO → Inspecții.</p>}
      </div>
    </>
  );
}

/* ---------- inspection detail ---------- */

function Detail({ x, draft, onBack, onStart }: { x: Insp; draft: Draft | null; onBack: () => void; onStart: () => void }) {
  const done = x.status === "gata" || x.status === "pred";
  const dest = x.lat != null ? `${x.lat},${x.lng}` : encodeURIComponent(x.address);
  const docs = x.files.filter((f) => f.kind !== "photo" && f.kind !== "signature");
  return (
    <>
      <header className="mbBar"><Back onClick={onBack} /><span><b>{x.address}</b><small>{[x.prop_type, x.cad_nr && `nr. cad. ${x.cad_nr}`].filter(Boolean).join(" · ")}</small></span></header>
      <div className="mbBody">
        {done ? <div className="mbOk">✓ Inspecția a fost trimisă. Fișa se vede în UVALO, pe web.</div> : (
          <button type="button" className="mbStart" onClick={onStart}>
            <b>{draft?.started_at ? "Continuă fișa" : "Începe fișa acum"}</b><small>{x.scheduled_at ? `programată ${fmtWhen(x.scheduled_at)}` : "sunt la proprietate"}</small>
          </button>
        )}
        <section className="mbCard">
          <b>{x.address}</b>
          <small>{[x.prop_type, x.area_util && `${x.area_util} mp utili`, x.area_land && `teren ${x.area_land} mp`].filter(Boolean).join(" · ")}</small>
          <span className="mbGrid2">
            <a className="mbBtn" href={`https://www.google.com/maps/dir/?api=1&destination=${dest}`} target="_blank" rel="noopener">Google Maps</a>
            <a className="mbBtn" href={x.lat != null ? `https://waze.com/ul?ll=${x.lat},${x.lng}&navigate=yes` : `https://waze.com/ul?q=${dest}`} target="_blank" rel="noopener">Waze</a>
          </span>
        </section>
        {x.contact_name && (
          <section className="mbCard">
            <span className="mbRowBetween"><span><small className="mbCap">{(x.contact_role ?? "Contact").toUpperCase()}</small><b>{x.contact_name}</b></span><small>{x.contact_phone}</small></span>
            {x.contact_phone && <span className="mbGrid2"><a className="mbBtn dark" href={`tel:${x.contact_phone.replace(/\s+/g, "")}`}>Sună</a><a className="mbBtn" href={`sms:${x.contact_phone.replace(/\s+/g, "")}`}>SMS</a></span>}
          </section>
        )}
        <section className="mbCard">
          <small className="mbCap">ACTE · {docs.length}</small>
          {docs.length ? <span className="mbDocs">{docs.map((d) => <a key={d.id} className="mbBtn" href={`/api/inspectii/file/${d.id}`} target="_blank" rel="noopener">{d.kind === "cf" ? "Extras CF" : d.kind === "releveu" ? "Releveu" : d.name ?? "Document"}</a>)}</span>
            : <small>Niciun act atașat pe web.</small>}
        </section>
        {x.notes && <section className="mbCard"><small className="mbCap">NOTE</small><span>{x.notes}</span></section>}
        <section className="mbCard"><small className="mbCap">FIȘA</small><span>{x.template_name ?? "Fișa de inspecție"} · {x.template.groups.reduce((s, g) => s + g.qs.length, 0)} întrebări · {x.rooms.length} încăperi</span></section>
      </div>
    </>
  );
}

/* ---------- the sheet ---------- */

function QInput({ q, v, set, onPhoto }: { q: Question; v: string | string[] | undefined; set: (v: string | string[]) => void; onPhoto: (f: File, room: string) => void }) {
  const cam = useRef<HTMLInputElement>(null);
  return (
    <div className="mbQ">
      <span className="mbQT">{q.t}{q.req && <i aria-label="obligatorie"> *</i>}</span>
      {(q.kind === "one" || q.kind === "many") && (
        <span className="mbOpts">
          {(q.options ?? []).map((o) => {
            const on = q.kind === "one" ? v === o : Array.isArray(v) && v.includes(o);
            return <button key={o} type="button" aria-pressed={on} onClick={() => set(q.kind === "one" ? (on ? "" : o) : on ? (v as string[]).filter((y) => y !== o) : [...(Array.isArray(v) ? v : []), o])}>{o}</button>;
          })}
        </span>
      )}
      {q.kind === "text" && <textarea className="mbIn" rows={2} value={(v as string) ?? ""} onChange={(e) => set(e.target.value)} />}
      {q.kind === "number" && <span className="mbNum"><input className="mbIn" inputMode="decimal" value={(v as string) ?? ""} onChange={(e) => set(e.target.value.replace(/[^\d.,-]/g, ""))} />{q.unit && <em>{q.unit}</em>}</span>}
      {q.kind === "date" && <input className="mbIn" type="date" value={(v as string) ?? ""} onChange={(e) => set(e.target.value)} />}
      {q.photo && <>
        <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f, q.t); e.target.value = ""; }} />
        <button type="button" className="mbLink" onClick={() => cam.current?.click()}>+ Fotografie pentru „{q.t}”</button>
      </>}
    </div>
  );
}

function Form({ x, d, sec, photos, onBack, onSec, change, onPhoto, onRooms, onPhotos, onSign }: {
  x: Insp; d: Draft; sec: number; photos: number; onBack: () => void; onSec: (s: number) => void; change: (f: (d: Draft) => Draft) => void;
  onPhoto: (f: File, room: string) => void; onRooms: () => void; onPhotos: () => void; onSign: () => void;
}) {
  const groups = x.template.groups;
  const all = groups.flatMap((g) => g.qs);
  const done = all.filter((q) => answered(d.answers[q.id])).length;
  const isFind = sec >= groups.length;
  const g = groups[sec];
  const roomsDone = d.rooms.filter((r) => r.floor && r.state).length;
  return (
    <>
      <header className="mbBar tall">
        <span className="mbBarRow"><Back onClick={onBack} /><span><b>Fișa · {x.prop_type ?? "imobil"}</b><small>Salvat pe telefon · {done} din {all.length} completate</small></span></span>
        <span className="mbProg"><i style={{ width: `${all.length ? Math.round((done / all.length) * 100) : 0}%` }} /></span>
        <nav className="mbSecs" aria-label="Secțiuni">
          {groups.map((gr, i) => {
            const n = gr.qs.filter((q) => answered(d.answers[q.id])).length;
            return <button key={gr.id} type="button" aria-current={i === sec ? "step" : undefined} className={n === gr.qs.length && gr.qs.length ? "ok" : ""} onClick={() => onSec(i)}>{n === gr.qs.length && gr.qs.length ? "✓ " : ""}{gr.name}{i === sec ? ` ${n}/${gr.qs.length}` : ""}</button>;
          })}
          <button type="button" aria-current={isFind ? "step" : undefined} onClick={() => onSec(groups.length)}>Constatări</button>
        </nav>
      </header>
      <div className="mbBody">
        {!isFind && g && <>
          <h2 className="mbH2">{g.name}</h2>
          {g.qs.map((q) => <QInput key={q.id} q={q} v={d.answers[q.id]} onPhoto={onPhoto} set={(v) => change((o) => { o.answers[q.id] = v; return o; })} />)}
        </>}
        {isFind && <>
          <h2 className="mbH2">Constatări</h2>
          <label className="mbField">Diferențe față de acte<textarea className="mbIn" rows={2} value={d.findings.diff} onChange={(e) => change((o) => { o.findings.diff = e.target.value; return o; })} /></label>
          <label className="mbField">Defecte vizibile<textarea className="mbIn" rows={2} value={d.findings.defects} onChange={(e) => change((o) => { o.findings.defects = e.target.value; return o; })} /></label>
          <label className="mbField">Observații<textarea className="mbIn" rows={3} value={d.findings.notes} onChange={(e) => change((o) => { o.findings.notes = e.target.value; return o; })} /></label>
        </>}
      </div>
      <footer className="mbFoot">
        <span className="mbGrid3">
          <button type="button" className="mbBtn" onClick={onRooms}>Încăperi {roomsDone}/{d.rooms.length}</button>
          <button type="button" className="mbBtn" onClick={onPhotos}>Foto · {photos}</button>
          <button type="button" className="mbBtn" onClick={onSign}>Semnătură</button>
        </span>
        {sec < groups.length ? <button type="button" className="mbBtn gold big" onClick={() => { onSec(sec + 1); window.scrollTo(0, 0); }}>Secțiunea următoare: {sec + 1 < groups.length ? groups[sec + 1].name : "Constatări"} →</button>
          : <button type="button" className="mbBtn gold big" onClick={onSign}>Încheie inspecția →</button>}
      </footer>
    </>
  );
}

/* ---------- rooms (from the floor plan) ---------- */

function Rooms({ d, change, onBack, onPhoto }: { d: Draft; change: (f: (d: Draft) => Draft) => void; onBack: () => void; onPhoto: (f: File, room: string) => void }) {
  const cam = useRef<HTMLInputElement>(null);
  const [for_, setFor] = useState("");
  const pick = (i: number, k: "floor" | "walls" | "state", v: string) => change((o) => { o.rooms[i][k] = o.rooms[i][k] === v ? undefined : v; return o; });
  return (
    <>
      <header className="mbBar"><Back onClick={onBack} /><span><b>Încăperi · {d.rooms.length}</b><small>Din releveu; adaugi ce lipsește</small></span></header>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f, for_); e.target.value = ""; }} />
      <div className="mbBody">
        {d.rooms.map((r, i) => (
          <section key={i} className="mbCard">
            <span className="mbRowBetween"><b>{i + 1}. {r.n}</b><span className="mbNum small"><input className="mbIn" inputMode="decimal" aria-label="Suprafața" value={r.a ?? ""} onChange={(e) => change((o) => { const v = parseFloat(e.target.value.replace(",", ".")); o.rooms[i].a = Number.isFinite(v) ? v : null; return o; })} /><em>mp</em></span></span>
            <small className="mbCap">PARDOSEALĂ</small>
            <span className="mbOpts">{FLOORS.map((o) => <button key={o} type="button" aria-pressed={r.floor === o} onClick={() => pick(i, "floor", o)}>{o}</button>)}</span>
            <small className="mbCap">PEREȚI</small>
            <span className="mbOpts">{WALLS.map((o) => <button key={o} type="button" aria-pressed={r.walls === o} onClick={() => pick(i, "walls", o)}>{o}</button>)}</span>
            <small className="mbCap">STARE</small>
            <span className="mbOpts">{STATES.map((o) => <button key={o} type="button" aria-pressed={r.state === o} onClick={() => pick(i, "state", o)}>{o}</button>)}</span>
            <button type="button" className="mbLink" onClick={() => { setFor(r.n); cam.current?.click(); }}>+ Fotografie {r.n}</button>
          </section>
        ))}
        <button type="button" className="mbBtn" onClick={() => { const n = prompt("Numele încăperii"); if (n?.trim()) change((o) => { o.rooms.push({ n: n.trim(), a: null }); return o; }); }}>+ Încăpere</button>
      </div>
    </>
  );
}

/* ---------- photos ---------- */

function Photos({ x, d, pending, onBack, onPhoto }: { x: Insp; d: Draft; pending: QPhoto[]; onBack: () => void; onPhoto: (f: File, room: string) => void }) {
  const cats = useMemo(() => ["Exterior", ...d.rooms.map((r, i) => `${r.n} · rlv ${i + 1}`), "Contoare", "Defecte"], [d.rooms]);
  const [room, setRoom] = useState(cats[0]);
  const cam = useRef<HTMLInputElement>(null);
  const sent = x.files.filter((f) => f.kind === "photo");
  const urls = useMemo(() => new Map(pending.map((p) => [p.id, URL.createObjectURL(p.blob)])), [pending]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  const groups = cats.map((c) => ({ c, sent: sent.filter((f) => f.room === c), local: pending.filter((p) => p.room === c) })).filter((g) => g.sent.length || g.local.length || g.c === room);
  return (
    <>
      <header className="mbBar"><Back onClick={onBack} /><span><b>Fotografii · {sent.length + pending.length}</b><small>Cu dată și locație · {sent.length} trimise, {pending.length} pe telefon</small></span></header>
      <div className="mbBody">
        {groups.map((g) => (
          <section key={g.c} className="mbPhGroup">
            <span className="mbRowBetween"><b>{g.c}</b><small>{g.sent.length + g.local.length} foto</small></span>
            <span className="mbPhGrid">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {g.sent.map((f) => <img key={f.id} src={`/api/inspectii/file/${f.id}`} alt={g.c} loading="lazy" />)}
              {g.local.map((p) => <span key={p.id} className="mbPhLocal">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={urls.get(p.id)} alt={g.c} /><em>PE TELEFON</em></span>)}
              <button type="button" aria-label={`Fotografiază ${g.c}`} onClick={() => { setRoom(g.c); cam.current?.click(); }}>+</button>
            </span>
          </section>
        ))}
      </div>
      <footer className="mbFoot">
        <label className="mbField">Următoarea poză merge la<select className="mbIn" value={room} onChange={(e) => setRoom(e.target.value)}>{cats.map((c) => <option key={c}>{c}</option>)}</select></label>
        <input ref={cam} type="file" accept="image/*" capture="environment" hidden multiple onChange={async (e) => { for (const f of Array.from(e.target.files ?? [])) await onPhoto(f, room); e.target.value = ""; }} />
        <button type="button" className="mbBtn gold big" onClick={() => cam.current?.click()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>Fotografiază
        </button>
      </footer>
    </>
  );
}

/* ---------- signature and sending ---------- */

function Sign({ x, d, photos, change, onBack, onFinish }: { x: Insp; d: Draft; photos: number; change: (f: (d: Draft) => Draft) => void; onBack: () => void; onFinish: (name: string, sig: Blob | null) => Promise<void> }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [has, setHas] = useState(false);
  const [who, setWho] = useState<"contact" | "other">(x.contact_name ? "contact" : "other");
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const all = x.template.groups.flatMap((g) => g.qs);
  const req = all.filter((q) => q.req), missing = req.filter((q) => !answered(d.answers[q.id]));
  useEffect(() => {
    const c = cv.current!; const r = c.getBoundingClientRect(), k = window.devicePixelRatio || 1;
    c.width = r.width * k; c.height = r.height * k;
    const g = c.getContext("2d")!; g.scale(k, k); g.lineWidth = 2.6; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#141414";
  }, []);
  const pt = (e: React.PointerEvent) => { const r = cv.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  const name = who === "contact" ? x.contact_name ?? "" : other.trim();
  return (
    <>
      <header className="mbBar"><Back onClick={onBack} /><span><b>Încheie inspecția</b><small>Verifică, semnează, trimite</small></span></header>
      <div className="mbBody">
        <section className="mbCard mbSum">
          <span><span>Fișa</span><b className={missing.length ? "warn" : "ok"}>{missing.length ? `lipsesc ${missing.length} obligatorii` : `✓ ${all.filter((q) => answered(d.answers[q.id])).length}/${all.length}`}</b></span>
          <span><span>Încăperi</span><b className={d.rooms.every((r) => r.state) ? "ok" : "warn"}>{d.rooms.filter((r) => r.state).length}/{d.rooms.length}</b></span>
          <span><span>Fotografii</span><b className={photos ? "ok" : "warn"}>{photos ? `✓ ${photos}` : "niciuna"}</b></span>
        </section>
        {missing.length > 0 && <p className="mbNote">Lipsesc: {missing.slice(0, 4).map((q) => q.t).join(", ")}{missing.length > 4 ? "…" : ""}. Poți trimite și așa.</p>}
        <small className="mbCap">CINE A FOST PREZENT</small>
        <span className="mbOpts">
          {x.contact_name && <button type="button" aria-pressed={who === "contact"} onClick={() => setWho("contact")}>{x.contact_name}{x.contact_role ? ` · ${x.contact_role.toLowerCase()}` : ""}</button>}
          <button type="button" aria-pressed={who === "other"} onClick={() => setWho("other")}>Altcineva</button>
        </span>
        {who === "other" && <input className="mbIn" placeholder="Numele persoanei prezente" value={other} onChange={(e) => setOther(e.target.value)} />}
        <span className="mbRowBetween"><small className="mbCap">SEMNĂTURA PERSOANEI PREZENTE</small><button type="button" className="mbLink" onClick={() => { const c = cv.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setHas(false); }}>Șterge</button></span>
        <canvas ref={cv} className="mbSig" aria-label="Semnează aici cu degetul"
          onPointerDown={(e) => { drawing.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); const [a, b] = pt(e); const g = cv.current!.getContext("2d")!; g.beginPath(); g.moveTo(a, b); }}
          onPointerMove={(e) => { if (!drawing.current) return; const [a, b] = pt(e); const g = cv.current!.getContext("2d")!; g.lineTo(a, b); g.stroke(); setHas(true); }}
          onPointerUp={() => { drawing.current = false; }} />
        <section className="mbDark"><b>După trimitere</b><span>Fișa, fotografiile pe încăperi și semnătura apar în UVALO, pe web, la inspecție: de acolo descarci PDF-ul și trimiți anexa foto în Word.</span></section>
      </div>
      <footer className="mbFoot">
        <button type="button" className="mbBtn gold big" disabled={busy || !name || !has} onClick={async () => {
          setBusy(true);
          const blob = await new Promise<Blob | null>((res) => cv.current!.toBlob(res, "image/png"));
          change((o) => o);
          await onFinish(name, blob);
          setBusy(false);
        }}>Finalizează și trimite</button>
        <small className="mbCenterSmall">{!name ? "Alege cine a fost prezent." : !has ? "Cere semnătura în chenar." : "Fără semnal? Se trimite singură când revine rețeaua."}</small>
      </footer>
    </>
  );
}

/* ---------- queue and account ---------- */

function Queue({ pending, finishN, items, online, onSend }: { pending: QPhoto[]; finishN: number; items: InspRow[]; online: boolean; onSend: () => void }) {
  const by = new Map<string, number>();
  pending.forEach((p) => by.set(p.insp, (by.get(p.insp) ?? 0) + 1));
  return (
    <>
      <header className="mbHead small"><b>De trimis</b><small>{online ? "Ai semnal: se trimite automat" : "Fără semnal: se trimite când revine rețeaua"}</small></header>
      <div className="mbBody">
        {[...by].map(([id, n]) => <section key={id} className="mbCard"><b>{items.find((i) => i.id === id)?.address ?? "Inspecție"}</b><small>{n} {n === 1 ? "fișier" : "fișiere"} pe telefon</small></section>)}
        {finishN > 0 && <section className="mbCard"><b>{finishN} {finishN === 1 ? "fișă finalizată" : "fișe finalizate"}</b><small>așteaptă să fie trimise</small></section>}
        {!pending.length && !finishN ? <p className="mbEmpty">Totul a fost trimis.</p> : <button type="button" className="mbBtn gold big" disabled={!online} onClick={onSend}>Trimite acum</button>}
      </div>
    </>
  );
}

function Account({ me }: { me: { name: string; email: string } | null }) {
  return (
    <>
      <header className="mbHead small"><b>Contul meu</b><small>{me?.email}</small></header>
      <div className="mbBody">
        <section className="mbCard"><b>{me?.name}</b><small>{me?.email}</small></section>
        <InstallHint compact />
        <a className="mbBtn" href="https://app.uvalo.ro/inspectii" target="_blank" rel="noopener">Deschide UVALO pe web</a>
        <button type="button" className="mbBtn" onClick={async () => { if (!confirm("Ieși din cont pe acest telefon?")) return; await fetch("/api/auth/logout", { method: "POST" }); location.reload(); }}>Ieși din cont</button>
        <small className="mbCenterSmall">UVALO Inspecții · versiune de test</small>
      </div>
    </>
  );
}
