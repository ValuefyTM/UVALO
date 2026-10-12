import type { Metadata } from "next";
import { COMPANY, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Politica de confidențialitate | UVALO" };

const TOC: [string, string][] = [
  ["operator", "Cine prelucrează datele"],
  ["date", "Ce date prelucrăm"],
  ["word", "UVALO pentru Word"],
  ["chrome", "UVALO pentru Chrome"],
  ["scopuri", "De ce le prelucrăm"],
  ["furnizori", "Cui le transmitem"],
  ["pastrare", "Cât timp le păstrăm"],
  ["cookie", "Cookie-uri și stocare locală"],
  ["securitate", "Securitate"],
  ["drepturi", "Drepturile tale"],
  ["modificari", "Modificări și contact"],
];

/** Privacy policy of UVALO (app.uvalo.ro) and of the UVALO pentru Word add-in. Public page. */
export default function Confidentialitate() {
  return (
    <LegalPage title="Politica de confidențialitate" lead="Cum prelucrăm datele personale în platforma UVALO (app.uvalo.ro) și în add-in-ul UVALO pentru Word. Pe scurt: colectăm doar ce trebuie ca să-ți oferim contul și instrumentele, nu vindem date și nu folosim cookie-uri de publicitate." toc={TOC}>
      <section id="operator">
        <h2>1. Cine prelucrează datele</h2>
        <p>Operatorul datelor este <b>{COMPANY.name}</b>, CUI {COMPANY.cui}, înregistrată la Registrul Comerțului cu nr. {COMPANY.reg}, cu sediul în {COMPANY.seat} („UVALO”, „noi”), care operează platforma UVALO pentru evaluatori imobiliari.</p>
        <p>Pentru orice întrebare despre date ne scrii la <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.</p>
      </section>

      <section id="date">
        <h2>2. Ce date prelucrăm</h2>
        <ul>
          <li><b>Contul tău</b>: nume, adresa de email, telefon (opțional), numărul legitimației ANEVAR, județul și specializările, imaginea de profil (opțional), data acceptării termenilor.</li>
          <li><b>Firma</b> (dacă lucrezi într-un birou de evaluare): denumire, CUI, localitate, email de facturare, planul de abonament și rolul tău în firmă.</li>
          <li><b>Solicitarea de cont</b>: legitimația ANEVAR, numele, emailul, telefonul, firma, mesajul tău, adresa IP și browserul de pe care ai trimis-o. Verificăm legitimația în tabloul public ANEVAR.</li>
          <li><b>Autentificare și sesiuni</b>: codurile trimise pe email (păstrate doar ca amprentă criptografică), adresa IP, țara și orașul aproximate din IP, tipul de browser, data conectării.</li>
          <li><b>Activitatea în platformă</b>: ce instrumente folosești și ce acțiuni faci (de exemplu localitatea și numărul cadastral căutat, exporturile, textele generate), cu data și ora. Le folosim pentru securitate, limite de utilizare și statistici.</li>
          <li><b>Datele introduse în instrumente</b>: în analiza amplasamentului, datele parcelei, completările tale și, dacă îl încarci, planul de amplasament (PDF sau imagine) trimis spre citire automată; în localizatorul de comparabile, adresele și punctele pe care le pui pe hartă.</li>
          <li><b>Colaborări</b> (când modulul îți este disponibil și îl activezi): profilul de colaborare (experiența, competențele, disponibilitatea, permisul, despre tine), locația de bază și zonele de acoperire, anunțurile pe care le publici, cererile de detalii, mesajele din conversații și notificările din aplicație. Profilul și mesajul tău le vede autorul anunțului la care ceri detalii; telefonul și emailul se văd între voi doar după ce începe conversația. Localitatea și adresa de bază se transformă în coordonate prin Google, ca să calculăm distanțele.</li>
        </ul>
        <p>Nu prelucrăm categorii speciale de date și nu luăm decizii automate cu efect juridic asupra ta.</p>
      </section>

      <section id="word">
        <h2>3. UVALO pentru Word</h2>
        <ul>
          <li><b>Pozele și documentele PDF</b> pe care le alegi în Anexă foto și Anexă documente se prelucrează <b>pe calculatorul tău</b>, în Word. Nu se trimit pe serverele UVALO.</li>
          <li>Ca să nu pierzi lucrul dacă închizi panoul, fișierele și lista lor (ordine, legende, titluri) se păstrează <b>local</b>, în spațiul de stocare al panoului din Word, cel mult 12 ore. Butonul „Golește” le șterge imediat.</li>
          <li>Add-in-ul citește din documentul deschis doar ce îi trebuie ca să insereze anexa (dimensiunea paginii, anexele inserate anterior de UVALO) și scrie în document doar când apeși „Inserează”.</li>
          <li>Pentru Comparabile, harta și tabelul trec din fereastra hărții direct în document, pe calculatorul tău.</li>
          <li>Înregistrăm doar faptul că ai folosit un instrument (de exemplu „anexă foto inserată, 8 poze, 2 pagini”), fără conținutul pozelor sau al documentelor.</li>
          <li>Add-in-ul se încarcă în Word prin biblioteca Office.js a Microsoft; Microsoft prelucrează datele propriei aplicații conform politicii sale de confidențialitate.</li>
        </ul>
      </section>

      <section id="chrome">
        <h2>4. UVALO pentru Chrome</h2>
        <ul>
          <li>Extensia capturează paginile anunțurilor pe care le alegi tu, în browserul tău, folosind sesiunea ta pe acele site-uri. Capturile și lista lor se păstrează <b>local</b>, în Chrome, până le ștergi („Golește lista” / „Reset”).</li>
          <li>Pentru a captura pagina întreagă, extensia folosește permisiunea de depanare a Chrome doar pe tab-ul pe care îl deschide pentru anunț, pe durata capturii.</li>
          <li>Extensia verifică la deschidere contul tău UVALO și trimite statistici de folosire (adresa anunțului capturat, exporturile făcute), fără imaginile capturate.</li>
          <li><b>Doar când apeși „Trimite în Word”</b>, capturile alese și datele lor (nume, titlu, adresă, data capturii) se urcă în contul tău UVALO, ca să le poți insera din Word. Le vezi doar tu; se șterg automat după 7 zile sau la următoarea trimitere.</li>
        </ul>
      </section>

      <section id="scopuri">
        <h2>5. De ce le prelucrăm</h2>
        <ul>
          <li><b>Ca să-ți oferim serviciul</b> (contul, instrumentele, abonamentul firmei): executarea contractului, art. 6 alin. (1) lit. b) GDPR.</li>
          <li><b>Securitate și prevenirea abuzurilor</b> (sesiuni, IP, limite de utilizare, jurnal de activitate): interesul nostru legitim, lit. f).</li>
          <li><b>Statistici și îmbunătățirea instrumentelor</b>: interesul nostru legitim, lit. f). Folosim date agregate ori de câte ori se poate.</li>
          <li><b>Mesaje despre cont</b> (coduri de autentificare, invitații, anunțuri despre serviciu): executarea contractului. Mesajele „Anunță-mă la lansare” le primești doar dacă le ceri.</li>
          <li><b>Obligații legale</b> (contabilitate, facturare): obligația legală, lit. c).</li>
        </ul>
      </section>

      <section id="furnizori">
        <h2>6. Cui le transmitem</h2>
        <p>Nu vindem și nu închiriem date. Le transmitem doar furnizorilor care ne ajută să facem serviciul să funcționeze, ca persoane împuternicite, cu contracte de prelucrare a datelor:</p>
        <ul>
          <li><b>Cloudflare</b>: găzduirea aplicației, baza de date și rețeaua (inclusiv protecția împotriva atacurilor).</li>
          <li><b>Resend</b>: trimiterea emailurilor (coduri de autentificare, invitații).</li>
          <li><b>Anthropic</b>: generarea textului „Descrierea amplasamentului” și citirea planului de amplasament încărcat. Primește doar datele analizei, completările tale și fișierul încărcat, nu datele contului. Conform termenilor comerciali Anthropic, datele trimise prin API nu sunt folosite pentru antrenarea modelelor.</li>
          <li><b>Google Maps Platform</b>: căutarea adreselor și hărțile de fundal.</li>
          <li><b>OpenStreetMap</b> (Overpass și Nominatim): dotările și străzile din jurul amplasamentului și căutarea adreselor în localizatorul de comparabile. Primesc doar coordonatele zonei sau adresa căutată, direct din browserul tău, fără date despre cont.</li>
          <li><b>Membrii firmei tale</b>: titularul și administratorii contului firmei văd cine folosește locurile firmei și activitatea din cadrul firmei.</li>
        </ul>
        <p>Unii furnizori prelucrează date și în afara Spațiului Economic European (de exemplu în SUA). În aceste cazuri transferul se face pe baza Cadrului UE–SUA privind protecția datelor sau a clauzelor contractuale standard aprobate de Comisia Europeană. Putem transmite date autorităților doar când legea ne obligă.</p>
      </section>

      <section id="pastrare">
        <h2>7. Cât timp le păstrăm</h2>
        <ul>
          <li>Datele contului și ale firmei: cât timp contul este activ. După închiderea contului le ștergem sau le anonimizăm în cel mult 12 luni, cu excepția celor pe care legea ne obligă să le păstrăm mai mult (de exemplu documentele contabile).</li>
          <li>Codurile de autentificare expiră în 15 minute; sesiunile, în cel mult 60 de zile sau la deconectare.</li>
          <li>Jurnalul de activitate: cât timp contul este activ, apoi ca mai sus.</li>
          <li>Solicitările de cont respinse: cel mult 12 luni.</li>
          <li>Planurile încărcate pentru citire automată nu se păstrează după ce au fost citite.</li>
          <li>Comparabilele trimise din UVALO pentru Chrome în Word: cel mult 7 zile, sau până la următoarea trimitere.</li>
          <li>Colaborări: profilul, anunțurile și conversațiile cât timp contul este activ; anunțurile arhivate rămân doar pentru tine și pentru cei cu care ai discutat. Datele introduse în perioada de test a modulului se pot șterge la încheierea testului.</li>
        </ul>
      </section>

      <section id="cookie">
        <h2>8. Cookie-uri și stocare locală</h2>
        <p>Folosim <b>un singur cookie</b>, strict necesar: cookie-ul de sesiune care te ține conectat (valabil cel mult 60 de zile). Nu folosim cookie-uri de publicitate sau de urmărire și nici servicii de analiză de la terți.</p>
        <p>Browserul (sau panoul din Word) păstrează local câteva preferințe, de exemplu straturile hărții, setările anexelor și lucrul în curs din add-in. Acestea rămân pe dispozitivul tău.</p>
      </section>

      <section id="securitate">
        <h2>9. Securitate</h2>
        <p>Toate conexiunile sunt criptate (HTTPS). Nu folosim parole: te conectezi cu un cod de unică folosință trimis pe email, iar codurile și tokenurile de sesiune se păstrează doar ca amprente criptografice. Accesul la date în echipa UVALO este limitat la persoanele care administrează platforma.</p>
      </section>

      <section id="drepturi">
        <h2>10. Drepturile tale</h2>
        <p>Ai dreptul să ceri acces la datele tale, rectificarea sau ștergerea lor, restricționarea prelucrării, portabilitatea datelor și să te opui prelucrărilor bazate pe interesul legitim. Ne scrii la <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> și îți răspundem în cel mult o lună. Numele, telefonul și imaginea le poți schimba oricând din pagina „Contul meu”.</p>
        <p>Dacă ești nemulțumit, poți depune o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (<a href="https://www.dataprotection.ro" target="_blank" rel="noreferrer">dataprotection.ro</a>).</p>
      </section>

      <section id="modificari">
        <h2>11. Modificări și contact</h2>
        <p>Când schimbăm această politică actualizăm data de sus; schimbările importante le anunțăm în platformă sau pe email. Pentru orice întrebare: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.</p>
        <p>Vezi și <a href="/termeni">Termenii de utilizare</a>.</p>
      </section>
    </LegalPage>
  );
}
