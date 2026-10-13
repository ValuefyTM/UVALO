import type { Metadata } from "next";
import { origin } from "@/lib/site";
import { COMPANY } from "@/components/LegalPage";
import { SiteGallery } from "@/components/SiteGallery";

// The presentation site on uvalo.ro (worker.ts serves this page for "/" on SITE_HOSTS). Public, works in maintenance too.
// Focus on Colaborări, announces the market analyses; no pricing.
export const metadata: Metadata = {
  title: "UVALO · platforma evaluatorilor imobiliari",
  description: "Colaborări între evaluatori autorizați ANEVAR: găsești un coleg pentru inspecție în câteva minute. Plus localizatorul cadastral, analiza amplasamentului, comparabilele și anexele în Word.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://uvalo.ro/" },
};

const RENTS: [string, number, string, boolean][] = [
  ["Timișoara (prime)", 4.4, "4,30–4,50", true], ["Deta", 3.93, "3,93", false], ["Șag", 3.5, "3,50", false],
  ["Lugoj", 2.61, "2,61", false], ["Fibiș", 1.8, "1,80", false], ["Lugoj (depozit)", 1.63, "1,63", false],
];
const LAND: [string, string, string, string][] = [
  ["Deta Est", "Intravilan, pretabil industrial", "25.000", "3,52"],
  ["Deta", "Intravilan extins, front stradal", "145.000", "2,69"],
  ["Deta – spre Banloc", "Agricol comasat, extravilan", "52.400", "1,05"],
  ["Timișoara (reper)", "Teren autorizat industrial", "—", "35–60"],
];

export default async function Site() {
  const app = await origin();
  const signup = `${app}/solicita-cont`, login = `${app}/login`;
  return (
    <div className="ld">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" precedence="default" />

      <header className="ldTop">
        <div className="ldWrap ldTopIn">
          <a href="/" aria-label="UVALO"><img src="/uvalo-lockup.svg" alt="UVALO" className="ldLogo" /></a>
          <nav className="ldNavLinks" aria-label="Secțiuni">
            <a href="#colaborari">Colaborări</a><a href="#analize">Analize de piață</a><a href="#instrumente">Instrumente</a><a href="#birouri">Pentru birouri</a>
          </nav>
          <div className="ldTopActs">
            <a className="ldBtn ldGhostDark ldSm" href={login}>Autentificare</a>
            <a className="ldBtn ldGold ldSm" href={`${app}/`}>Intră în platformă →</a>
          </div>
        </div>
      </header>

      <section className="ldHero">
        <div className="ldWrap ldHeroGrid">
          <div className="ldStack">
            <span className="ldKicker"><span className="ldBadge">NOU ÎN UVALO</span><span>Colaborări între evaluatori autorizați ANEVAR</span></span>
            <h1 className="ldH ldH1">Găsești un coleg pentru inspecție <em>în câteva minute.</em></h1>
            <p className="ldLead">Publici lucrarea, colegii din zona proprietății primesc notificare și îți cer detalii. Alegi pe cine vrei și vă înțelegeți în chat. Sau preiei tu inspecții și rapoarte acolo unde lucrezi deja.</p>
            <div className="ldActs">
              <a className="ldBtn ldGold ldBig" href={signup}>Creează cont gratuit</a>
              <a className="ldBtn ldGhostDark ldBig" href={login}>Am deja cont</a>
            </div>
            <small className="ldNote">Contul se cere cu numărul legitimației ANEVAR și se activează după verificarea în Tabloul membrilor titulari.</small>
          </div>
          <div className="ldHeroArt">
            <img src="/site/colaborari.png" alt="Un anunț de inspecție din Arad la 62 km, cu buget de 250 de lei, și o conversație între doi evaluatori despre extrasul CF" />
            <div className="ldToast">
              <span className="ldToastIc"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg></span>
              <span><b>Anunț nou în zona ta</b><small>în aplicație și pe email, cu link direct</small></span>
            </div>
          </div>
        </div>
      </section>

      <section id="colaborari" className="ldSec ldSecTop">
        <div className="ldWrap ldStack ldGap36">
          <div className="ldHead">
            <span className="ldEyebrow">COLABORĂRI · CUM FUNCȚIONEAZĂ</span>
            <h2 className="ldH ldH2">De la anunț la coleg ales, fără telefoane date pe grupuri.</h2>
          </div>
          <div className="ldGrid3">
            {[
              ["Publici lucrarea", "Inspecție sau raport + inspecție: localitatea, tipul proprietății, specializarea, termenul și bugetul (sau „de stabilit”)."],
              ["Colegii din zonă îți cer detalii", "Anunțul ajunge doar la evaluatorii care acoperă zona: rază în jurul adresei sau județe întregi. Vezi profilul și distanța fiecăruia."],
              ["Alegi și vorbiți în chat", "Telefonul și emailul apar abia după ce începe conversația. Lucrarea trece „În lucru” și iese din feed."],
            ].map(([t, d], i) => (
              <div key={t} className="ldCard"><span className="ldH ldNum">{i + 1}</span><b className="ldH ldCardT">{t}</b><p>{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="ldSec ldSecBottom">
        <div className="ldWrap ldGrid2">
          <div className="ldPanel ldDark">
            <span className="ldEyebrow gold">AI NEVOIE DE AJUTOR</span>
            <h3 className="ldH ldH3">O inspecție la 80 km nu mai înseamnă o zi pierdută.</h3>
            <ul className="ldList">
              <li>Anunțul ajunge la colegii din zona proprietății, nu la toată lumea.</li>
              <li>Vezi profilul fiecăruia: specializările din Tabloul ANEVAR, experiența, distanța.</li>
              <li>Îți editezi sau ștergi anunțul oricând; cine a cerut detalii e anunțat.</li>
            </ul>
            <a className="ldBtn ldGold ldSelf" href={signup}>Creează cont gratuit</a>
          </div>
          <div className="ldPanel">
            <span className="ldEyebrow">VREI LUCRĂRI ÎN ZONA TA</span>
            <h3 className="ldH ldH3">Lucrări de la colegi, acolo unde ajungi oricum.</h3>
            <ul className="ldList">
              <li>Îți alegi zona și tipurile de lucrări: doar inspecții sau și rapoarte.</li>
              <li>Primești anunțurile noi în aplicație și pe email, cu un link care te duce direct la anunț.</li>
              <li>„Doar mă uit”: vezi anunțurile fără notificări, până te decizi.</li>
            </ul>
            <a className="ldBtn ldInk ldSelf" href={signup}>Activează Colaborările</a>
          </div>
        </div>
      </section>

      <section className="ldSecBottom">
        <div className="ldWrap">
          <div className="ldTrust">
            {[
              ["Doar evaluatori autorizați", "Conturile se verifică după legitimația ANEVAR."],
              ["Contact protejat", "Datele apar doar între voi, după ce începe discuția."],
              ["Statusuri clare", "Activ, În lucru, Arhivat: știi mereu ce mai e disponibil."],
              ["Anunțuri de la firme", "Angajări și colaborări pe termen lung, în curând."],
            ].map(([t, d]) => <span key={t}><b className="ldH">{t}</b><small>{d}</small></span>)}
          </div>
        </div>
      </section>

      <section id="analize" className="ldDarkSec">
        <div className="ldWrap ldHeroGrid ldStart">
          <div className="ldStack ldSticky">
            <span className="ldKicker"><span className="ldBadge ldOutline">ÎN CURÂND</span><span>Analize de piață</span></span>
            <h2 className="ldH ldH2">Analiza de piață pentru raport, <em>cu sursele la vedere.</em></h2>
            <p className="ldLead ldLeadSm">Chirii și prețuri cerute pe localități, terenuri, repere de piață din rapoartele publice și o metodă de lucru explicată, totul cu linkul fiecărei surse. Gata de adaptat în capitolul „Analiza pieței”.</p>
            <ul className="ldList ldListLight">
              <li>Tabele de oferte cu EUR/mp calculat și observații</li>
              <li>Repere din rapoartele de piață (chirii prime, neocupare)</li>
              <li>Limitele datelor și pașii de verificare, scriși explicit</li>
            </ul>
            <a className="ldBtn ldGold ldSelf" href={signup}>Creează cont și fii primul care le primește</a>
            <small className="ldNote">Imaginile sunt dintr-un raport pilot: piața industrială din Deta și sudul județului Timiș, 7 octombrie 2026. Valorile sunt oferte publice, nu tranzacții.</small>
          </div>
          <div className="ldStack ldGap22">
            <figure className="ldPrint ldTiltL">
              <span className="ldEyebrow">ANALIZĂ DE PIAȚĂ · INDUSTRIAL · DETA ȘI SUDUL JUD. TIMIȘ</span>
              <h3 className="ldH">Chirii cerute pentru hale existente</h3>
              <small>EUR/mp/lună · oferte publice, octombrie 2026</small>
              <div className="ldRents" role="img" aria-label={`Chirii cerute: ${RENTS.map(([p, , l]) => `${p} ${l}`).join(", ")} EUR pe metru pătrat pe lună`}>
                {RENTS.map(([p, v, l, hi]) => (
                  <div key={p}><span>{p}</span><span className="ldTrack"><i style={{ width: `${(v / 5) * 100}%` }} className={hi ? "hi" : ""} /></span><b>{l}</b></div>
                ))}
              </div>
              <p>Mediana halelor vechi din periferia Timișoarei este ~4–4,5 EUR/mp, față de ~2,5–3 EUR/mp în orașele mici din sud și est.</p>
            </figure>
            <figure className="ldPrint ldTiltR ldIndent">
              <h3 className="ldH">Terenuri cu potențial industrial</h3>
              <small>Preț cerut, EUR/mp</small>
              <div className="ldTableWrap">
                <table>
                  <thead><tr><th>LOCALITATE</th><th>TEREN</th><th className="r">MP</th><th className="r">EUR/MP</th></tr></thead>
                  <tbody>{LAND.map(([a, b, c, d]) => <tr key={a}><td>{a}</td><td>{b}</td><td className="r">{c}</td><td className="r"><b>{d}</b></td></tr>)}</tbody>
                </table>
              </div>
            </figure>
            <figure className="ldFigures">
              <span><b className="ldH">4,30–4,50</b><small>EUR/mp/lună, chirie prime Timișoara (Q2 2026)</small></span>
              <span><b className="ldH">~11%</b><small>neocupare în Timișoara, a doua cea mai mare din țară</small></span>
              <span className="hi"><b className="ldH">35–50%</b><small>decalaj de locație Deta vs. periferia Timișoarei</small></span>
            </figure>
          </div>
        </div>
      </section>

      <section id="instrumente" className="ldSec">
        <div className="ldWrap ldStack ldGap34">
          <div className="ldHead">
            <span className="ldEyebrow">ȘI INSTRUMENTELE PE CARE LE FOLOSEȘTI ZILNIC</span>
            <h2 className="ldH ldH2">Un singur cont, de la parcelă până la anexa din raport.</h2>
          </div>
          <div className="ldGrid2 ldFeature">
            <div className="ldStack ldGap14">
              <span className="ldEyebrow">LOCALIZATOR CADASTRAL</span>
              <h3 className="ldH ldH3">Orice imobil din planurile ANCPI, după număr cadastral, topo sau adresă.</h3>
              <p className="ldBody">Conturul parcelei, construcțiile, vecinii și coordonatele Stereo 70, plus poziția ta pe teren pe telefon. Fișa imobilului o exporți în PDF, Word sau PNG.</p>
            </div>
            <img src="/site/localizator.webp" alt="Localizatorul cadastral UVALO: parcela găsită pe plan, cu construcțiile, vecinii și fișa cu suprafața" loading="lazy" />
          </div>
          <div className="ldGrid3">
            <div className="ldCard ldTool">
              <span className="ldEyebrow">ANALIZA AMPLASAMENTULUI</span>
              <b className="ldH ldCardT">Fișa zonei și textul pentru raport</b>
              <p>Forma și deschiderea parcelei, dotările din jur, drumurile principale și factorii negativi, plus „Descrierea amplasamentului” redactată cu AI, cu cifrele verificate față de date.</p>
              <img src="/site/amplasament.webp" alt="Fișa de analiză a amplasamentului exportată: încadrarea în zonă cu dotările numerotate, planul de situație al parcelei și tabelele cu caracteristicile terenului" loading="lazy" />
            </div>
            <div className="ldCard ldTool">
              <span className="ldEyebrow">LOCALIZATOR DE COMPARABILE</span>
              <b className="ldH ldCardT">Subiectul și comparabilele pe hartă</b>
              <p>Distanța până la fiecare comparabil, tabelul și harta, gata de inserat în raport.</p>
              <img src="/site/comparabile.webp" alt="Localizatorul de comparabile: proprietatea subiect și patru comparabile pe hartă, cu distanțele, legenda și butoanele de export" loading="lazy" />
            </div>
            <div className="ldCard ldTool">
              <span className="ldEyebrow">UVALO PENTRU WORD</span>
              <b className="ldH ldCardT">Anexele, direct în raport</b>
              <p>Anexa foto și anexa cu documente PDF dintr-un tab UVALO în Word, plus comparabilele cu hartă.</p>
              <SiteGallery />
            </div>
          </div>
          <div className="ldGrid2 ldFeature ldDark">
            <div className="ldStack ldGap14">
              <span className="ldEyebrow gold">UVALO PENTRU CHROME</span>
              <h3 className="ldH ldH3">Anunțurile comparabile, capturate întreg, pe pagini A4.</h3>
              <p className="ldBody">Salvezi anunțul complet dintr-un click, faci dosarul Word sau PDF și îl trimiți direct în raport.</p>
            </div>
            <img src="/site/chrome.webp" alt="Un anunț de spațiu comercial de închiriat deschis în browser, cu panoul UVALO pentru Chrome alături: comparabilele în listă, capturarea paginii întregi și butoanele Word, PDF și Trimite în Word" loading="lazy" />
          </div>
        </div>
      </section>

      <section id="birouri" className="ldSecBottom">
        <div className="ldWrap ldGrid2">
          <div className="ldPanel ldSmallPanel">
            <span className="ldEyebrow">PENTRU FIRME DE EVALUARE · ÎN CURÂND</span>
            <b className="ldH ldH4">Firmele vor putea publica anunțuri de angajare și colaborare.</b>
            <p>Posturi de evaluator, colaborări pe termen lung sau colaboratori pe zone, în tab-ul „De la firme” din Colaborări, văzute direct de evaluatorii din zona potrivită.</p>
          </div>
          <div className="ldPanel ldSmallPanel ldDashed">
            <span className="ldEyebrow">PENTRU BIROURI DE EVALUARE · ÎN TESTARE</span>
            <b className="ldH ldH4">Toată echipa într-un singur cont de birou.</b>
            <p>Denumirea și logo-ul firmei, colegii evaluatori și colaboratorii fără legitimație (asistenți, inspectori), activitatea echipei într-un singur loc.</p>
          </div>
        </div>
      </section>

      <section className="ldDarkSec ldCta">
        <div className="ldWrap ldStack ldCenter">
          <h2 className="ldH ldH2">Intră în rețeaua evaluatorilor din zona ta.</h2>
          <p className="ldLead">Contul este gratuit pentru membrii titulari ANEVAR. Îl ceri cu numărul legitimației, noi îl verificăm în Tablou.</p>
          <div className="ldActs ldCenterRow">
            <a className="ldBtn ldGold ldBig" href={signup}>Creează cont gratuit</a>
            <a className="ldBtn ldGhostDark ldBig" href={login}>Autentificare</a>
          </div>
        </div>
      </section>

      <footer className="ldFoot">
        <div className="ldWrap ldFootIn">
          <span className="ldFootBrand"><img src="/uvalo-lockup.svg" alt="UVALO" /><span>Platformă pentru evaluatori</span></span>
          <span className="ldFootLinks">
            <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
            <a href={`${app}/confidentialitate`}>Confidențialitate</a>
            <a href={`${app}/termeni`}>Termeni</a>
          </span>
          <small className="ldFootLegal">© {new Date().getFullYear()} {COMPANY.name} · CUI {COMPANY.cui} · {COMPANY.seat}</small>
        </div>
      </footer>
    </div>
  );
}
