"use client";

import { useEffect } from "react";

export function LogoutButton() {
  return (
    <button type="button" className="logout" onClick={async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      location.href = "/login";
    }}>Ieși din cont</button>
  );
}

/** Switches the firm the person works in (when they belong to several). */
export function OrgSwitch({ orgs, current }: { orgs: { id: string; name: string }[]; current: string | null }) {
  if (orgs.length < 2) return null;
  return (
    <select className="select orgSwitch" aria-label="Firma" value={current ?? ""} onChange={async (e) => {
      await fetch("/api/account/org", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ org: e.target.value }) });
      location.reload();
    }}>
      {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );
}

/**
 * Phone: the last button of the bottom menu opens the sidebar (everything in it: account, firm, recommendations,
 * admin portal, sign out) as a panel from the left. Closes on the backdrop, the ✕ or Escape.
 */
export function MenuButton() {
  const set = (open: boolean) => {
    const shell = document.querySelector(".shell");
    if (!shell) return;
    shell.toggleAttribute("data-menu", open);
    document.documentElement.style.overflow = open ? "hidden" : "";
    if (open) {
      const close = (e: KeyboardEvent) => { if (e.key === "Escape") { set(false); removeEventListener("keydown", close); } };
      addEventListener("keydown", close);
      (shell.querySelector(".side a, .side button") as HTMLElement | null)?.focus();
    }
  };
  return (
    <>
      <button type="button" className="menuBtn" aria-label="Meniu" onClick={() => set(true)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        Meniu
      </button>
      <button type="button" className="menuBackdrop" aria-label="Închide meniul" tabIndex={-1} onClick={() => set(false)} />
      <button type="button" className="menuClose" aria-label="Închide meniul" onClick={() => set(false)}>✕</button>
    </>
  );
}

/**
 * Admin on the phone: the filter forms (Utilizatori, Tablou) show only the search; the other fields behind "Mai multe filtre"
 * ("Filtre (N)" when some are set). After hydration, so React does not redo the form.
 */
export function FilterFold() {
  useEffect(() => {
    if (!matchMedia("(max-width: 979px)").matches) return;
    let n = 0;
    new URLSearchParams(location.search).forEach((v, k) => { if (v && k !== "q" && k !== "page") n++; });
    document.querySelectorAll<HTMLFormElement>("form.tabFilters").forEach((f) => {
      if (f.querySelector(".tfMore")) return;
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn btnGhost btnSm tfMore"; b.textContent = n ? `Filtre (${n}) ▾` : "Mai multe filtre ▾";
      b.onclick = () => { f.classList.remove("fold"); b.remove(); };
      f.classList.add("fold");
      f.insertBefore(b, f.children[1] ?? null);
    });
  }, []);
  return null;
}
