import type { Metadata } from "next";
import { page } from "@/lib/guard";
import { origin } from "@/lib/site";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = { title: "UVALO pentru Word | UVALO" };
export const dynamic = "force-dynamic";

/** UVALO pentru Word: what the add-in does and how to install it (Windows installer, firm-wide, Mac). */
export default async function Word() {
  const { c } = await page();
  const on = c.modules.includes("word");
  const o = await origin();
  return (
    <AppShell c={c} active="word" title="UVALO pentru Word" subtitle="Anexa foto și anexa cu documente, direct în raportul Word">
      {!on && <div className="note">{c.off.includes("word") ? "UVALO pentru Word este dezactivat temporar. Revine în curând." : (c.block ?? "Abonamentul firmei tale nu include UVALO pentru Word.")} Scrie-ne la <a className="rowLink" href="mailto:office@valuefy.ro">office@valuefy.ro</a>.</div>}
      <div className="cols">
        <section className="card">
          <h2>Instalare pe Windows</h2>
          <ol className="wordSteps">
            <li><b>Descarcă instalatorul</b> și deschide-l (dublu-click). Dacă Windows întreabă, alege <i>Mai multe informații → Rulează oricum</i>.</li>
            <li>Instalatorul închide Word, înregistrează UVALO și scoate add-in-ul vechi <i>VALUEFY Anexe</i>, dacă îl ai. Nu cere drepturi de administrator și nu instalează nimic altceva.</li>
            <li>Deschide Word. Dacă tab-ul <b>UVALO</b> nu apare (sau dispare după ce repornești Word): <b>Inserare → Add-in-urile mele → Add-in-uri de dezvoltator → UVALO</b>. Pentru un tab care rămâne mereu, fără acest pas, folosește instalarea pentru toată firma din Microsoft 365 (mai jos).</li>
            <li>La prima folosire te conectezi în panoul din dreapta cu contul UVALO (email + cod), o singură dată pe calculator.</li>
          </ol>
          <div className="actions" style={{ justifyContent: "flex-start" }}>
            <a className="btn btnGold" href="/word/instaleaza.cmd" download>Descarcă instalatorul</a>
            <a className="btn btnGhost btnSm" href="/word/dezinstaleaza.cmd" download>Dezinstalare</a>
          </div>
          <p className="hint">Actualizările vin automat: panourile se încarcă din UVALO, deci nu reinstalezi nimic la o versiune nouă. Instalatorul se rulează din nou doar dacă îți spunem noi (când apare un buton nou în tab).</p>
        </section>
        <section className="card">
          <h2>Ce face</h2>
          <ul className="wordList">
            <li><b>Anexă foto</b>: alegi folderul cu pozele de la inspecție, bifezi, ordonezi, scrii legendele și alegi câte poze pe pagină. Pozele se micșorează la mărimea de tipar, ca raportul să rămână mic.</li>
            <li><b>Anexă documente</b>: extras CF, releveu, autorizații (PDF sau scanări). Fiecare pagină se poate bifa, roti sau scoate; fiecare document primește titlu, cu numerotare automată.</li>
            <li><b>Comparabile</b>: localizatorul de comparabile într-o fereastră mare, în Word; „Inserează în raport” pune harta și tabelul comparabilelor la cursor.</li>
            <li><b>Inserează din nou</b> fără dubluri: anexa e un bloc marcat, pe care UVALO îl înlocuiește. Merg și anexele făcute cu vechiul add-in VALUEFY.</li>
          </ul>
          <p className="hint">Pozele și PDF-urile se prelucrează pe calculatorul tău, în Word; nu se trimit pe server.</p>
        </section>
      </div>
      <div className="cols">
        <section className="card">
          <h2>Pentru toată firma (Microsoft 365)</h2>
          <p className="hint">Administratorul Microsoft 365 al firmei îl poate instala pentru toți angajații, fără instalator pe fiecare calculator: <b>admin.microsoft.com → Setări → Aplicații integrate → Încarcă aplicații personalizate</b>, apoi adresa manifestului de mai jos. Nu trece prin Microsoft Store și nu are nevoie de aprobarea Microsoft.</p>
          <code className="wordUrl">{o}/word/manifest.xml</code>
          <div className="actions" style={{ justifyContent: "flex-start" }}><a className="btn btnGhost btnSm" href="/word/manifest.xml" download="uvalo-word-manifest.xml">Descarcă manifestul</a></div>
        </section>
        <section className="card">
          <h2>Word pe Mac</h2>
          <p className="hint">Descarcă manifestul și copiază-l în folderul <code>~/Library/Containers/com.microsoft.Word/Data/Documents/wef</code> (creează folderul <code>wef</code> dacă nu există), apoi repornește Word. Tab-ul UVALO apare la fel ca pe Windows.</p>
          <p className="hint">Word în browser (Office pe web) nu e încă suportat.</p>
        </section>
      </div>
      <section className="card">
        <h2>Nu apare tab-ul UVALO?</h2>
        <ol className="wordSteps">
          <li>Închide Word de tot (și din bara de jos) și rulează din nou instalatorul. Fiecare pas afișează <b>[OK]</b> sau <b>[!!]</b> cu motivul; dacă apare <b>[!!]</b>, trimite-ne o captură a ferestrei.</li>
          <li>În Word: <b>Inserare → Add-in-urile mele</b> (sau <b>Pornire → Add-in-uri → Mai multe add-in-uri</b>) → secțiunea <b>Add-in-uri de dezvoltator</b> → <b>UVALO</b> → Adaugă.</li>
          <li>Dacă firma are calculatoare administrate de IT, add-in-urile instalate local pot fi blocate; atunci varianta potrivită e instalarea pentru toată firma, din Microsoft 365.</li>
        </ol>
      </section>
    </AppShell>
  );
}
