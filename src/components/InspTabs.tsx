"use client";

// The inspection page's tabs (Detalii / Fișa / Fotografii / Acte / Istoric): the panels come rendered from the server, only the
// chosen one shows; the choice follows the URL hash (#fisa) so links from elsewhere land on a tab.
import { useEffect, useState } from "react";

export type TabDef = { key: string; label: string; count?: string | number | null };

export function InspTabs({ tabs, initial, panels }: { tabs: TabDef[]; initial: string; panels: Record<string, React.ReactNode> }) {
  const [on, setOn] = useState(initial);
  useEffect(() => {
    const fromHash = () => { const h = location.hash.replace("#", ""); if (tabs.some((t) => t.key === h)) setOn(h); };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [tabs]);
  const pick = (k: string) => { setOn(k); history.replaceState(null, "", `#${k}`); };
  return (
    <>
      <div className="ixTabs2" role="tablist" aria-label="Secțiuni">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={on === t.key} onClick={() => pick(t.key)}>{t.label}{t.count != null && t.count !== "" && <i>{t.count}</i>}</button>
        ))}
      </div>
      {tabs.map((t) => <div key={t.key} role="tabpanel" hidden={on !== t.key} className="ixPanel">{panels[t.key]}</div>)}
    </>
  );
}
