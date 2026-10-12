import type { Metadata } from "next";
import { COMPANY, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Termeni de utilizare | UVALO" };

const TOC: [string, string][] = [
  ["serviciul", "Serviciul"],
  ["cont", "Contul"],
  ["abonament", "Abonament și plată"],
  ["date", "Datele cadastrale și textele generate"],
  ["utilizare", "Utilizare permisă"],
  ["word", "UVALO pentru Word"],
  ["proprietate", "Proprietate intelectuală"],
  ["disponibilitate", "Disponibilitate"],
  ["raspundere", "Răspundere"],
  ["incetare", "Suspendare și încetare"],
  ["final", "Dispoziții finale"],
  ["contact", "Contact și suport"],
];

/** Terms of use of UVALO (app.uvalo.ro) and of the UVALO pentru Word add-in. Public page. */
export default function Termeni() {
  return (
    <LegalPage title="Termeni de utilizare" lead="Regulile pentru folosirea platformei UVALO (app.uvalo.ro) și a add-in-ului UVALO pentru Word. Folosind UVALO, ești de acord cu acești termeni și cu Politica de confidențialitate." toc={TOC}>
      <section id="serviciul">
        <h2>1. Serviciul</h2>
        <p>UVALO este o platformă pentru evaluatori imobiliari, operată de <b>{COMPANY.name}</b> (CUI {COMPANY.cui}, {COMPANY.reg}, {COMPANY.seat}). Include localizatorul cadastral, analiza amplasamentului, localizatorul de comparabile și add-in-ul UVALO pentru Word (Anexă foto, Anexă documente, Comparabile). Instrumentele disponibile pentru tine depind de planul de abonament al firmei.</p>
      </section>

      <section id="cont">
        <h2>2. Contul</h2>
        <ul>
          <li>Conturile se acordă evaluatorilor autorizați ANEVAR și colaboratorilor firmelor de evaluare, după verificarea solicitării.</li>
          <li>Contul este <b>personal</b>: nu îl împarți cu alte persoane și nu dai altcuiva codurile de autentificare. Răspunzi de activitatea făcută din contul tău.</li>
          <li>Datele din cont trebuie să fie corecte; le poți actualiza din pagina „Contul meu”.</li>
          <li>Activitatea din platformă se înregistrează pentru securitate, limite de utilizare și statistici, așa cum explicăm în <a href="/confidentialitate">Politica de confidențialitate</a>.</li>
        </ul>
      </section>

      <section id="abonament">
        <h2>3. Abonament și plată</h2>
        <ul>
          <li>Accesul la instrumente urmează planul de abonament al firmei în care lucrezi (sau al contului tău individual), cu numărul de locuri și perioada de valabilitate stabilite cu UVALO.</li>
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

      <section id="word">
        <h2>6. UVALO pentru Word</h2>
        <ul>
          <li>Add-in-ul funcționează în Microsoft Word pentru Windows și Mac (Microsoft 365 sau Office 2016 și mai noi). Word în browser nu este suportat deocamdată.</li>
          <li>Pozele și documentele alese se prelucrează pe calculatorul tău; răspunzi de dreptul de a folosi conținutul pe care îl inserezi în raport.</li>
          <li>Add-in-ul modifică documentul doar la comanda ta („Inserează”); îți recomandăm să salvezi documentul înainte. Inserarea se poate anula cu Ctrl+Z.</li>
          <li>Folosirea Microsoft Word și a Microsoft Marketplace este guvernată și de termenii Microsoft.</li>
        </ul>
      </section>

      <section id="proprietate">
        <h2>7. Proprietate intelectuală</h2>
        <p>Platforma UVALO, add-in-ul, designul și textele lor aparțin operatorului UVALO. Primești un drept personal, neexclusiv și netransmisibil de a le folosi cât timp ai cont și abonament activ.</p>
        <p>Conținutul tău (pozele, documentele, rapoartele, datele introduse) rămâne al tău. Hărțile folosesc date © contribuitorii OpenStreetMap (licența ODbL) și Google Maps, conform termenilor acestora.</p>
      </section>

      <section id="disponibilitate">
        <h2>8. Disponibilitate</h2>
        <p>Facem tot ce ne stă în putință ca UVALO să funcționeze continuu, dar pot exista întreruperi pentru mentenanță, actualizări sau din cauza furnizorilor (găzduire, hărți, servicii de date). Putem adăuga, schimba sau opri temporar instrumente; schimbările importante le anunțăm din timp.</p>
      </section>

      <section id="raspundere">
        <h2>9. Răspundere</h2>
        <p>În limitele permise de lege, UVALO nu răspunde pentru pierderi indirecte (de exemplu profit nerealizat) și nici pentru decizii luate doar pe baza datelor orientative din platformă. Răspunderea totală a UVALO față de un utilizator este limitată la sumele plătite pentru serviciu în ultimele 12 luni. Aceste limite nu se aplică în caz de intenție sau culpă gravă.</p>
      </section>

      <section id="incetare">
        <h2>10. Suspendare și încetare</h2>
        <p>Poți cere oricând închiderea contului. Putem suspenda sau închide un cont care încalcă acești termeni, după ce te anunțăm (sau imediat, dacă e nevoie pentru securitatea serviciului). După închidere, datele se tratează conform Politicii de confidențialitate.</p>
      </section>

      <section id="final">
        <h2>11. Dispoziții finale</h2>
        <p>Termenii sunt guvernați de legea română. Neînțelegerile se rezolvă pe cale amiabilă, iar dacă nu se poate, de instanțele competente de la sediul operatorului UVALO. Dacă ești consumator, ai și drepturile pe care ți le dă legea protecției consumatorilor. Putem actualiza termenii; versiunea în vigoare este cea publicată aici, cu data de sus.</p>
      </section>

      <section id="contact">
        <h2>12. Contact și suport</h2>
        <p>Pentru suport, întrebări despre abonament sau despre acești termeni: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.</p>
      </section>
    </LegalPage>
  );
}
