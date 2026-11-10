"use client";

import { Children, useEffect, useState } from "react";

/** Tabs of the /word page; the address keeps the open tab (#instalare, #versiuni), so links can open one directly. */
export function WordTabs({ tabs, children }: { tabs: { id: string; label: string }[]; children: React.ReactNode }) {
  const [cur, setCur] = useState(tabs[0].id);
  useEffect(() => {
    const read = () => {
      const h = location.hash.slice(1);
      const t = tabs.find((x) => x.id === h);
      if (t) { setCur(t.id); document.getElementById("wpTabs")?.scrollIntoView({ behavior: "smooth", block: "start" }); }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [tabs]);
  const panels = Children.toArray(children);
  return (
    <div className="wpTabsWrap" id="wpTabs">
      <div className="wpTabs" role="tablist">
        {tabs.map((t) => (
          <a key={t.id} role="tab" href={`#${t.id}`} aria-selected={cur === t.id} className={cur === t.id ? "on" : ""}
            onClick={(e) => { e.preventDefault(); setCur(t.id); history.replaceState(null, "", t.id === tabs[0].id ? location.pathname : `#${t.id}`); }}>
            {t.label}
          </a>
        ))}
      </div>
      {panels.map((p, i) => <div key={tabs[i].id} role="tabpanel" hidden={cur !== tabs[i].id}>{p}</div>)}
    </div>
  );
}
