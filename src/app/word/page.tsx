import type { Metadata } from "next";
import { page } from "@/lib/guard";
import { origin } from "@/lib/site";
import { WORD_VERSIONS } from "@/lib/word";
import { AppShell } from "@/components/AppShell";
import { WordTabs } from "@/components/WordTabs";

export const metadata: Metadata = { title: "UVALO pentru Word | UVALO" };
export const dynamic = "force-dynamic";

/** A tool of the add-in, presented with real screenshots of its pane (public/word/prezentare/). */
const STEPS = {
  foto: [
    ["foto-1-lista", "Alegi pozele", "Tot folderul de la inspecție sau doar câteva. Bifezi ce intră, le tragi în ordinea dorită și scrii legenda sub fiecare."],
    ["foto-2-aranjare", "Aranjezi pagina", "1–12 poze pe pagină, cu proporția păstrată sau decupate uniform, spațiu, chenar, legende numerotate, titlul anexei."],
    ["foto-3-previzualizare", "Verifici și inserezi", "Vezi paginile exact cum ies, apoi un click le pune în raport. Pozele se micșorează la mărimea de tipar."],
  ],
  doc: [
    ["doc-1-lista", "Adaugi actele", "Extras CF, releveu, certificat energetic, autorizații: PDF sau scanări. Fiecare pagină apare separat; o bifezi, o rotești sau o scoți."],
    ["doc-2-restranse", "Pui documentele în ordine", "Restrângi paginile ca să vezi doar lista documentelor și le muți trăgându-le de mâner. Titlul fiecăruia se scrie direct în listă."],
    ["doc-3-previzualizare", "Verifici și inserezi", "O pagină de document pe o pagină Word, cu titlu numerotat deasupra. Planurile landscape se rotesc singure."],
  ],
} as const;

/** UVALO pentru Word: presentation of the add-in (tools with screenshots), installation and versions, in tabs. */
export default async function Word() {
  const { c } = await page();
  const on = c.modules.includes("word");
  const o = await origin();
  return (
    <AppShell c={c} active="word" title="UVALO pentru Word" subtitle="Anexele raportului de evaluare, direct în Word">
      {!on && <div className="note">{c.off.includes("word") ? "UVALO pentru Word este dezactivat temporar. Revine în curând." : (c.block ?? "Abonamentul firmei tale nu include UVALO pentru Word.")} Scrie-ne la <a className="rowLink" href="mailto:office@uvalo.ro">office@uvalo.ro</a>.</div>}

      <section className="wpHero">
        <div className="wpHeroText">
          <span className="wpEyebrow">Add-in pentru Microsoft Word · v{WORD_VERSIONS[0].v}</span>
          <h2>Anexa foto și anexa cu acte, gata în câteva minute.</h2>
          <p>Un tab <b>UVALO</b> în Word, cu instrumentele care așază pozele de la inspecție și documentele imobilului în raport: ordonate, cu legende și titluri, la mărimea potrivită.</p>
          <div className="wpCta">
            <a className="btn btnGold" href="#instalare">Instalează în Word</a>
            <a className="btn wpGhost" href="#anexa-foto">Vezi cum funcționează</a>
          </div>
          <ul className="wpBadges">
            <li>Se actualizează singur</li>
            <li>Pozele rămân pe calculatorul tău</li>
            <li>Lucrul se păstrează dacă închizi panoul</li>
          </ul>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="wpHeroShot" src="/word/prezentare/hero-foto.webp" alt="Word cu tab-ul UVALO și panoul Anexă foto deschis lângă anexa inserată" width={1600} height={1000} />
      </section>

      <WordTabs tabs={[{ id: "prezentare", label: "Prezentare" }, { id: "instalare", label: "Instalare" }, { id: "versiuni", label: "Versiuni" }]}>
        <div className="wpPanel">
          <section className="wpTool" id="anexa-foto">
            <div className="wpToolHead">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/word/assets/foto-80.png" alt="" width={48} height={48} />
              <div><span className="wpEyebrow dark">Instrumentul 1</span><h2>Anexă foto</h2><p>Pozele de la inspecție, așezate în pagină fără să le muți una câte una prin Word.</p></div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="wpShot wpPageShot" src="/word/prezentare/foto-pagina.webp" alt="Anexa foto inserată în raport: patru poze pe pagină, cu legende numerotate" width={800} height={701} loading="lazy" />
            <ol className="wpSteps">
              {STEPS.foto.map(([img, t, d], i) => (
                <li key={img}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/word/prezentare/${img}.webp`} alt={t} width={570} height={1170} loading="lazy" />
                  <b><span>{i + 1}</span>{t}</b><p>{d}</p>
                </li>
              ))}
            </ol>
            <ul className="wpFacts">
              <li><b>Ordonare</b> manuală, după nume sau după data fotografierii</li>
              <li><b>Legende</b> „Foto 3 – Bucătărie”, numerotate automat</li>
              <li><b>Rotire</b> și mărire, din tastatură: ← → Space R</li>
              <li><b>Inserezi din nou</b> fără dubluri: anexa existentă se înlocuiește</li>
            </ul>
          </section>

          <section className="wpTool" id="anexa-documente">
            <div className="wpToolHead">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/word/assets/doc-80.png" alt="" width={48} height={48} />
              <div><span className="wpEyebrow dark">Instrumentul 2</span><h2>Anexă documente</h2><p>Actele imobilului, pagină cu pagină, fiecare cu titlul lui, în ordinea pe care o vrei.</p></div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="wpShot" src="/word/prezentare/hero-doc.webp" alt="Word cu panoul Anexă documente: documentele restrânse, lângă anexa inserată" width={1600} height={1000} loading="lazy" />
            <ol className="wpSteps">
              {STEPS.doc.map(([img, t, d], i) => (
                <li key={img}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/word/prezentare/${img}.webp`} alt={t} width={570} height={1170} loading="lazy" />
                  <b><span>{i + 1}</span>{t}</b><p>{d}</p>
                </li>
              ))}
            </ol>
            <ul className="wpFacts">
              <li><b>Titluri</b> cu prefix numerotat: „Anexa 3.1 – Extras de carte funciară”</li>
              <li><b>Stil Titlu 2/3</b>, ca documentele să apară în cuprins</li>
              <li><b>Scanări JPG/PNG</b> merg alături de PDF-uri</li>
              <li><b>Calitate</b> compactă, standard sau de tipar</li>
            </ul>
          </section>

          <section className="wpMore">
            <div><b>Comparabile</b><p>Localizatorul de comparabile într-o fereastră mare, în Word; harta și tabelul intră în raport la cursor.</p></div>
            <div><b>Lucrul nu se pierde</b><p>Dacă închizi panoul sau Word, pozele și actele te așteaptă 12 ore, cu ordinea și legendele.</p></div>
            <div><b>Totul local</b><p>Pozele și PDF-urile se prelucrează pe calculatorul tău; nu se trimit pe server.</p></div>
          </section>
          <div className="wpEnd"><b>Îl încerci?</b><a className="btn btnGold" href="#instalare">Instalare în 2 minute →</a></div>
          <p className="legalLinks"><a href="/termeni">Termeni de utilizare</a> · <a href="/confidentialitate">Politica de confidențialitate</a> · Pozele și documentele rămân pe calculatorul tău.</p>
        </div>

        <div className="wpPanel">
        <section className="card">
          <h2>Instalare pe Windows</h2>
          <ol className="wordSteps">
            <li><b>Descarcă instalatorul</b> și deschide-l (dublu-click). Dacă Windows întreabă, alege <i>Mai multe informații → Rulează oricum</i>.</li>
            <li>Instalatorul închide Word, înregistrează UVALO și scoate add-in-ul vechi de anexe, dacă îl ai. Nu cere drepturi de administrator și nu instalează nimic altceva.</li>
            <li>Deschide Word. Dacă tab-ul <b>UVALO</b> nu apare (sau dispare după ce repornești Word): <b>Inserare → Add-in-urile mele → Add-in-uri de dezvoltator → UVALO</b>. Pentru un tab care rămâne mereu, fără acest pas, folosește instalarea pentru toată firma din Microsoft 365 (mai jos).</li>
            <li>La prima folosire te conectezi în panoul din dreapta cu contul UVALO (email + cod), o singură dată pe calculator.</li>
          </ol>
          <div className="actions" style={{ justifyContent: "flex-start" }}>
            <a className="btn btnGold" href="/word/instaleaza.cmd" download>Descarcă instalatorul</a>
            <a className="btn btnGhost btnSm" href="/word/dezinstaleaza.cmd" download>Dezinstalare</a>
          </div>
          <p className="hint">Actualizările vin automat: panourile se încarcă din UVALO, deci nu reinstalezi nimic la o versiune nouă. Instalatorul se rulează din nou doar dacă îți spunem noi (când apare un buton nou în tab).</p>
        </section>
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
        </div>

        <div className="wpPanel">
      <section className="card">
        <div className="cardHead"><h2>Versiuni</h2><span className="pill pillOk"><i />v{WORD_VERSIONS[0].v} · actuală</span></div>
        <p className="hint">Versiunile noi ajung singure în Word. Doar cele marcate „cere reinstalare” (butoane noi în tab) au nevoie să rulezi din nou instalatorul.</p>
        <ul className="wordVers">
          {WORD_VERSIONS.map((r) => (
            <li key={r.v}>
              <div><b>v{r.v}</b> <span className="muted">· {r.date}</span>{r.manifest && <span className="pill pillWarn" style={{ marginLeft: 8 }}><i />cere reinstalare</span>}</div>
              <ul>{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </li>
          ))}
        </ul>
      </section>
        </div>
      </WordTabs>
    </AppShell>
  );
}
