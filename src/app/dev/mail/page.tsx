import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { context } from "@/lib/access";
import { appEnv } from "@/lib/config";

export const metadata: Metadata = { title: "Emailuri de test" };
export const dynamic = "force-dynamic";

type Mail = { id: number; to_addr: string; subject: string; html: string; text: string; sent: number; created_at: string };

/**
 * Local and test environments: the emails the app would have sent (login links, invitations…). Not in production.
 * Locally anyone can open it (that is how you sign in); in staging only VALUEFY administrators.
 */
export default async function DevMail({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const env = appEnv();
  if (env === "production") notFound();
  const db = await getDb();
  if (!db) throw new Error("Baza de date nu este disponibilă.");
  if (env === "staging") {
    const c = await context(db);
    if (!c) redirect("/login");
    if (!c.super) notFound();
  }
  const { id } = await searchParams;
  const { results } = await db.prepare("SELECT * FROM dev_mail ORDER BY id DESC LIMIT 60").all<Mail>();
  const open = results.find((m) => String(m.id) === id) ?? results[0];
  const when = (iso: string) => new Date(iso).toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Bucharest" });
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px 60px", display: "grid", gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22 }}>Emailuri de test · {env}</h1>
        <p className="hint">Ce ar fi trimis aplicația. {env === "staging" ? "Doar adresele din MAIL_ALLOW le primesc și pe email (marcate „trimis”)." : "Local nu pleacă niciun email."}</p>
      </div>
      {results.length === 0 ? <p className="hint">Niciun email încă. Cere un cod de autentificare din <a className="link" href="/login">/login</a>.</p> : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 340px) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
          <ul className="docList">
            {results.map((m) => (
              <li key={m.id} style={{ background: m.id === open?.id ? "var(--cream)" : undefined }}>
                <a href={`?id=${m.id}`} className="who" style={{ textDecoration: "none", color: "inherit" }}>
                  <b>{m.subject}</b>
                  <small>{m.to_addr} · {when(m.created_at)}{m.sent ? " · trimis" : ""}</small>
                </a>
              </li>
            ))}
          </ul>
          {open && (
            <section className="card" style={{ gap: 10 }}>
              <div><b>{open.subject}</b><p className="hint">Către {open.to_addr} · {when(open.created_at)}</p></div>
              <iframe title="Email" srcDoc={open.html} sandbox="allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation" style={{ width: "100%", height: 560, border: "1px solid var(--line)", borderRadius: 12, background: "#fff" }} />
              <details><summary className="hint">Varianta text</summary><pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{open.text}</pre></details>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
