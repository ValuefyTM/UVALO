"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONTACT_ROLES, fmtWhen, isOptional, photoCategories, PROP_TYPES, typesOf, ROOM_FIELDS, roomDone, STANDARD_ROOMS, STATUS, type InspRow, type Question, type SubQ, subKey, type Template } from "@/lib/insp-shared";
import { allFiles, allFinish, delFile, flush, progress, putFile, putFinish, readExif, shrink, type QPhoto, type UploadProgress } from "./store";
import { InstallHint } from "./InstallHint";
import { MobileCollab } from "./MobileCollab";
import { DocViewer } from "./DocViewer";
import { gpsFix, LocPick, type Loc } from "./LocPick";
import { SigCard } from "./SigCard";
import { Radar, RadarBanner } from "./Radar";

/** The first phone number of a field that may hold two ("0721 123 456 / 0256 …"), digits and + only, for tel: / sms: links. */
const firstPhone = (s: string) => (s.split(/[\/,;]|\bsau\b/)[0] ?? s).replace(/[^\d+]/g, "");

type Insp = InspRow & {
  cf_nr: string | null; area_util: number | null; area_land: number | null; rooms: { n: string; a: number | null }[]; template: Template; template_name: string | null;
  contact_phone: string | null; contact_role: string | null; answers: Record<string, string | string[]>; room_answers: Room[];
  findings: { diff?: string; defects?: string; notes?: string }; started_at: string | null; notes: string | null;
  files: { id: string; kind: string; name: string | null; room: string | null; taken_at: string | null }[];
  uat?: string | null; county?: string | null; template_version?: number | null; created_at?: string; redo_note?: string | null;
  /** the property's details from the firm's app (marca, model, nr. camere…) */
  facts?: { label: string; value: string }[];
  /** from the firm's software: the client of the work and the user of the report (e.g. the bank) */
  ext_client?: string | null; ext_user?: string | null;
  /** on the colleagues' radar: yes / no / collab (only collaborators) */
  radar?: "yes" | "no" | "collab"; template_id?: string | null;
};
type Room = { n: string; a: number | null; floor?: string; walls?: string; ceiling?: string; state?: string; std?: boolean };
type Me = { id: string; name: string; email: string; avatar?: boolean; anevar_no?: string | null; county?: string | null; phone?: string | null; has_sig?: boolean; super?: boolean;
  org?: { id: string; name: string; logo: boolean; role: string | null } | null };
type Info = { stats: { total: number; month: number; last: string | null; avg_min: number | null; photos: number }; device: { name: string; platform: string; created_at: string; last_seen_at: string } | null };
type Tpl = { id: string; name: string; prop_type: string | null };
type Notif = { id: number; insp: string; at: string; text: string; address: string; who: string | null };
type Reminder = { key: string; insp: string; when: string; address: string; today: boolean };
type Draft = { answers: Record<string, string | string[]>; rooms: Room[]; findings: { diff: string; defects: string; notes: string }; started_at: string;
  sig?: string | null; signer?: { who: "contact" | "other"; other: string }; // the signature stays on the phone until the inspection is sent
  loc?: Loc | null; // where the inspection is made: the GPS fix taken when the sheet was opened, or the pin moved on the map before signing
  rev?: number }; // the sheet it belongs to (inspections.sheet_rev): a sheet deleted on the web makes the phone's draft obsolete
type View = { v: "home" } | { v: "detail"; id: string } | { v: "form"; id: string; sec: number } | { v: "rooms"; id: string } | { v: "photos"; id: string } | { v: "sign"; id: string } | { v: "queue" } | { v: "collab" } | { v: "account" } | { v: "new" } | { v: "notifs" } | { v: "radar"; id: string } | { v: "loc" } | { v: "edit"; id: string };

const DAYS = ["DUM", "LUN", "MAR", "MIE", "JOI", "VIN", "SÂM"];
const MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
const WEEKDAYS = ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"];

const J = async (r: Response) => (await r.json().catch(() => ({}))) as Record<string, unknown>;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const loadDraft = (id: string): Draft | null => { try { return JSON.parse(localStorage.getItem(`insp-draft-${id}`) || "null"); } catch { return null; } };
const saveDraft = (id: string, d: Draft) => { try { localStorage.setItem(`insp-draft-${id}`, JSON.stringify(d)); } catch {} };
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Bucharest" });
const fmtHour = (iso: string) => new Date(iso).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" });
/** Sent back with the saved signature kept: no new signature is needed to send it again. */
const keptSig = (x: { redo_note?: string | null; redo_keep_sig?: number; signed_at?: string | null; signed_name?: string | null }) => !!(x.redo_note && x.redo_keep_sig && x.signed_at && x.signed_name);
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
  const [collabOn, setCollabOn] = useState(false); // Colaborări open for this account (same mode as on the web)
  const [locOn, setLocOn] = useState(true); // the cadastral locator is in the account's modules
  const locSeen = useRef(false); // the locator tab, once opened, stays loaded (the map keeps its place between tabs)
  const [locSheet, setLocSheet] = useState(false); // the parcel sheet is open in the locator: the menu steps aside
  // a parcel to show in the locator (from an inspection's detail) and the inspection to go back to („Înapoi la fișă”)
  const [locTarget, setLocTarget] = useState<{ key: string; nr: string; seq: number } | null>(null);
  const [locFrom, setLocFrom] = useState<string | null>(null);
  useEffect(() => {
    const on = (e: MessageEvent) => { if (e.origin === location.origin && (e.data as { uvLoc?: string })?.uvLoc === "sheet") setLocSheet((e.data as { state: string }).state !== "off"); };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);
  const [appUrl, setAppUrl] = useState("");
  const [firms, setFirms] = useState<{ id: string; name: string }[]>([]); // offices I may create inspections for (angajat, allowed)
  const [cur, setCur] = useState<Insp | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [view, setViewState] = useState<View>({ v: "home" });
  // „Înapoi la fișă” only while the locator was opened from an inspection; leaving it forgets that
  useEffect(() => { if (view.v !== "loc") setLocFrom(null); }, [view.v]);
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
  const [scope, setScope] = useState<Scope>("all");
  const [st, setSt] = useState<StatF>("all");

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3500); };
  // the bottom bar (.mbFoot) is fixed to the screen: its height is kept in --foot-h so the content scrolls clear of it
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".mb"), f = document.querySelector<HTMLElement>(".mbFoot");
    if (!root || !f) return;
    const set = () => root.style.setProperty("--foot-h", `${f.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set); ro.observe(f);
    return () => ro.disconnect();
  });
  const go = useCallback((v: View) => { setViewState(v); history.pushState({ mbv: v }, ""); window.scrollTo(0, 0); }, []);
  // the phone's Back button moves between the app's screens; caught before the Next.js router, which would reload the page
  useEffect(() => {
    const on = (e: PopStateEvent) => { e.stopImmediatePropagation(); setViewState((e.state?.mbv as View) ?? { v: "home" }); };
    window.addEventListener("popstate", on, true);
    return () => window.removeEventListener("popstate", on, true);
  }, []);

  // the inspections finished on the phone (sent, or waiting for signal) leave the active list at once
  const [finished, setFinished] = useState<Set<string>>(new Set());
  const refreshQueue = useCallback(async () => { setPending(await allFiles()); const f = await allFinish(); setFinishQ(f.length); setFinished((o) => new Set([...o, ...f.map((x) => x.insp)])); }, []);
  // what /api/m/state returned, shown at once on the next start (the app opens from the phone's memory, then refreshes)
  const apply = useCallback((j: Record<string, unknown>) => {
    setMe(j.user as Me);
    setItems((j.items as InspRow[]) ?? []);
    setFirms((j.firms as { id: string; name: string }[]) ?? []);
    setCollabOn(!!j.collabOn); setLocOn(j.locOn !== false); setAppUrl(String(j.app ?? ""));
    setInfo((j.info as Info) ?? null);
    setTpls((j.templates as Tpl[]) ?? []);
    setNotifs((j.notifs as Notif[]) ?? []);
  }, []);
  const load = useCallback(async () => {
    const r = await fetch("/api/m/state", { cache: "no-store" }).catch(() => null);
    if (!r) { setState((s) => (s === "boot" ? "app" : s)); return; } // offline: keep what we have
    if (r.status === 401) { try { localStorage.removeItem("insp-state"); } catch {} setState("login"); return; }
    const j = await J(r);
    setMe(j.user as Me);
    if (!j.allowed) { try { localStorage.removeItem("insp-state"); } catch {} setState("noaccess"); return; }
    apply(j);
    try { localStorage.setItem("insp-state", JSON.stringify(j)); } catch {}
    setState("app");
  }, [apply]);

  // start: pairing code from the QR (?pair=), the service worker (only on the app's own domain), the queue
  useEffect(() => {
    // the last state known on this phone: the app shows at once, without waiting for the network
    try { const c = JSON.parse(localStorage.getItem("insp-state") || "null"); if (c?.user && c.allowed) { apply(c); setState("app"); } } catch {}
    const sp = new URLSearchParams(location.search), code = sp.get("pair"), openId = sp.get("open");
    const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    (async () => {
      // already signed in as the same person (e.g. the web's preview frame opened again): the code is not used, no new session.
      // Signed in as someone else (another account on the same browser, e.g. a super-admin before): the code signs in the right one.
      const want = sp.get("u");
      let signed = false;
      if (code) {
        const r = await fetch("/api/m/state", { cache: "no-store" }).catch(() => null);
        const who = r?.ok ? ((await r.json().catch(() => null)) as { user?: { id?: string } } | null)?.user?.id : null;
        signed = !!who && (!want || who === want);
      }
      if (code && signed) history.replaceState(null, "", location.pathname);
      else if (code) {
        try { localStorage.removeItem("insp-state"); } catch {}
        history.replaceState(null, "", location.pathname);
        const r = await fetch("/api/m/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, standalone }) });
        const j = await J(r);
        if (!r.ok) say(String(j.error || "Codul nu a mers."));
        else if (typeof j.go === "string") { location.replace(j.go); return; } // the session again through a page load
      }
      await load();
      // the details of the active inspections are kept on the phone in the background: they open at once, also without signal
      setTimeout(() => { void (async () => {
        let list: InspRow[] = [];
        try { list = ((JSON.parse(localStorage.getItem("insp-state") || "null")?.items ?? []) as InspRow[]).filter((i) => !isDone(i)).slice(0, 15); } catch {}
        for (const i of list) { if (!navigator.onLine) break; await fetchRef.current(i.id); }
      })(); }, 2500);
      // the phone's "last seen" is recorded after the list, so it does not slow the start
      if (!code) void fetch("/api/m/device", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ standalone }) }).catch(() => {});
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
  }, [load, refreshQueue, apply]);

  const curId = useRef<string | null>(null);
  const fetchRef = useRef<(id: string) => Promise<Insp | null>>(async () => null);
  fetchRef.current = (id: string) => fetchInsp(id);
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
      if ((e.target as Element).closest?.(".mbMap, .mbMini.big, .mbSig, .mbSheetBg, input, textarea, select")) return;
      y0 = e.touches[0].clientY; d = 0;
      window.addEventListener("touchmove", move, { passive: false });
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
      window.removeEventListener("touchmove", move);
      if (y0 == null) return;
      y0 = null;
      setDrag(false);
      if (d < PULL) { setPull(0); return; }
      busy = true; setPulling(true); setPull(PULL);
      try { await refreshRef.current(); } finally { busy = false; setPulling(false); setPull(0); }
    };
    window.addEventListener("touchstart", start, { passive: true });
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
    // opened before on this phone: shown at once from memory, then refreshed from the network
    let cached: Insp | null = null;
    try { cached = JSON.parse(localStorage.getItem(`insp-${id}`) || "null"); } catch {}
    if (cached) {
      void fetchInsp(id).then((fresh) => {
        if (!fresh || curId.current !== id) return;
        setCur(fresh);
        // the sheet was deleted on the web meanwhile: the draft on the phone belonged to it
        const old = loadDraft(id);
        if (old && (old.rev ?? 0) !== (fresh.sheet_rev ?? 0)) {
          try { localStorage.removeItem(`insp-draft-${id}`); } catch {}
          setDraft(newDraft(fresh));
          say("Fișa a fost ștearsă de pe web: începi o fișă nouă.");
        }
      });
    }
    const x = cached ?? (await fetchInsp(id));
    if (!x) { say("Inspecția nu se poate deschide fără semnal. Deschide-o o dată cu internet."); return; }
    setCur(x); curId.current = id;
    const saved = loadDraft(id);
    const d = saved && (saved.rev ?? 0) === (x.sheet_rev ?? 0) ? saved : newDraft(x);
    setDraft(d);
    go(then);
  }

  function newDraft(x: Insp): Draft {
    const d: Draft = {
      // the sheet's default answers, under what is already filled in (the property's details sent by the firm, or the answers so far)
      answers: { ...(x.started_at ? {} : Object.fromEntries(x.template.groups.flatMap((g) => g.qs.filter((q) => q.def).map((q) => [q.id, q.kind === "many" ? [q.def!] : q.def!])))), ...x.answers },
      rooms: x.room_answers.length ? x.room_answers : x.rooms.map((r) => ({ ...r })), findings: { diff: x.findings.diff ?? "", defects: x.findings.defects ?? "", notes: x.findings.notes ?? "" },
      started_at: x.started_at ?? "", rev: x.sheet_rev ?? 0,
    };
    // a building with no rooms from the floor survey gets the standard ones (replaced by "Preia din RLV")
    // (only when the sheet asks the rooms' finishes)
    if (!d.rooms.length && x.template.rooms && !/^teren/i.test(x.prop_type ?? "")) d.rooms = STANDARD_ROOMS.map((n) => ({ n, a: null, std: true }));
    return d;
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
        body: JSON.stringify({ action: "progress", id, answers: d.answers, room_answers: d.rooms, findings: d.findings, started_at: d.started_at, rev: d.rev ?? 0, near, loc: d.loc ?? null }) }).catch(() => {});
    }, 4000);
  };

  /** Deletes a photo: one still on the phone from the queue, one already sent from the server (then the inspection is read again). */
  async function deletePhoto(id: string, local: boolean) {
    if (!cur || !confirm("Ștergi fotografia?")) return;
    if (local) { await delFile(id); await refreshQueue(); return; }
    const r = await fetch(`/api/inspectii/file/${id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) { say(r ? "Fotografia nu a putut fi ștearsă." : "Fără semnal: fotografia se poate șterge când revine rețeaua."); return; }
    const x = await fetchInsp(cur.id);
    if (x) setCur(x);
    say("Fotografia a fost ștearsă.");
  }

  /** Moves a photo to another category: on the phone in the queue, an already sent one on the server. */
  async function movePhoto(id: string, local: boolean, room: string) {
    if (!cur) return;
    if (local) {
      const f = (await allFiles()).find((x) => x.id === id);
      if (f) { await putFile({ ...f, room }); await refreshQueue(); }
      return;
    }
    setCur({ ...cur, files: cur.files.map((f) => (f.id === id ? { ...f, room } : f)) }); // shown at once
    const r = await fetch(`/api/inspectii/file/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ room }) }).catch(() => null);
    if (!r?.ok) say(r ? "Fotografia nu a putut fi mutată." : "Fără semnal: mutarea nu s-a salvat.");
    const x = await fetchInsp(cur.id);
    if (x) setCur(x);
  }

  /** "Preia din RLV": the floor survey read with AI (an attached one, or one photographed / chosen now) → its rooms. */
  async function readRlv(src: { fileId: string } | { file: File }): Promise<Room[] | null> {
    if (!cur) return null;
    if (!navigator.onLine) { say("Citirea releveului cere semnal."); return null; }
    const fd = new FormData(); fd.set("id", cur.id);
    if ("fileId" in src) fd.set("fileId", src.fileId);
    else {
      const f = src.file, pdf = f.type === "application/pdf";
      const blob = pdf ? f : await shrink(f, 2400);
      fd.set("file", new File([blob], pdf ? f.name || "releveu.pdf" : "releveu.jpg", { type: pdf ? f.type : blob.type || "image/jpeg" }));
    }
    const r = await fetch("/api/inspectii/rlv", { method: "POST", body: fd }).catch(() => null);
    const j = r ? await J(r) : {};
    if (!r?.ok) { say(typeof j.error === "string" ? j.error : "Releveul nu a putut fi citit."); return null; }
    if ("file" in src) { const x = await fetchInsp(cur.id); if (x) setCur(x); }
    return j.rooms as Room[];
  }

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
      started_at: draft.started_at, signed_name: signed, new_sig: !!sig, rev: draft.rev ?? 0, loc: draft.loc ?? null } });
    try { localStorage.removeItem(`insp-draft-${cur.id}`); } catch {}
    setFinished((o) => new Set([...o, cur.id]));
    setItems((l) => l.map((i) => (i.id === cur.id ? { ...i, status: "gata" as const, finished_at: i.finished_at ?? new Date().toISOString() } : i)));
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
      <button type="button" className="mbBtn" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); try { localStorage.removeItem("insp-state"); } catch {} location.reload(); }}>Ieși din cont</button>
    </div>
  );

  const queueN = pending.length + finishQ;
  const nav = view.v === "home" || view.v === "queue" || view.v === "collab" || view.v === "account" || view.v === "loc";
  if (view.v === "loc" && !locSeen.current) locSeen.current = true;
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
      {view.v === "home" && <Home me={me} items={items.filter((i) => !isDone(i) && !finished.has(i.id))} queueN={queueN} onQueue={() => go({ v: "queue" })} pos={pos} unread={unread} scope={scope} setScope={setScope} st={st} setSt={setSt} onBell={() => go({ v: "notifs" })} onMe={() => go({ v: "account" })} onSchedule={setSched} onNew={() => go({ v: "new" })} onOpen={(id) => open(id, { v: "detail", id })} onStart={(id) => open(id, { v: "form", id, sec: 0 })} />}
      {view.v === "radar" && <Radar inspId={view.id} myName={me?.name ?? ""} onBack={() => history.back()} />}
      {view.v === "detail" && cur && <Detail x={cur} draft={draft} mine={!cur.ro && (!me || cur.assignee_id === me.id)} onSchedule={setSched}
        onRadar={me?.super && me.id === cur.assignee_id ? () => go({ v: "radar", id: cur.id }) : undefined}
        onLocator={locOn ? (t) => { setLocTarget({ ...t, seq: Date.now() }); setLocFrom(cur.id); go({ v: "loc" }); } : undefined}
        editable={!!me && cur.created_by === me.id && !cur.ro} onEdit={() => go({ v: "edit", id: cur.id })}
        onDelete={async () => {
          const done = cur.status === "gata" || cur.status === "pred";
          if (!confirm(done ? `Ștergi inspecția ${cur.code}? E finalizată: fișa, pozele și actele nu se mai văd nicăieri.` : `Ștergi inspecția ${cur.code} (${cur.address})?`)) return;
          const r = await fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: cur.id }) }).catch(() => null);
          if (!r?.ok) { say(r ? String((await J(r)).error || "Nu a mers.") : "Fără semnal: încearcă din nou când ai rețea."); return; }
          try { localStorage.removeItem(`insp-${cur.id}`); } catch {}
          await load(); history.replaceState({ mbv: { v: "home" } }, ""); setViewState({ v: "home" }); say("Inspecția a fost ștearsă.");
        }}
        onAnswer={async (ok) => {
          const r = await fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: ok ? "accept" : "decline", id: cur.id }) }).catch(() => null);
          if (!r?.ok) { say(r ? String((await J(r)).error || "Nu a mers.") : "Fără semnal: încearcă din nou când ai rețea."); return; }
          await load();
          try { localStorage.removeItem(`insp-${cur.id}`); } catch {}
          if (ok) { setCur({ ...cur, assign_state: null }); say("Ai acceptat inspecția."); } else { go({ v: "home" }); say("Solicitarea a fost refuzată."); }
        }} onBack={() => { history.replaceState({ mbv: { v: "home" } }, ""); setViewState({ v: "home" }); window.scrollTo(0, 0); }}
        onStart={() => go({ v: "form", id: cur.id, sec: 0 })} />}
      {view.v === "form" && cur && draft && (
        <Form x={cur} d={draft} sec={view.sec} photos={pending.filter((p) => p.insp === cur.id && p.kind === "photo").length + cur.files.filter((f) => f.kind === "photo").length}
          pending={pending.filter((p) => p.insp === cur.id && p.kind === "photo")}
          onBack={() => history.back()} onSec={(s) => setViewState({ v: "form", id: cur.id, sec: s })} change={change} onPhoto={addPhoto}
          onRooms={() => go({ v: "rooms", id: cur.id })} onPhotos={() => go({ v: "photos", id: cur.id })} onSign={() => go({ v: "sign", id: cur.id })} />
      )}
      {view.v === "rooms" && cur && draft && <Rooms x={cur} d={draft} change={change} onBack={() => history.back()} onNext={() => go({ v: "photos", id: cur.id })} onPhoto={addPhoto} onRlv={readRlv} />}
      {view.v === "photos" && cur && draft && <Photos x={cur} d={draft} pending={pending.filter((p) => p.insp === cur.id && p.kind === "photo")} onBack={() => history.back()} onNext={() => go({ v: "sign", id: cur.id })} onPhotos={addPhotos} onDelete={deletePhoto} onMove={movePhoto} />}
      {view.v === "sign" && cur && draft && <Sign x={cur} d={draft} photos={pending.filter((p) => p.insp === cur.id && p.kind === "photo").length + cur.files.filter((f) => f.kind === "photo").length} change={change} onBack={() => history.back()} onFinish={finish}
        onRooms={() => go({ v: "rooms", id: cur.id })} onPhotos={() => go({ v: "photos", id: cur.id })} />}
      {view.v === "queue" && <Queue pending={pending} finishN={finishQ} items={items} online={online} onSend={async () => { const n = await sendAll(); say(n ? "Mai sunt elemente de trimis." : "Totul a fost trimis."); }} />}
      {view.v === "collab" && <MobileCollab on={collabOn} app={appUrl} online={online} say={say} pos={pos} onMe={() => go({ v: "account" })} me={me && <Avatar me={me} />} />}
      {view.v === "notifs" && <Notifs notifs={notifs} reminders={reminders} seenAt={seen.at} onBack={() => { markSeen(); history.back(); }}
        onOpen={(id) => { markSeen(); void open(id, { v: "detail", id }); }} />}
      {view.v === "account" && <Account onBack={() => history.back()} me={me} info={info} done={items.filter(isDone)} onOpen={(id) => open(id, { v: "detail", id })} queueN={queueN} online={online} onSend={async () => { const n = await sendAll(); say(n ? "Mai sunt elemente de trimis." : "Totul a fost trimis."); }} say={say} />}
      {view.v === "edit" && cur && <NewInsp edit={cur} tpls={tpls} firms={[]} online={online} pos={pos} onBack={() => history.back()} onDone={async () => {
        await load();
        try { localStorage.removeItem(`insp-${cur.id}`); } catch {}
        const x = await fetchInsp(cur.id); if (x) setCur(x);
        history.back(); say("Modificările au fost salvate.");
      }} />}
      {view.v === "new" && <NewInsp tpls={tpls} firms={firms} online={online} pos={pos} onBack={() => history.back()} onDone={async (id, now) => {
        await load();
        // the "new inspection" screen is replaced in the history: Back from the sheet goes home, not to an empty form
        history.replaceState({ mbv: { v: "home" } }, "");
        if (now) await open(id, { v: "form", id, sec: 0 }); else { setViewState({ v: "home" }); say("Inspecția a fost adăugată."); }
      }} />}
      </div>
      {nav && !(view.v === "loc" && locSheet) && (
        <nav className="mbNav" aria-label="Meniu">
          <button type="button" aria-current={view.v === "home" ? "page" : undefined} onClick={() => go({ v: "home" })}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4" /></svg><span>Inspecții</span></button>
          {/* the locator: only the sign, in orange, raised in the middle */}
          <button type="button" className="mbNavLoc" aria-label="Localizator cadastral" aria-current={view.v === "loc" ? "page" : undefined} onClick={() => go({ v: "loc" })}>
            <span><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21.5s-6.5-6.1-6.5-11.2a6.5 6.5 0 0 1 13 0c0 5.1-6.5 11.2-6.5 11.2z" /><circle cx="12" cy="10.2" r="2.4" /></svg></span>
          </button>
          <button type="button" aria-current={view.v === "collab" ? "page" : undefined} onClick={() => go({ v: "collab" })}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="3.2" /><circle cx="17" cy="9" r="2.6" /><path d="M2.5 20c.8-3.4 3-5.4 5.5-5.4s4.7 2 5.5 5.4M14 15c2.6-.6 5.6.6 7 4.6" /></svg><span>Colaborări</span></button>
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
      {locSeen.current && <LocTab on={locOn} shown={view.v === "loc"} target={locTarget} />}
      {view.v === "loc" && locFrom && (
        <button type="button" className="mbLocBack" onClick={() => { setLocFrom(null); history.back(); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>Înapoi la fișă
        </button>
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
  const post = async (url: string, body: unknown): Promise<false | Record<string, unknown>> => {
    setBusy(true); setMsg("");
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await J(r);
      if (!r.ok) throw new Error(String(j.error || "Nu a mers."));
      return j as Record<string, unknown>;
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
          <form onSubmit={async (e) => { e.preventDefault(); const v = await post("/api/auth/verify", { email, code }); if (v) {
            await fetch("/api/m/device", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ standalone }) }).catch(() => {});
            // the one-time link sets the session again through a page load (the installed app on iPhone may drop the cookie of the request)
            if (typeof v.go === "string") { setBusy(true); location.replace(v.go); } else onDone();
          } }}>
            <p className="mbNote">Ți-am trimis un cod de 6 cifre pe <b>{email}</b>.</p>
            <label className="mbField">Codul din email<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required /></label>
            <button className="mbBtn gold big" disabled={busy || code.length < 6}>Intră</button>
            <button type="button" className="mbLink" onClick={() => { setStep("email"); setCode(""); }}>Alt email</button>
          </form>
        )}
        {step === "pair" && (
          <form onSubmit={async (e) => { e.preventDefault(); const v = await post("/api/m/pair", { code, standalone }); if (v) { if (typeof v.go === "string") { setBusy(true); location.replace(v.go); } else onDone(); } }}>
            <p className="mbNote">Pe calculator, în UVALO → <b>Inspecții</b>, apasă „Arată codul de conectare”. Scanează codul QR cu camera telefonului sau scrie aici cele 8 cifre.</p>
            <label className="mbField">Codul de conectare<input inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required /></label>
            <button className="mbBtn gold big" disabled={busy || code.length < 8}>Conectează telefonul</button>
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

/** The phone's statuses: what the person has to do with each inspection (sent back to complete = "Completări"). */
type MStat = "req" | "redo" | "lucru" | "plan" | "prog" | "gata";
const MSTAT: Record<MStat, { label: string; fg: string; bg: string }> = {
  req: { label: "Solicitări", fg: "#7A5AA6", bg: "#F4F0FA" },
  redo: { label: "Completări", fg: "#B3261E", bg: "#FBE9E7" },
  lucru: { label: "În lucru", fg: STATUS.lucru.fg, bg: STATUS.lucru.bg },
  plan: { label: "De făcut", fg: STATUS.plan.fg, bg: STATUS.plan.bg },
  prog: { label: "De programat", fg: STATUS.prog.fg, bg: STATUS.prog.bg },
  gata: { label: "Finalizate", fg: STATUS.gata.fg, bg: STATUS.gata.bg },
};
const MSTAT_ORDER: MStat[] = ["req", "redo", "lucru", "plan", "prog", "gata"];
const mstat = (i: InspRow): MStat => (i.assign_state === "pending" ? "req" : i.status === "gata" || i.status === "pred" ? "gata" : i.status === "lucru" ? (i.redo_note ? "redo" : "lucru") : i.status);
type Scope = "all" | "today" | "week" | "unsched";
type StatF = "all" | MStat;

type Sched = { id: string; address: string; scheduled_at: string | null; duration_min: number; day?: string };
type HView = "list" | "map" | "cal";
const isDone = (i: InspRow) => i.status === "gata" || i.status === "pred";
/** A timestamp (UTC, "…Z") as the phone's local "YYYY-MM-DDTHH:MM", like scheduled_at. */
const localStamp = (iso: string) => { const d = new Date(iso); return `${ymd(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
/** The inspection's date: when the sheet was finished (done, or sent back after being finished), else when it is scheduled. */
const whenOf = (i: InspRow): string | null => (isDone(i) && i.finished_at ? localStamp(i.finished_at)
  : i.redo_note && i.redo_prev_at ? localStamp(i.redo_prev_at) : i.scheduled_at);
const canSchedule = (i: { status: string }) => i.status === "prog" || i.status === "plan";

function Home({ me, items, queueN, onQueue, pos, unread, scope, setScope, st, setSt, onBell, onMe, onNew, onOpen, onStart, onSchedule }: {
  me: Me | null; items: InspRow[]; queueN: number; onQueue: () => void; unread: number; scope: Scope; setScope: (s: Scope) => void; st: StatF; setSt: (s: StatF) => void; onBell: () => void; onMe: () => void; pos: React.RefObject<[number, number] | null>; onNew: () => void; onOpen: (id: string) => void;
  onStart: (id: string) => void; onSchedule: (x: Sched) => void;
}) {
  const [hv, setHv] = useState<HView>("list");
  // whose: mine (my account) or received from the firms I work with (angajat / colaborator); only shown when there are such
  const [own, setOwn] = useState<"all" | "mine" | "firms">("all");
  useEffect(() => { try { const v = localStorage.getItem("insp-view"); if (v === "map" || v === "cal" || v === "list") setHv(v); } catch {} }, []);
  const pickView = (v: HView) => { setHv(v); try { localStorage.setItem("insp-view", v); } catch {} };
  const now = new Date(), today = ymd(now);
  const wkEnd = ymd(new Date(now.getTime() + 7 * 864e5));
  const active = items.filter((i) => !isDone(i));
  // the card on top: the next scheduled one not started yet (still shown while its time slot runs); without one, the most urgent
  // sent back to complete (earliest first), then one in progress
  const endOf = (i: InspRow) => new Date(i.scheduled_at!).getTime() + (i.duration_min || 60) * 60000;
  const byWhen = (a: InspRow, b: InspRow) => (a.scheduled_at ?? "9999").localeCompare(b.scheduled_at ?? "9999");
  // a request not accepted yet (colaborator) is not the next one to do
  const next = active.filter((i) => i.status === "plan" && i.assign_state !== "pending" && i.scheduled_at && endOf(i) > now.getTime()).sort(byWhen)[0]
    ?? active.filter((i) => mstat(i) === "redo").sort(byWhen)[0]
    ?? active.filter((i) => mstat(i) === "lucru").sort(byWhen)[0];
  const nextKind = next ? mstat(next) : null;
  const inWeek = active.filter((i) => i.scheduled_at && i.scheduled_at.slice(0, 10) >= today && i.scheduled_at.slice(0, 10) <= wkEnd);
  const unsched = active.filter((i) => !i.scheduled_at);
  const todayL = items.filter((i) => whenOf(i)?.startsWith(today));
  const weekL = items.filter((i) => { const w = whenOf(i)?.slice(0, 10); return !!w && w >= today && w <= wkEnd; });
  // the cards choose the time (Toate / Azi / Săptămâna asta / De programat), the list below the status
  const firmN = items.filter((i) => i.firm).length;
  const byOwn = (l: InspRow[]) => (own === "mine" ? l.filter((i) => !i.firm) : own === "firms" ? l.filter((i) => i.firm) : l);
  const scoped = byOwn(scope === "today" ? todayL : scope === "week" ? weekL : scope === "unsched" ? unsched : items);
  const list = st === "all" ? scoped : scoped.filter((i) => mstat(i) === st);
  const count = (k: MStat) => scoped.filter((i) => mstat(i) === k).length;
  const first = (me?.name ?? "").split(/\s+/)[0];
  const mins = next?.scheduled_at ? Math.round((new Date(next.scheduled_at).getTime() - now.getTime()) / 60000) : null;
  const showScope = (k: Scope) => { setScope(k); if (hv === "cal") pickView("list"); };
  const FILTERS: [StatF, string, number][] = [["all", "Toate", scoped.length], ...MSTAT_ORDER.filter((k) => k !== "gata").map((k) => [k, MSTAT[k].label, count(k)] as [StatF, string, number])];
  return (
    <>
      <header className="mbHead">
        <div className="mbHeadRow">
          <span><small>{WEEKDAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]}</small><b>Bună{first ? `, ${first}` : ""}!</b></span>
          <span className="mbHeadBtns">
            {/* sheets / photos still on the phone: shown only while there is something to send */}
            {queueN > 0 && (
              <button type="button" className="mbBell mbQueueBtn" onClick={onQueue} aria-label={`De trimis: ${queueN}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
                <i>{queueN > 9 ? "9+" : queueN}</i>
              </button>
            )}
            <button type="button" className="mbBell" onClick={onBell} aria-label={unread ? `Notificări, ${unread} noi` : "Notificări"}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
              {unread > 0 && <i>{unread > 9 ? "9+" : unread}</i>}
            </button>
            <button type="button" className="mbAv" onClick={onMe} aria-label="Contul meu"><Avatar me={me} /></button>
          </span>
        </div>
        <div className="mbHeroStats" role="group" aria-label="Perioada">
          <button type="button" aria-pressed={scope === "all"} onClick={() => showScope("all")}><b>{items.length}</b><small>toate</small></button>
          <button type="button" aria-pressed={scope === "today"} onClick={() => showScope("today")}><b>{todayL.length}</b><small>azi</small></button>
          <button type="button" aria-pressed={scope === "week"} onClick={() => showScope("week")}><b>{weekL.length}</b><small>săpt. asta</small></button>
          <button type="button" aria-pressed={scope === "unsched"} onClick={() => showScope("unsched")} className={unsched.length ? "red" : ""}><b>{unsched.length}</b><small>de programat</small></button>
        </div>
        {next ? (
          <div className="mbNext">
            <span className="mbNextTop"><small className={nextKind === "redo" ? "redo" : ""}>{nextKind === "redo" ? "DE COMPLETAT" : nextKind === "lucru" ? "ÎN LUCRU"
              : mins != null && mins < 0 ? "ACUM" : mins != null && mins < 24 * 60 ? `URMĂTOAREA · ÎN ${mins < 60 ? `${mins} MIN` : `${Math.round(mins / 60)} H`}` : "URMĂTOAREA"}</small></span>
            <button type="button" className="mbNextMain" onClick={() => onOpen(next.id)}>
              <span className="mbTime">{next.scheduled_at && !next.scheduled_at.startsWith(today)
                ? <><small>{Number(next.scheduled_at.slice(8, 10))} {MONTHS[Number(next.scheduled_at.slice(5, 7)) - 1].slice(0, 3)}</small><b>{next.scheduled_at.slice(11, 16)}</b></>
                : <><b>{next.scheduled_at?.slice(11, 16) ?? "—"}</b><small>{next.duration_min} min</small></>}</span>
              <span><b>{next.address}</b><small>{nextKind === "redo" && next.redo_note ? next.redo_note : [next.prop_type, next.contact_name].filter(Boolean).join(" · ")}</small></span>
            </button>
            <span className="mbNextBtns">
              <a className="mbBtn" href={next.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${next.lat},${next.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(next.address)}`} target="_blank" rel="noopener">Navighează</a>
              <button type="button" className="mbBtn" onClick={() => onOpen(next.id)}>Detalii</button>
              <button type="button" className="mbBtn gold" onClick={() => onStart(next.id)}>{nextKind === "redo" ? "Modifică fișa" : next.status === "lucru" ? "Continuă" : "Începe fișa"}</button>
            </span>
          </div>
        ) : <div className="mbNext mbNextNone"><span>Nicio inspecție programată</span></div>}
      </header>
      <InstallHint />
      <div className="mbTools">
        {hv === "cal" ? <b className="mbToolsT">Calendar</b> : (
          <label className="mbSel">
            <span className="mbSelV" aria-hidden="true"><span>{FILTERS.find((x) => x[0] === st)![1]}</span><em>{FILTERS.find((x) => x[0] === st)![2]}</em></span>
            <select value={st} onChange={(e) => setSt(e.target.value as StatF)} aria-label="Starea">
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
      {firmN > 0 && hv !== "cal" && (
        <div className="mbOwn" role="group" aria-label="Ale cui">
          <button type="button" aria-pressed={own === "all"} onClick={() => setOwn("all")}>Toate <em>{items.length}</em></button>
          <button type="button" aria-pressed={own === "mine"} onClick={() => setOwn("mine")}>Ale mele <em>{items.length - firmN}</em></button>
          <button type="button" aria-pressed={own === "firms"} className="firms" onClick={() => setOwn("firms")}>De la firme <em>{firmN}</em></button>
        </div>
      )}
      {hv === "list" && <ItemList list={list} today={today} onOpen={onOpen} grouped={st === "all"} />}
      {hv === "map" && <MapList list={list} today={today} pos={pos} onOpen={onOpen} />}
      {hv === "cal" && <Calendar items={items} today={today} onOpen={onOpen} onSchedule={onSchedule} />}
    </>
  );
}

function ItemRow({ i, today, onOpen, n, sub }: { i: InspRow; today: string; onOpen: (id: string) => void; n?: number; sub?: string }) {
  const w = whenOf(i), d = w ? new Date(w) : null, isToday = w?.startsWith(today);
  return (
    <button type="button" className={`mbItem${i.firm ? ` byFirm ${i.place === "collab" ? "collab" : "staff"}` : ""}`} onClick={() => onOpen(i.id)}>
      {i.firm && <u className="mbFirm" title={i.firm}>{i.firm}</u>}
      {n != null ? <span className="mbPinN" style={{ background: STATUS[i.status].fg }}>{n}</span>
        : <span className={`mbDay${isDone(i) ? " done" : isToday ? " today" : ""}`}>{d ? <><small>{isToday ? "AZI" : `${DAYS[d.getDay()]} ${d.getDate()}`}</small><b>{w!.slice(11, 16)}</b></> : <><small>FĂRĂ</small><small>DATĂ</small></>}</span>}
      <span className="mbItemTxt">
        <span><em>{(i.prop_type ?? "IMOBIL").toUpperCase()}</em><i style={{ color: MSTAT[mstat(i)].fg }}>● {mstat(i) === "gata" ? (i.status === "pred" ? "Predată" : "Finalizată") : MSTAT[mstat(i)].label}</i></span>
        <b>{i.address}</b>
        <small>{sub ?? (i.redo_note && mstat(i) === "redo" ? `De completat: ${i.redo_note}` : isDone(i) && w ? `Făcută ${fmtWhen(w)}` : n != null ? fmtWhen(i.scheduled_at) : [i.contact_name, i.cad_nr && `nr. cad. ${i.cad_nr}`].filter(Boolean).join(" · ") || fmtWhen(i.scheduled_at))}</small>
      </span>
    </button>
  );
}

function ItemList({ list, today, onOpen, grouped = false }: { list: InspRow[]; today: string; onOpen: (id: string) => void; grouped?: boolean }) {
  const byDate = (a: InspRow, b: InspRow) => (a.scheduled_at ?? "9999").localeCompare(b.scheduled_at ?? "9999");
  if (grouped && list.length) {
    return (
      <div className="mbList">
        {MSTAT_ORDER.map((k) => {
          const g = list.filter((i) => mstat(i) === k).sort(k === "gata" ? (a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? "") : byDate);
          if (!g.length) return null;
          return (
            <Fragment key={k}>
              <span className="mbGroupHead" style={{ color: MSTAT[k].fg }}><i style={{ background: MSTAT[k].fg }} />{MSTAT[k].label}<em>{g.length}</em></span>
              {g.map((i) => <ItemRow key={i.id} i={i} today={today} onOpen={onOpen} />)}
            </Fragment>
          );
        })}
      </div>
    );
  }
  return (
    <div className="mbList">
      {[...list].sort(byDate).map((i) => <ItemRow key={i.id} i={i} today={today} onOpen={onOpen} />)}
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
  const byDay = (d: string) => items.filter((i) => whenOf(i)?.startsWith(d)).sort((a, b) => whenOf(a)!.localeCompare(whenOf(b)!));
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
            <span className={`mbSlotT${isDone(i) ? " done" : ""}`}><b>{whenOf(i)!.slice(11, 16)}</b><small>{i.duration_min}′</small></span>
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
/** The cadastral locator in the app: the locator page itself (/localizare?app=1: the map on the whole screen, the search on top,
 *  the parcel sheet sliding up from the bottom), kept loaded once opened and only hidden when another tab is shown. */
function LocTab({ on, shown, target }: { on: boolean; shown: boolean; target: { key: string; nr: string; seq: number } | null }) {
  const frame = useRef<HTMLIFrameElement>(null), ready = useRef(false), first = useRef(target?.seq ?? 0);
  // a parcel asked for later (from an inspection): the loaded locator shows it; at the first opening it goes in the address (#uat-nr)
  useEffect(() => {
    if (!target || target.seq === first.current || !ready.current) return;
    frame.current?.contentWindow?.postMessage({ uvLoc: "show", key: target.key, nr: target.nr }, location.origin);
  }, [target]);
  // the phone's keyboard, which the frame does not see: its height goes to the locator, so the search panel stays above it
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const f = () => frame.current?.contentWindow?.postMessage({ uvLoc: "kb", px: Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) }, location.origin);
    vv.addEventListener("resize", f); vv.addEventListener("scroll", f);
    return () => { vv.removeEventListener("resize", f); vv.removeEventListener("scroll", f); };
  }, []);
  // the phone's top safe area and the space of the floating menu, measured here (an iframe does not know them): the map goes under both
  const [src] = useState(() => {
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)";
    document.body.appendChild(d);
    const cs = getComputedStyle(d), t = Math.round(parseFloat(cs.paddingTop) || 0), b = Math.round(parseFloat(cs.paddingBottom) || 0);
    d.remove();
    // b = the menu's height (56 px + what it keeps of the bottom safe area, as in .mbNav) and a small gap
    return `/localizare?app=1&t=${t}&b=${56 + Math.max(6, b - 14) + 6}&s=${b}${target ? `#${target.key}-${target.nr}` : ""}`;
  });
  if (!on) return shown ? (
    <div className="mbLoc off"><div className="mbSoon"><b>Localizatorul cadastral</b><small>Nu este în planul contului tău. Scrie-ne la office@uvalo.ro ca să-l activăm.</small></div></div>
  ) : null;
  return (
    <div className="mbLoc" hidden={!shown} aria-hidden={!shown}>
      <iframe ref={frame} src={src} title="Localizator cadastral" allow="geolocation; clipboard-write" onLoad={() => { ready.current = true; }} />
    </div>
  );
}

const ESRI_SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const ESRI_ROADS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}";
/** The map at the top of the detail: small and still; a tap opens it to ~70% of the screen, movable and zoomable, with Hartă / Satelit
 *  (remembered in localStorage `insp-base`); „Restrânge” closes it. */
function MiniMap({ lat, lng, onLocator }: { lat: number; lng: number; onLocator?: () => void }) {
  const el = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = useRef<any>(null), layers = useRef<{ osm: any; sat: any } | null>(null);
  const [big, setBig] = useState(false);
  const [base, setBase] = useState<"map" | "sat">(() => { try { return localStorage.getItem("insp-base") === "sat" ? "sat" : "map"; } catch { return "map"; } });
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let m: any = null, gone = false;
    loadLeaflet().then((L) => {
      if (gone || !el.current) return;
      m = L.map(el.current, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false, tap: false });
      layers.current = {
        osm: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }),
        sat: L.layerGroup([L.tileLayer(ESRI_SAT, { maxZoom: 19 }), L.tileLayer(ESRI_ROADS, { maxZoom: 19 }), L.tileLayer(ESRI_LABELS, { maxZoom: 19 })]),
      };
      L.marker([lat, lng], { icon: L.divIcon({ className: "", html: '<span class="mbPin" style="background:#141414"><b>●</b></span>', iconSize: [30, 30], iconAnchor: [15, 30] }) }).addTo(m);
      m.setView([lat, lng], 16);
      map.current = m;
      (base === "sat" ? layers.current.sat : layers.current.osm).addTo(m);
    }).catch(() => {});
    return () => { gone = true; m?.remove(); map.current = null; layers.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);
  // Hartă / Satelit
  useEffect(() => {
    const m = map.current, l = layers.current;
    if (!m || !l) return;
    const on = base === "sat" ? l.sat : l.osm, off = base === "sat" ? l.osm : l.sat;
    if (m.hasLayer(off)) m.removeLayer(off);
    if (!m.hasLayer(on)) on.addTo(m);
    try { localStorage.setItem("insp-base", base); } catch {}
  }, [base]);
  // opened: movable and zoomable; closed: still again, back on the property
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    for (const h of [m.dragging, m.touchZoom, m.doubleClickZoom]) big ? h.enable() : h.disable();
    const t = setTimeout(() => { m.invalidateSize(); if (!big) m.setView([lat, lng], 16); }, 300);
    return () => clearTimeout(t);
  }, [big, lat, lng]);
  // the grip at the bottom of the opened map: the map follows the finger, a swipe up (> 60 px) or a tap closes it
  const box = useRef<HTMLDivElement>(null), drag = useRef<{ y: number; h: number; dy: number } | null>(null);
  const gripStart = (e: React.TouchEvent) => { e.stopPropagation(); drag.current = { y: e.touches[0].clientY, h: box.current?.offsetHeight ?? 0, dy: 0 }; if (box.current) box.current.style.transition = "none"; };
  const gripMove = (e: React.TouchEvent) => {
    const d = drag.current; if (!d || !box.current) return;
    d.dy = Math.min(0, e.touches[0].clientY - d.y);
    box.current.style.height = `${Math.max(150, d.h + d.dy)}px`;
  };
  const gripEnd = () => {
    const d = drag.current; drag.current = null;
    if (box.current) { box.current.style.transition = ""; box.current.style.height = ""; }
    if (d && d.dy < -60) setBig(false);
  };
  return (
    <div ref={box} className={`mbMini${big ? " big" : ""}`} onClick={big ? undefined : () => setBig(true)} role={big ? undefined : "button"} aria-label={big ? undefined : "Mărește harta"}>
      <div ref={el} className="mbMiniMap" />
      <span className="mbMiniBase" onClick={(e) => e.stopPropagation()}>
        <button type="button" aria-pressed={base === "map"} onClick={() => setBase("map")}>Hartă</button>
        <button type="button" aria-pressed={base === "sat"} onClick={() => setBase("sat")}>Satelit</button>
      </span>
      {!big && <span className="mbMiniBtn" aria-hidden="true">⤢ Mărește</span>}
      {onLocator && <button type="button" className={`mbMiniBtn loc${big ? " up" : ""}`} onClick={(e) => { e.stopPropagation(); onLocator(); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21.5s-6.5-6.1-6.5-11.2a6.5 6.5 0 0 1 13 0c0 5.1-6.5 11.2-6.5 11.2z" /><circle cx="12" cy="10.2" r="2.4" /></svg>Vezi în localizator</button>}
      {big && <button type="button" className="mbMiniGrip" aria-label="Restrânge harta (trage în sus)" onClick={(e) => { e.stopPropagation(); setBig(false); }}
        onTouchStart={gripStart} onTouchMove={gripMove} onTouchEnd={gripEnd} onTouchCancel={gripEnd}><i /></button>}
      {big && <button type="button" className="mbMiniBtn re" onClick={(e) => { e.stopPropagation(); map.current?.setView([lat, lng], 17); }}>Centrează</button>}
    </div>
  );
}

const DOC_KIND: Record<string, [string, string]> = { cf: ["CF", "Extras de carte funciară"], releveu: ["RLV", "Releveu"], doc: ["DOC", "Document"] };
const nfm = (n: number | null | undefined, d = 2) => (n == null ? "" : n.toLocaleString("ro-RO", { maximumFractionDigits: d }));

const inPlan = new Map<string, { key: string; nr: string } | null>(); // inspection → its parcel in the locator's plans (asked once)
function Detail({ x, draft, mine, onBack, onStart, onSchedule, onAnswer, onRadar, onLocator, editable, onEdit, onDelete }: { x: Insp; draft: Draft | null; mine: boolean; onRadar?: () => void; onLocator?: (t: { key: string; nr: string }) => void;
  editable: boolean; onEdit: () => void; onDelete: () => Promise<void>; onBack: () => void; onStart: () => void; onSchedule: (s: Sched) => void; onAnswer: (ok: boolean) => Promise<void> }) {
  const [answering, setAnswering] = useState(false);
  // „Vezi în localizator”: only with a cadastral number found in a plan of the locator
  const [plan, setPlan] = useState(() => inPlan.get(`${x.id}:${x.cad_nr}`) ?? null);
  useEffect(() => {
    const k = `${x.id}:${x.cad_nr}`;
    if (!onLocator || !x.cad_nr || inPlan.has(k)) return;
    const q = new URLSearchParams({ nr: x.cad_nr, uat: x.uat ?? "", ...(x.lat != null && x.lng != null ? { lat: String(x.lat), lng: String(x.lng) } : {}) });
    fetch(`/api/m/inplan?${q}`).then((r) => (r.ok ? (r.json() as Promise<{ found?: { key: string; nr: string } | null }>) : null)).then((j) => {
      if (!j) return; inPlan.set(k, j.found ?? null); setPlan(j.found ?? null);
    }).catch(() => {});
  }, [x.id, x.cad_nr, x.uat, x.lat, x.lng, onLocator]);
  const ask = mine && x.assign_state === "pending";
  const done = x.status === "gata" || x.status === "pred";
  const dest = x.lat != null ? `${x.lat},${x.lng}` : encodeURIComponent(x.address);
  const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
  const docs = x.files.filter((f) => f.kind !== "photo" && f.kind !== "signature");
  const photos = x.files.filter((f) => f.kind === "photo");
  // the date of the inspection = when the sheet was finished (also for one sent back to complete)
  const madeAt = done && x.finished_at ? x.finished_at : x.redo_note && x.redo_prev_at ? x.redo_prev_at : null;
  const qn = x.template.groups.reduce((t, g) => t + g.qs.length, 0);
  // everything known about the property, only what is filled in
  // what the firm's app knows about the property (make, model, VIN, rooms, floor…) comes right after its type
  const own = (x.facts ?? []).filter((f) => f.label !== "Tip bun").map((f): [string, string] => [f.label, f.value]);
  const kind = x.facts?.find((f) => f.label === "Tip bun")?.value;
  const facts: [string, string][] = ([
    ["Data inspecției", madeAt ? `${fmtDay(madeAt)}, ${fmtHour(madeAt)}` : ""],
    ["Tipul bunului", kind ? `${kind}${x.prop_type && !x.prop_type.toLowerCase().startsWith(kind.toLowerCase()) ? ` · ${x.prop_type}` : ""}` : x.prop_type ?? ""],
    ...own,
    ["Nr. cadastral", x.cad_nr ?? ""],
    ["Carte funciară", x.cf_nr ?? ""],
    ["Localitate (UAT)", x.uat ?? ""],
    ["Județ", x.county ?? ""],
    ["Suprafață utilă (acte)", x.area_util ? `${nfm(x.area_util)} mp` : ""],
    ["Teren (acte)", x.area_land ? `${nfm(x.area_land, 0)} mp` : ""],
    ["Pregătită de", x.owner_name ?? ""],
    ["O face", x.assignee_name ?? ""],
  ] as [string, string][]).filter(([, v]) => v);
  return (
    <>
      <header className="mbBar"><Back onClick={onBack} /><span><b>{x.code}</b><small>{x.template_name ?? "Fișa de inspecție"}{x.template_version ? ` · v${x.template_version}` : ""}</small></span></header>
      <div className="mbBody">
        <section className="mbHero">
          {x.lat != null && x.lng != null ? <MiniMap lat={x.lat} lng={x.lng} onLocator={plan && onLocator ? () => onLocator(plan) : undefined} />
            : <div className="mbMini none"><span>Poziția nu a fost găsită pe hartă</span></div>}
          <div className="mbHeroBody">
            <span className="mbHeroTags">
              <i style={{ color: STATUS[x.status].fg, background: STATUS[x.status].bg }}>{STATUS[x.status].label}</i>
              {x.prop_type && <i>{x.prop_type}</i>}
              {x.firm && <i className="firm">{x.firm}</i>}
            </span>
            <b>{x.address}</b>
            {(x.cad_nr || x.cf_nr) && <small>{[x.cad_nr && `nr. cad. ${x.cad_nr}`, x.cf_nr && `CF ${x.cf_nr}`].filter(Boolean).join(" · ")}</small>}
            <span className="mbGrid2">
              <a className="mbBtn" href={gmaps} target="_blank" rel="noopener">Google Maps</a>
              <a className="mbBtn" href={x.lat != null ? `https://waze.com/ul?ll=${x.lat},${x.lng}&navigate=yes` : `https://waze.com/ul?q=${dest}`} target="_blank" rel="noopener">Waze</a>
            </span>
          </div>
        </section>

        {done && <div className="mbOk">✓ Inspecție făcută{madeAt ? ` pe ${fmtDay(madeAt)} la ${fmtHour(madeAt)}` : ""}. Fișa se vede în UVALO, pe web.</div>}
        {!done && x.redo_note && (
          <div className="mbRedo">
            <b>Întoarsă pentru completări</b>
            {x.redo_prev_at && <small>Fișa a fost completată pe {fmtDay(x.redo_prev_at)} la ora {fmtHour(x.redo_prev_at)}.</small>}
            <span><em>Motivul:</em> {x.redo_note}</span>
            <small>Ce ai completat a rămas. {keptSig(x) ? `Semnătura lui ${x.signed_name} rămâne valabilă; nu mai trebuie semnat.` : "La final se semnează din nou."}</small>
          </div>
        )}

        {canSchedule(x) && (
          <section className="mbCard mbSched">
            <span className="mbSchedIco" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg></span>
            <span><small className="mbCap">PROGRAMARE</small><b>{x.scheduled_at ? fmtWhen(x.scheduled_at) : "Neprogramată"}</b>{x.scheduled_at && <small>{x.duration_min} min</small>}</span>
            <button type="button" className="mbBtn" onClick={() => onSchedule({ id: x.id, address: x.address, scheduled_at: x.scheduled_at, duration_min: x.duration_min })}>{x.scheduled_at ? "Reprogramează" : "Programează"}</button>
          </section>
        )}

        {/* Radar colegi (super-admins, test): the colleagues' inspections around this one, on its day */}
        {onRadar && mine && !done && !ask && x.lat != null && <RadarBanner scheduled={!!x.scheduled_at} onOpen={onRadar} />}

        {(x.ext_client || x.ext_user) && (
          <section className="mbCard">
            <small className="mbCap">LUCRAREA</small>
            <dl className="mbFacts">
              {x.ext_user && <div><dt>Utilizatorul raportului</dt><dd>{x.ext_user}</dd></div>}
              {x.ext_client && <div><dt>Client</dt><dd>{x.ext_client}</dd></div>}
            </dl>
          </section>
        )}

        {x.contact_name && (
          <section className="mbCard mbContact">
            <span className="mbAvImg" aria-hidden="true">{initials(x.contact_name)}</span>
            <span><small className="mbCap">{(x.contact_role ?? "Persoana de contact").toUpperCase()}</small><b>{x.contact_name}</b>{x.contact_phone && <small>{x.contact_phone}</small>}</span>
            {x.contact_phone && <span className="mbContactBtns">
              <a className="mbIconBtn dark" href={`tel:${firstPhone(x.contact_phone)}`} aria-label="Sună"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg></a>
              <a className="mbIconBtn" href={`sms:${firstPhone(x.contact_phone)}`} aria-label="SMS"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></a>
            </span>}
          </section>
        )}

        {facts.length > 0 && (
          <section className="mbCard">
            <small className="mbCap">PROPRIETATEA</small>
            <dl className="mbFacts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
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

        <section className="mbCard mbTplCard">
          <small className="mbCap">FIȘA</small>
          <span><b>{x.template_name ?? "Fișa de inspecție"}</b><small>{x.template.groups.length} secțiuni · {qn} întrebări</small></span>
          {/* the sheet is a record of the property: number and date given when it starts being filled in */}
          <span className={`mbSheetNo${x.sheet_no ? " on" : ""}`}>
            {x.sheet_no ? <><span><small>Nr. fișă</small><b>{x.sheet_no}</b></span><span><small>Data fișei</small><b>{fmtDay(x.sheet_at ?? x.started_at ?? "")}</b></span></>
              : draft?.started_at ? <small>Fișa a început pe telefon: numărul și data apar după prima sincronizare.</small>
              : <small>Numărul și data fișei se dau când începi completarea.</small>}
          </span>
        </section>
        {/* the inspections I added myself (not the ones received from a firm): edit while not finished, delete */}
        {editable && (
          <div className="mbOwnActs">
            {!done && <button type="button" className="mbBtn" onClick={onEdit}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></svg>Editează</button>}
            <button type="button" className="mbBtn danger" onClick={() => void onDelete()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>Șterge</button>
          </div>
        )}
      </div>
      {!!x.ro && <p className="mbNote">Asocierea cu {x.firm ?? "firma"} s-a încheiat: inspecția se poate doar citi.</p>}
      {ask && (
        <footer className="mbFoot">
          <p className="mbAskNote"><b>Solicitare de inspecție{x.firm ? ` de la ${x.firm}` : ""}</b><small>Acceptă ca să o primești în lucru. Dacă o refuzi, se întoarce la firmă.</small></p>
          <span className="mbGrid2">
            <button type="button" className="mbBtn big" disabled={answering} onClick={async () => { if (!confirm("Refuzi solicitarea? Inspecția se întoarce la firmă.")) return; setAnswering(true); await onAnswer(false); setAnswering(false); }}>Refuz</button>
            <button type="button" className="mbBtn gold big" disabled={answering} onClick={async () => { setAnswering(true); await onAnswer(true); setAnswering(false); }}>Accept</button>
          </span>
        </footer>
      )}
      {!done && mine && !ask && (
        <footer className="mbFoot">
          <button type="button" className="mbBtn gold big" onClick={onStart}>{x.redo_note ? "Modifică fișa →" : draft?.started_at ? "Continuă fișa →" : "Începe fișa →"}</button>
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

function QInput({ q, v, set, onPhoto, answers, setKey, thumbs = [] }: { q: Question; v: string | string[] | undefined; set: (v: string | string[]) => void; onPhoto: (f: File, room: string) => void;
  answers?: Record<string, string | string[]>; setKey?: (k: string, v: string | string[]) => void; thumbs?: string[] }) {
  const pickRef = useRef<HTMLInputElement>(null);
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
      {q.photo && (
        // one button: the phone offers the camera or the gallery; the photos of the question show small next to it
        <span className="mbQPh">
          <input ref={pickRef} type="file" accept="image/*" multiple hidden onChange={(e) => { for (const f of Array.from(e.target.files ?? [])) onPhoto(f, q.t); e.target.value = ""; }} />
          <button type="button" className="mbQPhBtn" aria-label={`Fotografie pentru „${q.t}”`} onClick={() => pickRef.current?.click()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            <b aria-hidden="true">+</b>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {thumbs.map((src) => <img key={src} src={src} alt="" className="mbQThumb" />)}
        </span>
      )}
    </div>
  );
}

function Form({ x, d, sec, photos, pending, onBack, onSec, change, onPhoto, onRooms, onPhotos, onSign }: {
  x: Insp; d: Draft; sec: number; photos: number; pending: QPhoto[]; onBack: () => void; onSec: (s: number) => void; change: (f: (d: Draft) => Draft) => void;
  onPhoto: (f: File, room: string) => void; onRooms: () => void; onPhotos: () => void; onSign: () => void;
}) {
  const groups = x.template.groups;
  // the photos of each question (sent ones from the server, the ones still on the phone from memory)
  const local = useMemo(() => pending.map((p) => ({ room: p.room, src: URL.createObjectURL(p.blob) })), [pending]);
  useEffect(() => () => local.forEach((p) => URL.revokeObjectURL(p.src)), [local]);
  // where the inspection is made: one GPS fix when the sheet is opened (the valuer can move the pin before signing)
  useEffect(() => {
    if (d.loc) return;
    void gpsFix().then((f) => { if (f) change((o) => { if (!o.loc) o.loc = f; return o; }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const thumbsOf = (room: string) => [...x.files.filter((f) => f.kind === "photo" && f.room === room).map((f) => `/api/inspectii/file/${f.id}`), ...local.filter((p) => p.room === room).map((p) => p.src)];
  // only the groups the sheet has (no "Constatări" step of its own: a sheet that wants findings has a group for them)
  const last = groups.length - 1;
  const all = groups.flatMap((g) => g.qs).filter((q) => !isOptional(q));
  const done = all.filter((q) => answered(d.answers[q.id])).length;
  const g = groups[sec];
  const roomsDone = d.rooms.filter(roomDone).length;
  // the next section opens only when this one's required questions (marked *) are answered; the others can stay empty
  const secReq = g ? g.qs.filter((q) => q.req) : [];
  const secLeft = secReq.filter((q) => !answered(d.answers[q.id])).length;
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
        </nav>
      </header>
      <div className="mbBody">
        {x.redo_note && <div className="mbRedo small"><b>De completat</b><span>{x.redo_note}</span></div>}
        {g && <>
          <h2 className="mbH2">{g.name}</h2>
          {g.qs.map((q) => <QInput key={q.id} q={q} v={d.answers[q.id]} onPhoto={onPhoto} answers={d.answers} thumbs={q.photo ? thumbsOf(q.t) : []}
            set={(v) => change((o) => { o.answers[q.id] = v; return o; })} setKey={(k, v) => change((o) => { o.answers[k] = v; return o; })} />)}
        </>}
      </div>
      <DocViewer docs={x.files.filter((f) => f.kind !== "photo" && f.kind !== "signature")} />
      <footer className="mbFoot">
        <Tiles d={d} photos={photos} kept={keptSig(x) ? x.signed_name! : null} rooms={!!x.template.rooms} onRooms={onRooms} onPhotos={onPhotos} onSign={onSign} />
        <span className="mbFootNav">
          <button type="button" className="mbBtn big" onClick={() => { if (sec > 0) { onSec(sec - 1); window.scrollTo(0, 0); } else onBack(); }} aria-label="Înapoi">←</button>
          {sec < last
            ? <button type="button" className="mbBtn gold big" disabled={secLeft > 0} onClick={() => { onSec(sec + 1); window.scrollTo(0, 0); }}>
                {secLeft ? `Mai ai ${secLeft} ${secLeft === 1 ? "întrebare obligatorie" : "întrebări obligatorii"}` : `Secțiunea următoare: ${groups[sec + 1].name} →`}
              </button>
            : <button type="button" className="mbBtn gold big" onClick={x.template.rooms ? onRooms : onPhotos}>{x.template.rooms ? "Mai departe: Finisaje încăperi →" : "Mai departe: Fotografii →"}</button>}
        </span>
      </footer>
    </>
  );
}

/** The three steps every inspection needs before it is sent: the rooms' finishes, the photos, the signature (green when done). */
function Tiles({ d, photos, kept, rooms, onRooms, onPhotos, onSign }: { d: Draft; photos: number; kept: string | null; rooms: boolean; onRooms: () => void; onPhotos: () => void; onSign: () => void }) {
  const done = d.rooms.filter(roomDone).length, roomsOk = done === d.rooms.length;
  const ico = (p: React.ReactNode) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p}</svg>;
  const tiles = [
    // the rooms' finishes only when the sheet asks for them (template option)
    ...(rooms ? [{ k: "rooms", ok: roomsOk, t: "Finisaje încăperi", s: d.rooms.length ? `${done} din ${d.rooms.length}` : "nu e cazul", go: onRooms,
      i: ico(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 12h9V3M12 12v9" /></>) }] : []),
    { k: "photos", ok: photos > 0, t: "Fotografii", s: photos ? `${photos} încărcate` : "niciuna", go: onPhotos,
      i: ico(<><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>) },
    { k: "sign", ok: !!d.sig || !!kept, t: "Semnătură", s: d.sig ? "semnată" : kept ? "păstrată" : "nesemnată", go: onSign,
      i: ico(<path d="M3 17c3-1 4-8 6-8s0 7 2 7 3-4 4-4 1 3 3 3h3M3 21h18" />) },
  ];
  return (
    <span className="mbTiles" style={{ gridTemplateColumns: `repeat(${tiles.length}, 1fr)` }}>
      {tiles.map((x) => (
        <button key={x.k} type="button" className={`mbTile${x.ok ? " ok" : ""}`} onClick={x.go}>
          <span className="mbTileIco">{x.ok ? ico(<path d="M5 12.5l4.5 4.5L19 7.5" />) : x.i}</span>
          <b>{x.t}</b><small>{x.s}</small>
        </button>
      ))}
    </span>
  );
}

/* ---------- rooms (from the floor plan) ---------- */

function Rooms({ x, d, change, onBack, onNext, onPhoto, onRlv }: {
  x: Insp; d: Draft; change: (f: (d: Draft) => Draft) => void; onBack: () => void; onNext: () => void; onPhoto: (f: File, room: string) => void;
  onRlv: (src: { fileId: string } | { file: File }) => Promise<Room[] | null>;
}) {
  const cam = useRef<HTMLInputElement>(null), rlvCam = useRef<HTMLInputElement>(null), rlvFile = useRef<HTMLInputElement>(null);
  const [for_, setFor] = useState("");
  const [sheet, setSheet] = useState(false);
  const [reading, setReading] = useState(false);
  const pick = (i: number, k: "floor" | "walls" | "ceiling" | "state", v: string) => change((o) => { o.rooms[i][k] = o.rooms[i][k] === v ? undefined : v; return o; });
  const rlvs = x.files.filter((f) => f.kind === "releveu");
  const done = d.rooms.filter(roomDone).length;
  // the rooms made so far are deleted and the survey's rooms take their place
  const read = async (src: { fileId: string } | { file: File }) => {
    setSheet(false);
    if (d.rooms.length && !confirm("Încăperile de acum se șterg și se creează cele din releveu. Continui?")) return;
    setReading(true);
    try {
      const rooms = await onRlv(src);
      if (rooms?.length) change((o) => { o.rooms = rooms.map((r) => ({ n: r.n, a: r.a })); return o; });
    } finally { setReading(false); }
  };
  const fileIn = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void read({ file: f }); };
  return (
    <>
      <header className="mbBar"><Back onClick={onBack} /><span><b>Finisaje încăperi · {done}/{d.rooms.length}</b><small>Toate încăperile, cu toate finisajele</small></span></header>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f, for_); e.target.value = ""; }} />
      <input ref={rlvCam} type="file" accept="image/*" capture="environment" hidden onChange={fileIn} />
      <input ref={rlvFile} type="file" accept="application/pdf,image/*" hidden onChange={fileIn} />
      <div className="mbBody">
        <button type="button" className="mbBtn dark mbRlvBtn" disabled={reading} onClick={() => setSheet(true)}>
          {reading ? <><span className="mbSpin small" />Se citește releveul…</> : <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 12h9V3M12 12v9" /></svg>
            Preia din RLV</>}
        </button>
        {reading && <small className="mbCenterSmall">Citirea cu AI durează până la un minut.</small>}
        {d.rooms.map((r, i) => (
          <section key={i} className={`mbCard${roomDone(r) ? " mbRoomOk" : ""}`}>
            <span className="mbRowBetween"><b>{roomDone(r) ? "✓ " : ""}{i + 1}. {r.n}</b>
              <span className="mbRowEnd">
                <span className="mbNum small"><input className="mbIn" inputMode="decimal" aria-label="Suprafața" value={r.a ?? ""} onChange={(e) => change((o) => { const v = parseFloat(e.target.value.replace(",", ".")); o.rooms[i].a = Number.isFinite(v) ? v : null; return o; })} /><em>mp</em></span>
                <button type="button" className="mbRoomDel" aria-label={`Șterge ${r.n}`} onClick={() => { if (confirm(`Ștergi încăperea „${r.n}”?`)) change((o) => { o.rooms.splice(i, 1); return o; }); }}>×</button>
              </span>
            </span>
            {(["floor", "walls", "ceiling", "state"] as const).map((k) => (
              <Fragment key={k}>
                <small className={`mbCap${r[k] ? "" : " need"}`}>{ROOM_FIELDS[k].label.toUpperCase()}{r[k] ? "" : " · obligatoriu"}</small>
                <span className="mbOpts">{ROOM_FIELDS[k].opts.map((o) => <button key={o} type="button" aria-pressed={r[k] === o} onClick={() => pick(i, k, o)}>{o}</button>)}</span>
              </Fragment>
            ))}
            <button type="button" className="mbLink" onClick={() => { setFor(r.n); cam.current?.click(); }}>+ Fotografie {r.n}</button>
          </section>
        ))}
        <button type="button" className="mbBtn" onClick={() => { const n = prompt("Numele încăperii"); if (n?.trim()) change((o) => { o.rooms.push({ n: n.trim(), a: null }); return o; }); }}>+ Încăpere</button>
      </div>
      <DocViewer docs={x.files.filter((f) => f.kind !== "photo" && f.kind !== "signature")} />
      <footer className="mbFoot"><button type="button" className="mbBtn gold big" onClick={onNext}>Mai departe: Fotografii →</button></footer>
      {sheet && (
        <div className="mbSheetBg" onClick={() => setSheet(false)}>
          <div className="mbSheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Preia din RLV">
            <b>Preia încăperile din releveu</b>
            <small>Releveul se citește cu AI; încăperile de acum se înlocuiesc cu cele din releveu.</small>
            {rlvs.map((f) => <button key={f.id} type="button" className="mbBtn gold" onClick={() => void read({ fileId: f.id })}>Citește releveul atașat{f.name ? ` · ${f.name}` : ""}</button>)}
            <span className="mbGrid2">
              <button type="button" className={`mbBtn${rlvs.length ? "" : " gold"}`} onClick={() => rlvCam.current?.click()}>Fotografiază releveul</button>
              <button type="button" className="mbBtn" onClick={() => rlvFile.current?.click()}>Alege fișier</button>
            </span>
            <button type="button" className="mbLink" onClick={() => setSheet(false)}>Renunță</button>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- photos ---------- */

type DragPh = { id: string; local: boolean; src: string; from: string; x: number; y: number; over: string | null };

function Photos({ x, d, pending, onBack, onNext, onPhotos, onDelete, onMove }: {
  x: Insp; d: Draft; pending: QPhoto[]; onBack: () => void; onNext: () => void; onPhotos: (f: File[], room: string, gallery: boolean) => Promise<void>;
  onDelete: (id: string, local: boolean) => void; onMove: (id: string, local: boolean, room: string) => Promise<void>;
}) {
  const cats = useMemo(() => {
    const c = photoCategories(x.prop_type, x.template.photos);
    // the standard rooms keep their own name (Bucătărie is already a category); the survey's rooms get their number
    const before = d.rooms.some((r) => r.std) ? c.before.filter((n) => n !== "Baie") : c.before; // "Băi (spații umede)" takes its place
    return [...new Set([...before, ...d.rooms.map((r, i) => (r.std ? r.n : `${r.n} · rlv ${i + 1}`)), ...c.after])];
  }, [d.rooms, x.prop_type, x.template.photos]);
  const [room, setRoom] = useState(cats[0]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState<DragPh | null>(null);
  // the photos being prepared / sent (the upload bar's events)
  const [up, setUp] = useState<UploadProgress | null>(null);
  useEffect(() => {
    const on = (e: Event) => setUp((e as CustomEvent<UploadProgress>).detail ?? null);
    window.addEventListener("insp-upload", on);
    return () => window.removeEventListener("insp-upload", on);
  }, []);
  const cam = useRef<HTMLInputElement>(null), gal = useRef<HTMLInputElement>(null);
  const target = useRef(room); // the category the open picker adds to
  useEffect(() => { target.current = room; }, [room]);
  const sent = x.files.filter((f) => f.kind === "photo");
  // one preview URL per photo, kept while the photo is on the phone (re-creating them all on every upload reloads every thumbnail)
  const urlCache = useRef(new Map<string, string>());
  const urls = useMemo(() => {
    const c = urlCache.current, live = new Set(pending.map((p) => p.id));
    for (const [id, u] of c) if (!live.has(id)) { URL.revokeObjectURL(u); c.delete(id); }
    for (const p of pending) if (!c.has(p.id)) c.set(p.id, URL.createObjectURL(p.blob));
    return new Map(c);
  }, [pending]);
  useEffect(() => () => { urlCache.current.forEach((u) => URL.revokeObjectURL(u)); urlCache.current.clear(); }, []);
  // while dragging every category is shown, so a photo can go to an empty one too
  const groups = cats.map((c) => ({ c, sent: sent.filter((f) => f.room === c), local: pending.filter((p) => p.room === c) }))
    .filter((g) => drag || g.sent.length || g.local.length || g.c === room);
  const pick = (input: HTMLInputElement | null, c: string) => { target.current = c; setRoom(c); input?.click(); };
  const take = async (e: React.ChangeEvent<HTMLInputElement>, gallery: boolean) => {
    const input = e.target, r = target.current;
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
      await onPhotos(files, r, gallery);
    } finally { input.value = ""; setBusy(false); }
  };

  // drag a photo to another category: hold it (0,35 s), then move the finger over the category and let go
  const press = useRef<{ t: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const dragRef = useRef<DragPh | null>(null);
  const startPress = (e: React.TouchEvent, id: string, local: boolean, src: string, from: string) => {
    const t0 = e.touches[0];
    const sx = t0.clientX, sy = t0.clientY;
    if (press.current) clearTimeout(press.current.t);
    press.current = { x: sx, y: sy, t: setTimeout(() => {
      press.current = null;
      const dr: DragPh = { id, local, src, from, x: sx, y: sy, over: from };
      dragRef.current = dr; setDrag(dr);
      try { navigator.vibrate?.(15); } catch {}
      const move = (ev: TouchEvent) => {
        ev.preventDefault();
        const p = ev.touches[0];
        const el = document.elementFromPoint(p.clientX, p.clientY)?.closest("[data-cat]");
        const over = el?.getAttribute("data-cat") ?? null;
        dragRef.current = { ...dragRef.current!, x: p.clientX, y: p.clientY, over };
        setDrag(dragRef.current);
        if (p.clientY < 110) window.scrollBy(0, -14);
        else if (p.clientY > window.innerHeight - 190) window.scrollBy(0, 14);
      };
      const end = () => {
        window.removeEventListener("touchmove", move); window.removeEventListener("touchend", end); window.removeEventListener("touchcancel", end);
        const dd = dragRef.current;
        dragRef.current = null; setDrag(null);
        if (dd?.over && dd.over !== dd.from) { setRoom(dd.over); void onMove(dd.id, dd.local, dd.over); }
      };
      window.addEventListener("touchmove", move, { passive: false });
      window.addEventListener("touchend", end); window.addEventListener("touchcancel", end);
    }, 350) };
  };
  const movePress = (e: React.TouchEvent) => {
    const p = press.current, t0 = e.touches[0];
    if (p && Math.hypot(t0.clientX - p.x, t0.clientY - p.y) > 10) { clearTimeout(p.t); press.current = null; } // a scroll, not a hold
  };
  const endPress = () => { if (press.current) { clearTimeout(press.current.t); press.current = null; } };
  const holdProps = (id: string, local: boolean, src: string, from: string) => ({
    onTouchStart: (e: React.TouchEvent) => startPress(e, id, local, src, from), onTouchMove: movePress, onTouchEnd: endPress, onTouchCancel: endPress,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <>
      <header className="mbBar mbPhBar"><Back onClick={onBack} /><span><b>Fotografii · {sent.length + pending.length}</b><small>{drag ? "Lasă fotografia peste categoria dorită" : `${sent.length} trimise${pending.length ? ` · ${pending.length} pe telefon` : ""} · ține apăsat o poză ca s-o muți`}</small></span></header>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => take(e, false)} />
      <input ref={gal} type="file" accept="image/*" multiple hidden onChange={(e) => take(e, true)} />
      <div className={`mbBody${drag ? " mbDragging" : ""}`}>
        {groups.map((g) => (
          // the whole group is selectable: a tap anywhere on it (photos too; a hold moves the photo) makes it the one new photos go to
          <section key={g.c} data-cat={g.c} className={`mbPhGroup${g.c === room ? " on" : ""}${drag?.over === g.c && drag.over !== drag.from ? " drop" : ""}`}
            onClick={(e) => { if (!(e.target as HTMLElement).closest("button")) setRoom(g.c); }}>
            <span className="mbPhHead">
              <button type="button" className="mbPhTitle" onClick={() => setRoom(g.c)} aria-pressed={g.c === room}>
                <i className="mbPhRadio" aria-hidden="true" />
                <b>{g.c}</b><small>{g.c === room ? "aici merg pozele noi · " : ""}{g.sent.length + g.local.length} foto</small>
              </button>
              <span className="mbPhAdd">
                <button type="button" aria-label={`Fotografiază pentru ${g.c}`} onClick={() => pick(cam.current, g.c)}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                </button>
                <button type="button" aria-label={`Alege din galerie pentru ${g.c}`} onClick={() => pick(gal.current, g.c)}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></svg>
                </button>
              </span>
            </span>
            {(g.sent.length > 0 || g.local.length > 0) ? (
              <span className="mbPhGrid">
                {g.sent.map((f) => {
                  const src = `/api/inspectii/file/${f.id}`;
                  return (
                    <span key={f.id} className={`mbPhItem${drag?.id === f.id ? " lifted" : ""}`} {...holdProps(f.id, false, src, g.c)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={g.c} loading="lazy" decoding="async" draggable={false} />
                      <button type="button" className="mbPhDel" aria-label="Șterge fotografia" onClick={() => onDelete(f.id, false)}>×</button>
                    </span>
                  );
                })}
                {g.local.map((p) => (
                  <span key={p.id} className={`mbPhItem mbPhLocal${drag?.id === p.id ? " lifted" : ""}`} {...holdProps(p.id, true, urls.get(p.id) ?? "", g.c)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={urls.get(p.id)} alt={g.c} decoding="async" draggable={false} /><em>PE TELEFON</em>
                    <button type="button" className="mbPhDel" aria-label="Șterge fotografia" onClick={() => onDelete(p.id, true)}>×</button>
                  </span>
                ))}
              </span>
            ) : <span className="mbPhEmpty">{drag ? "Lasă aici" : "Nicio fotografie încă"}</span>}
          </section>
        ))}
      </div>
      {drag && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="mbPhGhost" src={drag.src} alt="" style={{ left: drag.x, top: drag.y }} />
      )}
      <footer className="mbFoot">
        <label className="mbField">Pozele noi merg la<select className="mbIn" value={room} onChange={(e) => {
          const c = e.target.value; setRoom(c);
          // the chosen group shows up (even empty) — bring it into view
          setTimeout(() => document.querySelector(`[data-cat="${CSS.escape(c)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
        }}>{cats.map((c) => <option key={c}>{c}</option>)}</select></label>
        <span className="mbGrid2 mbPhBtns">
          <button type="button" className="mbBtn gold" disabled={busy} onClick={() => pick(cam.current, room)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>Fotografiază
          </button>
          <button type="button" className="mbBtn dark" disabled={busy} onClick={() => pick(gal.current, room)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></svg>Din galerie
          </button>
        </span>
        {/* done only once the photos are prepared and sent (offline they wait on the phone and the buttons work) */}
        {(busy || up) && <small className="mbCenterSmall">{busy || up?.phase === "prep" ? "Se pregătesc fotografiile…" : `Se încarcă fotografiile${up?.total ? ` · ${up.done}/${up.total}` : ""}…`}</small>}
        <button type="button" className="mbBtn gold big mbNextStep" disabled={busy || !!up} onClick={onNext}>Mai departe: Semnătură →</button>
      </footer>
    </>
  );
}

/* ---------- signature and sending ---------- */

function Sign({ x, d, photos, change, onBack, onFinish, onRooms, onPhotos }: {
  x: Insp; d: Draft; photos: number; change: (f: (d: Draft) => Draft) => void; onBack: () => void; onFinish: (name: string, sig: Blob | null) => Promise<void>;
  onRooms: () => void; onPhotos: () => void;
}) {
  const cv = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false), inked = useRef(!!d.sig);
  const [has, setHas] = useState(!!d.sig);
  const [who, setWho] = useState<"contact" | "other">(d.signer?.who ?? (x.contact_name ? "contact" : "other"));
  const [other, setOther] = useState(d.signer?.other ?? "");
  const [busy, setBusy] = useState(false);
  // sent back with the saved signature kept: it is enough to send again (a new signature can still be taken)
  const [resign, setResign] = useState(false);
  const useKept = keptSig(x) && !resign;
  const all = x.template.groups.flatMap((g) => g.qs).filter((q) => !isOptional(q));
  const req = all.filter((q) => q.req), missing = req.filter((q) => !answered(d.answers[q.id]));
  useEffect(() => {
    if (useKept) return; // the pad is hidden; it is set up when a new signature is asked for
    const c = cv.current!; const r = c.getBoundingClientRect(), k = window.devicePixelRatio || 1;
    c.width = r.width * k; c.height = r.height * k;
    const g = c.getContext("2d")!; g.scale(k, k); g.lineWidth = 2.6; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#141414";
    // a signature given earlier is drawn back (it is kept while the rest of the sheet is completed)
    if (d.sig) { const im = new Image(); im.onload = () => g.drawImage(im, 0, 0, r.width, r.height); im.src = d.sig; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useKept]);
  const keep = (sig: string | null, w = who, o = other) => change((dd) => { dd.sig = sig; dd.signer = { who: w, other: o }; return dd; });
  const roomsLeft = x.template.rooms ? d.rooms.filter((r) => !roomDone(r)).length : 0;
  const pt = (e: React.PointerEvent) => { const r = cv.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  const name = who === "contact" ? x.contact_name ?? "" : other.trim();
  return (
    <>
      <header className="mbBar"><Back onClick={onBack} /><span><b>Încheie inspecția</b><small>{useKept ? "Verifică și trimite din nou" : "Verifică, semnează, trimite"}</small></span></header>
      <div className="mbBody">
        <section className="mbCard mbSum">
          <span><span>Fișa</span><b className={missing.length ? "warn" : "ok"}>{missing.length ? `lipsesc ${missing.length} obligatorii` : `✓ ${all.filter((q) => answered(d.answers[q.id])).length}/${all.length}`}</b></span>
          {!!x.template.rooms && <button type="button" onClick={onRooms}><span>Finisaje încăperi</span><b className={roomsLeft ? "warn" : "ok"}>{roomsLeft ? `lipsesc la ${roomsLeft} ›` : `✓ ${d.rooms.length}`}</b></button>}
          <button type="button" onClick={onPhotos}><span>Fotografii</span><b className={photos ? "ok" : "warn"}>{photos ? `✓ ${photos} încărcate` : "niciuna ›"}</b></button>
        </section>
        {missing.length > 0 && <p className="mbNote">Lipsesc: {missing.slice(0, 4).map((q) => q.t).join(", ")}{missing.length > 4 ? "…" : ""}. Poți trimite și așa.</p>}
        <LocPick loc={d.loc ?? null} addr={x.lat != null && x.lng != null ? [x.lat, x.lng] : null} onChange={(l) => change((o) => { o.loc = l; return o; })} />
        {useKept && (
          <section className="mbCard mbKept">
            <b>✓ Semnătura salvată rămâne</b>
            <span>{x.signed_name}{x.signed_at ? ` · semnat pe ${fmtDay(x.signed_at)} la ${fmtHour(x.signed_at)}` : ""}. Nu trebuie semnat din nou.</span>
            <button type="button" className="mbLink" onClick={() => setResign(true)}>Ia totuși o semnătură nouă</button>
          </section>
        )}
        <div style={useKept ? { display: "none" } : { display: "contents" }}>
        <small className="mbCap">CINE A FOST PREZENT</small>
        <span className="mbOpts">
          {x.contact_name && <button type="button" aria-pressed={who === "contact"} onClick={() => { setWho("contact"); keep(d.sig ?? null, "contact"); }}>{x.contact_name}{x.contact_role ? ` · ${x.contact_role.toLowerCase()}` : ""}</button>}
          <button type="button" aria-pressed={who === "other"} onClick={() => { setWho("other"); keep(d.sig ?? null, "other"); }}>Altcineva</button>
        </span>
        {who === "other" && <input className="mbIn" placeholder="Numele persoanei prezente" value={other} onChange={(e) => { setOther(e.target.value); keep(d.sig ?? null, who, e.target.value); }} />}
        <span className="mbRowBetween"><small className="mbCap">SEMNĂTURA PERSOANEI PREZENTE</small><button type="button" className="mbLink" onClick={() => { const c = cv.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setHas(false); inked.current = false; keep(null); }}>Șterge</button></span>
        <canvas ref={cv} className="mbSig" aria-label="Semnează aici cu degetul"
          onPointerDown={(e) => { drawing.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); const [a, b] = pt(e); const g = cv.current!.getContext("2d")!; g.beginPath(); g.moveTo(a, b); }}
          onPointerMove={(e) => { if (!drawing.current) return; const [a, b] = pt(e); const g = cv.current!.getContext("2d")!; g.lineTo(a, b); g.stroke(); inked.current = true; setHas(true); }}
          onPointerUp={() => { if (drawing.current && inked.current) keep(cv.current!.toDataURL("image/png")); drawing.current = false; }} />
        {has && <small className="mbSigOk">✓ Semnătura e salvată pe telefon; poți completa în continuare fișa.</small>}
        </div>
        <section className="mbDark"><b>După trimitere</b><span>Fișa, fotografiile pe încăperi și semnătura apar în UVALO, pe web, la inspecție: de acolo descarci PDF-ul și trimiți anexa foto în Word.</span></section>
      </div>
      <footer className="mbFoot">
        <button type="button" className="mbBtn gold big" disabled={busy || roomsLeft > 0 || !photos || (!useKept && (!name || !has))} onClick={async () => {
          setBusy(true);
          const blob = useKept ? null : await new Promise<Blob | null>((res) => cv.current!.toBlob(res, "image/png"));
          change((o) => o);
          await onFinish(useKept ? x.signed_name! : name, blob);
          setBusy(false);
        }}>Finalizează și trimite</button>
        <small className="mbCenterSmall">{roomsLeft ? "Completează finisajele tuturor încăperilor." : !photos ? "Adaugă cel puțin o fotografie." : useKept ? "Se trimite cu semnătura salvată." : !name ? "Alege cine a fost prezent." : !has ? "Cere semnătura în chenar." : "Fără semnal? Se trimite singură când revine rețeaua."}</small>
      </footer>
    </>
  );
}

/* ---------- queue and account ---------- */

/** "Colaborări": coming soon (announcements and requests from other valuers will come here). */
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

/** „+ Inspecție nouă”, and the same form for „Editează” on an inspection I added myself (`edit`): who does it stays, the sheet changes only
 *  while it is not started. */
function NewInsp({ tpls, firms, online, pos, onBack, onDone, edit }: { tpls: Tpl[]; firms: { id: string; name: string }[]; online: boolean; pos: React.RefObject<[number, number] | null>; onBack: () => void; onDone: (id: string, now: boolean) => Promise<void>; edit?: Insp }) {
  const [f, setF] = useState(() => ({ address: edit?.address ?? "", prop_type: edit?.prop_type ?? "", template_id: edit?.template_id ?? "", cad_nr: edit?.cad_nr ?? "", cf_nr: edit?.cf_nr ?? "",
    contact_name: edit?.contact_name ?? "", contact_phone: edit?.contact_phone ?? "", contact_role: edit?.contact_role ?? "", notes: edit?.notes ?? "" }));
  const [ll, setLl] = useState<[number, number] | null>(null);
  // now = I am there (opens the sheet); later = a date and time now; unsched = scheduled afterwards (status „De programat”)
  const [when, setWhen] = useState<"now" | "later" | "unsched">(edit ? (edit.scheduled_at ? "later" : "unsched") : "now");
  const [forOrg, setForOrg] = useState(""); // "" = my own account; otherwise an office I work for as angajat
  const [at, setAt] = useState(edit?.scheduled_at?.slice(0, 16) ?? "");
  // on the colleagues' radar: Da / Nu / Doar colaboratori
  const [radar, setRadar] = useState<"yes" | "no" | "collab">(edit?.radar ?? "yes");
  // the sheet cannot change once someone started filling it in (it keeps the answers)
  const tplLocked = !!edit && (!!edit.sheet_no || !!edit.started_at || edit.status === "lucru");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: keyof typeof f, v: string) => setF((o) => ({ ...o, [k]: v }));
  // as on the web: first the property type (only the types that have a sheet), then only the sheets of that type (plus the ones for any property)
  const types = typesOf(tpls.map((t) => t.prop_type));
  const forType = (ty: string) => (ty ? tpls.filter((t) => t.prop_type === ty || !t.prop_type) : []);
  const shownTpls = forType(f.prop_type);
  const pickType = (t: string) => setF((o) => {
    const list = forType(t);
    return { ...o, prop_type: t, template_id: list.some((x) => x.id === o.template_id) ? o.template_id : list[0]?.id ?? "" };
  });
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
    const scheduled_at = when === "now" ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` : when === "later" ? at : "";
    try {
      const r = await fetch(edit ? "/api/m/edit" : "/api/m/new", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, ...(edit ? { id: edit.id } : {}), scheduled_at, radar, for_org: forOrg, lat: ll?.[0] ?? null, lng: ll?.[1] ?? null }) });
      const j = await J(r);
      if (!r.ok) throw new Error(String(j.error || "Nu a mers."));
      await onDone(String(j.id), when === "now");
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <>
      <header className="mbBar"><Back onClick={onBack} /><span><b>{edit ? `Editează ${edit.code}` : "Inspecție nouă"}</b><small>{edit ? "Cine o face rămâne același" : "O faci tu; restul se completează și pe web"}</small></span></header>
      <div className="mbBody">
        {!online && <p className="mbNote">Fără semnal nu se poate crea o inspecție nouă. Încearcă din nou când ai rețea.</p>}
        {!edit && firms.length > 0 && <>
          <small className="mbCap">PENTRU</small>
          <span className="mbOpts">
            <button type="button" aria-pressed={!forOrg} onClick={() => setForOrg("")}>Contul meu</button>
            {firms.map((o) => <button key={o.id} type="button" aria-pressed={forOrg === o.id} onClick={() => setForOrg(o.id)}>{o.name}</button>)}
          </span>
          <small className="mbCenterSmall" style={{ textAlign: "left" }}>{forOrg ? "Inspecția e a firmei: o vede biroul și intră în lucrările lui." : "Inspecția e a ta: firma nu o vede."}</small>
        </>}
        <button type="button" className="mbStart" onClick={here}><b>📍 Sunt la proprietate</b><small>{ll ? `locație preluată · ${ll[0].toFixed(5)}, ${ll[1].toFixed(5)}` : "preia adresa după locația telefonului"}</small></button>
        <label className="mbField">Adresa bunului<textarea className="mbIn" rows={2} value={f.address} onChange={(e) => { set("address", e.target.value); setLl(null); }} placeholder="Str., nr., localitate, județ" /></label>
        <small className="mbCap">TIPUL BUNULUI</small>
        <span className="mbOpts">{types.map((t) => <button key={t} type="button" aria-pressed={f.prop_type === t} disabled={tplLocked && f.prop_type !== t} onClick={() => pickType(t)}>{t}</button>)}</span>
        <small className="mbCap">FIȘA DE INSPECȚIE</small>
        {!f.prop_type ? <p className="mbTplHint">Alege tipul bunului ca să vezi fișele lui.</p> : (
          <span className="mbTplPick" role="radiogroup" aria-label="Fișa de inspecție">
            {shownTpls.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={f.template_id === t.id} disabled={tplLocked && f.template_id !== t.id} onClick={() => set("template_id", t.id)}>
                <i aria-hidden="true" /><span><b>{t.name}</b><small>{t.prop_type ? t.prop_type : "pentru orice imobil"}</small></span>
              </button>
            ))}
          </span>
        )}
        {tplLocked && <small className="mbCenterSmall" style={{ textAlign: "left" }}>Fișa a început să fie completată: tipul bunului și fișa nu se mai schimbă.</small>}
        <span className="mbGrid2">
          <label className="mbField"><span>Nr. cadastral <small className="mbFieldHint">(util pentru localizatorul cadastral)</small></span><input className="mbIn" inputMode="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false} value={f.cad_nr} onChange={(e) => set("cad_nr", e.target.value)} /></label>
          <label className="mbField">Carte funciară<input className="mbIn" autoCapitalize="characters" autoCorrect="off" spellCheck={false} value={f.cf_nr} onChange={(e) => set("cf_nr", e.target.value)} /></label>
        </span>
        <small className="mbCap">PERSOANA DE CONTACT</small>
        <input className="mbIn" placeholder="Nume" autoCapitalize="words" autoComplete="off" value={f.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
        <input className="mbIn" placeholder="Telefon" type="tel" inputMode="tel" autoComplete="off" value={f.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
        <span className="mbOpts">{CONTACT_ROLES.map((t) => <button key={t} type="button" aria-pressed={f.contact_role === t} onClick={() => set("contact_role", f.contact_role === t ? "" : t)}>{t}</button>)}</span>
        <small className="mbCap">CÂND</small>
        <span className="mbOpts">
          {!edit && <button type="button" aria-pressed={when === "now"} onClick={() => setWhen("now")}>Acum, sunt acolo</button>}
          <button type="button" aria-pressed={when === "later"} onClick={() => setWhen("later")}>O programez acum</button>
          <button type="button" aria-pressed={when === "unsched"} onClick={() => setWhen("unsched")}>Programez ulterior</button>
        </span>
        {when === "later" && <input className="mbIn" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />}
        {when === "unsched" && <small className="mbCenterSmall" style={{ textAlign: "left" }}>Se adaugă cu starea „De programat”; alegi ziua și ora mai târziu, din detaliul inspecției sau din calendar.</small>}
        <label className="mbField">Note<textarea className="mbIn" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></label>
        <small className="mbCap">VIZIBIL ÎN RADAR</small>
        <span className="mbOpts" role="radiogroup" aria-label="Vizibil în radarul colegilor">
          <button type="button" role="radio" aria-checked={radar === "no"} aria-pressed={radar === "no"} onClick={() => setRadar("no")}>Nu</button>
          <button type="button" role="radio" aria-checked={radar === "yes"} aria-pressed={radar === "yes"} onClick={() => setRadar("yes")}>Da</button>
          <button type="button" role="radio" aria-checked={radar === "collab"} aria-pressed={radar === "collab"} onClick={() => setRadar("collab")}>Doar colaboratori</button>
        </span>
        <small className="mbCenterSmall" style={{ textAlign: "left" }}>{radar === "no" ? "Colegii nu văd inspecția pe radar." : radar === "collab" ? "Doar colaboratorii tăi o văd pe radar (ora și zona, nu adresa)." : "Colegii din jur văd pe radar ora și zona inspecției, nu adresa."}</small>
        {msg && <p className="mbErr" role="alert">{msg}</p>}
      </div>
      <footer className="mbFoot">
        <button type="button" className="mbBtn gold big" disabled={busy || !online || f.address.trim().length < 5 || !f.prop_type || !f.template_id || (when === "later" && !at)} onClick={save}>
          {edit ? "Salvează modificările" : when === "now" ? "Creează și începe fișa" : when === "unsched" ? "Adaugă (de programat)" : "Adaugă inspecția"}
        </button>
        <small className="mbCenterSmall">{f.address.trim().length < 5 ? "Scrie adresa sau apasă „Sunt la proprietate”." : !f.prop_type ? "Alege tipul bunului și fișa." : "Actele (CF, releveu) le poți adăuga apoi pe web."}</small>
      </footer>
    </>
  );
}

/* ---------- account: profile, activity, this phone, sending, security ---------- */

type Perm = "granted" | "denied" | "prompt" | "unknown";

function Account({ onBack, me, info, done, onOpen, queueN, online, onSend, say }: { onBack: () => void; me: Me | null; info: Info | null; done: InspRow[]; onOpen: (id: string) => void; queueN: number; online: boolean; onSend: () => Promise<void>; say: (m: string) => void }) {
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
      <header className="mbBar"><Back onClick={onBack} /><span><b>Contul meu</b><small>Profilul, telefonul acesta, sincronizarea</small></span></header>
      <div className="mbBody">
        <section className="mbCard">
          <span className="mbMe"><Avatar me={me} big /><span><b>{me?.name}</b><small>{me?.email}</small></span></span>
          {me?.anevar_no && <span className="mbKv"><span>Legitimație ANEVAR</span><b>{me.anevar_no}</b></span>}
          {me?.county && <span className="mbKv"><span>Județ</span><b>{me.county}</b></span>}
          {me?.org && <span className="mbKv mbOrg"><span>Birou</span><b>{me.org.logo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/api/org/logo/${me.org.id}`} alt="" />}{me.org.name}</b></span>}
        </section>

        {me && <SigCard key={me.id} hasSig={!!me.has_sig} say={say} />}

        <small className="mbCap">ACTIVITATE</small>
        <div className="mbStats flat">
          <span><b>{s?.month ?? 0}</b><small>luna asta</small></span>
          <span><b>{s?.total ?? 0}</b><small>în total</small></span>
          <span><b>{s?.avg_min != null ? `${s.avg_min}′` : "—"}</b><small>timp mediu</small></span>
          <span><b>{s?.photos ?? 0}</b><small>fotografii</small></span>
        </div>
        {s?.last && <small>Ultima inspecție trimisă: {fmtD(s.last, true)}</small>}

        <small className="mbCap">INSPECȚII FINALIZATE · {done.length}</small>
        {done.length ? <span className="mbList flat">{[...done].sort((a, b) => (whenOf(b) ?? "").localeCompare(whenOf(a) ?? "")).map((i) => <ItemRow key={i.id} i={i} today={ymd(new Date())} onOpen={onOpen} />)}</span>
          : <small>Nicio inspecție finalizată în ultimele 90 de zile.</small>}

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
        <button type="button" className="mbBtn" disabled={busy} onClick={async () => { if (!confirm("Ieși din cont pe acest telefon? Telefonul rămâne conectat la cont.")) return; await fetch("/api/auth/logout", { method: "POST" }); try { localStorage.removeItem("insp-state"); } catch {} location.reload(); }}>Ieși din cont</button>
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
