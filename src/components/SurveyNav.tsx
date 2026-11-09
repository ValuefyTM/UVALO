// Admin → Chestionar: the sub-navigation (Statistici / Răspunsuri / Setări) and the questionnaires (the active one and the older ones).
export function SurveyNav({ page, id, activeId, older }: { page: "stats" | "rows" | "settings"; id: string; activeId: string; older: { id: string; n: number; d: number }[] }) {
  const q = id === activeId ? "" : `?id=${encodeURIComponent(id)}`;
  return (
    <div className="sqNav">
      <div className="sqTabs" role="tablist" aria-label="Secțiune">
        <a role="tab" aria-selected={page === "stats"} href={`/admin/chestionar${q}`}>Statistici</a>
        <a role="tab" aria-selected={page === "rows"} href={`/admin/chestionar/raspunsuri${q}`}>Răspunsurile</a>
        <a role="tab" aria-selected={page === "settings"} href="/admin/chestionar/setari">Setări</a>
      </div>
      {older.length > 1 && (
        <div className="sqIds" role="group" aria-label="Chestionarul">
          {older.map((o) => (
            <a key={o.id} aria-current={o.id === id ? "true" : undefined} href={`/admin/chestionar${page === "rows" ? "/raspunsuri" : ""}${o.id === activeId ? "" : `?id=${encodeURIComponent(o.id)}`}`}>
              {o.id}{o.id === activeId ? " · activ" : ""} <b>{o.d}</b>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
