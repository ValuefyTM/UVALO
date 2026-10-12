// Home page, Colaborări: a preview for those who activated it (posts in their zones, their own post, messages,
// notifications) and a launch banner for those who may use it and have not activated it yet.
import type { CollabState } from "@/lib/collab";
import type { Kind } from "@/lib/collab-shared";

const TZ = "Europe/Bucharest";
function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "chiar acum";
  if (m < 60) return `acum ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? "acum o oră" : `acum ${h} ore`;
  const d = Math.round(h / 24);
  return d === 1 ? "ieri" : `acum ${d} zile`;
}
const where = (p: { city: string; county: string }) => (p.city.trim().toLowerCase() === p.county.toLowerCase() ? p.city : `${p.city}, ${p.county}`);
const fee = (b: number | null) => (b == null ? "Onorariu de stabilit" : `Buget ${b.toLocaleString("ro-RO")} lei`);
const dist = (d: number | null) => (d == null ? null : d < 4 ? "în localitate" : `≈ ${Math.round(d)} km`);
function due(d: string | null) {
  if (!d) return "Fără termen";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const n = Math.round((new Date(`${d}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 864e5);
  if (n < 0) return "Termen depășit";
  if (n === 0) return "Termen azi";
  if (n === 1) return "Termen mâine";
  return `Termen ${new Date(`${d}T12:00:00Z`).toLocaleDateString("ro-RO", { day: "numeric", month: "short" })}`;
}
const Tag = ({ k }: { k: Kind }) => <span className={`cbTag cbTag-${k}`}>{k === "inspectie" ? "INSPECȚIE" : "RAPORT + INSPECȚIE"}</span>;
function Av({ p, size = 36 }: { p: { id: string; init: string; avatar: boolean }; size?: number }) {
  const style = { width: size, height: size, borderRadius: 999, fontSize: size < 30 ? 10 : 12 };
  // eslint-disable-next-line @next/next/no-img-element
  return p.avatar ? <img className="cbAv" src={`/api/avatar/${p.id}`} alt="" style={style} /> : <span className="cbAv" style={style} aria-hidden="true">{p.init}</span>;
}
const ST: Record<string, [string, string]> = { active: ["Activ", "acc"], inlucru: ["În lucru", "ok"], archived: ["Arhivat", ""] };

/** For those who activated Colaborări. */
export function CollabHome({ s }: { s: CollabState }) {
  const z = s.profile!;
  const zone = s.feed.filter((p) => p.inZone && !p.own).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const posts = zone.slice(0, 3);
  const mine = s.mine.find((p) => p.status === "active") ?? s.mine.find((p) => p.status === "inlucru") ?? null;
  const convs = [...s.convs].sort((a, b) => b.unread - a.unread || b.last_at.localeCompare(a.last_at)).slice(0, 2);
  const unread = s.convs.reduce((n, c) => n + c.unread, 0);
  const notifs = s.notifs.slice(0, 3);
  const zoneText = !z.available ? null : [z.zone_mode === "judet" ? z.county : `${z.county ?? ""}${z.zone_mode === "raza" ? `, rază ${z.radius} km` : ""}`, ...z.extra].filter(Boolean).join(" · ");
  const fresh = (iso: string) => Date.now() - new Date(iso).getTime() < 24 * 3600e3;
  return (
    <section className="hc" aria-labelledby="hcT">
      <div className="hcHead">
        <span className="hcTitle"><small>COLABORĂRI</small><b id="hcT">Lucrări de la colegi, în zonele tale</b></span>
        <span className="hcActs">
          <a className="btn btnGhost btnSm" href="/colaborari">Toate anunțurile →</a>
          <a className="btn btnNavy btnSm" href="/colaborari?compose=1">+ Publică anunț</a>
        </span>
      </div>
      <div className="hcGrid">
        <div className="hcBox">
          <div className="hcBoxHead">
            <b>{z.available ? <>Ultimele anunțuri · <span className="hcRed">{zone.length === 1 ? "1 activ" : `${zone.length} active`} în zonele tale</span></> : "Ultimele anunțuri"}</b>
            {zoneText && <small>{zoneText}</small>}
          </div>
          {!z.available ? (
            <p className="hcEmpty">Ai ales „doar mă uit”: nu primești notificări. <a href="/colaborari?view=settings">Setează-ți zona</a> ca să vezi aici lucrările din apropiere.</p>
          ) : posts.length === 0 ? (
            <p className="hcEmpty">Niciun anunț activ în zonele tale acum. Te anunțăm când apare unul. <a href="/colaborari?view=settings">Modifică zonele</a></p>
          ) : posts.map((p) => (
            <article key={p.id} className="hcPost">
              <Av p={p.author} />
              <span className="hcPostText">
                <span className="hcPostTop"><Tag k={p.kind} /><small>{p.author.name} · <span suppressHydrationWarning>{ago(p.created_at)}</span></small>{fresh(p.created_at) && !p.myRequest && <span className="hcNew">● NOU</span>}</span>
                <b>{p.title}</b>
                <span className="hcFacts">
                  <span className="hcLoc">{where(p)}</span>
                  {dist(p.dist) && <span>{dist(p.dist)}</span>}
                  <span>{due(p.due)}</span>
                  <span className="line">{fee(p.budget)}</span>
                </span>
              </span>
              {p.myRequest
                ? <a className="hcDone" href={`/colaborari?post=${p.id}`}>✓ Detalii cerute</a>
                : <a className="btn btnGold btnSm hcGo" href={`/colaborari?post=${p.id}`}>Vreau detalii</a>}
            </article>
          ))}
          {z.available && zone.length > 0 && <a className="hcMore" href="/colaborari">{zone.length > 3 ? `Vezi toate cele ${zone.length} anunțuri din zonele tale →` : "Vezi anunțurile →"}</a>}
        </div>

        <div className="hcSide">
          {mine ? (
            <a className="hcBox hcCard" href="/colaborari?view=mine">
              <span className="hcCardHead"><small>ANUNȚUL TĂU</small><span className={`cbSt ${ST[mine.status]?.[1] ?? ""}`}>{ST[mine.status]?.[0] ?? mine.status}</span></span>
              <b>{mine.title}</b>
              <span className="hcReqs">
                {mine.requests.length > 0 && <span className="hcAvs">{mine.requests.slice(0, 3).map((r) => <Av key={r.id} p={r.user} size={28} />)}</span>}
                <small>{mine.requests.length === 0 ? "Încă nu a cerut nimeni detalii" : <><b>{mine.requests.length === 1 ? "1 coleg" : `${mine.requests.length} colegi`}</b> au cerut detalii{mine.requests.some((r) => r.status === "nou") && <> · <b className="hcRed">{mine.requests.filter((r) => r.status === "nou").length} {mine.requests.filter((r) => r.status === "nou").length === 1 ? "nou" : "noi"}</b></>}</>}</small>
              </span>
              <span className="hcCardGo">Vezi cererile →</span>
            </a>
          ) : (
            <a className="hcBox hcCard" href="/colaborari?compose=1">
              <span className="hcCardHead"><small>AI NEVOIE DE UN COLEG?</small></span>
              <b>Publică o inspecție sau predă o lucrare</b>
              <small className="hcMuted">Colegii din zonă primesc notificare în aplicație și pe email.</small>
              <span className="hcCardGo">+ Publică anunț</span>
            </a>
          )}

          <div className="hcBox">
            <div className="hcBoxHead"><small className="hcLabel">MESAJE</small>{unread > 0 && <span className="hcRed hcSmall">{unread === 1 ? "1 necitit" : `${unread} necitite`}</span>}</div>
            {convs.length === 0 ? <p className="hcEmpty">Conversațiile cu colegii apar aici.</p> : convs.map((c) => (
              <a key={c.id} className="hcMsg" href={`/colaborari?view=chat&conv=${c.id}`}>
                <Av p={c.peer} size={32} />
                <span className="hcMsgText"><b>{c.peer.name}</b><small>{c.last ? `${c.last.me ? "Tu: " : ""}${c.last.body}` : c.post.title}</small></span>
                {c.unread > 0 && <span className="hcDot" aria-label={`${c.unread} necitite`} />}
              </a>
            ))}
          </div>

          <div className="hcBox">
            <div className="hcBoxHead"><small className="hcLabel">NOTIFICĂRI</small></div>
            {notifs.length === 0 ? <p className="hcEmpty">Nicio notificare deocamdată.</p> : (
              <ul className="hcNotifs">
                {notifs.map((n) => (
                  <li key={n.id} className={n.read ? "read" : ""}>
                    <span className="hcDot" aria-hidden="true" />
                    <span><b>{n.type}:</b> {n.text} · <span suppressHydrationWarning>{ago(n.created_at)}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export type Launch = { count: number; county: string | null; latest: { kind: Kind; title: string; city: string; county: string; budget: number | null; created_at: string } | null };

/** For those who may use Colaborări and have not activated it yet: the launch banner. */
export function CollabLaunch({ l }: { l: Launch }) {
  return (
    <section className="hcLaunch" aria-labelledby="hcLT">
      <div className="hcLaunchText">
        <span className="hcLaunchTop"><span className="hcBadge">NOU ÎN UVALO</span><small>Colaborări între evaluatori</small></span>
        <h2 id="hcLT">Colaborări între evaluatori. <span>Găsești un coleg pentru inspecție în câteva minute.</span></h2>
        <p>Publici lucrarea, colegii din zonă primesc notificare și îți cer detalii. Alegi pe cine vrei și vorbiți în chat. Sau preiei tu inspecții și rapoarte de la colegi, în zonele în care lucrezi.</p>
        <ol className="hcSteps">
          <li><span>1</span>Îți alegi zona: rază în jurul adresei sau județe întregi</li>
          <li><span>2</span>Primești anunțurile noi din zonă, în aplicație și pe email</li>
          <li><span>3</span>Telefonul tău îl vede doar colegul cu care începi discuția</li>
        </ol>
        <span className="hcLaunchActs">
          <a className="btn btnGold hcBig" href="/colaborari">Activează Colaborările</a>
          <small>Gratuit, în toate conturile. Activarea durează un minut.</small>
        </span>
      </div>
      <div className="hcArt" aria-hidden="true">
        <span className="hcRing" />
        <span className="hcPin" />
        <span className="hcPt a" /><span className="hcPt b" /><span className="hcPt c" />
        {l.latest && (
          <span className="hcArtCard">
            <span className="hcArtTop"><Tag k={l.latest.kind} /><small suppressHydrationWarning>{ago(l.latest.created_at)}</small></span>
            <b>{l.latest.title}</b>
            <span className="hcFacts"><span className="hcLoc">{where(l.latest)}</span><span className="line">{fee(l.latest.budget)}</span></span>
          </span>
        )}
        <span className="hcArtChat">
          <small>MESAJE</small>
          <span className="in">Pot ajunge joi dimineață la proprietate.</span>
          <span className="out">Perfect, îți trimit adresa.</span>
        </span>
        {l.count > 0 && <span className="hcArtCount"><span>{l.count}</span><b>{l.count === 1 ? "anunț activ" : "anunțuri active"} acum {l.county ? `în județul ${l.county}` : "în UVALO"}</b></span>}
      </div>
    </section>
  );
}
