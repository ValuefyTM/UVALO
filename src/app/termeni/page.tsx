import type { Metadata } from "next";
import { COMPANY, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Termeni de utilizare | UVALO" };

const TOC: [string, string][] = [
  ["serviciul", "Serviciul"],
  ["cont", "Contul"],
  ["abonament", "Abonament și plată"],
  ["date", "Datele cadastrale și textele generate"],
  ["utilizare", "Utilizare permisă"],
  ["colaborari", "Colaborări între evaluatori"],
  ["birou", "Birouri de evaluare"],
  ["word", "UVALO pentru Word și pentru Chrome"],
  ["proprietate", "Proprietate intelectuală"],
  ["disponibilitate", "Disponibilitate"],
  ["raspundere", "Răspundere"],
  ["incetare", "Suspendare și încetare"],
  ["final", "Dispoziții finale"],
  ["contact", "Contact și suport"],
];

/** Terms of use of UVALO (uvalo.ro, app.uvalo.ro), the Word add-in and the Chrome extension. Public page. */
export default function Termeni() {
  return (
    <LegalPage title="Termeni de utilizare" lead="Regulile pentru folosirea platformei UVALO (uvalo.ro și app.uvalo.ro), a add-in-ului UVALO pentru Word și a extensiei UVALO pentru Chrome. Folosind UVALO, ești de acord cu acești termeni și cu Politica de confidențialitate." toc={TOC}>
      <section id="serviciul">
        <h2>1. Serviciul</h2>
        <p>UVALO este o platformă pentru evaluatori imobiliari, operată de <b>{COMPANY.name}</b> (CUI {COMPANY.cui}, {COMPANY.reg}, {COMPANY.seat}). Include localizatorul cadastral, analiza amplasamentului, localizatorul de comparabile, Colaborări între evaluatori, add-in-ul UVALO pentru Word (Anexă foto, Anexă documente, Comparabile) și extensia UVALO pentru Chrome. Instrumentele disponibile pentru tine depind de planul de abonament al firmei sau al contului tău; unele module sunt în testare și pot fi oferite doar anumitor conturi.</p>
        <p>Site-ul de prezentare uvalo.ro descrie serviciul; contul și instrumentele se folosesc în aplicația app.uvalo.ro.</p>
      </section>

      <section id="cont">
        <h2>2. Contul</h2>
        <ul>
          <li>Conturile se acordă evaluatorilor autorizați ANEVAR, după verificarea legitimației în Tabloul ANEVAR, și colaboratorilor invitați de un birou de evaluare (asistenți, inspectori).</li>
          <li>Contul este <b>personal</b>: nu îl împarți cu alte persoane și nu dai altcuiva codurile de autentificare. Răspunzi de activitatea făcută din contul tău.</li>
          <li>Datele din cont trebuie să fie corecte; le poți actualiza din pagina „Contul meu”. Numele, legitimația și specializările se preiau din Tabloul ANEVAR.</li>
          <li>Te autentifici cu un cod sau un link de unică folosință trimis pe email. Linkurile din emailurile de notificare te conectează direct, de aceea nu le trimite altor persoane.</li>
          <li>Activitatea din platformă se înregistrează pentru securitate, limite de utilizare și statistici, așa cum explicăm în <a href="/confidentialitate">Politica de confidențialitate</a>.</li>
        </ul>
      </section>

      <section id="abonament">
        <h2>3. Abonament și plată</h2>
        <ul>
          <li>Accesul la instrumente urmează planul de abonament al firmei în care lucrezi (sau al contului tău individual), cu numărul de locuri și perioada de valabilitate stabilite cu UVALO. Unele planuri și module (de exemplu contul individual de evaluator și Colaborările) pot fi gratuite; dacă introducem plata pentru ele, te anunțăm din timp și nu plătești nimic fără acordul tău.</li>
          <li>Add-in-ul UVALO pentru Word se instalează gratuit, dar funcționează doar cu un cont UVALO al cărui plan îl include. Plata se face către UVALO, nu prin Microsoft.</li>
          <li>Unele funcții au limite de utilizare (de exemplu numărul de texte generate pe zi), afișate în instrument când sunt atinse.</li>
          <li>Dacă abonamentul expiră sau firma este suspendată, accesul la instrumente se oprește până la reactivare.</li>
        </ul>
      </section>

      <section id="date">
        <h2>4. Datele cadastrale și textele generate</h2>
        <ul>
          <li>Planurile din localizator provin din exporturi ale datelor cadastrale (ANCPI) și pot fi incomplete sau neactualizate. Au <b>caracter orientativ</b> și nu înlocuiesc extrasul de carte funciară, planul de amplasament sau alte documente oficiale.</li>
          <li>Dotările, străzile și factorii din jurul amplasamentului provin din OpenStreetMap și pot fi incomplete.</li>
          <li>Textele generate automat (de exemplu „Descrierea amplasamentului”) și datele citite automat din planurile încărcate sunt <b>propuneri</b>. Evaluatorul le verifică și răspunde pentru conținutul raportului de evaluare, conform standardelor ANEVAR.</li>
        </ul>
      </section>

      <section id="utilizare">
        <h2>5. Utilizare permisă</h2>
        <p>Folosești UVALO pentru activitatea ta profesională de evaluare. Nu ai voie:</p>
        <ul>
          <li>să descarci sau să copiezi în masă datele din platformă (automat sau manual), să le revinzi sau să construiești din ele o bază de date separată;</li>
          <li>să ocolești limitele de utilizare, controalele de acces sau abonamentul;</li>
          <li>să încerci să accesezi conturi, date sau părți ale sistemului care nu îți sunt destinate, ori să perturbi funcționarea serviciului;</li>
          <li>să decompilezi sau să copiezi platforma ori add-in-ul, în afara cazurilor permise de lege;</li>
          <li>să încarci conținut ilegal sau care încalcă drepturile altor persoane.</li>
        </ul>
      </section>

      <section id="colaborari">
        <h2>6. Colaborări între evaluatori</h2>
        <ul>
          <li>Modulul Colaborări pune în legătură evaluatorii care au nevoie de ajutor la o inspecție sau la un raport cu colegii care acoperă zona proprietății. Este disponibil doar evaluatorilor autorizați ANEVAR.</li>
          <li><b>UVALO nu este parte în colaborare.</b> Onorariul, termenul, modul de lucru, răspunderea profesională și respectarea standardelor ANEVAR și a obligațiilor față de client le stabiliți direct între voi. Nu intermediem plăți și nu percepem comision din colaborări.</li>
          <li>Anunțurile trebuie să fie reale și corecte. Nu publici date personale ale clienților tăi (nume, CNP, număr de telefon) sau documente ale lor în anunț; detaliile le dai doar colegului ales, în conversație, cu respectarea confidențialității față de client.</li>
          <li>Datele de contact ale colegilor (telefon, email) le folosești doar pentru colaborarea respectivă, nu pentru reclame sau liste de contacte.</li>
          <li>Poți edita, arhiva sau șterge oricând anunțurile tale. Putem ascunde anunțuri sau mesaje care încalcă acești termeni și putem suspenda accesul la modul în caz de abuz.</li>
        </ul>
      </section>

      <section id="birou">
        <h2>7. Birouri de evaluare</h2>
        <ul>
          <li>Un birou de evaluare (cont de firmă) are un titular și, eventual, administratori, care invită membrii, le atribuie locurile din abonament și văd activitatea din cadrul biroului. Titularul răspunde de datele firmei (denumire, număr de autorizație, logo) și de persoanele pe care le invită.</li>
          <li>Membrii care nu au legitimație ANEVAR (asistenți, inspectori) folosesc instrumentele biroului, dar nu au acces la Colaborări.</li>
          <li>Un evaluator membru al unui birou poate cere să iasă din birou și să continue cu un cont individual; cererea o aprobă administratorii biroului, după ce legitimația lui a fost verificată în Tablou.</li>
        </ul>
      </section>

      <section id="word">
        <h2>8. UVALO pentru Word și pentru Chrome</h2>
        <ul>
          <li>Add-in-ul funcționează în Microsoft Word pentru Windows și Mac (Microsoft 365 sau Office 2016 și mai noi). Word în browser nu este suportat deocamdată.</li>
          <li>Pozele și documentele alese se prelucrează pe calculatorul tău; răspunzi de dreptul de a folosi conținutul pe care îl inserezi în raport.</li>
          <li>Add-in-ul modifică documentul doar la comanda ta („Inserează”); îți recomandăm să salvezi documentul înainte. Inserarea se poate anula cu Ctrl+Z.</li>
          <li>Folosirea Microsoft Word și a Microsoft Marketplace este guvernată și de termenii Microsoft.</li>
          <li>Extensia UVALO pentru Chrome capturează doar paginile pe care le deschizi tu. Folosești capturile pentru documentarea comparabilelor din raport, cu respectarea termenilor site-urilor de anunțuri și a drepturilor asupra conținutului lor.</li>
        </ul>
      </section>

      <section id="proprietate">
        <h2>9. Proprietate intelectuală</h2>
        <p>Platforma UVALO, add-in-ul, extensia, designul și textele lor aparțin operatorului UVALO, {COMPANY.name}. Primești un drept personal, neexclusiv și netransmisibil de a le folosi cât timp ai cont și abonament activ.</p>
        <p>Conținutul tău (pozele, documentele, rapoartele, anunțurile, datele introduse) rămâne al tău; ne dai doar dreptul de a-l stoca și afișa în măsura necesară funcționării serviciului (de exemplu anunțul tău, colegilor din zonă). Hărțile folosesc date © contribuitorii OpenStreetMap (licența ODbL) și Google Maps, conform termenilor acestora.</p>
      </section>

      <section id="disponibilitate">
        <h2>10. Disponibilitate</h2>
        <p>Facem tot ce ne stă în putință ca UVALO să funcționeze continuu, dar pot exista întreruperi pentru mentenanță, actualizări sau din cauza furnizorilor (găzduire, hărți, servicii de date). Putem adăuga, schimba sau opri temporar instrumente; schimbările importante le anunțăm din timp.</p>
      </section>

      <section id="raspundere">
        <h2>11. Răspundere</h2>
        <p>În limitele permise de lege, UVALO nu răspunde pentru pierderi indirecte (de exemplu profit nerealizat), pentru decizii luate doar pe baza datelor orientative din platformă și nici pentru modul în care evaluatorii își îndeplinesc colaborările stabilite între ei. Răspunderea totală a UVALO față de un utilizator este limitată la sumele plătite pentru serviciu în ultimele 12 luni. Aceste limite nu se aplică în caz de intenție sau culpă gravă.</p>
      </section>

      <section id="incetare">
        <h2>12. Suspendare și încetare</h2>
        <p>Îți poți închide oricând contul din „Contul meu” → „Închide contul”: sesiunile se încheie, locul din firmă se eliberează, iar anunțurile active din Colaborări se arhivează. Istoricul rămâne păstrat, conform Politicii de confidențialitate, și îți poți redeschide contul cerându-l din nou cu același email. Pentru ștergerea datelor ne scrii la {COMPANY.email}. Putem suspenda sau închide un cont care încalcă acești termeni, după ce te anunțăm (sau imediat, dacă e nevoie pentru securitatea serviciului). După închidere, datele se tratează conform Politicii de confidențialitate.</p>
      </section>

      <section id="final">
        <h2>13. Dispoziții finale</h2>
        <p>Termenii sunt guvernați de legea română. Neînțelegerile se rezolvă pe cale amiabilă, iar dacă nu se poate, de instanțele competente de la sediul operatorului UVALO. Dacă ești consumator, ai și drepturile pe care ți le dă legea protecției consumatorilor. Putem actualiza termenii; versiunea în vigoare este cea publicată aici, cu data de sus.</p>
      </section>

      <section id="contact">
        <h2>14. Contact și suport</h2>
        <p>Pentru suport, întrebări despre abonament sau despre acești termeni: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.</p>
      </section>
    </LegalPage>
  );
}
