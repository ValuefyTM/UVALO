import type { Metadata } from "next";
import { page } from "@/lib/guard";
import { CHROME_VERSIONS } from "@/lib/chrome";
import { AppShell } from "@/components/AppShell";
import { WordTabs } from "@/components/WordTabs";

export const metadata: Metadata = { title: "UVALO pentru Chrome | UVALO" };
export const dynamic = "force-dynamic";

const STEPS = [
  ["Aduni anunțurile", "Pe imobiliare.ro, Storia, OLX sau Publi24 apeși „＋ Adaugă pagina curentă”. Le organizezi în grupuri și le dai nume („Comparabila 1”…)."],
  ["Capturezi tot", "Un click și extensia deschide fiecare anunț, închide bannerele, arată telefonul și descrierea completă, adaugă harta și fotografiază pagina, feliată pe pagini A4."],
  ["Trimiți în Word", "„Trimite în Word” le pune în contul tău UVALO; în Word, tab-ul UVALO → Instrumente → „Comparabile din Chrome” le inserează la cursor. Sau exporți direct Word / PDF."],
] as const;

/** UVALO pentru Chrome: the comparables capture extension, its download, installation and versions. */
export default async function Chrome({ searchParams }: { searchParams: Promise<{ conectat?: string }> }) {
  const { c } = await page();
  const on = c.modules.includes("chrome");
  const connected = (await searchParams).conectat === "1";
  const v = CHROME_VERSIONS[0].v;
  return (
    <AppShell c={c} active="chrome" title="UVALO pentru Chrome" subtitle="Dovezile comparabilelor, capturate complet, direct în raport">
      {connected && <div className="note">Ești conectat la UVALO. Revino în panoul extensiei din Chrome și apasă „Am făcut, verifică din nou”.</div>}
      {!on && <div className="note">{c.off.includes("chrome") ? "UVALO pentru Chrome este dezactivat temporar. Revine în curând." : (c.block ?? "Abonamentul firmei tale nu include UVALO pentru Chrome.")} Scrie-ne la <a className="rowLink" href="mailto:office@uvalo.ro">office@uvalo.ro</a>.</div>}

      <section className="wpHero cpHero">
        <div className="wpHeroText">
          <span className="wpEyebrow">Extensie pentru Google Chrome · v{v}</span>
          <h2>Anunțurile comparabilelor, capturate complet și puse în raport.</h2>
          <p>Fotografiază anunțurile imobiliare întregi, cu telefonul, descrierea completă și harta, feliate pe pagini A4, fiecare cu <b>sursa și data capturii</b>. Le trimiți în Word cu un click sau le exporți ca Word și PDF.</p>
          <div className="wpCta">
            <a className="btn btnGold" href="/chrome/uvalo-chrome.zip" download>Descarcă extensia</a>
            <a className="btn wpGhost" href="#instalare">Cum se instalează</a>
          </div>
          <ul className="wpBadges">
            <li>Pagini A4 cu sursa și data</li>
            <li>Telefon, descriere și hartă incluse</li>
            <li>Trimite direct în Word</li>
          </ul>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cpShot" src="/chrome/prezentare/panou.webp" alt="Panoul UVALO pentru Chrome cu comparabilele capturate" width={570} height={1170} />
      </section>

      <WordTabs tabs={[{ id: "prezentare", label: "Prezentare" }, { id: "instalare", label: "Instalare" }, { id: "versiuni", label: "Versiuni" }]}>
        <div className="wpPanel">
          <section className="wpTool">
            <div className="wpToolHead">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/word/assets/comps-80.png" alt="" width={48} height={48} />
              <div><span className="wpEyebrow dark">Cum funcționează</span><h2>De la anunț la raport, în trei pași</h2><p>Fără capturi de ecran făcute de mână, fără lipit poze în Word.</p></div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="wpShot wpPageShot cpWordShot" src="/chrome/prezentare/word.webp" alt="Panoul Comparabile din Chrome în Word" width={570} height={1170} loading="lazy" />
            <ol className="cpSteps">
              {STEPS.map(([t, d], i) => <li key={t}><b><span>{i + 1}</span>{t}</b><p>{d}</p></li>)}
            </ol>
            <ul className="wpFacts">
              <li><b>Antet de dovadă</b>: numele comparabilei, titlul anunțului, link activ, data capturii</li>
              <li><b>Grupuri</b> și ordine prin tragere, pagini inutile șterse înainte de export</li>
              <li><b>Telefonul</b> afișat automat (cu sesiunea ta pe site) și <b>harta</b> ca ultimă pagină</li>
              <li><b>Capturile rămân în Chrome</b>; în UVALO ajung doar când apeși „Trimite în Word”, pentru 7 zile</li>
            </ul>
          </section>
          <div className="wpEnd"><b>Îl încerci?</b><a className="btn btnGold" href="#instalare">Instalare în 2 minute →</a></div>
          <p className="legalLinks"><a href="/termeni">Termeni de utilizare</a> · <a href="/confidentialitate">Politica de confidențialitate</a></p>
        </div>

        <div className="wpPanel">
          <section className="card">
            <h2>Instalare în Chrome</h2>
            <ol className="wordSteps">
              <li><b>Descarcă extensia</b> și dezarhivează folderul <code>uvalo-chrome</code> într-un loc stabil (de exemplu în Documente). Nu-l muta după instalare.</li>
              <li>În Chrome deschide <code>chrome://extensions</code> și pornește <b>Modul pentru dezvoltatori</b> (dreapta sus).</li>
              <li>Apasă <b>Încarcă extensia neîmpachetată</b> și alege folderul <code>uvalo-chrome</code>.</li>
              <li>Fixează extensia în bară (iconița puzzle → pin), apoi apasă pe ea: se deschide panoul lateral. Prima dată apeși <b>Conectează-te la UVALO</b>.</li>
            </ol>
            <div className="actions" style={{ justifyContent: "flex-start" }}>
              <a className="btn btnGold" href="/chrome/uvalo-chrome.zip" download>Descarcă extensia (v{v})</a>
            </div>
            <p className="hint">La o versiune nouă: descarcă arhiva, înlocuiește conținutul folderului și apasă ↻ la extensie în <code>chrome://extensions</code>. Panoul extensiei îți spune când a apărut o versiune nouă. Merge și în Microsoft Edge (<code>edge://extensions</code>).</p>
          </section>
          <section className="card">
            <h2>Bine de știut</h2>
            <ul className="wordList">
              <li>Pe durata capturii Chrome afișează bannerul „a început depanarea acestui browser”: e normal, așa se face captura paginii întregi.</li>
              <li>Pentru site-urile care arată telefonul doar cu cont (de exemplu OLX), intră în cont pe site înainte de captură.</li>
              <li>Dacă un site cere CAPTCHA, rezolvă-l în tab și re-capturează anunțul cu 📷.</li>
              <li>În Word, comparabilele trimise apar în tab-ul UVALO → Instrumente → <b>Comparabile din Chrome</b>.</li>
            </ul>
          </section>
        </div>

        <div className="wpPanel">
          <section className="card">
            <div className="cardHead"><h2>Versiuni</h2><span className="pill pillOk"><i />v{v} · actuală</span></div>
            <ul className="wordVers">
              {CHROME_VERSIONS.map((r) => (
                <li key={r.v}><div><b>v{r.v}</b> <span className="muted">· {r.date}</span></div><ul>{r.notes.map((n) => <li key={n}>{n}</li>)}</ul></li>
              ))}
            </ul>
          </section>
        </div>
      </WordTabs>
    </AppShell>
  );
}
