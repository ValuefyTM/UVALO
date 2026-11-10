import type { Metadata } from "next";
import { origin } from "@/lib/site";
import { COMPANY } from "@/components/LegalPage";

// The presentation page of the inspection app, on uvalo.ro/aplicatie-inspectie (worker.ts rewrites it to /site/inspectii on the site
// host). Public, works in maintenance too. How it works (web → phone → web) and the stores: today a web app you install
// from the browser, soon in the App Store and Google Play.
const OG = { url: "/site/inspectii-social.png", width: 1200, height: 628, alt: "Aplicația UVALO pentru inspecții: fișa pe telefon și lista pe web" };
export const metadata: Metadata = {
  title: "Aplicația UVALO pentru inspecții · în curând în App Store și Google Play",
  description: "Fișa de inspecție, pozele, actele, locația GPS și semnătura clientului, completate pe teren din telefon și gata pe web pentru raport. Merge și fără semnal. În curând în App Store și Google Play.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://uvalo.ro/aplicatie-inspectie" },
  openGraph: { type: "website", siteName: "UVALO", locale: "ro_RO", title: "Aplicația UVALO pentru inspecții", description: "Inspecția din telefon. Fișa, gata pe web. În curând în App Store și Google Play.", images: [OG] },
  twitter: { card: "summary_large_image", images: [OG.url] },
};

const CHECK = <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>;
const APPLE = <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.6-1-2.6-3.8ZM14 5.4c.7-.8 1.1-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4Z" /></svg>;
const PLAY = <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M4 3.5v17c0 .5.5.8.9.6l1.1-.6L15.4 12 6 3.5 4.9 2.9c-.4-.2-.9.1-.9.6Z" opacity=".9" /><path d="M15.4 12 6 20.5l9.9-5.6 2.9-1.6c.6-.4.6-1.2 0-1.6l-2.9-1.6L6 3.5l9.4 8.5Z" /></svg>;

const STEPS: [string, string, string][] = [
  ["Pe web", "Pregătești inspecția", "Adresa, extrasul CF citit automat, releveul și fișa potrivită tipului de imobil: apartament, casă, teren, spațiu comercial sau una făcută de tine. O programezi și alegi cine o face: tu, un coleg din birou sau un colaborator."],
  ["Pe telefon", "O faci pe teren", "Fișa pe secțiuni, cu întrebările obligatorii numărate. Pozele pe categorii, direct din cameră sau din galerie. Actele deschise peste fișă, finisajele pe încăperi, locația GPS confirmată pe hartă și semnătura persoanei prezente. Merge și fără semnal."],
  ["Pe web", "Fișa e gata pentru raport", "Primește număr și dată, semnătura ta se aplică automat, locația apare pe hartă. O descarci în PDF, o trimiți clientului sau băncii printr-un link, o întorci pe telefon pentru completări sau o preiei în CRM-ul firmei prin API."],
];

const FEATURES: [string, string][] = [
  ["Merge și fără semnal", "Răspunsurile, pozele și semnătura se păstrează pe telefon și pleacă singure când revine rețeaua. În subsol sau la țară, inspecția nu se oprește."],
  ["Notificări care contează", "Cu o oră înainte de fiecare inspecție, dimineața cu lista zilei, și de fiecare dată când cineva îți alocă, programează sau întoarce o inspecție."],
  ["Fișe pe tipuri de imobil", "Fișele UVALO au structura folosită de evaluatori, pe apartament, casă, teren, spațiu comercial. Le adaptezi în editorul de fișe, cu întrebări compuse și răspunsuri precompletate."],
  ["Locația inspecției", "La deschiderea fișei telefonul ia poziția GPS; înainte de semnătură tragi pinul pe imobil dacă e cazul. Harta mică intră în fișă și în PDF."],
  ["Pentru birouri", "Inspecțiile se atribuie colegilor din birou sau colaboratorilor, care le acceptă din telefon. Operaționalii le pregătesc pe web, tu vezi tot ce se întâmplă, în timp real."],
  ["Integrare cu CRM-ul tău", "Aplicația firmei creează inspecțiile prin API, primește un webhook la fiecare pas și citește fișa completă, cu poze, semnătură și locație."],
];

export default async function App() {
  const o = await origin();
  const onSite = /^https?:\/\/(www\.)?uvalo\.ro$/i.test(o);
  const app = onSite ? "https://app.uvalo.ro" : o;
  const home = onSite ? "/" : "/site";
  const signup = `${app}/solicita-cont`, login = `${app}/login`;
  return (
    <div className="ld">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" precedence="default" />

      <header className="ldTop">
        <div className="ldWrap ldTopIn">
          <a href={home} aria-label="UVALO"><img src="/uvalo-lockup.svg" alt="UVALO" className="ldLogo" /></a>
          <nav className="ldNavLinks" aria-label="Secțiuni">
            <a href="#cum">Cum funcționează</a><a href="#functii">Ce face</a><a href="#magazine">App Store și Google Play</a><a href={`${home}#colaborari`}>Platforma</a>
          </nav>
          <div className="ldTopActs">
            <a className="ldBtn ldGhostDark ldSm" href={login}>Autentificare</a>
            <a className="ldBtn ldGold ldSm" href={`${app}/`}>Intră în platformă →</a>
          </div>
        </div>
      </header>

      <section className="ldHero">
        <div className="ldWrap ldHeroGrid">
          <div className="ldStack ldGap22">
            <span className="ldKicker"><span className="ldBadge ldOutline">ÎN CURÂND ÎN APP STORE ȘI GOOGLE PLAY</span><span>Aplicația UVALO pentru inspecții</span></span>
            <h1 className="ldH ldH1">Inspecția, din telefon. <em>Fișa, gata pe web.</em></h1>
            <p className="ldLead">Fișa de inspecție, pozele, actele, locația GPS și semnătura clientului, completate pe teren din telefon și gata pe web pentru raport. Pentru tine și pentru biroul tău.</p>
            <ul className="ldChecks">
              <li>{CHECK}<span><b>Fișe pe tipuri de imobil</b>, personalizabile</span></li>
              <li>{CHECK}<span><b>Merge și fără semnal</b>, se sincronizează singură</span></li>
              <li>{CHECK}<span><b>Echipa ta</b>: alocare, colaboratori, notificări</span></li>
            </ul>
            <div className="ldActs">
              <a className="ldBtn ldGold ldBig" href={signup}>Creează cont gratuit</a>
              <a className="ldBtn ldGhostDark ldBig" href="#magazine">Cum o instalez azi</a>
            </div>
            <small className="ldNote">Aplicația se deschide cu contul tău UVALO. Contul se cere cu numărul legitimației ANEVAR și se activează după verificarea în Tabloul membrilor titulari.</small>
          </div>
          <div className="ldHeroArt">
            <div className="ldDuo">
              <div className="ldBrowser">
                <div className="ldBrowserBar"><i /><i /><i /><span>app.uvalo.ro/inspectii</span></div>
                <img src="/site/inspectii-web.webp" alt="Lista de inspecții pe web: adrese, contact, programare, cine o face și starea fiecăreia" />
              </div>
              <div className="ldPhone">
                <span className="ldPhoneIsland" aria-hidden="true" />
                <div className="ldPhoneScr"><img src="/site/inspectii-mob.webp" alt="Aplicația de telefon: următoarea inspecție, cele de completat și cele de făcut" /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="cum" className="ldSec ldSecTop">
        <div className="ldWrap ldStack ldGap36">
          <div className="ldHead">
            <span className="ldEyebrow">CUM FUNCȚIONEAZĂ</span>
            <h2 className="ldH ldH2">Pregătești pe web, faci pe teren, primești fișa gata.</h2>
          </div>
          <div className="ldGrid3">
            {STEPS.map(([where, t, d], i) => (
              <div key={t} className="ldCard ldStep">
                <span className="ldStepTop"><span className="ldH ldNum">{i + 1}</span><em className="ldWhere">{where}</em></span>
                <b className="ldH ldCardT">{t}</b><p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ldSec ldSecBottom">
        <div className="ldWrap ldGrid2">
          <div className="ldPanel ldDark">
            <span className="ldEyebrow gold">PE TEREN, DIN TELEFON</span>
            <h3 className="ldH ldH3">Tot ce ai nevoie la inspecție, într-un singur ecran.</h3>
            <ul className="ldList ldListLight">
              <li>Următoarea inspecție sus, cu navigare, telefonul contactului și „Începe fișa”.</li>
              <li>Fișa pe secțiuni: nu poți trece mai departe cu întrebări obligatorii necompletate.</li>
              <li>Pozele pe categorii (exterior, încăperi, acte), mutate dintr-o categorie în alta cu degetul.</li>
              <li>Extrasul CF și releveul, deschise peste fișă, fără să ieși din ea.</li>
              <li>Încăperile preluate din releveu, cu finisajele fiecăreia.</li>
              <li>Semnătura persoanei prezente, pe ecran, și trimiterea dintr-o atingere.</li>
            </ul>
          </div>
          <div className="ldPanel">
            <span className="ldEyebrow">PE WEB, PENTRU RAPORT</span>
            <h3 className="ldH ldH3">Fișa completă, în câteva secunde după semnătură.</h3>
            <ul className="ldList">
              <li>Vezi răspunsurile în timp ce se completează pe teren, nu doar la final.</li>
              <li>Fișa ca document: cuprins, răspunsuri, încăperi, constatări, fotografii, locația pe hartă, semnături. „Descarcă PDF”.</li>
              <li>Semnătura ta din cont se aplică automat la finalizare.</li>
              <li>Link public pentru client sau bancă, doar cu brandingul firmei tale.</li>
              <li>O întorci pe telefon „pentru completări”, cu nota ta; semnătura rămâne sau se ia din nou.</li>
              <li>Lista pe hartă sau pe calendar, cu inspecțiile de programat trase pe o oră.</li>
            </ul>
            <a className="ldBtn ldInk ldSelf" href={signup}>Creează cont gratuit</a>
          </div>
        </div>
      </section>

      <section id="functii" className="ldDarkSec">
        <div className="ldWrap ldStack ldGap36">
          <div className="ldHead">
            <span className="ldEyebrow gold">CE FACE APLICAȚIA</span>
            <h2 className="ldH ldH2">Făcută pentru teren, nu pentru birou.</h2>
          </div>
          <img className="ldBanner" src="/site/inspectii-banner.png" alt="Aplicația UVALO pentru inspecții: lista de inspecții pe web și, pe telefon, următoarea inspecție cu cele de completat și de făcut" loading="lazy" />
          <div className="ldGrid3">
            {FEATURES.map(([t, d]) => <div key={t} className="ldCard ldCardDark"><b className="ldH ldCardT">{t}</b><p>{d}</p></div>)}
          </div>
        </div>
      </section>

      <section id="magazine" className="ldSec">
        <div className="ldWrap ldGrid2">
          <div className="ldPanel">
            <span className="ldEyebrow">DISPONIBILĂ AZI</span>
            <h3 className="ldH ldH3">O instalezi din browser, în 10 secunde.</h3>
            <p>Aplicația rulează deja pe iPhone și Android ca aplicație web instalabilă: fără magazin, fără actualizări de făcut, cu icoană pe ecranul principal și notificări.</p>
            <ol className="ldSteps">
              <li><b>Intră pe web</b> în platformă, la Inspecții, și scanează codul QR cu telefonul.</li>
              <li><b>Pe iPhone</b>: în Safari, Partajează → „Adaugă pe ecranul principal”. <b>Pe Android</b>: „Instalează aplicația” din meniul browserului.</li>
              <li><b>Gata.</b> Telefonul rămâne conectat la contul tău și primește inspecțiile tale.</li>
            </ol>
            <a className="ldBtn ldInk ldSelf" href={`${app}/inspectii`}>Deschide Inspecții pe web</a>
          </div>
          <div className="ldPanel ldDark ldStores">
            <span className="ldEyebrow gold">ÎN CURÂND</span>
            <h3 className="ldH ldH3">În App Store și Google Play.</h3>
            <p className="ldLight">Lucrăm la aplicațiile native pentru iPhone și Android, cu aceleași fișe și același cont. Când apar în magazine, cei cu cont UVALO află primii, în aplicație și pe email.</p>
            <div className="ldStoreRow">
              <span className="ldStore" aria-label="În curând în App Store">{APPLE}<span><small>În curând în</small><b>App Store</b></span></span>
              <span className="ldStore" aria-label="În curând în Google Play">{PLAY}<span><small>În curând în</small><b>Google Play</b></span></span>
            </div>
            <a className="ldBtn ldGold ldSelf" href={signup}>Creează cont și află primul</a>
          </div>
        </div>
      </section>

      <section className="ldSecBottom">
        <div className="ldWrap">
          <div className="ldTrust">
            {[
              ["Datele rămân ale tale", "Fișele, pozele și actele stau în contul firmei tale; linkul public îl pornești și îl oprești tu."],
              ["Fără hârtii, fără transcriere", "Ce completezi pe teren e deja în fișa de pe web, în PDF și în CRM."],
              ["Lucrezi și cu colegii", "Alocări, colaboratori care acceptă din telefon, notificări la fiecare pas."],
              ["Același cont peste tot", "Web, telefon, Word, Chrome: un singur cont UVALO, verificat după legitimația ANEVAR."],
            ].map(([t, d]) => <span key={t}><b className="ldH">{t}</b><small>{d}</small></span>)}
          </div>
        </div>
      </section>

      <section className="ldDarkSec ldCta">
        <div className="ldWrap ldStack ldCenter">
          <h2 className="ldH ldH2">Următoarea inspecție, fără hârtii.</h2>
          <p className="ldLead">Contul este gratuit pentru membrii titulari ANEVAR. Îl ceri cu numărul legitimației, noi îl verificăm în Tablou.</p>
          <div className="ldActs ldCenterRow">
            <a className="ldBtn ldGold ldBig" href={signup}>Creează cont gratuit</a>
            <a className="ldBtn ldGhostDark ldBig" href={login}>Autentificare</a>
          </div>
        </div>
      </section>

      <footer className="ldFoot">
        <div className="ldWrap ldFootIn">
          <span className="ldFootBrand"><img src="/uvalo-lockup.svg" alt="UVALO" /><span>Platforma evaluatorilor autorizați din România</span></span>
          <span className="ldFootLinks">
            <a href={home}>uvalo.ro</a>
            <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
            <a href={`${app}/confidentialitate`}>Confidențialitate</a>
            <a href={`${app}/termeni`}>Termeni</a>
          </span>
          <small className="ldFootLegal">© {new Date().getFullYear()} {COMPANY.name} · CUI {COMPANY.cui} · {COMPANY.seat}. Apple și App Store sunt mărci Apple Inc.; Google Play este marcă Google LLC.</small>
        </div>
      </footer>
    </div>
  );
}
