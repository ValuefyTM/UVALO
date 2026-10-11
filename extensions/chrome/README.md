# UVALO pentru Chrome — Comparabile

Extensia UVALO pentru Chrome. Funcționează cu un cont UVALO (app.uvalo.ro) al cărui plan include „UVALO pentru Chrome”. Pagina extensiei, cu versiunile: https://app.uvalo.ro/chrome

Extensie Chrome care capturează anunțuri imobiliare complete (întreaga pagină, feliată automat pe pagini A4 portrait) și generează un document Word cu toate comparabilele în ordinea aleasă, fiecare cu antet de dovadă: titlu, URL (link activ) și data capturii.

## Instalare

1. Dezarhivează folderul `uvalo-chrome` undeva stabil (nu-l muta după instalare).
2. Deschide Chrome și mergi la `chrome://extensions`.
3. Activează **Developer mode** (comutatorul din dreapta sus).
4. Apasă **Load unpacked** și selectează folderul dezarhivat.
5. Fixează extensia în bara Chrome (iconița puzzle → pin).

## Utilizare

0. La prima deschidere a panoului apasă „Conectează-te la UVALO” și intră în cont (email + cod). Capturile rămân doar în Chrome-ul tău; UVALO primește doar statistici de folosire (ce anunț ai capturat, ce ai exportat).
1. Apasă pe iconița extensiei → se deschide panoul lateral.
2. Navighează pe site-urile de imobiliare (Imobiliare.ro, Storia, OLX, Publi24 etc.).
3. Pe fiecare anunț util, apasă **＋ Adaugă pagina curentă**. Anunțul intră în ultimul grup din listă, cu nume precompletat automat („Comparabila 1", „Comparabila 2"…) — numele e editabil direct în listă, apare bold în Word înaintea linkului și poate fi șters cu ✕ de lângă el.
4. Organizează lista:
   - **＋ Grup** creează un grup nou (numele grupului apare ca titlu de secțiune în Word);
   - trage anunțurile cu mouse-ul între grupuri sau folosește săgețile ▲▼ pentru ordine;
   - ✕ șterge un anunț sau un grup.
5. Apasă **📷 Capturează tot**. Extensia deschide pe rând fiecare anunț, închide bannerul de cookies, derulează ca să încarce toate pozele, apoi fotografiază pagina completă, feliată exact pe pagini A4. Tab-urile se închid singure.
6. Verifică orice captură cu 👁: previzualizarea arată paginile A4 exact cum intră în Word, iar butonul **🗑 Șterge pagina** elimină paginile inutile (ex. secțiuni de anunțuri similare de la final) înainte de generare.
7. Butoanele **W**, **PDF** și **W+P** de pe fiecare anunț exportă documente individuale doar cu acel anunț — Word, PDF sau ambele deodată (numit după eticheta lui, ex. `Comparabila_1_2026-07-14.docx` / `.pdf`).
8. Butoanele **Word**, **PDF** și **W+PDF** din bara de sus generează documentul complet — în formatul ales sau în ambele deodată (`Comparabile_AAAA-LL-ZZ.docx` / `.pdf`), A4 portrait, margini 0,5", cu capturile în ordinea din listă. Ambele formate au aceeași așezare: antet de dovadă (nume bold, titlu, link activ, data capturii) + câte o pagină per felie. PDF-ul folosește fontul DejaVu Sans încorporat, ca diacriticele românești să apară corect.

## Descrierea completă

Înainte de captură, extensia apasă automat butoanele de tip „Vezi mai mult" / „Citește mai mult" de la descrierea anunțului, astfel încât textul complet să apară în dovadă. Butoanele care ar încărca alte anunțuri sau rezultate sunt ignorate deliberat.

## Harta localizării

Comutatorul **„Capturează și harta localizării"** (activ implicit) face ca, după capturarea anunțului, extensia să apese butonul de tip „Vezi harta", să aștepte încărcarea hărții și să o adauge ca **ultimă pagină A4** a comparabilei — în Word și PDF apare automat după capturile anunțului. Funcționează pe imobiliare.ro și pe orice site cu hărți Google Maps, Leaflet/OpenStreetMap sau Mapbox. Dacă anunțul nu are hartă, captura rămâne validă fără ea. Pagina cu harta se poate șterge oricând din editorul de pagini (👁).

## Datele de contact în captură

Comutatorul **„Afișează datele de contact înainte de captură"** (activ implicit) face ca extensia, înainte de fotografiere, să apese automat butoanele de tip „Afișează numărul" / „Vezi telefon" — deci numărul de telefon apare în dovadă, exact ca la click manual.

- Extensia folosește sesiunea ta normală de Chrome. Pentru site-urile care cer cont ca să afișeze numărul (ex. OLX), **loghează-te pe site înainte** de captura în lot.
- Site-urile pot limita câte numere dezvăluie într-un interval scurt. La liste mari, dacă observi că numerele nu mai apar, fă o pauză și re-capturează anunțurile rămase mai târziu.
- Dacă pe un anunț numărul nu s-a afișat (ex. a apărut o fereastră de login), captura se face oricum — deschide anunțul manual, afișează numărul, apoi re-capturează cu 📷.

## Bine de știut

- La primul export „ambele deodată", Chrome poate cere permisiunea pentru descărcări multiple — apasă **Allow** o singură dată și rămâne memorat.
- **🗑 Reset** (în bara de sus) șterge complet lista și toate capturile — folosește-l când începi un raport nou.

- **Bannerul galben „a început depanarea acestui browser”** apare pe durata capturii — e normal, așa funcționează captura de pagină întreagă, și dispare la final.
- **Nu închide panoul lateral** în timpul capturii în lot; procesul rulează din panou.
- Între capturi există o **pauză de 2 secunde**, ca site-urile să nu blocheze accesul. Dacă un site afișează CAPTCHA, rezolvă-l manual în tab și re-capturează anunțul cu 📷.
- Capturile se păstrează local în browser și rămân disponibile între sesiuni. **Golește lista** le șterge definitiv.
- Anunțurile foarte lungi sunt plafonate la 14 pagini A4 per anunț.
- Dacă o comparabilă iese cu bannere sau ferestre peste conținut, deschide anunțul manual, închide-le, apoi re-capturează.

## Structura documentului Word

Pentru fiecare grup: numele grupului (majuscule, subliniat cu linie chihlimbar), apoi fiecare anunț începe pe pagină nouă cu:

- numele comparabilei (bold) urmat de titlul anunțului;
- „Sursă: <link activ> • Data capturii: zz.ll.aaaa hh:mm";
- capturile, câte o felie per pagină A4, în ordinea din listă.
