/** Public legal pages (privacy, terms): no sign-in, readable during maintenance too (Microsoft Marketplace links them). */
export const COMPANY = {
  name: "IDEONA ANALYTICS S.R.L.", cui: "46573375", reg: "J2022003536355", seat: "Str. Circumvalațiunii nr. 33, Timișoara, județul Timiș, România",
  email: "office@uvalo.ro", updated: "14 octombrie 2026",
};

export function LegalPage({ title, lead, toc, children }: { title: string; lead: string; toc: [string, string][]; children: React.ReactNode }) {
  return (
    <div className="legal">
      <header className="legalTop">
        <a href="/" aria-label="UVALO">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/uvalo-lockup.svg" alt="UVALO" />
        </a>
        <nav aria-label="Documente">
          <a href="/confidentialitate">Confidențialitate</a>
          <a href="/termeni">Termeni de utilizare</a>
        </nav>
      </header>
      <main className="legalMain">
        <span className="wpEyebrow dark">Actualizat la {COMPANY.updated}</span>
        <h1>{title}</h1>
        <p className="legalLead">{lead}</p>
        <nav className="legalToc" aria-label="Cuprins">
          {toc.map(([id, t], i) => <a key={id} href={`#${id}`}>{i + 1}. {t}</a>)}
        </nav>
        {children}
        <p className="legalFoot">{COMPANY.name} · CUI {COMPANY.cui} · {COMPANY.reg} · {COMPANY.seat} · <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></p>
      </main>
    </div>
  );
}
