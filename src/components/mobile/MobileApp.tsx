"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONTACT_ROLES, fmtWhen, isOptional, photoCategories, PROP_TYPES, ROOM_FIELDS, STATUS, type InspRow, type Question, type SubQ, subKey, type Template } from "@/lib/insp-shared";
import { allFiles, allFinish, flush, progress, putFile, putFinish, readExif, shrink, type QPhoto, type UploadProgress } from "./store";
import { InstallHint } from "./InstallHint";

type Insp = InspRow & {
  cf_nr: string | null; area_util: number | null; area_land: number | null; rooms: { n: string; a: number | null }[]; template: Template; template_name: string | null;
  contact_phone: string | null; contact_role: string | null; answers: Record<string, string | string[]>; room_answers: Room[];
  findings: { diff?: string; defects?: string; notes?: string }; started_at: string | null; notes: string | null;
  files: { id: string; kind: string; name: string | null; room: string | null; taken_at: string | null }[];
  uat?: string | null; county?: string | null; template_version?: number | null; created_at?: string; redo_note?: string | null;
};
type Room = { n: string; a: number | null; floor?: string; walls?: string; ceiling?: string; state?: string };
type Me = { id: string; name: string; email: string; avatar?: boolean; anevar_no?: string | null; county?: string | null; phone?: string | null;
  org?: { id: string; name: string; logo: boolean; role: string | null } | null };
type Info = { stats: { total: number; month: number; last: string | null; avg_min: number | null; photos: number }; device: { name: string; platform: string; created_at: string; last_seen_at: string } | null };
type Tpl = { id: string; name: string; prop_type: string | null };
type Notif = { id: number; insp: string; at: string; text: string; address: string; who: string | null };
type Reminder = { key: string; insp: string; when: string; address: string; today: boolean };
type Draft = { answers: Record<string, string | string[]>; rooms: Room[]; findings: { diff: string; defects: string; notes: string }; started_at: string };
type View = { v: "home" } | { v: "detail"; id: string } | { v: "form"; id: string; sec: number } | { v: "rooms"; id: string } | { v: "photos"; id: string } | { v: "sign"; id: string } | { v: "queue" } | { v: "account" } | { v: "new" } | { v: "notifs" };

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

/** The account's picture (as on the platform), or its initials. */
const Avatar = ({ me, big = false }: { me: Me | null; big?: boolean }) => {
  const [bad, setBad] = useState(false);
  const cls = `mbAvImg${big ? " big" : ""}`;
  // eslint-disable-next-line @next/next/no-img-element
  return me?.avatar && !bad ? <img className={cls} src={`/api/avatar/${me.id}`} alt="" onError={() => setBad(true)} /> : <span className={cls} aria-hidden="true">{initials(me?.name ?? "U")}</span>;
};

const Back = ({ onClick }: { onClick: () => void }) => (
  <button type="button" className="mbBack" aria-label="Înapoi" onClick={onClick}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
  </button>
);

/** UVALO Inspecții, the phone app (PWA on inspectii.uvalo.ro): sign-in, the assigned inspections, the sheet, rooms, photos, signature. */
export function MobileApp() {
  const [me, setMe] = useState<Me | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [seen, setSeen] = useState<{ at: string; keys: string[] }>({ at: "", keys: [] });
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem("insp-notif-seen") || "null"); if (v?.at != null) setSeen(v); } catch {} }, []);
  const [state, setState] = useState<"boot" | "login" | "noaccess" | "app">("boot");
  const [items, setItems] = useState<InspRow[]>([]);
  const [cur, setCur] = useState<Insp | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [view, setViewState] = useState<View>({ v: "home" });
  const [pending, setPending] = useState<QPhoto[]>([]);
  const [finishQ, setFinishQ] = useState(0);
  const [online, setOnline] = useState(true);
  const [toast, setToast] = useState("");
  const [up, setUp] = useState<UploadProgress>(null);
  useEffect(() => {
    const on = (e: Event) => setUp((e as CustomEvent<UploadProgress>).detail);
    window.addEventListener("insp-upload", on);
    return () => window.removeEventListener("insp-upload", on);
  }, []);
  const pos = useRef<[number, number] | null>(null);
  const [sched, setSched] = useState<Sched | null>(null);

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
    setMe(j.user as Me);
    if (!j.allowed) { setState("noaccess"); return; }
    setItems(j.items as InspRow[]);
    setInfo((j.info as Info) ?? null);
    setTpls((j.templates as Tpl[]) ?? []);
    setNotifs((j.notifs as Notif[]) ?? []);
    try { localStorage.setItem("insp-items", JSON.stringify(j.items)); } catch {}
    setState("app");
  }, []);

  // start: pairing code from the QR (?pair=), the service worker (only on the app's own domain), the queue
  useEffect(() => {
    try { const c = JSON.parse(localStorage.getItem("insp-items") || "[]"); if (Array.isArray(c)) setItems(c); } catch {}
    const sp = new URLSearchParams(location.search), code = sp.get("pair"), openId = sp.get("open");
    const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    (async () => {
      if (code) {
        history.replaceState(null, "", location.pathname);
        const r = await fetch("/api/m/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, standalone }) });
        if (!r.ok) say(String((await J(r)).error || "Codul nu a mers."));
      } else void fetch("/api/m/device", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ standalone }) }).catch(() => {});
      await load();
      if (openId) { history.replaceState(null, "", location.pathname); void openRef.current(openId); }
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

  // pull down at the top of the page = refresh (the list, what waits to be sent, the open inspection)
  const [pull, setPull] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [drag, setDrag] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const refresh = useCallback(async () => {
    await sendAll();
    await load();
    const v = viewRef.current;
    if (v.v === "detail") { const x = await fetchInsp(v.id); if (x) setCur(x); }
  }, [sendAll, load]); // eslint-disable-line react-hooks/exhaustive-deps
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    const PULL = 64;
    let y0: number | null = null, d = 0, busy = false;
    const ok = () => ["home", "queue", "account", "detail"].includes(viewRef.current.v);
    const start = (e: TouchEvent) => {
      y0 = null;
      if (busy || !ok() || window.scrollY > 0 || e.touches.length > 1) return;
      if ((e.target as Element).closest?.(".mbMap, .mbSig, .mbSheetBg, input, textarea, select")) return;
      y0 = e.touches[0].clientY; d = 0;
    };
    const move = (e: TouchEvent) => {
      if (y0 == null) return;
      d = (e.touches[0].clientY - y0) * 0.5;
      if (d <= 0 || window.scrollY > 0) { y0 = null; setPull(0); return; }
      if (e.cancelable) e.preventDefault();
      setDrag(true);
      setPull(Math.min(130, d));
    };
    const end = async () => {
      if (y0 == null) return;
      y0 = null;
      setDrag(false);
      if (d < PULL) { setPull(0); return; }
      busy = true; setPulling(true); setPull(PULL);
      try { await refreshRef.current(); } finally { busy = false; setPulling(false); setPull(0); }
    };
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);
    window.addEventListener("touchcancel", end);
    return () => {
      window.removeEventListener("touchstart", start); window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end); window.removeEventListener("touchcancel", end);
    };
  }, []);

  const openRef = useRef<(id: string) => Promise<void>>(async () => {});
  openRef.current = (id: string) => open(id, { v: "detail", id });
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
    await addPhotos([file], room, false, kind);
  }
  /**
   * Photos kept on the phone and sent when there is signal, marked with the chosen category. From the camera: now and here;
   * from the gallery: the time and place written in the photo (EXIF), else the file's date and no place.
   */
  async function addPhotos(files: File[], room: string, gallery: boolean, kind: "photo" | "signature" = "photo") {
    if (!cur || !files.length) return;
    let i = 0;
    for (const file of files) {
      if (kind === "photo") progress({ phase: "prep", done: i, total: files.length });
      const ex = gallery ? await readExif(file) : null;
      const blob = kind === "photo" ? await shrink(file) : file;
      const p = gallery ? null : pos.current;
      await putFile({ id: crypto.randomUUID(), insp: cur.id, kind, room, name: `${room || "foto"}-${Date.now()}-${++i}.jpg`.replace(/[^\w.\-]+/g, "_"),
        taken_at: ex?.taken_at ?? (gallery && file.lastModified ? new Date(file.lastModified).toISOString() : new Date().toISOString()),
        lat: ex?.lat ?? p?.[0] ?? null, lng: ex?.lng ?? p?.[1] ?? null, blob });
    }
    // the bar goes on with the sending (flush shows it and hides it at the end)
    progress({ phase: "send", done: 0, total: files.length });
    await refreshQueue();
    if (files.length > 1) say(`${files.length} fotografii adăugate la „${room}”.`);
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
  // the bell: today's / tomorrow's inspections not started yet, and what others did on my inspections
  const tday = ymd(new Date()), tmrw = ymd(new Date(Date.now() + 864e5));
  const reminders: Reminder[] = items.filter((i) => (i.status === "plan" || i.status === "prog") && i.scheduled_at && [tday, tmrw].includes(i.scheduled_at.slice(0, 10)))
    .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!))
    .map((i) => ({ key: `${i.id}@${i.scheduled_at}`, insp: i.id, when: i.scheduled_at!, address: i.address, today: i.scheduled_at!.startsWith(tday) }));
  const unread = notifs.filter((n) => n.at > seen.at).length + reminders.filter((r) => !seen.keys.includes(r.key)).length;
  const markSeen = () => {
    const v = { at: notifs[0]?.at && notifs[0].at > seen.at ? notifs[0].at : seen.at, keys: reminders.map((r) => r.key) };
    setSeen(v); try { localStorage.setItem("insp-notif-seen", JSON.stringify(v)); } catch {}
  };
  return (
    <div className={`mb${nav ? " withNav" : ""}`}>
      {(pull > 0 || pulling) && (
        <div className="mbPull" style={{ height: pull, opacity: Math.min(1, pull / 64) }} aria-live="polite">
          <span className={pulling ? "on" : ""} style={pulling ? undefined : { transform: `rotate(${pull * 4}deg)` }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" /></svg>
          </span>
          <span className="sr-only">{pulling ? "Se reîncarcă" : ""}</span>
        </div>
      )}
      <div className="mbPage" style={pull || drag ? { transform: `translateY(${pull}px)`, transition: drag ? "none" : undefined } : undefined}>
      {!online && <div className="mbOffline">Fără semnal · lucrezi pe telefon, se trimite când revine rețeaua</div>}
      {view.v === "home" && <Home me={me} items={items} queueN={queueN} pos={pos} unread={unread} onBell={() => go({ v: "notifs" })} onMe={() => go({ v: "account" })} onSchedule={setSched} onNew={() => go({ v: "new" })} onOpen={(id) => open(id, { v: "detail", id })} onStart={(id) => open(id, { v: "form", id, sec: 0 })} />}
      {view.v === "detail" && cur && <Detail x={cur} draft={draft} onSchedule={setSched} onBack={() => history.back()} onStart={() => go({ v: "form", id: cur.id, sec: 0 })} />}
      {view.v === "form" && cur && draft && (
        <Form x={cur} d={draft} sec={view.sec} photos={pending.filter((p) => p.insp === cur.id).length + cur.files.filter((f) => f.kind === "photo").length}
          onBack={() => go({ v: "detail", id: cur.id })} onSec={(s) => setViewState({ v: "form", id: cur.id, sec: s })} change={change} onPhoto={addPhoto}
          onRooms={() => go({ v: "rooms", id: cur.id })} onPhotos={() => go({ v: "photos", id: cur.id })} onSign={() => go({ v: "sign", id: cur.id })} />
      )}
      {view.v === "rooms" && cur && draft && <Rooms d={draft} change={change} onBack={() => history.back()} onPhoto={addPhoto} />}
      {view.v === "photos" && cur && draft && <Photos x={cur} d={draft} pending={pending.filter((p) => p.insp === cur.id && p.kind === "photo")} onBack={() => history.back()} onPhotos={addPhotos} />}
      {view.v === "sign" && cur && draft && <Sign x={cur} d={draft} photos={pending.filter((p) => p.insp === cur.id).length + cur.files.filter((f) => f.kind === "photo").length} change={change} onBack={() => history.back()} onFinish={finish} />}
      {view.v === "queue" && <Queue pending={pending} finishN={finishQ} items={items} online={online} onSend={async () => { const n = await sendAll(); say(n ? "Mai sunt elemente de trimis." : "Totul a fost trimis."); }} />}
      {view.v === "notifs" && <Notifs notifs={notifs} reminders={reminders} seenAt={seen.at} onBack={() => { markSeen(); history.back(); }}
        onOpen={(id) => { markSeen(); void open(id, { v: "detail", id }); }} />}
      {view.v === "account" && <Account me={me} info={info} queueN={queueN} online={online} onSend={async () => { const n = await sendAll(); say(n ? "Mai sunt elemente de trimis." : "Totul a fost trimis."); }} say={say} />}
      {view.v === "new" && <NewInsp tpls={tpls} online={online} pos={pos} onBack={() => history.back()} onDone={async (id, now) => {
        await load();
        if (now) await open(id, { v: "form", id, sec: 0 }); else { go({ v: "home" }); say("Inspecția a fost adăugată."); }
      }} />}
      </div>
      {nav && (
        <nav className="mbNav" aria-label="Meniu">
          <button type="button" aria-current={view.v === "home" ? "page" : undefined} onClick={() => go({ v: "home" })}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 11l9-7 9 7v9H3z" /></svg>Acasă</button>
          <button type="button" aria-current={view.v === "queue" ? "page" : undefined} onClick={() => go({ v: "queue" })}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>De trimis{queueN > 0 && <i>{queueN}</i>}</button>
          <button type="button" aria-current={view.v === "account" ? "page" : undefined} onClick={() => go({ v: "account" })}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>Contul meu</button>
        </nav>
      )}
      {sched && <ScheduleSheet x={sched} online={online} onClose={() => setSched(null)} onSave={async (when, dur) => {
        const r = await fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "schedule", id: sched.id, scheduled_at: when, duration_min: dur }) }).catch(() => null);
        if (!r) return "Fără semnal. Încearcă din nou.";
        if (!r.ok) return String((await J(r)).error || "Nu a mers.");
        await load();
        if (curId.current === sched.id) { const x = await fetchInsp(sched.id); if (x) setCur(x); }
        say(`Programată ${fmtWhen(when)}.`);
        return null;
      }} />}
      {up && up.total > 0 && (
        <div className="mbUp" role="status" aria-live="polite">
          <span><b>{up.phase === "prep" ? "Se pregătesc fotografiile" : "Se trimit fotografiile"}</b><em>{Math.min(up.done + (up.phase === "prep" ? 1 : 0), up.total)} din {up.total}</em></span>
          <i><s style={{ width: `${Math.round((up.done / up.total) * 100)}%` }} /></i>
        </div>
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

type Sched = { id: string; address: string; scheduled_at: string | null; duration_min: number; day?: string };
type HView = "list" | "map" | "cal";
const isDone = (i: InspRow) => i.status === "gata" || i.status === "pred";
const canSchedule = (i: { status: string }) => i.status === "prog" || i.status === "plan";

function Home({ me, items, queueN, pos, unread, onBell, onMe, onNew, onOpen, onStart, onSchedule }: {
  me: Me | null; items: InspRow[]; queueN: number; unread: number; onBell: () => void; onMe: () => void; pos: React.RefObject<[number, number] | null>; onNew: () => void; onOpen: (id: string) => void;
  onStart: (id: string) => void; onSchedule: (x: Sched) => void;
}) {
  const [f, setF] = useState<"week" | "prog" | "done" | "all">("week");
  const [hv, setHv] = useState<HView>("list");
  useEffect(() => { try { const v = localStorage.getItem("insp-view"); if (v === "map" || v === "cal" || v === "list") setHv(v); } catch {} }, []);
  const pickView = (v: HView) => { setHv(v); try { localStorage.setItem("insp-view", v); } catch {} };
  const now = new Date(), today = ymd(now);
  const wkEnd = ymd(new Date(now.getTime() + 7 * 864e5));
  const active = items.filter((i) => !isDone(i));
  const next = active.filter((i) => i.scheduled_at && i.scheduled_at >= today).sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!))[0] ?? active.find((i) => i.status === "lucru");
  const inWeek = active.filter((i) => i.scheduled_at && i.scheduled_at.slice(0, 10) >= today && i.scheduled_at.slice(0, 10) <= wkEnd);
  const weekList = [...active.filter((i) => i.status === "lucru"), ...inWeek.filter((i) => i.status !== "lucru")];
  const unsched = active.filter((i) => !i.scheduled_at);
  const done = items.filter(isDone);
  const list = f === "week" ? weekList : f === "prog" ? unsched : f === "done" ? done : items;
  const first = (me?.name ?? "").split(/\s+/)[0];
  const mins = next?.scheduled_at ? Math.round((new Date(next.scheduled_at).getTime() - now.getTime()) / 60000) : null;
  const showList = (k: typeof f) => { setF(k); pickView("list"); };
  const FILTERS = [["week", "Săptămâna asta", weekList.length], ["prog", "Neprogramate", unsched.length], ["done", "Finalizate", done.length], ["all", "Toate", items.length]] as const;
  return (
    <>
      <header className="mbHead">
        <div className="mbHeadRow">
          <span><small>{WEEKDAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]}</small><b>Bună{first ? `, ${first}` : ""}!</b></span>
          <span className="mbHeadBtns">
            <button type="button" className="mbBell" onClick={onBell} aria-label={unread ? `Notificări, ${unread} noi` : "Notificări"}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
              {unread > 0 && <i>{unread > 9 ? "9+" : unread}</i>}
            </button>
            <button type="button" className="mbAv" onClick={onMe} aria-label="Contul meu"><Avatar me={me} /></button>
          </span>
        </div>
        <div className="mbHeroStats">
          <button type="button" onClick={() => showList("week")}><b>{active.filter((i) => i.scheduled_at?.startsWith(today)).length}</b><small>azi</small></button>
          <button type="button" onClick={() => showList("week")}><b>{inWeek.length}</b><small>săptămâna asta</small></button>
          <button type="button" onClick={() => showList("prog")} className={unsched.length ? "red" : ""}><b>{unsched.length}</b><small>neprogramate</small></button>
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
        ) : <div className="mbNext mbNextNone"><b>Nicio inspecție programată</b><small>Inspecțiile pregătite pentru tine pe web apar aici. Sau adaugă una chiar de aici.</small>
          <button type="button" className="mbBtn gold" onClick={onNew}>+ Inspecție nouă</button></div>}
      </header>
      <InstallHint />
      <div className="mbTools">
        {hv === "cal" ? <b className="mbToolsT">Calendar</b> : (
          <label className="mbSel">
            <span className="mbSelV" aria-hidden="true"><span>{FILTERS.find((x) => x[0] === f)![1]}</span><em>{FILTERS.find((x) => x[0] === f)![2]}</em></span>
            <select value={f} onChange={(e) => setF(e.target.value as typeof f)} aria-label="Arată">
              {FILTERS.map(([k, l, n]) => <option key={k} value={k}>{l} · {n}</option>)}
            </select>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </label>
        )}
        <span className="mbSeg" role="group" aria-label="Vedere">
          <button type="button" aria-pressed={hv === "list"} aria-label="Listă" onClick={() => pickView("list")}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg></button>
          <button type="button" aria-pressed={hv === "map"} aria-label="Hartă" onClick={() => pickView("map")}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg></button>
          <button type="button" aria-pressed={hv === "cal"} aria-label="Calendar" onClick={() => pickView("cal")}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg></button>
        </span>
        <button type="button" className="mbAdd" aria-label="Inspecție nouă" onClick={onNew}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
      </div>
      {hv === "list" && <ItemList list={list} today={today} onOpen={onOpen} />}
      {hv === "map" && <MapList list={list} today={today} pos={pos} onOpen={onOpen} />}
      {hv === "cal" && <Calendar items={items} today={today} onOpen={onOpen} onSchedule={onSchedule} />}
    </>
  );
}

function ItemRow({ i, today, onOpen, n }: { i: InspRow; today: string; onOpen: (id: string) => void; n?: number }) {
  const d = i.scheduled_at ? new Date(i.scheduled_at) : null, isToday = i.scheduled_at?.startsWith(today);
  return (
    <button type="button" className="mbItem" onClick={() => onOpen(i.id)}>
      {n != null ? <span className="mbPinN" style={{ background: STATUS[i.status].fg }}>{n}</span>
        : <span className={`mbDay${isToday ? " today" : ""}`}>{d ? <><small>{isToday ? "AZI" : `${DAYS[d.getDay()]} ${d.getDate()}`}</small><b>{i.scheduled_at!.slice(11, 16)}</b></> : <><small>FĂRĂ</small><small>DATĂ</small></>}</span>}
      <span className="mbItemTxt">
        <span><em>{(i.prop_type ?? "IMOBIL").toUpperCase()}</em><i style={{ color: STATUS[i.status].fg }}>● {STATUS[i.status].label}</i></span>
        <b>{i.address}</b>
        <small>{n != null ? fmtWhen(i.scheduled_at) : [i.contact_name, i.cad_nr && `nr. cad. ${i.cad_nr}`].filter(Boolean).join(" · ") || fmtWhen(i.scheduled_at)}</small>
      </span>
    </button>
  );
}

function ItemList({ list, today, onOpen }: { list: InspRow[]; today: string; onOpen: (id: string) => void }) {
  return (
    <div className="mbList">
      {list.map((i) => <ItemRow key={i.id} i={i} today={today} onOpen={onOpen} />)}
      {!list.length && <p className="mbEmpty">Nimic aici. Inspecțiile se pregătesc pe web sau cu „+”.</p>}
    </div>
  );
}

/* map: Leaflet from cdnjs, loaded once */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let leafletP: Promise<any> | null = null;
function loadLeaflet() {
  leafletP ??= new Promise((res, rej) => {
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(css);
    const sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    sc.onload = () => res((window as unknown as { L: unknown }).L); sc.onerror = () => { leafletP = null; rej(); }; document.head.appendChild(sc);
  });
  return leafletP;
}

function MapList({ list, today, pos, onOpen }: { list: InspRow[]; today: string; pos: React.RefObject<[number, number] | null>; onOpen: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const placed = useMemo(() => list.filter((r) => r.lat != null && r.lng != null), [list]);
  const [sel, setSel] = useState<string | null>(null);
  const [fail, setFail] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let m: any = null, gone = false;
    loadLeaflet().then((L) => {
      if (gone || !el.current) return;
      m = L.map(el.current, { zoomControl: false, attributionControl: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(m);
      const pts: [number, number][] = [];
      placed.forEach((r, i) => {
        const icon = L.divIcon({ className: "", html: `<span class="mbPin" style="background:${STATUS[r.status].fg}"><b>${i + 1}</b></span>`, iconSize: [30, 30], iconAnchor: [15, 30] });
        L.marker([r.lat, r.lng], { icon }).addTo(m).on("click", () => setSel(r.id));
        pts.push([r.lat!, r.lng!]);
      });
      const me = pos.current;
      if (me) L.circleMarker(me, { radius: 7, color: "#fff", weight: 3, fillColor: "#2F6BD8", fillOpacity: 1 }).addTo(m);
      if (pts.length) m.fitBounds(L.latLngBounds(me ? [...pts, me] : pts), { padding: [36, 36], maxZoom: 15 });
      else m.setView(me ?? [45.75, 21.23], me ? 13 : 9);
    }).catch(() => setFail(true));
    return () => { gone = true; m?.remove(); };
  }, [placed, pos]);
  const s = placed.find((r) => r.id === sel);
  return (
    <div className="mbMapWrap">
      <div className="mbMapBox">
        <div ref={el} className="mbMap" role="region" aria-label="Harta inspecțiilor" />
        {fail && <p className="mbMapFail">Harta nu se poate încărca fără semnal.</p>}
        {s && (
          <div className="mbMapCard">
            <button type="button" className="mbHintX" aria-label="Închide" onClick={() => setSel(null)}>×</button>
            <ItemRow i={s} today={today} onOpen={onOpen} />
          </div>
        )}
      </div>
      {(list.length > placed.length || !list.length) && (
        <p className="mbMapNote">{!list.length ? "Nicio inspecție în filtrul ales." : `${list.length - placed.length} fără poziție pe hartă (adresa nu a fost găsită). Le vezi în listă.`}</p>
      )}
    </div>
  );
}

/* calendar: a week strip, the chosen day's agenda, and what is still to be scheduled */
function Calendar({ items, today, onOpen, onSchedule }: { items: InspRow[]; today: string; onOpen: (id: string) => void; onSchedule: (x: Sched) => void }) {
  const [day, setDay] = useState(today);
  const [wk, setWk] = useState(0);
  const base = new Date(`${today}T12:00`);
  const monday = new Date(base.getTime() - ((base.getDay() + 6) % 7) * 864e5 + wk * 7 * 864e5);
  const days = Array.from({ length: 7 }, (_, k) => new Date(monday.getTime() + k * 864e5));
  const byDay = (d: string) => items.filter((i) => i.scheduled_at?.startsWith(d)).sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!));
  const agenda = byDay(day);
  const unsched = items.filter((i) => !i.scheduled_at && !isDone(i));
  const label = `${days[0].getDate()} ${MONTHS[days[0].getMonth()].slice(0, 3)} – ${days[6].getDate()} ${MONTHS[days[6].getMonth()].slice(0, 3)}`;
  const dd = new Date(`${day}T12:00`);
  return (
    <div className="mbCal">
      <div className="mbCalHead">
        <button type="button" aria-label="Săptămâna trecută" onClick={() => setWk(wk - 1)}>‹</button>
        <b>{label}</b>
        <button type="button" aria-label="Săptămâna viitoare" onClick={() => setWk(wk + 1)}>›</button>
        {wk !== 0 && <button type="button" className="mbLink" onClick={() => { setWk(0); setDay(today); }}>Azi</button>}
      </div>
      <div className="mbWeek">
        {days.map((d) => {
          const k = ymd(d), n = byDay(k).length;
          return (
            <button key={k} type="button" aria-pressed={k === day} className={k === today ? "today" : ""} onClick={() => setDay(k)}>
              <small>{DAYS[d.getDay()].slice(0, 2)}</small><b>{d.getDate()}</b><i>{Array.from({ length: Math.min(n, 3) }, (_, j) => <em key={j} />)}</i>
            </button>
          );
        })}
      </div>
      <div className="mbAgenda">
        <span className="mbRowBetween"><b>{WEEKDAYS[dd.getDay()]}, {dd.getDate()} {MONTHS[dd.getMonth()]}</b><small>{agenda.length ? `${agenda.length} ${agenda.length === 1 ? "inspecție" : "inspecții"}` : "liber"}</small></span>
        {agenda.map((i) => (
          <div key={i.id} className="mbSlot">
            <span className="mbSlotT"><b>{i.scheduled_at!.slice(11, 16)}</b><small>{i.duration_min}′</small></span>
            <button type="button" className="mbSlotB" style={{ borderLeftColor: STATUS[i.status].fg }} onClick={() => onOpen(i.id)}>
              <b>{i.address}</b><small>{[i.prop_type, STATUS[i.status].label].filter(Boolean).join(" · ")}</small>
            </button>
            {canSchedule(i) && <button type="button" className="mbSlotE" aria-label="Reprogramează" onClick={() => onSchedule({ id: i.id, address: i.address, scheduled_at: i.scheduled_at, duration_min: i.duration_min })}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg></button>}
          </div>
        ))}
      </div>
      <div className="mbSecHead"><b>De programat · {unsched.length}</b></div>
      <div className="mbList">
        {unsched.map((i) => (
          <div key={i.id} className="mbItem mbUnsched">
            <button type="button" className="mbItemTxt" onClick={() => onOpen(i.id)}>
              <span><em>{(i.prop_type ?? "IMOBIL").toUpperCase()}</em></span><b>{i.address}</b><small>{i.contact_name ?? ""}</small>
            </button>
            <button type="button" className="mbBtn gold" onClick={() => onSchedule({ id: i.id, address: i.address, scheduled_at: null, duration_min: i.duration_min, day })}>Programează</button>
          </div>
        ))}
        {!unsched.length && <p className="mbEmpty">Totul e programat.</p>}
      </div>
    </div>
  );
}

/* the scheduling sheet (from the calendar, the inspection's page) */
function ScheduleSheet({ x, online, onClose, onSave }: { x: Sched; online: boolean; onClose: () => void; onSave: (when: string, dur: number) => Promise<string | null> }) {
  const [date, setDate] = useState(x.scheduled_at?.slice(0, 10) ?? x.day ?? ymd(new Date()));
  const [time, setTime] = useState(x.scheduled_at?.slice(11, 16) ?? "10:00");
  const [dur, setDur] = useState(x.duration_min || 60);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const quick = [["Azi", 0], ["Mâine", 1], ["Poimâine", 2]] as const;
  return (
    <div className="mbSheetBg" onClick={onClose}>
      <div className="mbSheet" role="dialog" aria-modal="true" aria-label="Programează inspecția" onClick={(e) => e.stopPropagation()}>
        <span className="mbSheetGrip" />
        <b className="mbSheetT">{x.scheduled_at ? "Reprogramează" : "Programează"} inspecția</b>
        <small>{x.address}</small>
        <span className="mbOpts">{quick.map(([l, k]) => { const v = ymd(new Date(Date.now() + k * 864e5)); return <button key={l} type="button" aria-pressed={date === v} onClick={() => setDate(v)}>{l}</button>; })}</span>
        <span className="mbGrid2">
          <label className="mbField">Ziua<input className="mbIn" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="mbField">Ora<input className="mbIn" type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} /></label>
        </span>
        <small className="mbCap">DURATĂ</small>
        <span className="mbOpts">{[30, 60, 90, 120].map((d) => <button key={d} type="button" aria-pressed={dur === d} onClick={() => setDur(d)}>{({ 30: "30 min", 60: "1 h", 90: "1 h 30", 120: "2 h" } as Record<number, string>)[d]}</button>)}</span>
        {msg && <p className="mbErr" role="alert">{msg}</p>}
        {!online && <p className="mbNote">Programarea are nevoie de semnal.</p>}
        <button type="button" className="mbBtn gold big" disabled={busy || !online || !date || !time} onClick={async () => {
          setBusy(true); setMsg("");
          const e = await onSave(`${date}T${time}`, dur);
          setBusy(false);
          if (e) setMsg(e); else onClose();
        }}>Salvează programarea</button>
        <button type="button" className="mbLink mbCenterSmall" onClick={onClose}>Renunță</button>
      </div>
    </div>
  );
}

/* ---------- inspection detail ---------- */

/** A small map of the property (Leaflet + OSM), not interactive: a tap opens the navigation. */
function MiniMap({ lat, lng, href }: { lat: number; lng: number; href: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let m: any = null, gone = false;
    loadLeaflet().then((L) => {
      if (gone || !el.current) return;
      m = L.map(el.current, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false, tap: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(m);
      L.marker([lat, lng], { icon: L.divIcon({ className: "", html: '<span class="mbPin" style="background:#141414"><b>●</b></span>', iconSize: [30, 30], iconAnchor: [15, 30] }) }).addTo(m);
      m.setView([lat, lng], 16);
    }).catch(() => {});
    return () => { gone = true; m?.remove(); };
  }, [lat, lng]);
  return <a className="mbMini" href={href} target="_blank" rel="noopener" aria-label="Deschide navigația"><div ref={el} className="mbMiniMap" /></a>;
}

const DOC_KIND: Record<string, [string, string]> = { cf: ["CF", "Extras de carte funciară"], releveu: ["RLV", "Releveu"], doc: ["DOC", "Document"] };
const nfm = (n: number | null | undefined, d = 2) => (n == null ? "" : n.toLocaleString("ro-RO", { maximumFractionDigits: d }));

function Detail({ x, draft, onBack, onStart, onSchedule }: { x: Insp; draft: Draft | null; onBack: () => void; onStart: () => void; onSchedule: (s: Sched) => void }) {
  const done = x.status === "gata" || x.status === "pred";
  const dest = x.lat != null ? `${x.lat},${x.lng}` : encodeURIComponent(x.address);
  const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
  const docs = x.files.filter((f) => f.kind !== "photo" && f.kind !== "signature");
  const photos = x.files.filter((f) => f.kind === "photo");
  const rooms = x.room_answers.length ? x.room_answers : x.rooms;
  const roomsArea = rooms.reduce((t, r) => t + (r.a ?? 0), 0);
  const qn = x.template.groups.reduce((t, g) => t + g.qs.length, 0);
  // everything known about the property, only what is filled in
  const facts: [string, string][] = ([
    ["Tipul bunului", x.prop_type ?? ""],
    ["Nr. cadastral", x.cad_nr ?? ""],
    ["Carte funciară", x.cf_nr ?? ""],
    ["Localitate (UAT)", x.uat ?? ""],
    ["Județ", x.county ?? ""],
    ["Suprafață utilă (acte)", x.area_util ? `${nfm(x.area_util)} mp` : ""],
    ["Teren (acte)", x.area_land ? `${nfm(x.area_land, 0)} mp` : ""],
    ["Încăperi (releveu)", rooms.length ? `${rooms.length}${roomsArea ? ` · ${nfm(roomsArea)} mp` : ""}` : ""],
    ["Pregătită de", x.owner_name ?? ""],
    ["O face", x.assignee_name ?? ""],
  ] as [string, string][]).filter(([, v]) => v);
  return (
    <>
      <header className="mbBar"><Back onClick={onBack} /><span><b>{x.code}</b><small>{x.template_name ?? "Fișa de inspecție"}{x.template_version ? ` · v${x.template_version}` : ""}</small></span></header>
      <div className="mbBody">
        <section className="mbHero">
          {x.lat != null && x.lng != null ? <MiniMap lat={x.lat} lng={x.lng} href={gmaps} />
            : <div className="mbMini none"><span>Poziția nu a fost găsită pe hartă</span></div>}
          <div className="mbHeroBody">
            <span className="mbHeroTags">
              <i style={{ color: STATUS[x.status].fg, background: STATUS[x.status].bg }}>{STATUS[x.status].label}</i>
              {x.prop_type && <i>{x.prop_type}</i>}
            </span>
            <b>{x.address}</b>
            {(x.cad_nr || x.cf_nr) && <small>{[x.cad_nr && `nr. cad. ${x.cad_nr}`, x.cf_nr && `CF ${x.cf_nr}`].filter(Boolean).join(" · ")}</small>}
            <span className="mbGrid2">
              <a className="mbBtn" href={gmaps} target="_blank" rel="noopener">Google Maps</a>
              <a className="mbBtn" href={x.lat != null ? `https://waze.com/ul?ll=${x.lat},${x.lng}&navigate=yes` : `https://waze.com/ul?q=${dest}`} target="_blank" rel="noopener">Waze</a>
            </span>
          </div>
        </section>

        {done && <div className="mbOk">✓ Inspecția a fost trimisă. Fișa se vede în UVALO, pe web.</div>}
        {!done && x.redo_note && <div className="mbRedo"><b>De completat</b><span>{x.redo_note}</span><small>Ce ai completat deja a rămas. La final se semnează din nou.</small></div>}

        {canSchedule(x) && (
          <section className="mbCard mbSched">
            <span className="mbSchedIco" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg></span>
            <span><small className="mbCap">PROGRAMARE</small><b>{x.scheduled_at ? fmtWhen(x.scheduled_at) : "Neprogramată"}</b>{x.scheduled_at && <small>{x.duration_min} min</small>}</span>
            <button type="button" className="mbBtn" onClick={() => onSchedule({ id: x.id, address: x.address, scheduled_at: x.scheduled_at, duration_min: x.duration_min })}>{x.scheduled_at ? "Reprogramează" : "Programează"}</button>
          </section>
        )}

        {x.contact_name && (
          <section className="mbCard mbContact">
            <span className="mbAvImg" aria-hidden="true">{initials(x.contact_name)}</span>
            <span><small className="mbCap">{(x.contact_role ?? "Persoana de contact").toUpperCase()}</small><b>{x.contact_name}</b>{x.contact_phone && <small>{x.contact_phone}</small>}</span>
            {x.contact_phone && <span className="mbContactBtns">
              <a className="mbIconBtn dark" href={`tel:${x.contact_phone.replace(/\s+/g, "")}`} aria-label="Sună"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg></a>
              <a className="mbIconBtn" href={`sms:${x.contact_phone.replace(/\s+/g, "")}`} aria-label="SMS"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></a>
            </span>}
          </section>
        )}

        {facts.length > 0 && (
          <section className="mbCard">
            <small className="mbCap">PROPRIETATEA</small>
            <dl className="mbFacts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </section>
        )}

        {rooms.length > 0 && (
          <section className="mbCard">
            <small className="mbCap">ÎNCĂPERI DIN RELEVEU · {rooms.length}</small>
            <ol className="mbRoomList">{rooms.map((r, i) => <li key={i}><span>{i + 1}</span><b>{r.n}</b><em>{r.a ? `${nfm(r.a)} mp` : "—"}</em></li>)}</ol>
          </section>
        )}

        {docs.length > 0 && (
          <section className="mbCard">
            <small className="mbCap">ACTE · {docs.length}</small>
            <span className="mbDocList">{docs.map((d) => {
              const [ico, label] = DOC_KIND[d.kind] ?? DOC_KIND.doc;
              return (
                <a key={d.id} href={`/api/inspectii/file/${d.id}`} target="_blank" rel="noopener">
                  <span className="mbDocIco">{ico}</span><span><b>{d.name ?? label}</b><small>{label}</small></span><em aria-hidden="true">›</em>
                </a>
              );
            })}</span>
          </section>
        )}

        {photos.length > 0 && (
          <section className="mbCard">
            <small className="mbCap">FOTOGRAFII TRIMISE · {photos.length}</small>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className="mbThumbs">{photos.slice(0, 8).map((p) => <img key={p.id} src={`/api/inspectii/file/${p.id}`} alt={p.room ?? "Fotografie"} loading="lazy" />)}</span>
          </section>
        )}

        {x.notes && <section className="mbCard mbNoteCard"><small className="mbCap">NOTE PENTRU INSPECȚIE</small><span>{x.notes}</span></section>}

        <section className="mbCard mbTplCard"><small className="mbCap">FIȘA</small><span><b>{x.template_name ?? "Fișa de inspecție"}</b><small>{x.template.groups.length} secțiuni · {qn} întrebări</small></span></section>
      </div>
      {!done && (
        <footer className="mbFoot">
          <button type="button" className="mbBtn gold big" onClick={onStart}>{draft?.started_at ? "Continuă fișa →" : "Începe fișa →"}</button>
        </footer>
      )}
    </>
  );
}

/* ---------- the sheet ---------- */

/** A follow-up of a composite question (shown after the answer that asks it). */
function SubInput({ sq, v, set }: { sq: SubQ; v: string | string[] | undefined; set: (v: string | string[]) => void }) {
  return (
    <span className="mbSubQ">
      <span className="mbQT">{sq.t}</span>
      {(sq.kind === "one" || sq.kind === "many") && (
        <span className="mbOpts">{(sq.options ?? []).map((o) => {
          const on = sq.kind === "one" ? v === o : Array.isArray(v) && v.includes(o);
          return <button key={o} type="button" aria-pressed={on} onClick={() => set(sq.kind === "one" ? (on ? "" : o) : on ? (v as string[]).filter((y) => y !== o) : [...(Array.isArray(v) ? v : []), o])}>{o}</button>;
        })}</span>
      )}
      {sq.kind === "text" && <input className="mbIn" value={(v as string) ?? ""} onChange={(e) => set(e.target.value)} />}
      {sq.kind === "number" && <span className="mbNum"><input className="mbIn" inputMode="decimal" value={(v as string) ?? ""} onChange={(e) => set(e.target.value.replace(/[^\d.,-]/g, ""))} />{sq.unit && <em>{sq.unit}</em>}</span>}
    </span>
  );
}

function QInput({ q, v, set, onPhoto, answers, setKey }: { q: Question; v: string | string[] | undefined; set: (v: string | string[]) => void; onPhoto: (f: File, room: string) => void;
  answers?: Record<string, string | string[]>; setKey?: (k: string, v: string | string[]) => void }) {
  const cam = useRef<HTMLInputElement>(null);
  return (
    <div className="mbQ">
      <span className="mbQT">{q.t}{q.req && <i aria-label="obligatorie"> *</i>}</span>
      {(q.kind === "one" || q.kind === "many" || q.kind === "comp") && (
        <span className="mbOpts">
          {(q.options ?? []).map((o) => {
            const single = q.kind !== "many", on = single ? v === o : Array.isArray(v) && v.includes(o);
            return <button key={o} type="button" aria-pressed={on} onClick={() => set(single ? (on ? "" : o) : on ? (v as string[]).filter((y) => y !== o) : [...(Array.isArray(v) ? v : []), o])}>{o}</button>;
          })}
        </span>
      )}
      {q.kind === "comp" && typeof v === "string" && (q.sub?.[v] ?? []).length > 0 && (
        <span className="mbSub">{q.sub![v].map((sq) => <SubInput key={sq.id} sq={sq} v={answers?.[subKey(q, sq)]} set={(x) => setKey?.(subKey(q, sq), x)} />)}</span>
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
  // the template's own "Constatări" group (UVALO sheets) replaces the free-text findings step
  const ownFind = groups.some((gr) => gr.id === "constatari");
  const last = ownFind ? groups.length - 1 : groups.length;
  const all = groups.flatMap((g) => g.qs).filter((q) => !isOptional(q));
  const done = all.filter((q) => answered(d.answers[q.id])).length;
  const isFind = !ownFind && sec >= groups.length;
  const g = groups[sec];
  const roomsDone = d.rooms.filter((r) => r.floor && r.state).length;
  // the current section's chip is scrolled into view (the chips row is wider than the screen)
  const secsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = secsRef.current, b = nav?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!nav || !b) return;
    nav.scrollTo({ left: b.offsetLeft - (nav.clientWidth - b.offsetWidth) / 2, behavior: "smooth" });
  }, [sec]);
  return (
    <>
      <header className="mbBar tall">
        <span className="mbBarRow"><Back onClick={onBack} /><span><b>Fișa · {x.prop_type ?? "imobil"}</b><small>Salvat pe telefon · {done} din {all.length} completate</small></span></span>
        <span className="mbProg"><i style={{ width: `${all.length ? Math.round((done / all.length) * 100) : 0}%` }} /></span>
        <nav ref={secsRef} className="mbSecs" aria-label="Secțiuni">
          {groups.map((gr, i) => {
            const qs = gr.qs.filter((q) => !isOptional(q)), n = qs.filter((q) => answered(d.answers[q.id])).length, ok = n === qs.length && qs.length > 0;
            return <button key={gr.id} type="button" aria-current={i === sec ? "step" : undefined} className={ok ? "ok" : ""} onClick={() => onSec(i)}>{ok ? "✓ " : ""}{gr.name}{i === sec ? ` ${n}/${qs.length}` : ""}</button>;
          })}
          {!ownFind && <button type="button" aria-current={isFind ? "step" : undefined} onClick={() => onSec(groups.length)}>Constatări</button>}
        </nav>
      </header>
      <div className="mbBody">
        {x.redo_note && <div className="mbRedo small"><b>De completat</b><span>{x.redo_note}</span></div>}
        {!isFind && g && <>
          <h2 className="mbH2">{g.name}</h2>
          {g.qs.map((q) => <QInput key={q.id} q={q} v={d.answers[q.id]} onPhoto={onPhoto} answers={d.answers}
            set={(v) => change((o) => { o.answers[q.id] = v; return o; })} setKey={(k, v) => change((o) => { o.answers[k] = v; return o; })} />)}
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
        {sec < last ? <button type="button" className="mbBtn gold big" onClick={() => { onSec(sec + 1); window.scrollTo(0, 0); }}>Secțiunea următoare: {sec + 1 < groups.length ? groups[sec + 1].name : "Constatări"} →</button>
          : <button type="button" className="mbBtn gold big" onClick={onSign}>Încheie inspecția →</button>}
      </footer>
    </>
  );
}

/* ---------- rooms (from the floor plan) ---------- */

function Rooms({ d, change, onBack, onPhoto }: { d: Draft; change: (f: (d: Draft) => Draft) => void; onBack: () => void; onPhoto: (f: File, room: string) => void }) {
  const cam = useRef<HTMLInputElement>(null);
  const [for_, setFor] = useState("");
  const pick = (i: number, k: "floor" | "walls" | "ceiling" | "state", v: string) => change((o) => { o.rooms[i][k] = o.rooms[i][k] === v ? undefined : v; return o; });
  return (
    <>
      <header className="mbBar"><Back onClick={onBack} /><span><b>Încăperi · {d.rooms.length}</b><small>Din releveu; adaugi ce lipsește</small></span></header>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f, for_); e.target.value = ""; }} />
      <div className="mbBody">
        {d.rooms.map((r, i) => (
          <section key={i} className="mbCard">
            <span className="mbRowBetween"><b>{i + 1}. {r.n}</b><span className="mbNum small"><input className="mbIn" inputMode="decimal" aria-label="Suprafața" value={r.a ?? ""} onChange={(e) => change((o) => { const v = parseFloat(e.target.value.replace(",", ".")); o.rooms[i].a = Number.isFinite(v) ? v : null; return o; })} /><em>mp</em></span></span>
            {(["floor", "walls", "ceiling", "state"] as const).map((k) => (
              <Fragment key={k}>
                <small className="mbCap">{ROOM_FIELDS[k].label.toUpperCase()}</small>
                <span className="mbOpts">{ROOM_FIELDS[k].opts.map((o) => <button key={o} type="button" aria-pressed={r[k] === o} onClick={() => pick(i, k, o)}>{o}</button>)}</span>
              </Fragment>
            ))}
            <button type="button" className="mbLink" onClick={() => { setFor(r.n); cam.current?.click(); }}>+ Fotografie {r.n}</button>
          </section>
        ))}
        <button type="button" className="mbBtn" onClick={() => { const n = prompt("Numele încăperii"); if (n?.trim()) change((o) => { o.rooms.push({ n: n.trim(), a: null }); return o; }); }}>+ Încăpere</button>
      </div>
    </>
  );
}

/* ---------- photos ---------- */

function Photos({ x, d, pending, onBack, onPhotos }: { x: Insp; d: Draft; pending: QPhoto[]; onBack: () => void; onPhotos: (f: File[], room: string, gallery: boolean) => Promise<void> }) {
  const cats = useMemo(() => { const c = photoCategories(x.prop_type); return [...c.before, ...d.rooms.map((r, i) => `${r.n} · rlv ${i + 1}`), ...c.after]; }, [d.rooms, x.prop_type]);
  const [room, setRoom] = useState(cats[0]);
  const [busy, setBusy] = useState(false);
  const cam = useRef<HTMLInputElement>(null), gal = useRef<HTMLInputElement>(null);
  const target = useRef(room); // the category the open picker adds to
  useEffect(() => { target.current = room; }, [room]);
  const sent = x.files.filter((f) => f.kind === "photo");
  const urls = useMemo(() => new Map(pending.map((p) => [p.id, URL.createObjectURL(p.blob)])), [pending]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  const groups = cats.map((c) => ({ c, sent: sent.filter((f) => f.room === c), local: pending.filter((p) => p.room === c) })).filter((g) => g.sent.length || g.local.length || g.c === room);
  const pick = (input: HTMLInputElement | null, c: string) => { target.current = c; setRoom(c); input?.click(); };
  const take = async (e: React.ChangeEvent<HTMLInputElement>, gallery: boolean) => {
    const input = e.target, room = target.current;
    const picked = Array.from(input.files ?? []);
    if (!picked.length) return;
    setBusy(true);
    try {
      // the files are read at once and kept as our own copies: on iPhone, the chosen files can become unreadable once the input changes
      const files: File[] = [];
      for (const f of picked) {
        try { files.push(new File([await f.arrayBuffer()], f.name || "foto.jpg", { type: f.type || "image/jpeg", lastModified: f.lastModified })); } catch {}
      }
      input.value = "";
      if (files.length < picked.length) alert(`${picked.length - files.length} din fotografiile alese nu au putut fi citite.`);
      await onPhotos(files, room, gallery);
    } finally { input.value = ""; setBusy(false); }
  };
  return (
    <>
      <header className="mbBar"><Back onClick={onBack} /><span><b>Fotografii · {sent.length + pending.length}</b><small>Cu dată și locație · {sent.length} trimise, {pending.length} pe telefon</small></span></header>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => take(e, false)} />
      <input ref={gal} type="file" accept="image/*" multiple hidden onChange={(e) => take(e, true)} />
      <div className="mbBody">
        {groups.map((g) => (
          <section key={g.c} className={`mbPhGroup${g.c === room ? " on" : ""}`}>
            <button type="button" className="mbPhHead" onClick={() => setRoom(g.c)} aria-pressed={g.c === room}>
              <b>{g.c}</b><small>{g.c === room ? "aici merg pozele noi · " : ""}{g.sent.length + g.local.length} foto</small>
            </button>
            <span className="mbPhGrid">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {g.sent.map((f) => <img key={f.id} src={`/api/inspectii/file/${f.id}`} alt={g.c} loading="lazy" />)}
              {g.local.map((p) => <span key={p.id} className="mbPhLocal">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={urls.get(p.id)} alt={g.c} /><em>PE TELEFON</em></span>)}
              <span className="mbPhAdd">
                <button type="button" aria-label={`Fotografiază pentru ${g.c}`} onClick={() => pick(cam.current, g.c)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                </button>
                <button type="button" aria-label={`Alege din galerie pentru ${g.c}`} onClick={() => pick(gal.current, g.c)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></svg>
                </button>
              </span>
            </span>
          </section>
        ))}
      </div>
      <footer className="mbFoot">
        <label className="mbField">Pozele noi merg la<select className="mbIn" value={room} onChange={(e) => setRoom(e.target.value)}>{cats.map((c) => <option key={c}>{c}</option>)}</select></label>
        <span className="mbGrid2">
          <button type="button" className="mbBtn gold big" disabled={busy} onClick={() => pick(cam.current, room)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>Fotografiază
          </button>
          <button type="button" className="mbBtn dark big" disabled={busy} onClick={() => pick(gal.current, room)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></svg>Din galerie
          </button>
        </span>
        {busy && <small className="mbCenterSmall">Se pregătesc fotografiile…</small>}
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
  const all = x.template.groups.flatMap((g) => g.qs).filter((q) => !isOptional(q));
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

const fmtD = (iso: string | null | undefined, time = false) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ""}${time ? `, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : ""}`;
};
const mb = (n: number) => (n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} MB`);

/* ---------- new inspection, from the phone ---------- */

function NewInsp({ tpls, online, pos, onBack, onDone }: { tpls: Tpl[]; online: boolean; pos: React.RefObject<[number, number] | null>; onBack: () => void; onDone: (id: string, now: boolean) => Promise<void> }) {
  const [f, setF] = useState({ address: "", prop_type: "", template_id: "", cad_nr: "", cf_nr: "", contact_name: "", contact_phone: "", contact_role: "", notes: "" });
  const [ll, setLl] = useState<[number, number] | null>(null);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [at, setAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: keyof typeof f, v: string) => setF((o) => ({ ...o, [k]: v }));
  const pickType = (t: string) => {
    setF((o) => ({ ...o, prop_type: o.prop_type === t ? "" : t,
      template_id: tpls.find((x) => x.prop_type === t)?.id ?? (o.template_id || tpls[0]?.id || "") }));
  };
  useEffect(() => { if (!f.template_id && tpls[0]) set("template_id", tpls[0].id); }, [tpls]); // eslint-disable-line react-hooks/exhaustive-deps
  async function here() {
    setMsg("");
    const p = pos.current ?? await new Promise<[number, number] | null>((res) => navigator.geolocation?.getCurrentPosition((g) => res([g.coords.latitude, g.coords.longitude]), () => res(null), { enableHighAccuracy: true, timeout: 10000 }));
    if (!p) { setMsg("Nu am primit locația. Verifică permisiunea pentru locație."); return; }
    setLl(p);
    const r = await fetch(`/api/m/where?lat=${p[0]}&lng=${p[1]}`).catch(() => null);
    const a = r?.ok ? ((await r.json()) as { address: string | null }).address : null;
    set("address", a ?? (f.address || `${p[0].toFixed(6)}, ${p[1].toFixed(6)}`));
  }
  async function save() {
    setBusy(true); setMsg("");
    const d = new Date(), pad = (n: number) => String(n).padStart(2, "0");
    const scheduled_at = when === "now" ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` : at;
    try {
      const r = await fetch("/api/m/new", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, scheduled_at, lat: ll?.[0] ?? null, lng: ll?.[1] ?? null }) });
      const j = await J(r);
      if (!r.ok) throw new Error(String(j.error || "Nu a mers."));
      await onDone(String(j.id), when === "now");
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <>
      <header className="mbBar"><Back onClick={onBack} /><span><b>Inspecție nouă</b><small>O faci tu; restul se completează și pe web</small></span></header>
      <div className="mbBody">
        {!online && <p className="mbNote">Fără semnal nu se poate crea o inspecție nouă. Încearcă din nou când ai rețea.</p>}
        <button type="button" className="mbStart" onClick={here}><b>📍 Sunt la proprietate</b><small>{ll ? `locație preluată · ${ll[0].toFixed(5)}, ${ll[1].toFixed(5)}` : "preia adresa după locația telefonului"}</small></button>
        <label className="mbField">Adresa bunului<textarea className="mbIn" rows={2} value={f.address} onChange={(e) => { set("address", e.target.value); setLl(null); }} placeholder="Str., nr., localitate, județ" /></label>
        <small className="mbCap">TIPUL BUNULUI</small>
        <span className="mbOpts">{PROP_TYPES.map((t) => <button key={t} type="button" aria-pressed={f.prop_type === t} onClick={() => pickType(t)}>{t}</button>)}</span>
        <label className="mbField">Fișa de inspecție<select className="mbIn" value={f.template_id} onChange={(e) => set("template_id", e.target.value)}>
          {tpls.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select></label>
        <span className="mbGrid2">
          <label className="mbField">Nr. cadastral<input className="mbIn" inputMode="numeric" value={f.cad_nr} onChange={(e) => set("cad_nr", e.target.value)} /></label>
          <label className="mbField">Carte funciară<input className="mbIn" value={f.cf_nr} onChange={(e) => set("cf_nr", e.target.value)} /></label>
        </span>
        <small className="mbCap">PERSOANA DE CONTACT</small>
        <input className="mbIn" placeholder="Nume" value={f.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
        <input className="mbIn" placeholder="Telefon" inputMode="tel" value={f.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
        <span className="mbOpts">{CONTACT_ROLES.map((t) => <button key={t} type="button" aria-pressed={f.contact_role === t} onClick={() => set("contact_role", f.contact_role === t ? "" : t)}>{t}</button>)}</span>
        <small className="mbCap">CÂND</small>
        <span className="mbOpts">
          <button type="button" aria-pressed={when === "now"} onClick={() => setWhen("now")}>Acum, sunt acolo</button>
          <button type="button" aria-pressed={when === "later"} onClick={() => setWhen("later")}>O programez</button>
        </span>
        {when === "later" && <input className="mbIn" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />}
        <label className="mbField">Note<textarea className="mbIn" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></label>
        {msg && <p className="mbErr" role="alert">{msg}</p>}
      </div>
      <footer className="mbFoot">
        <button type="button" className="mbBtn gold big" disabled={busy || !online || f.address.trim().length < 5 || !f.template_id || (when === "later" && !at)} onClick={save}>
          {when === "now" ? "Creează și începe fișa" : "Adaugă inspecția"}
        </button>
        <small className="mbCenterSmall">{f.address.trim().length < 5 ? "Scrie adresa sau apasă „Sunt la proprietate”." : "Actele (CF, releveu) le poți adăuga apoi pe web."}</small>
      </footer>
    </>
  );
}

/* ---------- account: profile, activity, this phone, sending, security ---------- */

type Perm = "granted" | "denied" | "prompt" | "unknown";

function Account({ me, info, queueN, online, onSend, say }: { me: Me | null; info: Info | null; queueN: number; online: boolean; onSend: () => Promise<void>; say: (m: string) => void }) {
  const [perm, setPerm] = useState<{ cam: Perm; loc: Perm }>({ cam: "unknown", loc: "unknown" });
  const [used, setUsed] = useState<number | null>(null);
  const [synced, setSynced] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const standalone = typeof window !== "undefined" && (matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
  const check = useCallback(async () => {
    const q = async (n: string): Promise<Perm> => { try { return (await navigator.permissions.query({ name: n as PermissionName })).state as Perm; } catch { return "unknown"; } };
    setPerm({ cam: await q("camera"), loc: await q("geolocation") });
    try { const e = await navigator.storage?.estimate(); setUsed(e?.usage ?? null); } catch {}
    try { setSynced(localStorage.getItem("insp-sync")); } catch {}
  }, []);
  useEffect(() => { void check(); }, [check, queueN]);
  async function askLoc() {
    navigator.geolocation?.getCurrentPosition(() => void check(), () => { say("Locația e blocată. Pornește-o din setările telefonului, pentru browser / aplicație."); void check(); });
  }
  async function askCam() {
    try { const st = await navigator.mediaDevices.getUserMedia({ video: true }); st.getTracks().forEach((t) => t.stop()); } catch { say("Camera e blocată. Pornește-o din setările telefonului."); }
    void check();
  }
  async function clean() {
    try {
      Object.keys(localStorage).filter((k) => /^insp-[0-9a-f-]{36}$/.test(k)).forEach((k) => localStorage.removeItem(k));
      for (const k of await caches.keys()) await caches.delete(k);
    } catch {}
    await check();
    say("Memoria aplicației a fost golită. Ciornele și ce așteaptă să fie trimis au rămas.");
  }
  async function disconnect() {
    if (queueN && !confirm(`Ai ${queueN} ${queueN === 1 ? "element netrimis" : "elemente netrimise"} pe telefon. Dacă deconectezi telefonul acum, se pierd. Continui?`)) return;
    if (!confirm("Deconectezi telefonul? Iese din lista de pe web și trebuie să te conectezi din nou.")) return;
    setBusy(true);
    await fetch("/api/m/device", { method: "DELETE" }).catch(() => null);
    try { localStorage.clear(); indexedDB.deleteDatabase("uvalo-insp"); } catch {}
    location.reload();
  }
  const permRow = (label: string, p: Perm, ask: () => void) => (
    <span className="mbKv"><span>{label}</span>{p === "granted" ? <b className="ok">✓ permisă</b> : <button type="button" className="mbLink" onClick={ask}>{p === "denied" ? "blocată · cum o pornesc" : "Permite"}</button>}</span>
  );
  const s = info?.stats;
  return (
    <>
      <header className="mbHead small"><b>Contul meu</b><small>UVALO Inspecții</small></header>
      <div className="mbBody">
        <section className="mbCard">
          <span className="mbMe"><Avatar me={me} big /><span><b>{me?.name}</b><small>{me?.email}</small></span></span>
          {me?.anevar_no && <span className="mbKv"><span>Legitimație ANEVAR</span><b>{me.anevar_no}</b></span>}
          {me?.county && <span className="mbKv"><span>Județ</span><b>{me.county}</b></span>}
          {me?.org && <span className="mbKv mbOrg"><span>Birou</span><b>{me.org.logo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/api/org/logo/${me.org.id}`} alt="" />}{me.org.name}</b></span>}
        </section>

        <small className="mbCap">ACTIVITATE</small>
        <div className="mbStats flat">
          <span><b>{s?.month ?? 0}</b><small>luna asta</small></span>
          <span><b>{s?.total ?? 0}</b><small>în total</small></span>
          <span><b>{s?.avg_min != null ? `${s.avg_min}′` : "—"}</b><small>timp mediu</small></span>
          <span><b>{s?.photos ?? 0}</b><small>fotografii</small></span>
        </div>
        {s?.last && <small>Ultima inspecție trimisă: {fmtD(s.last, true)}</small>}

        <small className="mbCap">TELEFONUL ACESTA</small>
        <section className="mbCard">
          <span className="mbKv"><span>Aplicația</span>{standalone ? <b className="ok">✓ instalată</b> : <b className="warn">deschisă în browser</b>}</span>
          <span className="mbKv"><span>Conectat</span><b>{info?.device ? `${info.device.name} · din ${fmtD(info.device.created_at)}` : "—"}</b></span>
          {permRow("Camera", perm.cam, askCam)}
          {permRow("Locația", perm.loc, askLoc)}
          <span className="mbKv"><span>Spațiu folosit</span><b>{used != null ? mb(used) : "—"}</b></span>
          <button type="button" className="mbLink" onClick={clean}>Golește memoria aplicației</button>
        </section>
        {!standalone && <InstallHint compact />}
        <PushCard />

        <small className="mbCap">SINCRONIZARE</small>
        <section className="mbCard">
          <span className="mbKv"><span>Ultima trimitere</span><b>{synced ? fmtD(synced, true) : "—"}</b></span>
          <span className="mbKv"><span>De trimis</span><b className={queueN ? "warn" : "ok"}>{queueN ? `${queueN} ${queueN === 1 ? "element" : "elemente"}` : "✓ nimic"}</b></span>
          <span className="mbKv"><span>Rețea</span><b className={online ? "ok" : "warn"}>{online ? "online" : "fără semnal"}</b></span>
          {queueN > 0 && <button type="button" className="mbBtn gold" disabled={!online} onClick={onSend}>Trimite acum</button>}
        </section>

        <small className="mbCap">SECURITATE</small>
        <a className="mbBtn" href="https://app.uvalo.ro/inspectii" target="_blank" rel="noopener">Deschide UVALO pe web</a>
        <button type="button" className="mbBtn" disabled={busy} onClick={async () => { if (!confirm("Ieși din cont pe acest telefon? Telefonul rămâne conectat la cont.")) return; await fetch("/api/auth/logout", { method: "POST" }); location.reload(); }}>Ieși din cont</button>
        <button type="button" className="mbBtn danger" disabled={busy} onClick={disconnect}>Deconectează telefonul</button>
        <small className="mbCenterSmall">UVALO Inspecții · versiune de test · <a href="https://app.uvalo.ro/termeni" target="_blank" rel="noopener">Termeni</a> · <a href="https://app.uvalo.ro/confidentialitate" target="_blank" rel="noopener">Confidențialitate</a></small>
      </div>
    </>
  );
}

/* ---------- notifications (the bell next to the avatar) ---------- */

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "acum";
  if (m < 60) return `acum ${m} min`;
  if (m < 24 * 60) return `acum ${Math.round(m / 60)} h`;
  if (m < 48 * 60) return "ieri";
  return fmtD(iso);
}

function Notifs({ notifs, reminders, seenAt, onBack, onOpen }: { notifs: Notif[]; reminders: Reminder[]; seenAt: string; onBack: () => void; onOpen: (id: string) => void }) {
  return (
    <>
      <header className="mbBar"><Back onClick={onBack} /><span><b>Notificări</b><small>Programările apropiate și ce s-a schimbat la inspecțiile tale</small></span></header>
      <div className="mbBody">
        <PushCard />
        {reminders.length > 0 && <>
          <small className="mbCap">DE FĂCUT</small>
          {reminders.map((r) => (
            <button key={r.key} type="button" className="mbNotif rem" onClick={() => onOpen(r.insp)}>
              <span className="mbNotifIco">⏰</span>
              <span><b>{r.today ? "Azi" : "Mâine"} la {r.when.slice(11, 16)}</b><small>{r.address}</small></span>
            </button>
          ))}
        </>}
        <small className="mbCap">ACTIVITATE</small>
        {notifs.map((n) => (
          <button key={n.id} type="button" className={`mbNotif${n.at > seenAt ? " new" : ""}`} onClick={() => onOpen(n.insp)}>
            <span className="mbNotifIco">{/fotografie|document|fișier/i.test(n.text) ? "📎" : /programat/i.test(n.text) ? "📅" : /creat/i.test(n.text) ? "＋" : /finaliz|predat/i.test(n.text) ? "✓" : "•"}</span>
            <span><b>{n.text.replace(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/, "$3.$2.$1, $4")}</b><small>{n.address}</small><em>{[n.who, ago(n.at)].filter(Boolean).join(" · ")}</em></span>
          </button>
        ))}
        {!notifs.length && <p className="mbEmpty">Nicio noutate. Aici apar inspecțiile primite, reprogramările și actele adăugate de colegi pe web.</p>}
      </div>
    </>
  );
}

/* ---------- push notifications on this phone ---------- */

type PushState = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

/** Turns the phone's notifications on / off (Web Push; on iPhone only in the installed app, iOS 16.4+). */
function PushCard() {
  const [st, setSt] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const check = useCallback(async () => {
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setSt(ios && !standalone ? "ios-install" : "unsupported"); return; }
    if (Notification.permission === "denied") { setSt("denied"); return; }
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    setSt(sub && Notification.permission === "granted" ? "on" : "off");
  }, []);
  useEffect(() => { void check(); }, [check]);
  async function turnOn() {
    setBusy(true); setMsg("");
    try {
      if ((await Notification.requestPermission()) !== "granted") { await check(); return; }
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
      await navigator.serviceWorker.ready;
      const { key } = (await (await fetch("/api/m/push")).json()) as { key: string };
      const raw = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((key.length + 3) % 4)), (c) => c.charCodeAt(0));
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw }));
      const r = await fetch("/api/m/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sub: sub.toJSON() }) });
      if (!r.ok) throw new Error(String((await J(r)).error || "Nu a mers."));
      setMsg("Notificările sunt pornite.");
    } catch (e) { setMsg((e as Error).message || "Nu am putut porni notificările."); } finally { setBusy(false); await check(); }
  }
  async function turnOff() {
    setBusy(true); setMsg("");
    const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
    if (sub) { await fetch("/api/m/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
    setBusy(false); await check();
  }
  async function test() {
    setBusy(true); setMsg("");
    const r = await fetch("/api/m/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test" }) }).catch(() => null);
    setMsg(r?.ok ? "Ți-am trimis o notificare de test." : String((r && (await J(r)).error) || "Nu a mers."));
    setBusy(false);
  }
  if (st === "loading" || st === "unsupported") return null;
  return (
    <section className={`mbCard mbPush${st === "on" ? " on" : ""}`}>
      <span className="mbPushHead">
        <span className="mbPushIco" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg></span>
        <span>
          <b>{st === "on" ? "Notificările sunt pornite" : "Notificări pe telefon"}</b>
          <small>{st === "ios-install" ? "Pe iPhone, notificările merg doar din aplicația instalată: Partajează → „Adaugă pe ecranul principal”, apoi deschide-o de acolo."
            : st === "denied" ? "Sunt blocate. Pornește-le din Setări → Notificări → Inspecții (sau din setările browserului)."
            : st === "on" ? "Inspecții noi, reprogramări, acte adăugate, cu o oră înainte de fiecare inspecție și dimineața, programul zilei."
            : "Află pe loc de inspecțiile noi, de reprogramări și primește un memento cu o oră înainte."}</small>
        </span>
      </span>
      {st === "off" && <button type="button" className="mbBtn gold" disabled={busy} onClick={turnOn}>Pornește notificările</button>}
      {st === "on" && <span className="mbGrid2"><button type="button" className="mbBtn" disabled={busy} onClick={test}>Trimite un test</button><button type="button" className="mbBtn" disabled={busy} onClick={turnOff}>Oprește</button></span>}
      {msg && <small className="mbPushMsg" role="status">{msg}</small>}
    </section>
  );
}
