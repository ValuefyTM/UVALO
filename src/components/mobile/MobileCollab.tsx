"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COUNTIES, KINDS, POST_SPECS, PROPS, type Kind } from "@/lib/collab-shared";

/*
 * Phone app → tab „Colaborări”: the same posts as on the web (/api/colaborari): the feed (in my zones / all), my posts with the
 * colleagues who asked for details (open the conversation, choose, archive, delete), the messages, and a new post.
 * The profile and the coverage zones stay on the web.
 */

type Person = { id: string; name: string; init: string; sub: string; avatar: boolean; phone?: string | null; email?: string };
type Card = { id: string; kind: Kind; title: string; note: string; city: string; county: string; prop: string | null; spec: string | null; due: string | null;
  budget: number | null; status: string; created_at: string; dist: number | null };
type FeedPost = Card & { author: Person; own: boolean; inZone: boolean; requests: number; myRequest: string | null };
type MyReq = { id: string; msg: string | null; status: string; created_at: string; conv_id: string | null; user: Person; base: string | null; dist: number | null };
type MinePost = Card & { chosen_id: string | null; requests: MyReq[] };
type Conv = { id: string; role: "author" | "requester"; last_at: string; unread: number; last: { body: string; me: boolean } | null; peer: Person;
  post: { id: string; title: string; city: string; county: string; status: string }; state: string };
type St = { profile: { available: number } | null; feed: FeedPost[]; mine: MinePost[]; convs: Conv[]; myRequests: { id: string; status: string; post: { id: string } }[] };
type Tab = "feed" | "mine" | "chat" | "new";
type Msg = { id: number; body: string; sys: boolean; me: boolean; at: string };

const REQ_LABEL: Record<string, string> = { nou: "a cerut detalii", contactat: "conversație deschisă", ales: "ales pentru lucrare", respins: "nealeasă" };
const STATUS_LABEL: Record<string, string> = { active: "Activ", inlucru: "În lucru", archived: "Arhivat" };
const day = (iso: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("ro-RO", { day: "numeric", month: "short" }) : "");
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `acum ${Math.max(1, m)} min` : m < 1440 ? `acum ${Math.round(m / 60)} h` : day(iso);
};
const money = (n: number | null) => (n ? `${n.toLocaleString("ro-RO")} lei` : "onorariu de stabilit");

function Av({ p, size = 32 }: { p: Person; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return p.avatar ? <img className="mcAv" src={`/api/avatar/${p.id}`} alt="" width={size} height={size} style={{ width: size, height: size }} />
    : <span className="mcAv" style={{ width: size, height: size }} aria-hidden="true">{p.init}</span>;
}

export function MobileCollab({ on, app, online, say }: { on: boolean; app: string; online: boolean; say: (m: string) => void }) {
  const [st, setSt] = useState<St | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<Tab>("feed");
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [conv, setConv] = useState<Conv | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/colaborari", { cache: "no-store" }).catch(() => null);
    if (!r) { setErr(online ? "Nu am putut încărca anunțurile." : "Fără semnal: anunțurile se încarcă când revine rețeaua."); return; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr((j as { error?: string }).error || "Nu am putut încărca anunțurile."); return; }
    setErr(""); setSt(j as St);
  }, [online]);
  useEffect(() => { if (on) void load(); }, [on, load]);

  const act = async (body: Record<string, unknown>, ok?: string) => {
    setBusy(true);
    const r = await fetch("/api/colaborari", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as Record<string, unknown> | undefined;
    setBusy(false);
    if (!r?.ok) { say(String(j?.error || (r ? "Nu a mers." : "Fără semnal."))); return null; }
    if (ok) say(ok);
    await load();
    return j ?? {};
  };

  if (!on) return (
    <>
      <header className="mbHead small"><b>Colaborări</b><small>Lucrări între evaluatori, în zona ta</small></header>
      <div className="mbBody"><div className="mbSoon"><b>În curând</b><small>Colaborările nu sunt încă deschise pentru contul tău.</small></div></div>
    </>
  );

  if (conv) return <Chat conv={conv} onBack={() => { setConv(null); void load(); }} say={say} />;

  const mine = st?.mine ?? [];
  const unread = (st?.convs ?? []).reduce((n, c) => n + c.unread, 0);
  const newReqs = mine.reduce((n, p) => n + p.requests.filter((r) => r.status === "nou").length, 0);
  const feed = (st?.feed ?? []).filter((p) => !p.own && (all || !st?.profile || p.inZone));
  return (
    <>
      <header className="mbHead small"><b>Colaborări</b><small>Lucrări între evaluatori, în zona ta</small></header>
      <div className="mbBody">
        <div className="mcTabs" role="tablist" aria-label="Colaborări">
          <button type="button" role="tab" aria-selected={tab === "feed"} onClick={() => setTab("feed")}>Anunțuri</button>
          <button type="button" role="tab" aria-selected={tab === "mine"} onClick={() => setTab("mine")}>Ale mele{newReqs ? <i>{newReqs}</i> : null}</button>
          <button type="button" role="tab" aria-selected={tab === "chat"} onClick={() => setTab("chat")}>Mesaje{unread ? <i>{unread}</i> : null}</button>
          <button type="button" role="tab" aria-selected={tab === "new"} className="mcNewTab" onClick={() => setTab("new")}>+ Postează</button>
        </div>
        {err && <p className="mbErr" role="alert">{err}</p>}
        {!st && !err && <p className="mbEmpty">Se încarcă…</p>}

        {st && tab === "feed" && <>
          {!st.profile && (
            <section className="mbCard mcInfo"><b>Activează-ți profilul de Colaborări</b>
              <small>Alegi zonele în care lucrezi și primești anunțurile de acolo (și pe email). Se face o singură dată, pe web.</small>
              <a className="mbBtn" href={`${app}/colaborari`} target="_blank" rel="noopener">Deschide pe web ↗</a></section>
          )}
          {st.profile && (
            <span className="mbOpts">
              <button type="button" aria-pressed={!all} onClick={() => setAll(false)}>În zonele mele</button>
              <button type="button" aria-pressed={all} onClick={() => setAll(true)}>Toate</button>
            </span>
          )}
          {!feed.length && <p className="mbEmpty">{all || !st.profile ? "Niciun anunț activ acum." : "Niciun anunț în zonele tale acum. Vezi „Toate”."}</p>}
          {feed.map((p) => (
            <FeedCard key={p.id} p={p} open={open === p.id} busy={busy} onToggle={() => setOpen(open === p.id ? null : p.id)}
              onAsk={async (msg) => {
                if (!p.inZone && st.profile && !confirm(`Anunțul e în afara zonelor tale (${p.county}). Ceri totuși detalii?`)) return;
                await act({ action: "request", post_id: p.id, msg }, "Cererea a fost trimisă autorului.");
              }}
              onWithdraw={async () => {
                const r = st.myRequests.find((x) => x.post.id === p.id);
                if (r && confirm("Retragi cererea de detalii?")) await act({ action: "withdraw", id: r.id }, "Cererea a fost retrasă.");
              }} />
          ))}
        </>}

        {st && tab === "mine" && <>
          {!mine.length && <p className="mbEmpty">Nu ai publicat niciun anunț. Apasă „+ Postează” când ai nevoie de un coleg.</p>}
          {mine.map((p) => (
            <section key={p.id} className={`mbCard mcCard mine s-${p.status}`}>
              <span className="mcTop"><small className={`mcKind k-${p.kind}`}>{KINDS[p.kind]}</small><small className="mcStatus">{STATUS_LABEL[p.status] ?? p.status}</small></span>
              <b>{p.title}</b>
              <small className="mcMeta">{p.city}, {p.county}{p.due ? ` · termen ${day(p.due)}` : ""} · {money(p.budget)}</small>
              {p.requests.length ? (
                <div className="mcReqs">
                  <small className="mbCap">{p.requests.length === 1 ? "1 COLEG A CERUT DETALII" : `${p.requests.length} COLEGI AU CERUT DETALII`}</small>
                  {p.requests.map((r) => (
                    <div key={r.id} className={`mcReq${r.status === "ales" ? " chosen" : ""}`}>
                      <Av p={r.user} />
                      <span className="mcReqTxt"><b>{r.user.name}</b><small>{[r.base, r.dist != null ? `${r.dist} km` : null, REQ_LABEL[r.status] ?? r.status].filter(Boolean).join(" · ")}</small>
                        {r.msg && <small className="mcMsg">„{r.msg}”</small>}
                        {r.conv_id && r.user.phone && <a href={`tel:${r.user.phone}`} className="mcTel">{r.user.phone}</a>}</span>
                      <span className="mcReqBtns">
                        <button type="button" className="mbBtn" disabled={busy} onClick={async () => {
                          const j = r.conv_id ? { id: r.conv_id } : await act({ action: "open_chat", request_id: r.id });
                          const id = (j as { id?: string } | null)?.id;
                          if (!id) return;
                          const s = await fetch("/api/colaborari", { cache: "no-store" }).then((x) => x.json()).catch(() => null) as St | null;
                          const c = s?.convs.find((x) => x.id === id);
                          if (c) setConv(c);
                        }}>{r.conv_id ? "Mesaje" : "Deschide conversația"}</button>
                        {!p.chosen_id && p.status !== "archived" && (
                          <button type="button" className="mbBtn gold" disabled={busy} onClick={() => { if (confirm(`Îl alegi pe ${r.user.name} pentru lucrare? Anunțul trece „În lucru”.`)) void act({ action: "pick", request_id: r.id }, `${r.user.name} a fost ales.`); }}>Alege</button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ) : <small className="mcMeta">Încă nu a cerut nimeni detalii. Colegii din zonă au primit notificare.</small>}
              <span className="mcActs">
                {p.status === "archived"
                  ? <button type="button" className="mbLink" disabled={busy} onClick={() => void act({ action: "status", post_id: p.id, archive: false }, "Anunțul a fost restaurat.")}>Restaurează</button>
                  : <button type="button" className="mbLink" disabled={busy} onClick={() => void act({ action: "status", post_id: p.id, archive: true }, "Anunțul a fost arhivat.")}>Arhivează</button>}
                <button type="button" className="mbLink danger" disabled={busy} onClick={() => { if (confirm("Ștergi anunțul? Cei care au cerut detalii primesc notificare.")) void act({ action: "delete", post_id: p.id }, "Anunțul a fost șters."); }}>Șterge</button>
                <a className="mbLink" href={`${app}/colaborari?view=mine`} target="_blank" rel="noopener">Modifică pe web ↗</a>
              </span>
            </section>
          ))}
        </>}

        {st && tab === "chat" && <>
          {!st.convs.length && <p className="mbEmpty">Nicio conversație încă. Conversația se deschide când autorul unui anunț îți răspunde la cererea de detalii.</p>}
          {st.convs.map((c) => (
            <button key={c.id} type="button" className="mbCard mcConv" onClick={() => setConv(c)}>
              <Av p={c.peer} size={40} />
              <span className="mcConvTxt"><b>{c.peer.name}</b><small>{c.post.title} · {c.post.city}</small>
                <small className="mcLast">{c.last ? `${c.last.me ? "Tu: " : ""}${c.last.body}` : "—"}</small></span>
              <span className="mcConvEnd"><small>{ago(c.last_at)}</small>{c.unread ? <i>{c.unread}</i> : null}</span>
            </button>
          ))}
        </>}

        {st && tab === "new" && <NewPost busy={busy} online={online} onPost={async (b) => {
          const j = await act({ action: "post", ...b });
          if (!j) return false;
          const n = Number((j as { notified?: number }).notified ?? 0);
          say(n ? `Anunțul a fost publicat · ${n} ${n === 1 ? "coleg a primit" : "colegi au primit"} notificare.` : "Anunțul a fost publicat.");
          setTab("mine");
          return true;
        }} />}
      </div>
    </>
  );
}

function FeedCard({ p, open, busy, onToggle, onAsk, onWithdraw }: { p: FeedPost; open: boolean; busy: boolean; onToggle: () => void; onAsk: (msg: string) => Promise<void>; onWithdraw: () => Promise<void> }) {
  const [msg, setMsg] = useState("");
  return (
    <section className={`mbCard mcCard${open ? " open" : ""}`}>
      <button type="button" className="mcHit" aria-expanded={open} onClick={onToggle}>
        <span className="mcTop"><small className={`mcKind k-${p.kind}`}>{KINDS[p.kind]}</small>{!p.inZone && <small className="mcOut">În afara zonei</small>}<small className="mcAgo">{ago(p.created_at)}</small></span>
        <b>{p.title}</b>
        <small className="mcMeta">{p.city}, {p.county}{p.dist != null ? ` · ${p.dist} km` : ""}{p.due ? ` · termen ${day(p.due)}` : ""}</small>
        <span className="mcMoney">{money(p.budget)}{p.requests ? <small> · {p.requests} {p.requests === 1 ? "cerere" : "cereri"}</small> : null}</span>
        {!open && <small className="mcNote clamp">{p.note}</small>}
      </button>
      {open && <>
        <p className="mcNote">{p.note}</p>
        <small className="mcMeta">{[p.prop, p.spec].filter(Boolean).join(" · ")}</small>
        <span className="mcAuthor"><Av p={p.author} /><span><b>{p.author.name}</b><small>{p.author.sub}</small></span></span>
        {p.myRequest ? (
          <span className="mcAsked"><b>✓ Ai cerut detalii</b><small>{REQ_LABEL[p.myRequest] ?? p.myRequest}. Autorul îți scrie în Mesaje.</small>
            {p.myRequest !== "ales" && <button type="button" className="mbLink" disabled={busy} onClick={() => void onWithdraw()}>Retrage cererea</button>}</span>
        ) : <>
          <textarea className="mbIn" rows={2} placeholder="Mesaj pentru autor (opțional): disponibilitate, întrebări" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <button type="button" className="mbBtn gold big" disabled={busy} onClick={() => void onAsk(msg)}>Vreau detalii</button>
        </>}
      </>}
    </section>
  );
}

function NewPost({ busy, online, onPost }: { busy: boolean; online: boolean; onPost: (b: Record<string, unknown>) => Promise<boolean> }) {
  const empty = { kind: "inspectie" as Kind, prop: "", city: "", county: "", spec: "EPI", due: "", budget: "", note: "", title: "" };
  const [f, setF] = useState(empty);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((o) => ({ ...o, [k]: v }));
  const ready = f.city.trim() && f.county && f.note.trim().length >= 10;
  return (
    <section className="mcForm">
      <small className="mbCap">CE CAUȚI</small>
      <span className="mbOpts">{(Object.keys(KINDS) as Kind[]).map((k) => <button key={k} type="button" aria-pressed={f.kind === k} onClick={() => set("kind", k)}>{KINDS[k]}</button>)}</span>
      <small className="mbCap">PROPRIETATEA</small>
      <span className="mbOpts">{PROPS.map((p) => <button key={p} type="button" aria-pressed={f.prop === p} onClick={() => set("prop", f.prop === p ? "" : p)}>{p}</button>)}</span>
      <span className="mbGrid2">
        <label className="mbField">Localitatea<input className="mbIn" value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="ex. Lugoj" /></label>
        <label className="mbField">Județul<select className="mbIn" value={f.county} onChange={(e) => set("county", e.target.value)}><option value="">Alege</option>{COUNTIES.map((c) => <option key={c}>{c}</option>)}</select></label>
      </span>
      <small className="mbCap">SPECIALIZAREA</small>
      <span className="mbOpts">{POST_SPECS.map((s) => <button key={s} type="button" aria-pressed={f.spec === s} onClick={() => set("spec", s)}>{s}</button>)}</span>
      <span className="mbGrid2">
        <label className="mbField">Termen<input className="mbIn" type="date" value={f.due} onChange={(e) => set("due", e.target.value)} /></label>
        <label className="mbField">Buget (lei)<input className="mbIn" inputMode="numeric" value={f.budget} onChange={(e) => set("budget", e.target.value.replace(/\D/g, ""))} placeholder="gol = de stabilit" /></label>
      </span>
      <label className="mbField">Descrierea lucrării<textarea className="mbIn" rows={4} value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="Ce e de făcut, acces, documente disponibile, când ai nevoie" /></label>
      <label className="mbField"><span>Titlu <small>(opțional)</small></span><input className="mbIn" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder={`${f.prop || "Proprietate"}, ${f.city || "localitate"}`} /></label>
      <button type="button" className="mbBtn gold big" disabled={busy || !online || !ready} onClick={async () => { if (await onPost({ ...f, budget: f.budget ? Number(f.budget) : null, due: f.due || null })) setF(empty); }}>
        {busy ? "Se publică…" : "Publică anunțul"}
      </button>
      <small className="mbCenterSmall">{!online ? "Fără semnal: anunțul se poate publica doar cu rețea." : !ready ? "Completează localitatea, județul și descrierea (min. 10 caractere)." : "Colegii cu zona potrivită primesc notificare în aplicație și pe email."}</small>
    </section>
  );
}

function Chat({ conv, onBack, say }: { conv: Conv; onBack: () => void; say: (m: string) => void }) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/colaborari?conv=${conv.id}`, { cache: "no-store" }).catch(() => null);
    const j = r?.ok ? ((await r.json()) as { messages: Msg[] }) : null;
    if (j) setMsgs(j.messages);
  }, [conv.id]);
  useEffect(() => { void load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs?.length]);
  const send = async () => {
    if (!body.trim()) return;
    setBusy(true);
    const r = await fetch("/api/colaborari", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "message", conv_id: conv.id, body }) }).catch(() => null);
    setBusy(false);
    if (!r?.ok) { say(r ? "Mesajul nu a putut fi trimis." : "Fără semnal: mesajul nu a plecat."); return; }
    setBody(""); void load();
  };
  return (
    <>
      <header className="mbBar"><button type="button" className="mbBack" aria-label="Înapoi" onClick={onBack}>‹</button>
        <span><b>{conv.peer.name}</b><small>{conv.post.title} · {conv.post.city}</small></span></header>
      <div className="mbBody mcChat">
        {(conv.peer.phone || conv.peer.email) && (
          <span className="mcContact">{conv.peer.phone && <a className="mbBtn" href={`tel:${conv.peer.phone}`}>Sună</a>}{conv.peer.email && <a className="mbBtn" href={`mailto:${conv.peer.email}`}>Email</a>}</span>
        )}
        {!msgs && <p className="mbEmpty">Se încarcă…</p>}
        <div className="mcMsgs">
          {msgs?.map((m) => <div key={m.id} className={`mcBubble${m.sys ? " sys" : m.me ? " me" : ""}`}>{m.body}<small>{ago(m.at)}</small></div>)}
          <div ref={end} />
        </div>
      </div>
      <footer className="mbFoot mcSend">
        <textarea className="mbIn" rows={1} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Scrie un mesaj" aria-label="Mesaj" />
        <button type="button" className="mbBtn gold" disabled={busy || !body.trim()} onClick={() => void send()}>Trimite</button>
      </footer>
    </>
  );
}
