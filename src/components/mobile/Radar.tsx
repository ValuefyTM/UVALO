"use client";
// Phone app → "Radar colegi" (first phase: super-admins only, from the banner on the home screen). A full-screen radar: the gold
// beam sweeps, the colleagues' inspections scheduled on the chosen day within the chosen radius light up as it passes over them
// (real bearing and distance from the phone), the list of them in the sheet below, and a colleague's screen with the two
// inspections side by side, a proposed message, Sună / Mesaj. The API gives the zone and a position rounded to ~100 m, never the
// exact address.
import { useCallback, useEffect, useRef, useState } from "react";

type Found = { id: string; user_id: string; name: string; email: string; phone: string | null; legit: string | null; avatar: boolean; org: string | null;
  prop_type: string | null; zone: string; when: string; duration_min: number; lat: number; lng: number; dist_m: number };
type Mine = { id: string; address: string; scheduled_at: string; lat: number; lng: number };
type Res = { day: string; km: number; found: Found[]; mine: Mine[] };

const KMS = [5, 10, 25] as const;
const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const hhmm = (w: string) => w.slice(11, 16);
const fmtKm = (m: number) => (m < 950 ? `${Math.round(m / 50) * 50} m` : `${(m / 1000).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} km`);
const distM = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * 111320, (a[1] - b[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180));
const ymdLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** the phone's own number, digits and + only, for tel: / sms: / WhatsApp */
const digits = (p: string | null) => (p ?? "").replace(/[^\d+]/g, "");
const waNumber = (p: string | null) => { const d = digits(p).replace(/^\+/, ""); return d.startsWith("0") ? `40${d.slice(1)}` : d; };

const PHONE = <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>;
const CHAT = <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z" /></svg>;

export function Radar({ pos, myName, onBack }: { pos: React.RefObject<[number, number] | null>; myName: string; onBack: () => void }) {
  const [km, setKm] = useState<(typeof KMS)[number]>(10);
  const [day, setDay] = useState<"today" | "tomorrow">("today");
  const [here, setHere] = useState<[number, number] | null>(pos.current);
  const [res, setRes] = useState<Res | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState<Found | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dayStr = day === "today" ? ymdLocal(new Date()) : ymdLocal(new Date(Date.now() + 864e5));

  // the phone's position: what the app already has, else one fix now
  useEffect(() => {
    if (here || !("geolocation" in navigator)) { if (!here) setErr("Telefonul nu are locație. Pornește locația ca radarul să știe unde ești."); return; }
    navigator.geolocation.getCurrentPosition((p) => setHere([p.coords.latitude, p.coords.longitude]), () => setErr("Nu am primit poziția telefonului. Verifică permisiunea de locație."), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }, [here]);

  const scan = useCallback(async () => {
    if (!here) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/m/radar?lat=${here[0]}&lng=${here[1]}&km=${km}&day=${dayStr}`);
      const d = (await r.json().catch(() => ({}))) as Res & { error?: string };
      if (!r.ok) throw new Error(d.error || "Radarul nu a putut scana.");
      setRes(d);
    } catch (e) { setErr(e instanceof Error ? e.message : "Fără semnal. Încearcă din nou."); }
    finally { setBusy(false); }
  }, [here, km, dayStr]);
  // scan at open and at every change, then every minute while the screen is open
  useEffect(() => { void scan(); }, [scan]);
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => { void scan(); }, 60000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [scan]);

  const found = res?.found ?? [];
  // the blips: bearing and distance from the phone → position on the 350-px disc (the ring of `km` is the edge)
  const R = 175, scale = R / (km * 1000);
  const blip = (f: Found) => {
    if (!here) return { x: R, y: R };
    const dy = (f.lat - here[0]) * 111320, dx = (f.lng - here[1]) * 111320 * Math.cos((here[0] * Math.PI) / 180);
    const d = Math.min(Math.hypot(dx, dy), km * 1000 - 400) * scale, ang = Math.atan2(dx, dy);
    return { x: R + d * Math.sin(ang), y: R - d * Math.cos(ang), delay: (((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360) / 360 * 3 };
  };
  // the nearest of my inspections that day to a colleague's one
  const nearestMine = (f: Found) => {
    const m = (res?.mine ?? []).map((x) => ({ x, d: distM([x.lat, x.lng], [f.lat, f.lng]) })).sort((a, b) => a.d - b.d)[0];
    return m ? { ...m.x, d: m.d } : null;
  };
  const dayLabel = day === "today" ? "azi" : "mâine";

  if (sel) {
    const first = sel.name.split(/\s+/)[0], mine = nearestMine(sel), me1 = myName.split(/\s+/)[0];
    const msg = mine
      ? `Salut, ${first}! Sunt ${me1}, de pe UVALO. Am și eu o inspecție ${dayLabel} la ${hhmm(mine.scheduled_at)}, la ${fmtKm(mine.d)} de a ta de la ${hhmm(sel.when)}. Dacă vrei, ne ajutăm reciproc sau mergem împreună.`
      : `Salut, ${first}! Sunt ${me1}, de pe UVALO. Văd că ai o inspecție ${dayLabel} la ${hhmm(sel.when)} în ${sel.zone}, la ${fmtKm(sel.dist_m)} de mine. Dacă ai nevoie de o mână de ajutor, spune-mi.`;
    const tel = digits(sel.phone);
    return (
      <div className="mbRadar">
        <header className="mbRdTop">
          <button type="button" className="mbRdBack" aria-label="Înapoi la radar" onClick={() => setSel(null)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button>
          <span><b>Coleg în apropiere</b><small>Găsit de radar · {dayLabel}, în {km} km</small></span>
        </header>
        <div className="mbRdBody">
          <div className="mbRdWho">
            {sel.avatar ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/api/avatar/${sel.user_id}`} alt="" /> : <span>{initials(sel.name)}</span>}
            <span className="mbRdWhoT"><b>{sel.name}</b><small>{[sel.legit && `leg. ANEVAR ${sel.legit}`, sel.org].filter(Boolean).join(" · ") || "Evaluator"}</small></span>
          </div>
          <div className="mbRdTwo">
            <div><small className="gold">INSPECȚIA LUI</small><b>{dayLabel === "azi" ? "Azi" : "Mâine"}, {hhmm(sel.when)}</b><small>{[sel.prop_type, sel.zone].filter(Boolean).join(" · ")}</small><small className="dim">zona, nu adresa exactă</small></div>
            {mine ? <div><small className="blue">INSPECȚIA TA</small><b>{dayLabel === "azi" ? "Azi" : "Mâine"}, {hhmm(mine.scheduled_at)}</b><small>{mine.address}</small><small className="dim">la {fmtKm(mine.d)} de a lui</small></div>
              : <div><small className="blue">TU</small><b>{fmtKm(sel.dist_m)}</b><small>de locul unde ești acum</small><small className="dim">fără inspecție programată {dayLabel}</small></div>}
          </div>
          <div className="mbRdMsg">
            <small className="mbCap">MESAJ PROPUS</small>
            <p>{msg}</p>
            <small>Se deschide în SMS sau WhatsApp; îl poți modifica înainte de trimitere.</small>
          </div>
          <div className="mbRdActs">
            {tel ? <a className="mbBtn" href={`tel:${tel}`}>{PHONE}Sună</a> : <span className="mbBtn" aria-disabled="true">{PHONE}Fără telefon</span>}
            {tel ? <a className="mbBtn gold" href={`sms:${tel}?body=${encodeURIComponent(msg)}`}>{CHAT}Trimite SMS</a> : <a className="mbBtn gold" href={`mailto:${sel.email}?subject=${encodeURIComponent("Inspecție în apropiere · UVALO")}&body=${encodeURIComponent(msg)}`}>{CHAT}Trimite email</a>}
          </div>
          {tel && <a className="mbLink mbRdWa" href={`https://wa.me/${waNumber(sel.phone)}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener">Trimite pe WhatsApp</a>}
          <small className="mbRdNote">{first} vede doar ora și zona inspecției tale. Adresele exacte vi le spuneți voi, după ce răspunde.</small>
        </div>
      </div>
    );
  }

  return (
    <div className="mbRadar">
      <header className="mbRdTop">
        <button type="button" className="mbRdBack" aria-label="Înapoi" onClick={onBack}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button>
        <span><b>Radar colegi</b><small>Inspecțiile programate ale colegilor din jurul tău</small></span>
        <em className="mbRdScan"><i className={busy || !res ? "on" : ""} />{busy ? "SCANEZ" : res ? "ACTIV" : "PORNESC"}</em>
      </header>
      <div className="mbRdChips">
        {KMS.map((k) => <button key={k} type="button" aria-pressed={km === k} onClick={() => setKm(k)}>{k} km</button>)}
        <span />
        <button type="button" className="day" aria-pressed={day === "today"} onClick={() => setDay("today")}>Azi</button>
        <button type="button" className="day" aria-pressed={day === "tomorrow"} onClick={() => setDay("tomorrow")}>Mâine</button>
      </div>

      <div className="mbRdDisc" role="img" aria-label={`Radar pe ${km} km: ${found.length} ${found.length === 1 ? "coleg" : "colegi"}`}>
        <i className="ring r3" /><i className="ring r2" /><i className="ring r1" /><i className="ax v" /><i className="ax h" />
        <small style={{ top: 110 }}>{(km / 3).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} km</small>
        <small style={{ top: 50 }}>{((km * 2) / 3).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} km</small>
        <small style={{ top: 4 }}>{km} km</small>
        <i className="sweep" /><i className="beam" />
        <i className="ping" /><i className="me" />
        {found.map((f) => { const b = blip(f); return (
          <button key={f.id} type="button" className="blip" style={{ left: b.x, top: b.y }} onClick={() => setSel(f)} aria-label={`${f.name}, ${hhmm(f.when)}, la ${fmtKm(f.dist_m)}`}>
            <i style={{ animationDelay: `${b.delay ?? 0}s` }} /><span style={{ animationDelay: `${b.delay ?? 0}s` }}>{initials(f.name)} · {hhmm(f.when)}</span>
          </button>
        ); })}
      </div>

      <p className="mbRdSum">{err ? <span className="warn">{err}</span> : !res ? "Caut poziția și inspecțiile din jur…"
        : found.length ? <><b>{found.length} {found.length === 1 ? "coleg are" : "colegi au"}</b> inspecții {dayLabel} în {km} km de tine</> : <>Niciun coleg cu inspecție {dayLabel} în {km} km</>}</p>

      <div className="mbRdSheet">
        <span className="mbRdHandle" />
        {found.length ? (
          <>
            <div className="mbRowBetween"><b>Colegi în apropiere</b><small>{found.length}</small></div>
            <div className="mbRdList">
              {found.map((f) => { const mine = nearestMine(f); return (
                <button key={f.id} type="button" className="mbRdCard" onClick={() => setSel(f)}>
                  {f.avatar ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/api/avatar/${f.user_id}`} alt="" /> : <span className="mbRdIni">{initials(f.name)}</span>}
                  <span className="mbRdCardT">
                    <b>{f.name}</b>
                    <small>{[f.prop_type, f.zone].filter(Boolean).join(" · ")} · {dayLabel} {hhmm(f.when)}</small>
                    <small className="gold">{mine ? `${fmtKm(mine.d)} de inspecția ta de la ${hhmm(mine.scheduled_at)}` : `${fmtKm(f.dist_m)} de tine acum`}</small>
                  </span>
                  <span className="mbRdGo">{PHONE}</span>
                </button>
              ); })}
            </div>
          </>
        ) : res && !err ? (
          <>
            <small className="mbRdEmpty">Radarul scanează în continuare. Mărește raza sau încearcă {day === "today" ? "mâine" : "azi"}.</small>
            {km < 25 && <button type="button" className="mbBtn gold big" onClick={() => setKm(km === 5 ? 10 : 25)}>Caută în {km === 5 ? 10 : 25} km</button>}
          </>
        ) : null}
        <small className="mbRdNote">Colegii te văd pe radarul lor doar dacă ai o inspecție programată. Se vede ora și zona, nu adresa.</small>
      </div>
    </div>
  );
}

/** The banner on the home screen that opens the radar. */
export function RadarBanner({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="mbRdBanner">
      <span className="mbRdMini" aria-hidden="true"><i className="ring" /><i className="sweep" /><i className="dot" /></span>
      <span className="mbRdBannerT"><b>Radar colegi <em>TEST</em></b><small>Vezi cine mai are inspecții azi în jurul tău și dați-vă o mână de ajutor.</small></span>
      <button type="button" className="mbBtn gold" onClick={onOpen}>Scanează după colegi</button>
    </section>
  );
}
