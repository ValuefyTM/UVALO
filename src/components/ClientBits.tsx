"use client";

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
