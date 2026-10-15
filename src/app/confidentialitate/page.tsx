import type { Metadata } from "next";
import { COMPANY, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Politica de confidențialitate | UVALO" };

const TOC: [string, string][] = [
  ["operator", "Cine prelucrează datele"],
  ["date", "Ce date prelucrăm"],
  ["site", "Site-ul uvalo.ro"],
  ["word", "UVALO pentru Word"],
  ["chrome", "UVALO pentru Chrome"],
  ["acte", "Documentele încărcate (CF, planuri)"],
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
    <LegalPage title="Politica de confidențialitate" lead="Cum prelucrăm datele personale pe site-ul uvalo.ro, în platforma UVALO (app.uvalo.ro), în add-in-ul UVALO pentru Word și în extensia UVALO pentru Chrome. Pe scurt: colectăm doar ce trebuie ca să-ți oferim contul și instrumentele, nu vindem date și nu folosim cookie-uri de publicitate." toc={TOC}>
      <section id="operator">
        <h2>1. Cine prelucrează datele</h2>
        <p>Operatorul datelor este <b>{COMPANY.name}</b>, CUI {COMPANY.cui}, înregistrată la Registrul Comerțului cu nr. {COMPANY.reg}, cu sediul în {COMPANY.seat} („UVALO”, „noi”), care operează platforma UVALO pentru evaluatori imobiliari.</p>
        <p>Pentru orice întrebare despre date ne scrii la <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.</p>
      </section>

      <section id="date">
        <h2>2. Ce date prelucrăm</h2>
        <ul>
          <li><b>Contul tău</b>: nume, adresa de email, telefon (opțional), numărul legitimației ANEVAR, județul și specializările, imaginea de profil (opțional), data acceptării termenilor.</li>
          <li><b>Firma</b> (dacă lucrezi într-un birou de evaluare): denumire, CUI, localitate, email de facturare, planul de abonament și rolul tău în firmă; pentru biroul de evaluare și numărul autorizației de membru corporativ, descrierea și logo-ul încărcate de titular.</li>
          <li><b>Cererea de ieșire dintr-un birou</b>: legitimația pe care o introduci, verificată în Tabloul ANEVAR, data cererii și decizia administratorilor biroului, care primesc cererea pe email.</li>
          <li><b>Solicitarea de cont</b>: legitimația ANEVAR, numele, emailul, telefonul, firma, mesajul tău, adresa IP și browserul de pe care ai trimis-o. Verificăm legitimația în tabloul public ANEVAR.</li>
          <li><b>Autentificare și sesiuni</b>: codurile trimise pe email (păstrate doar ca amprentă criptografică), adresa IP, țara și orașul aproximate din IP, tipul de browser, data conectării.</li>
          <li><b>Activitatea în platformă</b>: ce instrumente folosești și ce acțiuni faci (de exemplu localitatea și numărul cadastral căutat, exporturile, textele generate), cu data și ora, precum și pagina deschisă în acel moment și ultima dată când ai fost activ (un semnal trimis cât timp pagina e deschisă). Le folosim pentru securitate, limite de utilizare, suport și statistici, inclusiv statistici de folosire pe utilizator, văzute doar de administratorii UVALO.</li>
          <li><b>Închiderea contului</b>: data și motivul ales de tine, cu observațiile pe care le scrii.</li>
          <li><b>Datele introduse în instrumente</b>: în analiza amplasamentului, datele parcelei, completările tale și, dacă îl încarci, extrasul CF sau planul de amplasament (PDF sau imagine), folosit doar pentru citirea automată și nestocat (vezi secțiunea 6); în localizatorul de comparabile, adresele și punctele pe care le pui pe hartă.</li>
          <li><b>Aplicația Inspecții pe telefon</b>: telefonul conectat (tipul și data conectării) și, dacă pornești notificările, adresa de abonare a telefonului
            la serviciul de notificări al sistemului (Apple sau Google). Notificările (inspecții noi, reprogramări, acte adăugate, memento-uri) sunt criptate
            pe serverul UVALO pentru telefonul tău, așa că serviciul Apple sau Google doar le livrează, fără să le poată citi. Le oprești oricând din aplicație
            (Contul meu → Notificări) sau din setările telefonului.</li>
          <li><b>Feedback</b>: mesajele trimise din butonul „Feedback”, cu pagina de pe care le-ai trimis, browserul și dacă vrei răspuns pe email. Le citesc doar administratorii UVALO.</li>
          <li><b>Colaborări</b> (când modulul îți este disponibil și îl activezi): profilul de colaborare (experiența, competențele, disponibilitatea, permisul, despre tine), locația de bază și zonele de acoperire, anunțurile pe care le publici, cererile de detalii, mesajele din conversații și notificările din aplicație. Pentru anunțurile noi din zonele tale îți trimitem și un email cu un link de autentificare valabil 3 zile (îl poți opri din „Zone de acoperire”). Profilul și mesajul tău le vede autorul anunțului la care ceri detalii; telefonul și emailul se văd între voi doar după ce începe conversația. Localitatea și adresa de bază se transformă în coordonate prin Google, ca să calculăm distanțele.</li>
        </ul>
        <p>Nu prelucrăm categorii speciale de date și nu luăm decizii automate cu efect juridic asupra ta.</p>
      </section>

      <section id="site">
        <h2>3. Site-ul uvalo.ro</h2>
        <p>Site-ul de prezentare nu folosește cookie-uri, formulare sau servicii de analiză. Ca orice server web, Cloudflare primește adresa IP și browserul pentru a livra pagina și a o proteja de atacuri. Fonturile site-ului se încarcă de la Google Fonts, care primește adresa IP a browserului tău.</p>
      </section>

      <section id="word">
        <h2>4. UVALO pentru Word</h2>
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
        <h2>5. UVALO pentru Chrome</h2>
        <ul>
          <li>Extensia capturează paginile anunțurilor pe care le alegi tu, în browserul tău, folosind sesiunea ta pe acele site-uri. Capturile și lista lor se păstrează <b>local</b>, în Chrome, până le ștergi („Golește lista” / „Reset”).</li>
          <li>Pentru a captura pagina întreagă, extensia folosește permisiunea de depanare a Chrome doar pe tab-ul pe care îl deschide pentru anunț, pe durata capturii.</li>
          <li>Extensia verifică la deschidere contul tău UVALO și trimite statistici de folosire (adresa anunțului capturat, exporturile făcute), fără imaginile capturate.</li>
          <li><b>Doar când apeși „Trimite în Word”</b>, capturile alese și datele lor (nume, titlu, adresă, data capturii) se urcă în contul tău UVALO, ca să le poți insera din Word. Le vezi doar tu; se șterg automat după 7 zile sau la următoarea trimitere.</li>
        </ul>
      </section>

      <section id="acte">
        <h2>6. Documentele încărcate (extras CF, plan de amplasament)</h2>
        <p>În analiza amplasamentului, în bara de căutare de pe pagina de start și în localizatorul cadastral poți încărca un extras de carte funciară sau un plan de amplasament și delimitare (PDF sau imagine), ca să citim automat datele imobilului.</p>
        <ul>
          <li><b>Folosim documentul doar pentru citirea datelor</b> imobilului: numărul cadastral și de carte funciară, localitatea, suprafețele, coordonatele Stereo 70, construcțiile, vecinii și adresa. Nu îl folosim în alt scop.</li>
          <li><b>Nu stocăm documentul.</b> Fișierul trece prin serverul UVALO doar cât durează citirea, este trimis spre citire la Anthropic și nu este salvat în baza de date, pe disc sau în altă formă, nici la noi, nici în contul tău.</li>
          <li><b>Nu îl partajăm</b> cu alți utilizatori, cu firma ta, cu colegii din Colaborări sau cu terți. Singurul furnizor care îl primește este Anthropic, ca persoană împuternicită, numai pentru citire; conform termenilor săi comerciali, datele trimise prin API nu sunt folosite pentru antrenarea modelelor și sunt păstrate de Anthropic doar temporar, pentru siguranță și prevenirea abuzurilor, apoi șterse conform politicii sale.</li>
          <li><b>Datele citite</b> rămân doar în browserul tău, în pagina deschisă (și în memoria tab-ului cât treci de la pagina de start la analiză), ca să le vezi pe hartă și în analiză. Dispar când închizi pagina, cu excepția a ceea ce alegi tu să exporți (PDF, Word, PNG).</li>
          <li>În jurnalul de activitate păstrăm doar faptul că ai folosit citirea automată: data, numărul cadastral citit, tipul și mărimea fișierului și numărul de puncte de coordonate, pentru limitele de utilizare și statistici. Nu păstrăm conținutul documentului și nici numele proprietarilor sau alte date personale din el.</li>
          <li><b>Excepție: modulul Inspecții.</b> Când atașezi un document (extras CF, releveu, alt act) sau fotografii la o inspecție, acestea se păstrează în contul tău, într-un spațiu de stocare privat (Cloudflare R2), ca să le vezi în fișa inspecției. Le văd doar tu, colegul care face inspecția pentru tine și administratorii UVALO, pentru suport. Le poți șterge oricând din fișă; la ștergerea inspecției sau a contului se șterg și ele.</li>
          <li>Extrasul de carte funciară poate conține date personale ale proprietarilor. Încarcă doar documente pe care ai dreptul să le folosești în lucrarea de evaluare; noi nu extragem, nu afișăm și nu păstrăm aceste date.</li>
        </ul>
      </section>

      <section id="scopuri">
        <h2>7. De ce le prelucrăm</h2>
        <ul>
          <li><b>Ca să-ți oferim serviciul</b> (contul, instrumentele, abonamentul firmei): executarea contractului, art. 6 alin. (1) lit. b) GDPR.</li>
          <li><b>Securitate și prevenirea abuzurilor</b> (sesiuni, IP, limite de utilizare, jurnal de activitate): interesul nostru legitim, lit. f).</li>
          <li><b>Statistici și îmbunătățirea instrumentelor</b>: interesul nostru legitim, lit. f). Folosim date agregate ori de câte ori se poate.</li>
          <li><b>Mesaje despre cont</b> (coduri de autentificare, invitații, anunțuri despre serviciu): executarea contractului. Mesajele „Anunță-mă la lansare” le primești doar dacă le ceri.</li>
          <li><b>Obligații legale</b> (contabilitate, facturare): obligația legală, lit. c).</li>
        </ul>
      </section>

      <section id="furnizori">
        <h2>8. Cui le transmitem</h2>
        <p>Nu vindem și nu închiriem date. Le transmitem doar furnizorilor care ne ajută să facem serviciul să funcționeze, ca persoane împuternicite, cu contracte de prelucrare a datelor:</p>
        <ul>
          <li><b>Cloudflare</b>: găzduirea aplicației, baza de date și rețeaua (inclusiv protecția împotriva atacurilor).</li>
          <li><b>Resend</b>: trimiterea emailurilor (coduri de autentificare, invitații).</li>
          <li><b>Anthropic</b>: generarea textului „Descrierea amplasamentului” și citirea extrasului CF sau a planului de amplasament încărcat. Primește doar datele analizei, completările tale și fișierul încărcat, nu datele contului. Conform termenilor comerciali Anthropic, datele trimise prin API nu sunt folosite pentru antrenarea modelelor.</li>
          <li><b>Google Maps Platform</b>: căutarea adreselor, hărțile de fundal și transformarea în coordonate a localității de bază din Colaborări și a localității anunțurilor.</li>
          <li><b>OpenStreetMap</b> (Overpass și Nominatim): dotările și străzile din jurul amplasamentului și căutarea adreselor în localizatorul de comparabile. Primesc doar coordonatele zonei sau adresa căutată, direct din browserul tău, fără date despre cont.</li>
          <li><b>Membrii firmei tale</b>: titularul și administratorii contului firmei văd cine folosește locurile firmei și activitatea din cadrul firmei.</li>
          <li><b>Colegii din Colaborări</b>: profilul tău de colaborare îl văd autorii anunțurilor la care ceri detalii; anunțurile tale le văd evaluatorii din zonă; telefonul și emailul, doar colegul cu care ai început o conversație.</li>
        </ul>
        <p>Unii furnizori prelucrează date și în afara Spațiului Economic European (de exemplu în SUA). În aceste cazuri transferul se face pe baza Cadrului UE–SUA privind protecția datelor sau a clauzelor contractuale standard aprobate de Comisia Europeană. Putem transmite date autorităților doar când legea ne obligă.</p>
      </section>

      <section id="pastrare">
        <h2>9. Cât timp le păstrăm</h2>
        <ul>
          <li>Datele contului și ale firmei: cât timp contul este activ. Când îți închizi singur contul, istoricul rămâne păstrat ca să-l poți redeschide; la cererea ta ștergem datele. După închiderea contului le ștergem sau le anonimizăm în cel mult 12 luni, cu excepția celor pe care legea ne obligă să le păstrăm mai mult (de exemplu documentele contabile).</li>
          <li>Codurile de autentificare expiră în 15 minute; sesiunile, în cel mult 60 de zile sau la deconectare.</li>
          <li>Jurnalul de activitate: cât timp contul este activ, apoi ca mai sus.</li>
          <li>Solicitările de cont respinse: cel mult 12 luni.</li>
          <li>Extrasele CF și planurile încărcate pentru citire automată <b>nu se păstrează</b>: nu le salvăm nicăieri după citire (vezi secțiunea 6).</li>
          <li>Documentele și fotografiile atașate la o inspecție: cât timp există inspecția și contul, până le ștergi.</li>
          <li>Comparabilele trimise din UVALO pentru Chrome în Word: cel mult 7 zile, sau până la următoarea trimitere.</li>
          <li>Colaborări: profilul, anunțurile și conversațiile cât timp contul este activ; anunțurile arhivate rămân doar pentru tine și pentru cei cu care ai discutat. Datele introduse în perioada de test a modulului se pot șterge la încheierea testului.</li>
        </ul>
      </section>

      <section id="cookie">
        <h2>10. Cookie-uri și stocare locală</h2>
        <p>Folosim <b>un singur cookie</b>, strict necesar: cookie-ul de sesiune care te ține conectat (valabil cel mult 60 de zile). Nu folosim cookie-uri de publicitate sau de urmărire și nici servicii de analiză de la terți.</p>
        <p>Browserul (sau panoul din Word) păstrează local câteva preferințe, de exemplu straturile hărții, setările anexelor și lucrul în curs din add-in. Acestea rămân pe dispozitivul tău.</p>
      </section>

      <section id="securitate">
        <h2>11. Securitate</h2>
        <p>Toate conexiunile sunt criptate (HTTPS). Nu folosim parole: te conectezi cu un cod de unică folosință trimis pe email, iar codurile și tokenurile de sesiune se păstrează doar ca amprente criptografice. Accesul la date în echipa UVALO este limitat la persoanele care administrează platforma.</p>
      </section>

      <section id="drepturi">
        <h2>12. Drepturile tale</h2>
        <p>Ai dreptul să ceri acces la datele tale, rectificarea sau ștergerea lor, restricționarea prelucrării, portabilitatea datelor și să te opui prelucrărilor bazate pe interesul legitim. Ne scrii la <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> și îți răspundem în cel mult o lună. Numele, telefonul și imaginea le poți schimba oricând din pagina „Contul meu”, de unde îți poți și închide singur contul.</p>
        <p>Dacă ești nemulțumit, poți depune o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (<a href="https://www.dataprotection.ro" target="_blank" rel="noreferrer">dataprotection.ro</a>).</p>
      </section>

      <section id="modificari">
        <h2>13. Modificări și contact</h2>
        <p>Când schimbăm această politică actualizăm data de sus; schimbările importante le anunțăm în platformă sau pe email. Pentru orice întrebare: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.</p>
        <p>Vezi și <a href="/termeni">Termenii de utilizare</a>.</p>
      </section>
    </LegalPage>
  );
}
