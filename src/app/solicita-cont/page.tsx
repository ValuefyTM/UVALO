import type { Metadata } from "next";
import { RequestForm } from "./RequestForm";

export const metadata: Metadata = { title: "Solicită cont | VALUEFY Tools" };

export default function RequestAccount() {
  return (
    <div className="authPage">
      <aside className="authSide">
        <span className="brandPill" style={{ position: "relative", alignSelf: "flex-start" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/valuefy-logo.png" alt="VALUEFY" style={{ height: 22, display: "block" }} />
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span className="eyebrow" style={{ position: "relative", color: "var(--acc-light)" }}>VALUEFY TOOLS</span>
          <h2>Cont pentru evaluatorii autorizați ANEVAR.</h2>
          <ul>
            <li>Introduci numărul legitimației ANEVAR</li>
            <li>Confirmi numele din tabloul membrilor titulari</li>
            <li>Lași adresa de email; după aprobare primești linkul de activare</li>
          </ul>
        </div>
        <p style={{ fontSize: 12 }}>Datele din tablou: anevar.ro</p>
      </aside>
      <main className="authMain">
        <div className="authBox">
          <h1>Solicită cont</h1>
          <RequestForm />
          <p className="hint">Ai deja cont? <a className="rowLink" href="/login">Intră în cont</a></p>
        </div>
      </main>
    </div>
  );
}
