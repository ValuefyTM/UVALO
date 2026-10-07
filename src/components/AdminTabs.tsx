export function AdminTabs({ active }: { active: "firme" | "utilizatori" | "activitate" }) {
  const t: [typeof active, string, string][] = [["firme", "Firme și abonamente", "/admin"], ["utilizatori", "Utilizatori", "/admin/utilizatori"], ["activitate", "Activitate", "/admin/activitate"]];
  return (
    <nav className="pillTabs" aria-label="Administrare">
      {t.map(([k, l, h]) => <a key={k} href={h} aria-current={active === k ? "page" : undefined}>{l}</a>)}
    </nav>
  );
}
