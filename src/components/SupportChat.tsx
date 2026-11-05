// The thread of a ticket as a chat (server component): the person's bubbles on the right, the UVALO team's on the left.
import type { Reply, Ticket } from "@/lib/support";

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" });
const day = (iso: string) => new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Bucharest" });

export function Chat({ t, replies, mine, names }: { t: Ticket & { who?: string | null; page?: string | null }; replies: Reply[]; mine: (userId: string | null) => boolean; names?: boolean }) {
  const items = [
    { id: `t${t.id}`, user_id: t.user_id, staff: 0, text: t.text, img: t.image_key ? `/api/suport/img/f/${t.id}` : null, at: t.created_at, who: t.who ?? null },
    ...replies.map((m) => ({ id: `r${m.id}`, user_id: m.user_id, staff: m.staff, text: m.text, img: m.image_key ? `/api/suport/img/r/${m.id}` : null, at: m.created_at, who: m.who })),
  ];
  let last = "";
  return (
    <div className="spChat">
      {items.map((m) => {
        const d = day(m.at), sep = d !== last; last = d;
        const right = names ? !!m.staff : mine(m.user_id);
        return (
          <div key={m.id} style={{ display: "contents" }}>
            {sep && <span className="spDay">{d}</span>}
            <div className={`spBubble${right ? " me" : ""}${m.staff ? " staff" : ""}`}>
              {names && <small className="spWho">{m.staff ? `Echipa UVALO · ${m.who ?? ""}` : m.who ?? "—"}</small>}
              {!names && !!m.staff && !right && <small className="spWho">Echipa UVALO</small>}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.img && <a href={m.img} target="_blank" rel="noopener"><img className="spImg" src={m.img} alt="Imagine atașată" /></a>}
              {m.text !== "(imagine)" && <span className="spText">{m.text}</span>}
              <small className="spTime">{hhmm(m.at)}</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}
