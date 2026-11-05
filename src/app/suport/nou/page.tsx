import type { Metadata } from "next";
import { page } from "@/lib/guard";
import { AppShell } from "@/components/AppShell";
import { TicketForm } from "@/components/Support";

export const metadata: Metadata = { title: "Tichet nou | UVALO" };
export const dynamic = "force-dynamic";

/** Suport tehnic → a new ticket: subject, message, an optional photo. */
export default async function NewTicket() {
  const { c } = await page({ maint: true });
  return (
    <AppShell c={c} active="suport" title="Suport tehnic">
      <div className="spWrap">
        <a className="spBack" href="/suport">‹ Înapoi</a>
        <h2 className="spTitle">Tichet nou</h2>
        <p className="hint" style={{ fontSize: 14, marginBottom: 16 }}>Răspundem aici, în chat. Primești răspunsul și pe email.</p>
        <TicketForm />
      </div>
    </AppShell>
  );
}
