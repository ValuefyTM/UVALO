# UVALO — app.uvalo.ro

Repo: `ValuefyTM/uvalo` (fost `ValuefyTM/tools`).

Platformă SaaS pentru evaluatori imobiliari (fostă „VALUEFY Tools”). Modulul principal este **Localizatorul cadastral**
(hartă cu parcele/clădiri din exporturile ANCPI, căutare după nr. cadastral/topo/adresă, export PDF/Word/PNG, GPS).
Operatorul platformei (din 13 oct 2026): **IDEONA ANALYTICS S.R.L.**, CUI 46573375, J2022003536355, Str. Circumvalațiunii nr. 33,
Timișoara (`COMPANY` în `src/components/LegalPage.tsx`). UVALO e un produs separat de site-ul și CRM-ul VALUEFY.

## Reguli de lucru

- **Răspunde în română.** Utilizatorul apreciază o propunere scurtă (design/abordare) înainte de funcții mari,
  dar adesea cere să treci direct la implementare.
- **Credențialele nu se scriu niciodată în chat sau în cod** — stau în Cloudflare (secrets/vars ale workerului)
  și în GitHub (Actions secrets). Dacă lipsește ceva, spune ce secret trebuie pus și unde.
- **Datele de plan nu se șterg la actualizare**: la un export nou se adaugă/modifică doar ce e nou; parcelele
  care lipsesc din exportul nou rămân (marcate intern `"o":1`), dar **fără marcaj vizibil** pe hartă.
- **Copiile bazei de producție se anonimizează implicit** (nume, emailuri, telefoane).
- Mesajele de commit în română, scurte, la obiect. Push pe `main` = deploy în producție (vezi mai jos).
- După schimbarea de branch: `rm -rf .next/types` dacă `tsc` dă erori ciudate.
- **Fără VALUEFY în platformă** (texte, antete de export, logo, emailuri): contactul afișat este `office@uvalo.ro`;
  antetul exporturilor (amplasament, comparabile) = numele evaluatorului + legitimația, nu numele firmei.
  Excepții: identificatorii tehnici
  (`vf_tools`, `valuefy-tools-db`, `valuefy-anexa-*`, redirecționarea `tools.valuefy.ro`, scurtătura veche ștearsă de instalator).

## Stack

- Next.js 16 (App Router) pe **Cloudflare Workers** prin **OpenNext** (`@opennextjs/cloudflare`).
- Bază de date **D1** `valuefy-tools-db` (binding `DB`) — separată de CRM (`valuefy-db`). Migrații în `migrations/`.
- `worker.ts` = intrarea workerului (wrangler `"main"`), un strat peste aplicația OpenNext:
  - `OLD_HOSTS` (implicit `tools.valuefy.ro`) → **301** către `APP_URL`, păstrând calea și query-ul; `/api/` NU se
    redirecționează (CRM-ul VALUEFY îl folosește încă);
  - `SITE_HOSTS` (implicit `uvalo.ro,www.uvalo.ro`) = **site-ul de prezentare**: `/` servește pagina `/site` a aplicației,
    fișierele ei trec (`SITE_FILES`: `/_next/`, `/site/`, `/word/prezentare/`, logo, iconițe), orice altă cale → **302** la aceeași cale în aplicație;
  - șterge `x-forwarded-*` (linkurile din emailuri se construiesc doar din `APP_URL`/Host — `src/lib/site.ts`).
- Fără framework CSS: totul în `src/app/globals.css`. Paginile din `AppShell` folosesc toată lățimea (`.content` max. 1800 px; Colaborări fără limită proprie). Brand: fundal închis `#141414`, auriu `#E0AD4F`.
  **Fontul platformei = Plus Jakarta Sans** (variabil, servit din `public/fonts/` — latin + latin-ext pentru ș/ț, licență OFL; `--font` în
  `globals.css`, `@font-face` și în `localizare-data/*.html`, `public/word/src/taskpane.css`, panoul din `word.ts`, paginile din `route.ts`;
  `/fonts/` trece și pe `INSP_HOSTS` / `SITE_HOSTS`). Excepții păstrate pe Verdana: exporturile PDF / PNG / Word (canvas, docx) și emailurile.
  Site-ul de prezentare (`.ld*`) rămâne pe Manrope + Sora. În atributele `style="…"` fontul se scrie cu ghilimele simple.
  Logo-uri în `public/uvalo-*.svg` (lockup alb, simbol, vertical ink, logo text); favicon `src/app/icon.svg`;
  iconițe PWA `public/loc-icon-*.png`.

## Structură

- Meniul (`AppShell`), cu iconițe (`NavIcon`, conturul auriu la pagina curentă): **Acasă**, (**Inspecții** pe locul 2 doar după lansare, modul `on`,
  cu contorul auriu = inspecțiile mele de azi neterminate), **Colaborări** (pentru cine are acces în modul curent), **Instrumente**
  (`/instrumente`, toate instrumentele pe o pagină, grupate „Pe platformă” și „În Word și în browser”; paginile instrumentelor aprind „Instrumente”),
  apoi **În curând**: Inspecții (cât modul ≠ `on`; link cu TEST pentru cei din grupul de test, altfel estompat) și Analize de piață.
  Pe telefon: Acasă, Colaborări, Instrumente, Contul meu.
- `src/app/` — pagini: `login`, `solicita-cont`, `invitatie`, `cont`, `firma` (panoul firmei), `admin/*`
  (firme, utilizatori, solicitări, recomandări, activitate, tablou ANEVAR, planuri), `mentenanta`, `localizare`.
- `src/app/api/` — `auth`, `account`, `org`, `admin/*`, `localizare/*` (data, geocode, centroid, manifest, sw, track-js…),
  `request`, `invite`, `referral`, `track`, `avatar`.
- `src/lib/` — `auth.ts` (coduri pe email, sesiuni cookie `vf_tools` host-only), `guard.ts` (acces pagini/API +
  mentenanță), `access.ts`/`orgs.ts` (firme, locuri, planuri), `plans.ts` (pipeline planuri), `maintenance.ts`,
  `email.ts` (Resend), `gmaps.ts`, `site.ts`, `track.ts`, `crypto.ts` (inclusiv `cleanPhone`).
- `localizare-data/` — Localizatorul: HTML static (`index.html`, cu lista `UATS` inline: key/name/county/v/n/nb/bb/
  hull/date) + date per UAT. Servit de `src/app/localizare/route.ts`, care injectează scripturile (export, tracking,
  PWA, notice) și redirecționează la mentenanță. `export.js` = export PDF/Word/PNG + căutare mai multe numere.
  `scripts/copy-localizare.mjs` îl copiază în build.
  Selectorul Județ are toate cele 42 de județe (`ALL_J`), Timiș preselectat: „Cu planuri cadastrale” / „Fără planuri”. Un județ fără planuri
  deschide fereastra `#np` (`noPlan`): coordonate Stereo 70 scrise (`parse70`, un punct pe rând; ordinea X/Y după județ, `orient70`/`JUDC`)
  sau CF / plan citit cu AI (`/api/amplasament/plan`, folosește `_place.swap`; doar cu modulul `amplasament`, `window.UVALO_DOC.ai` injectat
  de rută) → conturul pe aceeași hartă (`docL`) + cardul din `#out` (suprafață, GPS, „Analiză amplasament” prin `uvalo-doc`). Evenimente
  `no_plan_county`, `stereo_locate`.
  Pe telefon: harta 72svh, butonul ⤢ (`#full`) = hartă pe tot ecranul (`body.mapFull`), pornită automat de „Locația mea” și oprită la
  „×”; acolo, parcela atinsă dă butonul „Vezi fișa ↓” (`toOut`). Bara GPS e compactă: stare + ×, o linie de detalii, acțiuni pe un rând.
  **Straturi Timișoara** (în panoul Straturi, oprite implicit): „Cartiere Timișoara” (contur alb punctat + nume, ascunse sub zoom 13)
  și „Zone de impozitare Timișoara” (A–D colorate, HCL 620/25.11.2025, cu legendă). Datele în `localizare-data/straturi/timisoara.json`
  (în subdosar, ca `copy-localizare` să nu le ia drept UAT), servite de `/api/localizare/strat/<uat>`, încărcate la prima bifă sau la
  deschiderea Timișoarei; nu răspund la click (pane `strPane` sub parcele). Fișa parcelei din Timișoara arată „Cartier” și „Zonă de impozitare”
  (punctul central în poligon, `zoneInfo`). Refacere din GeoJSON-urile WGS84: `python3 tools/straturi/convert.py <dosar> localizare-data/straturi/timisoara.json`
  (`cartiere_timisoara_2024.geojson`, `zone_impozitare_timisoara_2026.geojson`, `cartiere_x_zone_procent.csv`).
  **Grila notarială 2026** (bifa „Grilă notarială 2026”, oprită implicit): zonele din Studiul de piață al CNP Timișoara (Romprice, nr. 4100/10.12.2025)
  — Timișoara 0–5, Dumbrăvița A–E, Giroc + Chișoda, Ghiroda, Moșnița Nouă + Veche + Urseni, Șag, Săcălaz, Dudeștii Noi, Jimbolia A–D (`GR_UATS`).
  Zonarea din studiu e **pe străzi** (anexele 21–31, cu tronsoane pe numere poștale / intersecții / pare-impare), deci stratul = străzile OSM colorate
  pe zone + suprafețele zonelor; **tooltip-ul `grHov`** urmează cursorul pe toată suprafața (`map.on('mousemove', grHover)`): zona, localitatea,
  prețurile principale (`grValues().short`) și strada + tronsonul când cursorul e la ≤ 15 m de o stradă zonată; suprafețele zonelor (grilă de 15 m, zona străzii zonate celei mai apropiate la ≤ 220 m, vectorizată și
  rotunjită). Fișa parcelei: „Zonă notarială 2026” + teren €/mp + strada după care s-a încadrat (centrul parcelei în poligon; > 120 m = „estimat”)
  + „Toate valorile minime” (apartamente, case, comercial, extravilan din `grila-valori.json`); blocul apare **doar cu stratul pornit**
  (`grilaRefresh()` la bifă). **„Calculează valoarea de grilă”** (`gcOpen`, fereastra `#gc`): tipul bunului (teren / casă / apartament / spațiu
  comercial / industrial / hotel-pensiune), câmpurile preluate din plan (suprafața parcelei, amprenta construcțiilor ca Sc parter), prețurile
  din `grPrices()` și regulile studiului în `gcCalc()`: teren > 5.000 mp (Timișoara, −30% zonele 1–3 / −65% zonele 4–5) sau > 3.000 mp
  (localități, −20% A–B / −80% C–E), drum −85%, spații verzi −70%, extravilan (8 €/mp Timișoara; €/ha pe localitate × categorie), casa pe
  niveluri și perioade (localități: mansardă/subsol 50%), anexe, apartament pe camere / Su (Scd : 1,25) / mansardă −10% / subsol −30% + garaj
  și boxă, spațiu comercial > 200 mp −20%, restaurant −20%, lemn/PVC −50%, industrial și hotel pe Scd; „Copiază rezumatul”. Date: `localizare-data/straturi/grila-<uat>.json`
  (`/api/localizare/strat/grila-<uat>`, încărcate la bifă sau la deschiderea UAT-ului; `applyGrila()` și din `loadUat`).
  Refacere: `tools/grila/` — `parse_streets.py` (textul anexelor din `pdftotext -layout` → `data/anexe-strazi.json`), `valori.py` (tabelele
  transcrise → `data/valori.json`), `overpass.py` (străzile OSM pe dale + adresele; oglinzile `overpass.private.coffee` / `kumi.systems`,
  `overpass-api.de` refuză IP-urile cloud), `build.py <anexe> <valori> <dosar osm> localizare-data <out>` (potrivire nume cu aliasuri `ALIAS`,
  spina străzii = cel mai lung drum prin rețea, tăierea tronsoanelor, raster → poligoane; cere `.open-next/assets/_localizare/c/` din build);
  `data/raport.json` = nepotrivirile (străzi lipsă din OSM, mai ales în Moșnița / Urseni) și tronsoanele estimate. La un studiu nou se refac
  `anexe-strazi.json` + `valori.json` și se rulează din nou.
- `tools/dxf/convert.py` — convertorul DXF ANCPI → date localizator (ezdxf, shapely, pyproj; Stereo70 → WGS84).
  Citește stratul `T_A1S1_<UAT>_<data>` și `*constructii*`; face **merge** cu datele existente.
  `--entry <key>` reface intrarea din `UATS` (versiune sha1[:10], dată, județ).

## Analiza amplasamentului (`/amplasament`)

- Pagina: `localizare-data/amplasament.html` (servită de `src/app/amplasament/route.ts`, modulul `amplasament`, în toate
  planurile prin migrația 0012). Intrări: `?uat=&nr=` (bara de pe pagina de start → „Analiză amplasament”, butonul din
  fișa parcelei din localizator), `?adr=` (adresă/coordonate), `?lat=&lng=`. Nr. negăsit → cere adresa; dacă adresa
  cade pe o parcelă din planuri, o identifică (WGS84 → Stereo 70 prin iterații Newton).
  Căutare după adresă (formularul din pagina goală `#addrF`, `?adr=`, „nr. negăsit”): dacă în jurul punctului (250 m) există parcele
  din planurile localizatorului → fereastra `#pickDlg` cu harta satelit și parcelele, evaluatorul alege parcela (cea de sub punct e preselectată)
  sau „Doar zona”; fără plan în zonă → starea `#noplan`: încărcarea planului de amplasament pentru reconstrucția parcelei sau „Continuă doar
  cu analiza zonei”. Evenimente `pick_open`, `pick_parcel`, `no_plan`.
- Calculele parcelei se fac în browser, din datele localizatorului (`/api/localizare/data/<uat>`): formă, regularitate,
  deschidere (laturi fără vecin înscris la ≤ 25 m de axul străzii OSM), adâncime, orientare, construcții, POT, vecini.
  Intravilanul NU se deduce (limita din plan e incompletă) — îl completează evaluatorul.
- `/api/amplasament/osm`: Overpass (OpenStreetMap), dotări 1,5 km, străzi, drumuri principale, factori negativi,
  localități; cache în worker o săptămână. Var opțională `OVERPASS_URL`.
- `/api/amplasament/text`: textul „Descrierea amplasamentului” cu Claude (`@anthropic-ai/sdk`, `claude-opus-5-5`,
  fallback server-side), variante scurt/detaliat/academic + promptul utilizatorului; cifrele din răspuns sunt verificate
  față de date (`unverified`). Secret worker: **`ANTHROPIC_API_KEY`**. Limitele se setează în Admin → Instrumente.
- Fără plan în localizator: `/api/amplasament/plan` — evaluatorul încarcă planul de amplasament și delimitare (PDF/poză,
  max. 15 MB; pozele se micșorează în browser), Claude îl citește cu structured output (nr. cadastral, CF, suprafețe,
  inventar de coordonate Stereo 70, construcții, vecini, adresă). Pagina reface parcela din coordonate (X=N, Y=E; le
  întoarce dacă ies din România), verifică suprafața față de cea scrisă pe plan și ia vecinii din planul ANCPI dacă UAT-ul
  există. Fără coordonate → formular manual (suprafață, deschidere, adâncime, formă, poziție, construcții). Limită 30/zi.
  Acceptă și **extrasul CF** (coordonatele din tabelul „Lungime segmente”) și planuri **fără inventar, dar cu caroiaj** (`sursa_coordonate =
  caroiaj` → `puncte_estimate`, aduse la suprafața de pe plan cu `fitArea`, marcate „estimate ±1–2 m”). Ordinea X/Y se decide în pagină
  (`orientPts`): varianta care cade în România, iar dacă amândouă, cea mai apropiată de UAT-ul din document (bb din localizator, apoi
  centrul județului din `JUD`, apoi geocodare; decide doar la diferență > 0,15°). Extrasele CF scriu „X / Y” cu **Y (est) întâi** →
  la CF, în caz de dubiu, se inversează implicit (Argeș pus greșit lângă Sibiu înainte de corecție).
  Nr. cadastral găsit și în localizator → `p.anc` (conturul ANCPI, suprafața, distanța maximă între contururi): pe harta zonei și în fig. 2
  conturul din document roșu, cel ANCPI albastru punctat, cu legendă; în caseta planului „coincid” sub 0,5 m.
  Merge și în județe fără plan în localizator. Fig. 2 (plan de situație) arată numerele punctelor, lungimile laturilor și vecinii de pe planul încărcat.
- Adresele în format de act („Jud. Cluj, UAT Cluj-Napoca, Loc. …, Str TRAIAN VUIA, Nr. 21-23”, și cele citite din CF) se desfac
  (`parseAddr`/`addrVariants` în amplasament.html) în stradă + număr + localitate + județ; se încearcă pe rând formulările curate, apoi originalul.
- Căutare după **coordonate Stereo 70** (`parseStereo`, în amplasament și în localizator): „X 476000 Y 210500” sau „476000, 210500”.
- Deschiderea: doar laturi aproape paralele (< 30°) cu o stradă OSM la ≤ 25 m; altfel „neidentificată automat”, cu
  laturile fără vecin înscris și dreptunghiul încadrator (nu se ghicește frontul).
- Index UAT-uri (`_localizare/c/index.json`) conține acum și `v` (versiunea datelor) și `bb`.
- **Bara de pe Acasă** (varianta A din canvas, `src/components/QuickSearch.tsx`): un rând — titlu + `heroMeta` + „Deschide harta”, câmpul `.quickField` cu
  butonul „CF / plan” în interior (și drag & drop peste câmp), Localizează, Analiză amplasament; sub el exemple (`quickEx`) sau rezultatul citirii
  pe o linie (`docLine`). „CF / plan” doar cu modulul `amplasament`: fișierul merge la
  `/api/amplasament/plan`, care întoarce acum și `_place` (`placeDoc` în `src/lib/cadastre.ts`, conversia în `src/lib/stereo70.ts`: ordinea X/Y,
  GPS, UAT-ul din localizator în care cade, `inPlan` = nr. cadastral găsit în planul lui). Cardul arată ce s-a citit, „identificat în planul
  cadastral” și „localizat după Stereo 70”, cu „Vezi pe harta cadastrală” (doar unde există plan) și „Analiză amplasament” (datele trec prin
  `sessionStorage` `uvalo-doc` → `/amplasament?doc=1`, fără a doua citire AI). Bara acceptă și Stereo 70 („X 476000 Y 210500”).
- Exportul Word al analizei = aceeași așezare ca PDF-ul: hărțile una lângă alta (tabel de așezare fără chenar), sub fiecare tabelul ei
  (cu două tabele; altfel tabelul pe toată lățimea), apoi descrierea.
- Harta zonei din amplasament: straturi „Hartă” / „Satelit” (Esri, ales în `localStorage` `amp-base`, folosit și la exportul PNG/PDF/Word);
  „Vezi în localizator ↗” (`locLink`) când parcela e în planul ANCPI sau punctul cade într-un UAT cu plan.
- Documentul încărcat: UAT-ul se ia și după poziție (`uatAt`, bb), ca vecinii ANCPI să apară și când CF-ul numește altfel localitatea.
  `parcele_vecine` (schema AI: parcelele vecine desenate în CF / plan, cu nr. cadastral, colțuri estimate) → `p.extN`, desenate punctat în fig. 2
  doar unde localizatorul nu are planul zonei.

## UVALO pentru Word (`/word`, modulul `word`)

- Add-in Word instalat **fără Microsoft Store** (preluat din add-in-ul VALUEFY Anexe, care mergea pe server local
  `https://localhost:3001`). Tab „UVALO” în Word: **Anexă foto**, **Anexă documente**, **Instrumente**.
- Panourile: `/word/anexe?mode=photo|pdf` (HTML în `localizare-data/word-anexe.html`, scripturile + pdf.js în
  `public/word/`), `/word/instrumente` (listă de instrumente, cele web se deschid în browser). Acces = `locatorAccess("word")`;
  nelogat → `/login?next=…` chiar în panou (cookie-ul `vf_tools` merge în Word desktop; Word pe web nu e suportat).
- `src/lib/word.ts`: `ADDIN_ID` (nu se schimbă), manifestul generat cu originea curentă (`/word/manifest.xml`),
  instalatorul Windows `/word/instaleaza.cmd` (descarcă manifestul în `%LOCALAPPDATA%\UVALO\Word`, îl înregistrează în
  `HKCU\…\WEF\Developer`, scoate add-in-ul vechi VALUEFY) și `/word/dezinstaleaza.cmd`. Pentru o firmă întreagă:
  Microsoft 365 admin center → Aplicații integrate → manifestul. Mac: manifestul în `…/com.microsoft.Word/Data/Documents/wef`.
- Schimbările din panouri ajung imediat la toți; un buton nou în tab = manifest nou (`MANIFEST_VERSION`) și reinstalare.
- Blocurile inserate păstrează etichetele vechi `valuefy-anexa-*`, ca „Înlocuiește anexa existentă” să le recunoască.
- Folosire în `events` (`module = 'word'`: `pane`, `insert_photo`, `insert_pdf`); în toate planurile prin migrația 0013.
- Admin → Instrumente → UVALO pentru Word: comutator pentru tot add-in-ul + „Funcții” (Anexă foto / Anexă documente /
  Comparabile separat; cheile `word.photo` / `word.pdf` / `word.comps` în `off`, lista `FEATURES` din `src/lib/tools.ts`).
- Butonul **Comparabile** (manifest 1.1): panoul `/word/comparabile` deschide `/comparabile?word=1` într-o fereastră mare
  (Office dialog). Acolo `public/word/src/comps-bridge.js` adaugă „Inserează în raport”: harta PNG + rândurile tabelului
  trimise prin `messageParent` pe bucăți de 30 000 de caractere; panoul (`comps-pane.js`) le inserează la cursor (imagine
  + tabel Word, WordApi 1.3).
- Anexele păstrează lucrul la închiderea panoului: fișierele și lista (ordine, bife, descrieri, titluri) în IndexedDB
  `uvalo-anexe` (per mod, 12 ore); „Golește” șterge tot.
- Anexă documente: „Restrânge paginile / Arată paginile” și ▸/▾ pe fiecare document (`doc.folded`, păstrat în sesiune);
  documentele se mută trăgându-le de mânerul ⠿.
- Pagina `/word`: prezentare (hero + cele două unelte cu capturi din `public/word/prezentare/*.webp`), tab-uri
  Prezentare / Instalare / Versiuni (`src/components/WordTabs.tsx`, `#instalare`, `#versiuni`). Capturile se refac cu
  Playwright din panourile reale, cu poze și PDF-uri demonstrative (fără date reale).
- Pagini publice (fără cont, merg și în mentenanță): `/confidentialitate` și `/termeni` (`src/components/LegalPage.tsx`,
  datele firmei în `COMPANY`). Legate din login, invitație, `/word`, panourile Word; `SupportUrl` din manifest =
  `/termeni#contact`. Le cere Microsoft Marketplace. La o schimbare de prelucrare (furnizor nou, date noi) se actualizează.
- **Versiuni**: `WORD_VERSIONS` în `src/lib/word.ts` (cea mai nouă prima; afișată în panouri și pe `/word#versiuni`).
  La fiecare schimbare vizibilă se adaugă o intrare; `manifest: true` = s-au schimbat butoanele, cere reinstalare
  (și `MANIFEST_VERSION` crește).

## UVALO pentru Chrome (`/chrome`, modulul `chrome`)

- Extensia Chrome (Manifest V3) pentru capturi de anunțuri ca comparabile, preluată de la VALUEFY și rebranduită:
  sursa în `extensions/chrome/` (sidepanel.js = captură CDP feliată pe A4, export Word/PDF; `uvalo.js` = contul UVALO,
  statistici, „Trimite în Word”). Arhiva descărcabilă `public/chrome/uvalo-chrome.zip` se reface cu
  `npm run chrome:zip` după orice schimbare (și crește `version` din `manifest.json` + `CHROME_VERSIONS` în `src/lib/chrome.ts`).
- Instalare: „Încarcă extensia neîmpachetată” (fără Chrome Web Store deocamdată). Pagina `/chrome`: prezentare,
  instalare, versiuni; capturi în `public/chrome/prezentare/`.
- Contul: la deschiderea panoului `GET /api/chrome/status` cu cookie-ul `vf_tools` (401 → ecran „Conectează-te la UVALO”,
  care deschide `/login?next=/chrome?conectat=1`; 403 plan; 503 mentenanță; fără rețea → merge local).
- „Trimite în Word”: `POST /api/chrome/batch` (lista), `PUT /api/chrome/batch/<id>/<item>/<idx>` (fiecare imagine JPEG,
  ≤ 1,9 MB, recomprimată în extensie), `POST …/<id>/done`. Stocare în D1 (`chrome_batches`, `chrome_slices`, migrația
  0015), o trimitere per persoană, ștearsă după 7 zile. În Word: panoul `/word/chrome` („Comparabile din Chrome”, din
  Instrumente și din panoul Comparabile) → `public/word/src/chrome-pane.js` inserează la cursor. Funcție separată
  `word.chrome` în admin. Dacă volumul crește, imaginile se pot muta în R2.
- Evenimente: `chrome` (`open`, `capture`, `export`, `send_word`), `word` (`chrome_open`, `insert_chrome`).

## Site-ul de prezentare (uvalo.ro → `/site`)

- Numele afișat: „Platforma evaluatorilor autorizați din România” (titlul paginii, OG, subsol, login).
- `src/app/site/page.tsx` (publică, indexabilă, merge și în mentenanță) după canvasul „UVALO — Landing Colaborări”: hero Colaborări,
  cum funcționează, analize de piață „În curând” (raport pilot Deta), instrumentele (localizator, amplasament, comparabile, Word cu galerie
  `SiteGallery`, Chrome), firme/birouri, CTA „Creează cont gratuit” (`/solicita-cont`). Fără pricing. Stiluri `.ld*` în `globals.css`,
  fonturi Sora + Manrope (Google Fonts), imagini în `public/site/`. Linkurile spre aplicație = `origin()` (APP_URL).
- `uvalo.ro` și `www.uvalo.ro` trebuie adăugate ca custom domains pe workerul `tools` ca site-ul să apară.
- Hero-ul e un slider (`src/components/HeroSlider.tsx`, `SLIDES`): Colaborări („NOU ÎN UVALO”) și Inspecții („ÎN CURÂND”, „Gata cu hârtiile.”,
  fereastră de browser + ramă de telefon din `public/site/inspectii-web.webp` / `inspectii-mob.webp`). Se schimbă doar textul și imaginea;
  butoanele și nota (`actions`) rămân fixe. Trece singur la 7 s (oprit la hover/atingere, `prefers-reduced-motion`), file + săgeți, swipe.
  Pe telefon textul slide-urilor inactive e ascuns (fără gol). Stiluri `.ldSlides`, `.ldDots`, `.ldDuo`, `.ldBrowser`, `.ldPhone`.
- **Pagina aplicației de inspecții**: `uvalo.ro/aplicatie-inspectie` (`worker.ts` o rescrie pe `SITE_HOSTS` la `/site/inspectii`; `/aplicatie` → 301
  spre ea; pe app host e la `/site/inspectii`), `src/app/site/inspectii/page.tsx`, publică, canonical `https://uvalo.ro/aplicatie-inspectie`,
  OG `public/site/inspectii-social.png`.
  Hero cu rama browser + telefon (`.ldDuo`) și lista `.ldChecks`; „Cum funcționează” (web → telefon → web, `.ldStep` cu eticheta `.ldWhere`);
  panourile „Pe teren” / „Pe web”; „Ce face aplicația” (secțiune închisă, bannerul `.ldBanner` + carduri `.ldCardDark`); **„Disponibilă azi”**
  (instalare din browser, pașii `.ldSteps`) lângă **„În curând în App Store și Google Play”** (pastilele `.ldStore`, fără badge-urile oficiale;
  mențiunea mărcilor în subsol); trust + CTA. Linkuri din landing: meniu, subsol și slide-ul Inspecții (`more` în `HeroSlider`, `.ldMore`).
  Când aplicațiile native apar, pastilele devin linkuri spre magazine.
- Bannere de promovare Inspecții: `public/site/inspectii-banner.png` (1600×900) și `inspectii-social.png` (1200×628, OG/LinkedIn): capturi reale
  cu date demonstrative fictive.

## Acasă nouă (dashboard, `src/components/HomeDash.tsx`)

- După canvasul „UVALO — Dashboard Acasă”. Acces după **mod** (Admin → Instrumente → Acasă nouă, `app_settings` `acasa_mode`, API `/api/admin/acasa`,
  `c.homeNew` în `context()`); `src/app/page.tsx` o arată în loc de pagina veche. Ceilalți văd pagina veche.
- Conținut (doar ce are persoana în module): „Ce evaluăm azi?” + bara de căutare închisă, pe toată lățimea (`QuickSearch` cu `extra` = „+ Inspecție” și `recent` = ultimele parcele ca
  „Recente”), cifrele zilei, compacte pe un rând (inspecții azi / săptămâna asta / fișe de verificat = finalizate de verificat / lucrări noi în zonă), **Inspecții** pe
  hartă sau calendar (`HdInsp`, refolosește `MapView` / `CalView` din `InspList`, alegerea în `localStorage` `home-insp-view`; doar nefinalizatele — În lucru, Programată,
  De programat; harta 360 px cu lista în dreapta — carduri compacte cu scroll (`.hdMapRow`, `.hdItem`: număr, stare, data + ora, adresa,
  inspectorul), cardul atins aprinde pinul (`focus` în `MapView`); pe telefon lista sub hartă; lângă titlu etichete colorate `.hdTag`: azi / pe teren acum /
  săptămâna asta / de programat, cifra în bulină), telefonul (`HdPhone`: cu un telefon real conectat — card compact pe un rând („iPhone conectat”, „Semnal … · push activ”) + butonul „Reinstalează”; fără niciunul (dispozitivul `test` nu se numără) tot cardul
  îndeamnă „Instalează aplicația UVALO”; ambele deschid fereastra cu QR — `pair_code`, se conectează singur — și pașii iPhone / Android), „Necesită atenția ta” (fișe întoarse, de verificat, solicitări fără răspuns / refuzate,
  fără dată, cereri noi la anunțul meu, mesaje necitite), Colaborări (anunțurile din zonă cu distanța), caruselul de instrumente (`HdTools`, iconițe
  Word / Chrome), „Luna ta” (finalizate, timp mediu, fotografii, analize AI, grafic pe 8 săptămâni), activitatea recentă (`phoneNotifs` + notificările
  Colaborări), „Analize de piață și comparabile” în curând. Fără „Documente recente” (cerut). Comparabile = „Localizator Comparabile”. Stiluri `.hd*`.

## Feedback (buton în dreapta jos)

- `public/feedback.js` (vanilla, stiluri proprii `uvfb-*`): în `AppShell` și injectat de rutele `localizare`, `amplasament`,
  `comparabile` (nu în fereastra Word). Atribute `data-bottom` / `data-bottom-mobile` pentru barele fixe (meniul de jos pe
  telefon, scara hărții). Trimite la `/api/feedback` (tip problemă / idee / altceva, text, pagina, acord de răspuns; max. 10/oră),
  salvat în tabelul `feedback` (migrația 0017), email către super-admini. Admin → Feedback (`/admin/feedback`): filtre,
  stare nou / citit / rezolvat, notă internă, „Răspunde” pe email; contorul de noi în meniul admin.

## Cine e online (Admin → Panou)

- `public/presence.js` (în `AppShell`, `AdminShell` și injectat lângă `feedback.js` în localizator / amplasament /
  comparabile): un `POST /api/ping` pe minut cât pagina e vizibilă → `sessions.last_seen_at` + `sessions.last_page`
  (migrația 0018) și `users.last_seen_at`. Panoul: „Online acum” = sesiuni cu semnal în ultimele 3 minute, grupate pe
  persoană, cu pagina (UAT și nr. cadastral în localizator), dispozitivul și orașul; plus ultimele 15 minute și azi.

## Admin → Activitate (`/admin/activitate`)

- Fără filtru: „Cei mai activi utilizatori” (top 5 pe 30 de zile, `topUsers`, fără modulul `admin`, cu instrumentul preferat) și
  „Cele mai folosite instrumente” (`toolUsage`: acțiuni, persoane, ultima folosire, doar modulele din `TOOLS`), apoi graficul și tabelele.
- `?user=<id>` (selectorul de sus sau click pe top): statisticile persoanei — `userTotals` (acțiuni, locul în clasament, zile active,
  autentificări, prima/ultima acțiune), graficul ei, instrumentele, acțiunile, localitățile, parcelele și jurnalul doar al ei
  (`topActions`/`topTargets` primesc acum și `userId`).

## Filtre în admin (Utilizatori, Tablou ANEVAR)

- `/admin/utilizatori`: filtre GET (caută, județ, stare, tip cont, firmă, activitate, ordonare) și „Grupează pe județe” (`grup=judet`,
  rânduri-antet cu totaluri). „Unește două conturi” primește mereu lista completă. `/admin/tablou`: același `grup=judet` (`TablouFilter.grup`).

## Emailuri de cont

- **Acordurile la crearea contului** (migrația 0034): în „Solicită cont” (`RequestForm`) și la activarea invitației (`AcceptForm`) bifa obligatorie
  „Am citit și accept Termenii și condițiile și Politica de confidențialitate” (butonul rămâne inactiv fără ea; verificată și pe server:
  `account_requests.terms_at`, `users.terms_at`) și bifa opțională, nebifată implicit, „Vreau să primesc pe email noutățile UVALO, când lansăm
  instrumente noi” (`account_requests.newsletter` → precompletată la activare; `users.newsletter` + `newsletter_at`). În „Contul meu” cardul
  `NewsletterCard` o pornește / oprește (`PATCH /api/account {newsletter}`). Confidențialitatea (secț. 7) o menționează (consimțământ, lit. a).
  La unirea conturilor rămâne pornită dacă unul o avea.

- Aprobarea unei solicitări de cont (`approve` în `requests.ts` → `invite(..., approved = true)`) trimite „Solicitarea ta de cont UVALO a fost
  aprobată” + „Activează contul”, fără numele celui care a aprobat; retrimiterea invitației detectează singură solicitarea aprobată.
  Invitațiile în firmă păstrează „X te-a invitat”. Saluturile folosesc `greetName()` (numele din Tablou, scris cu majuscule → „Ionescu Maria”).

## Unirea a două conturi (Admin → Utilizatori → „Unește două conturi”)

- `src/lib/merge.ts` (`/api/admin/users/merge`): contul care rămâne își păstrează emailul și preia de la celălalt numele,
  legitimația, județul, specializările, telefonul, poza (unde le are); firmele (rolul mai mare), sesiunile, evenimentele,
  auditul, recomandările, Chrome, Colaborări, setările care numesc persoana. Totul într-un `db.batch` (tranzacție), apoi
  contul vechi se șterge; copia lui rămâne în `audit_log` (`user.merge`). Un tabel nou cu `REFERENCES users` → adaugă-l aici.

## Ștergerea unui cont (Admin → Utilizatori → „Șterge contul”)

- `deleteUser` în `src/lib/merge.ts` (`DELETE /api/admin/users/<id>`), pentru email greșit: șterge sesiunile, codurile de autentificare,
  apartenențele, invitațiile deschise, Chrome, datele din Colaborări și firma individuală (dacă nu are alți membri/invitații), apoi contul;
  persoana poate cere din nou cont (legitimația devine liberă). Nu merge pe super-admini și pe propriul cont. Un tabel nou cu `REFERENCES users` → și aici.
- Persoana NU își șterge contul, ci îl **închide**: „Contul meu” → „Închide contul” (`CloseAccount`, `DELETE /api/account` cu
  `{confirm: email, reason, note}` → `closeAccount` în `merge.ts`): `users.status = 'closed'`, `closed_at`, `close_reason` (migrația 0019),
  sesiunile revocate (nu șterse), istoricul rămâne, locul din firmă se eliberează, în Colaborări fără notificări și anunțurile active arhivate.
  Refuzat pentru super-admini și administratorul unic al unei firme cu colegi. Admin → Utilizatori, Stare „Au renunțat” (și în Tablou);
  „Reactivează” sau o nouă solicitare de cont cu același email îl fac din nou activ. `status 'closed'` se tratează ca `disabled` la locuri/solicitări.

## Birou de evaluare (`/cont` → `/firma`)

- În testare, per cont: Admin → Utilizatori → „Permite birou” / „Retrage birou” (`users.office_allowed`, migrația 0021; `setUserStatus`
  `office_on|off`; filtrele „Cu funcția de birou” și „Au cerut funcția de birou”). `c.office` = super-admin sau `office_allowed`.
- Fără permisiune: în „Contul meu” cardul „În curând · în testare” + „Anunță-mă când se lansează” (`/api/interest`, cheia `birou`).
- Cu permisiune: „Activează funcția de birou” → `OfficeForm` (denumire, bifa membru corporativ + nr. autorizație, descriere, logo ≤ 300 KB,
  micșorat în browser) → `POST /api/account/office` → `saveOffice` (`src/lib/office.ts`): firma pe care o administrează persoana (altfel una
  nouă, cu ea titular) primește detaliile (`orgs.corporate/corp_no/description/logo/office_at`), minimum `OFFICE_SEATS` = 5 locuri, `is_office = 1`
  → `/firma?nou=1`. „Firma mea” nu e în meniu: apare în bara laterală sub cardul de profil, în același bloc (`.meStack`/`.meOffice`,
  cu logo-ul), doar cu `officeActive(c)`. Pagina: `OfficeHeader` (logo `/api/org/logo/<id>`, editare) + `MembersPanel` (invitații pe email,
  inclusiv colaboratori fără legitimație ANEVAR). `OFFICE_READY` nu mai există.

- Membrii unui birou (nu administratorii) nu pot activa funcția de birou: cardul „Membru în X” + „Vreau să ies din birou” (`OfficeLeave`):
  doar evaluatori — legitimația se verifică în Tablou (există, nu e pe alt cont, numele se potrivește) → `office_leaves` (migrația 0022),
  email către administratorii biroului; în „Firma mea” `LeaveRequests`: „Scoate din birou și creează cont individual” (`decideLeave`: membership
  `removed`, firmă individuală nouă cu persoana titular, `anevar_no`/județ/specializări din Tablou, email) sau „Respinge”.
- **Asocieri** (etapa 1 din planul birou ↔ evaluatori; migrația 0029 `office_links`, logica în `src/lib/links.ts`, API `/api/office/links`):
  evaluatori cu **cont propriu** legați de un birou **fără să ocupe locuri**; mai târziu, la pricing, consumă creditele biroului.
  **Tipurile de oameni din birou** (așa apar și în fereastra „Pe cine inviți?”): **Evaluator în birou** = membru, lucrează doar prin birou și nu
  face alte inspecții (ocupă un loc); **Operațional** = fără legitimație, vede și introduce inspecțiile firmei, nu face inspecții (ocupă un loc);
  **Angajat asociat** (`kind = angajat`) = evaluator care face evaluări și pe cont propriu sau cu alte firme, primește inspecțiile biroului
  **automat, fără acceptare**; **Colaborator asociat** (`kind = colaborator`) = primește o **solicitare** pentru fiecare inspecție și o acceptă
  înainte să i se aloce (migrația 0031 `inspections.assign_state`: `pending` la atribuire → acțiunile `accept` (NULL) / `decline` (`declined`,
  `assignee_id` golit, inspecția revine biroului: „Refuzată · alege altcineva” în listă); cât e `pending`, programarea / fișa sunt blocate;
  jurnal + notificare „Solicitare de inspecție”; pe telefon starea „Solicitări” (mov, prima în listă) și în detaliu Refuz / Accept).
  Textele nu mai spun unde apar inspecțiile pe telefon: totul e în Acasă.
  **Vizibilitatea inspecțiilor**: un asociat vede doar inspecțiile primite (și cele create de el); bifa **„Administrator”** la un angajat asociat
  (migrația 0032 `office_links.admin`, acțiunea `admin`; doar `kind = angajat`, se pierde la trecerea în colaborator) îi dă toate inspecțiile
  biroului: `c.linkAdmin` (în `context()`) → `firmOrgs(c)` în `insp.ts` (biroul propriu pentru administrator / operațional + birourile care l-au
  făcut administrator) → lista (fila „Ale firmei”), fișa, editarea, realocarea (`canPrepare`); `team(db, c, orgId)` listează oamenii biroului
  inspecției, nu ai firmei proprii.
- **Acces per utilizator în birou** (migrația 0041 `memberships.modules`, listă de chei separate prin virgulă; NULL = tot planul): în „Firma mea” →
  Utilizatori, pe fiecare **membru** (evaluator în birou sau operațional; nu pe titular / administratori, care au mereu tot planul) butonul
  **„Acces: …”** (`AccessDialog` în `OfficeLinks.tsx`, `ToolsPick`: „Toate instrumentele biroului” / „Doar instrumentele bifate”; Colaborări apare
  doar la evaluatori) → `PATCH /api/org/members {user, modules: string[] | null}` → `setModules` în `orgs.ts` (refuză pe titular / administratori
  și pe propriul cont; audit `member.modules`). Lista posibilă = `orgTools(org)` din `access.ts` (`MEMBER_TOOLS`: modulele planului + Inspecții +
  Colaborări). Fereastra „+ Invită” are același bloc pentru „Evaluator în birou” (fără bifa Administrator) și „Operațional” (`inviteMember` scrie
  `modules` pe membership). Aplicarea: `contextOf()` ia `m.modules` din membership și, pentru `role = member`, păstrează în `c.modules` doar
  cheile din listă (după ce s-au adăugat Colaborări / Inspecții după mod) → meniul, Acasă, Instrumente, paginile și API-urile (toate verifică
  `c.modules`) ascund / refuză restul. Promovarea la administrator golește lista. Caz tipic: asistent fără legitimație doar cu Localizatorul.
- **Operațional → evaluator**: în „Contul meu”, cei fără legitimație au cardul „Datele tale” (nume și telefon editabile — `PATCH /api/account`;
  poza și emailul ca toți) și butonul **„Am devenit evaluator”** (`POST /api/account/legit`); administratorul biroului are „Adaugă legitimația”
  la operaționali în „Firma mea” (`POST /api/org/legit`). Ambele → `claimLegit()` în `office.ts`: legitimația există în Tablou, nu e pe alt cont,
  numele contului are un cuvânt comun cu cel din Tablou → `anevar_no`, nume, județ, specializări din Tablou; persoana devine „Evaluator”.
  Evaluatorii își pot schimba doar telefonul (numele vine din Tablou). Doar evaluatorii
  (`anevar_no`); cei fără legitimație rămân membri cu rol **Operațional** (eticheta din „Firma mea”: Evaluator / Operațional, după `anevar_no`;
  văd și introduc inspecțiile firmei, nu fac inspecții). Stări: `invited` (biroul invită după email sau legitimație) / `requested` (evaluatorul cere
  din „Contul meu” → „Asociază-te cu o firmă”, căutare după nume `searchOffices`, deocamdată doar cu `c.office`) → `active` → `ended` (oricare parte;
  după încheiere vede doar în citire ce a făcut pentru birou — etapa 3); `declined` / `cancelled`. Un singur link deschis per birou și persoană
  (index unic parțial). Emailuri la invitație, cerere, acceptare/aprobare, încheiere. UI: în „Firma mea” un singur panou „Utilizatori” (`OfficePeople`, `#asocieri`; doar super-admini și birouri cu funcția activă —
  `officeActive`; altfel vechiul `MembersPanel`), grupat: Cereri de asociere, Administratori, Evaluatori, Operaționali (membri, ocupă locuri),
  Angajați asociați, Colaboratori asociați, Invitații în așteptare; „+ Invită” deschide fereastra cu tipul (Evaluator în birou / Operațional /
  Angajat asociat / Colaborator asociat), apoi formularul potrivit și `MyLinks` în „Contul meu” (invitații primite, active, cereri, încheiate). `merge.ts` acoperă tabelul.
  Avatarele (`UserAv` în `src/components/UserAv.tsx`: poza contului sau inițialele) apar lângă oameni în „Firma mea”, „Cine o face”,
  coloana „Cine o face” din lista de inspecții și notificări. Membrii existenți NU se transformă în asociați. Grupurile din panou au culori proprii (`.op-admin/eval/ops/angajat/colaborator/inv/req`),
  iar cei invitați care n-au intrat apar doar la „Invitații în așteptare”.
- **Etapa 2 — inspecțiile pe web** (`src/lib/insp.ts`): `isOps(c)` = membru fără legitimație într-un birou (nu e super-admin) → nu face inspecții
  („Eu” ascuns și refuzat la salvare), nu are nevoie de telefon conectat; `firmView(c)` = operaționalii și administratorii biroului văd
  **toate inspecțiile firmei** (`org_id`): pentru administrator firma e chiar contul lui → „Ale mele” le cuprinde și pe ale firmei;
  operaționalul are fila „Ale firmei” (fără „Ale mele” / „Făcute pentru colegi”), acces la fișă / editare / retrimitere /
  link public prin `canPrepare()`. „Cine o face” → „Cineva din birou” = `team(c)`: membrii cu legitimație (în birou; în firmele fără birou toți
  colegii, ca înainte) + asociații activi, grupați Evaluatori / Angajați / Colaboratori (`TeamPick` în `InspForm`), cu disponibilitatea
  (`busy` = inspecțiile lor programate și neterminate, din orice firmă, doar ora): liber / N inspecții în ziua aleasă / „ocupat atunci” la
  suprapunere / următoarea. `assignee_kind` rămâne `office` și pentru asociați (Acasă vs Colaborări pe telefon se decide în etapa 3 după `office_links.kind`).
- **Etapa 3 — telefonul**: `myAssigned` marchează fiecare inspecție cu `place` (`collab` = de la un birou unde persoana e colaborator,
  altfel `home`), `firm` (numele firmei când nu e a persoanei) și `ro` (asocierea cu firma s-a încheiat → doar citire, **și pentru ce a creat
  chiar persoana pentru acea firmă**: cele nefinalizate dispar, cele finalizate rămân; `lockedFor()` blochează pe server acțiunile, editarea,
  fișierele și „Preia din RLV”; pe web insigna „DOAR CITIRE” în locul butoanelor, pe telefon nota din detaliu). **Toate inspecțiile stau în
  Acasă**: filtrul `.mbOwn` Toate / Ale mele / De la firme (doar când există de la firme), lista rămâne grupată pe stări; cardurile de la
  firme au alt fundal (`.byFirm.collab` mov, `.byFirm.staff` verde) și tag-ul firmei în colțul de sus (`.mbFirm`, absolut, fără să schimbe
  mărimea cardului). Migrația 0030 `orgs.staff_create`: bifa „Angajații pot crea inspecții pentru birou de pe telefon” (grupul Angajați din
  „Firma mea”, acțiunea `staff_create`) → `phoneFirms()` în `/api/m/state` (`firms`) → la „Inspecție nouă” pe telefon „Pentru: Contul meu /
  Firma X” (`for_org` la `/api/m/new`, verificat; `saveInspection(..., { orgId })`). Creditele pe birou vin la pricing.
- **Tab-ul Colaborări pe telefon** (`src/components/mobile/MobileCollab.tsx`, același API `/api/colaborari` ca pe web, deci același mod / acces):
  `/api/m/state` dă `collabOn` (modulul în `c.modules`) și `app` (`origin()`, pentru linkurile spre web); fără acces → „În curând”. File:
  **Anunțuri** (feed fără ale mele; „În zonele mele” / „Toate”; cardul se deschide cu descrierea, autorul și „Vreau detalii” + mesaj opțional,
  confirmare în afara zonei; cererea făcută → „Ai cerut detalii” + „Retrage cererea”), **Ale mele** (starea, cei care au cerut detalii: „Deschide
  conversația” / „Mesaje”, „Alege”; Arhivează / Restaurează, Șterge, „Modifică pe web”), **Mesaje** (conversațiile cu necitite; chatul `Chat`:
  `GET ?conv=` la 8 s, `message`, Sună / Email după deschiderea conversației) și **+ Postează** (tip, proprietate, localitate, județ, specializare,
  termen, buget gol = de stabilit, descriere, titlu → `post`, apoi „Ale mele”). Fără profil: cardul „Activează-ți profilul” cu link spre web
  (profilul și zonele rămân pe web). Stiluri `.mc*`.
  Distanța față de telefon: `collabState` dă și `lat`/`lng` ale anunțului (localitatea geocodată); tab-ul cere locația la deschidere și arată
  pe fiecare card „N km de tine” (`.mcDist`, în linie dreaptă; + „km de baza ta” din profil), cu butonul „Cele mai apropiate” (sortare).
- „În curând: Colaborări” (card pe Acasă, meniu) doar pentru evaluatori fără acces cât timp modul ≠ `on`; niciodată pentru nonevaluatori.

## Colaborări (`/colaborari`, modulul `colaborari`)

- Lucrări ocazionale între evaluatori (inspecție / raport + inspecție), după mockup-ul din canvas „UVALO — Colaborări”.
  Tab-ul „Angajare” (anunțuri de la firme) afișează doar „În curând”.
- **Moduri** (Admin → Instrumente → Colaborări, `app_settings` cheia `collab` = `{mode, users}`; grupul de test se alege din lista conturilor active, cu căutare și bife — acțiunea `add_many`): `off` (implicit; doar
  super-adminii), `test` (super-adminii + `users`, indiferent de abonament), `on` (toți cei fără blocaj). Doar evaluatorii
  (cu `anevar_no`) și super-adminii: membrii unui birou fără legitimație nu primesc modulul. Nu e în planuri:
  `context()` adaugă `colaborari` în `c.modules` după mod; `c.collab` = modul.
- **Date de test**: tot ce se scrie cât timp modul ≠ `on` are `test = 1` (tabelele `collab_*`, migrația 0016); butonul
  „Șterge datele de test” (`/api/admin/colaborari`, `purgeTest`) le șterge, cu tot ce depinde de ele. Evenimentele rămân.
- Logica în `src/lib/collab.ts` (+ `collab-shared.ts` pentru browser), API unic `/api/colaborari` (GET = starea paginii,
  `?conv=` = mesajele; POST `{action}`: profile, post, request, withdraw, open_chat, pick, status, message, read),
  pagina `src/components/Colaborari.tsx` (feed, Anunțurile mele, Mesaje cu polling 6 s, Zone de acoperire, profil,
  activare în 3 pași).
- Reguli: anunț nou → notificări în aplicație (și email, vezi mai jos) pentru profilurile cu zona potrivită (`inZone`: județul de bază cu rază
  sau tot județul, plus județele suplimentare; fără coordonate contează tot județul). Coordonatele vin din Google
  Geocoding (`GOOGLE_MAPS_KEY`); fără cheie, distanțele lipsesc. Onorariu implicit „de stabilit”, sumă = „Buget”.
  Telefonul/emailul apar doar după ce autorul deschide conversația. „Alege pentru lucrare” → `inlucru` (iese din feed),
  apoi Arhivează / Restaurează. Specializările vin din `users.specs` (Tablou ANEVAR), nu se editează.
- Profil „doar mă uit” (`available = 0`) + „Vreau detalii” → fereastra `AvailModal`: activează disponibilitatea și cere
  zona, apoi deschide cererea. Meniul arată la „Colaborări” un contor roșu (`relevantCount`, `.navCount`): anunțurile active din
  zonele persoanei, fără ale ei (0 pentru „doar mă uit”).
- „Toate zonele”: anunțurile din afara zonelor au eticheta roșie „În afara zonei” (fără notificări de acolo); „Vreau detalii” pe ele cere
  confirmare (`cbWarnOut`: „Ești sigur…? În zonele tale nu ai selectat acoperire în județul X”), cu opțiunea „Adaugă județul X în zone”.
- Autorul își poate **edita** (`edit` → `editPost`, fereastra `EditPost`) sau **șterge** (`delete` → `deletePost`) anunțul din „Postările mele”.
  Ștergerea e logică (`status = 'deleted'`): iese din feed și din listă, conversațiile rămân cu „Anunț șters de autor” + mesaj de sistem;
  la ambele, cei care au cerut detalii primesc notificare în aplicație. Evenimente `post_edit`, `post_delete`.
- **Email la anunț nou** (pe lângă notificarea din aplicație): `emailNewPost` în `collab.ts` → „Un coleg are nevoie de ajutorul tău”, către
  profilurile din zonă cu `email_notif = 1` (migrația 0020, comutator în „Zone de acoperire”), trimis prin `sendEmails` (Resend batch, 100/apel).
  Butonul = `magicLink()` din `auth.ts`: rând în `auth_codes` cu `ip = 'notify'` (nu intră în limita de 5 coduri/oră), valabil 3 zile, o singură dată,
  `/login/link?token=…&next=/colaborari?post=<id>` (deja autentificat → doar deschide pagina); `?post=` evidențiază anunțul în feed.
- **Acasă** (`src/components/HomeCollab.tsx`): cu profil → secțiunea „Lucrări de la colegi, în zonele tale” sub localizator (`CollabHome`, din
  `collabState`: ultimele 3 anunțuri din zone, anunțul propriu activ/în lucru cu cererile, mesajele, notificările); fără profil → bannerul de
  lansare „NOU ÎN UVALO” deasupra localizatorului (`CollabLaunch`, `collabLaunch()`: anunțurile active din județul persoanei și cel mai nou).
  Imaginea = `CollabArt` (`src/components/CollabArt.tsx`, și în email). „N colegi l-au activat deja” (`activatedCount`, minimum 20) pe banner și în
  pagina de activare. Fără splash de lansare; după activare apare o dată (localStorage) `RecommendSplash`: îndeamnă la „Recomandă unui coleg”
  (`Referral variant="button"`). Meniul: „NOU” până la activare, apoi contorul roșu; pe telefon
  Colaborări intră în meniul de jos. `/colaborari` primește `?view=mine|chat|settings`, `?conv=`, `?compose=1`, `?post=`.
- Admin → Instrumente → Colaborări: „Cine a activat Colaborările” (profilurile) și „Anunțul de lansare”: abonații „Anunță-mă la lansare”
  (`launchSubscribers`) + butonul care trimite o dată emailul „Colaborările sunt aici” (`sendLaunchEmails`, imagine `public/email/colaborari-lansare.png`,
  link de autentificare 7 zile; eveniment `colaborari`/`launch_mail` pe destinatar), doar celor cu acces în modul curent și fără profil.
- Evenimente `colaborari`: `page`, `profile`, `post`, `request`, `open_chat`, `pick`, `post_status` (meta `{test:1}` în test).

## Inspecții (`/inspectii`, modulul `inspectii`) — moduri ca la Colaborări

- Pregătite pe web, făcute pe telefon (aplicația PWA de pe `inspectii.uvalo.ro`, vezi mai jos), văzute pe web. Mockup: canvasul „UVALO — Inspecții” (pagini Web / Mobil).
- Acces după **mod** (Admin → Instrumente → Inspecții, `app_settings` cheia `inspectii_mode` = `{mode, users}`, `src/lib/modmode.ts`:
  `modeSettings` / `setModeSettings` / `modeAllowed`; API `/api/admin/inspectii` cu `mode`, `add_many`, `remove`; panoul = `CollabAdmin` cu
  `endpoint` / `name` / `counts={null}`): `off` = doar super-adminii, `test` = super-adminii + grupul de test (orice cont activ, indiferent de
  abonament și de legitimație), `on` = toți cei cu acces la platformă. `context()` pune `inspectii` în `c.modules` după mod (comutatorul
  „dezactivat” din `off` îl scoate pentru non-super-admini), `c.insp` = modul; meniul arată eticheta TEST cât timp modul ≠ `on`.
- Fără telefon conectat (`insp_devices`) → pagina de activare (`InspActivate`: cod QR spre `<INSP_URL>/?pair=<cod>` + codul de 6 cifre din
  `insp_pair_codes`, 10 min; pagina întreabă `device_status` la 3 s și se deschide singură după conectare). Modulul pornește doar după o
  autentificare din aplicație (telefon sau aplicația instalată; browserul unui calculator nu se numără — `registerDevice`); în test, „Continuă fără telefon (test)” creează un dispozitiv `platform = 'test'`.
- **„Previzualizează aplicația”** (`InspPreview`, pe `/inspectii` și pe pagina de activare): aplicația de telefon reală într-o ramă de telefon
  (iframe spre `inspUrl()`), conectată singură cu un cod de conectare (`pair_code` → `/?pair=`); dacă rama are deja sesiune, codul nu se mai
  folosește (fără sesiuni noi) — doar dacă e același cont: `pair_code` întoarce și `uid`, rama primește `&u=` și, dacă sesiunea ei e a altcuiva
  (alt cont în același browser, de ex. super-adminul), se conectează din nou cu codul. Același site (`*.uvalo.ro`), deci cookie-ul `SameSite=Lax` merge în iframe. Calculatorul nu devine „telefon
  conectat”; `InstallHint` nu apare în ramă. Test local: Chromium cu `--host-resolver-rules=MAP *.uvalo.test 127.0.0.1:8797` și
  `--unsafely-treat-insecure-origin-as-secure`, wrangler cu `INSP_HOSTS=inspectii.uvalo.test`, `INSP_URL=http://inspectii.uvalo.test`.
- Migrația 0023: `inspections` (bunul, contact, programare, fișa ca instantaneu `template` + versiune, `answers`, `room_answers`, `findings`, semnătura,
  `test = 1`), `insp_templates` (fișele firmei `org` — pot fi impuse — și ale persoanei `user`; `draft` + `published` + `version`), `insp_files`
  (poze/acte, fișierele vor sta în R2 — bucket de legat), `insp_log` (istoric), `insp_devices`, `insp_pair_codes`. Fișele UVALO stau în cod
  (`UVALO_TEMPLATES` în `src/lib/insp-shared.ts`, doar citire, se duplică) au **structura fișei VALUEFY** (formularul v2 din CRM,
  `src/lib/insp-forms.ts` în `ValuefyTM/CRM`): Apartament, Casă, Teren, Spațiu comercial / Hală, Accesoriu; aceleași grupuri, întrebări, opțiuni
  și chei (`year_built`, `heating`…), branșamentele = **întrebări compuse** ca în VALUEFY (Branșat → contor montat Da/Nu; Nebranșat → distanța până la rețea); ultimul grup = „Constatări”
  (atunci aplicația și pagina web nu mai arată pasul separat de constatări libere). Încăperile: pardoseală, pereți, plafon, stare (`ROOM_FIELDS`),
  categoriile de poze `photoCategories()`; `isOptional()` = note, detalii, grad de finalizare, distanțele branșamentelor (nu intră în progres).
  `PROP_TYPES` / `CONTACT_ROLES` = listele VALUEFY.
- **Întrebare compusă** (`kind: "comp"`): o alegere cu întrebări de urmat pe răspuns (`sub: {răspuns: SubQ[]}`, tipuri unică / multiplă / text / număr);
  răspunsul la `answers[id]`, urmările la `answers["id.subId"]`; `compSummary()` pe o linie în fișa web. În editor: „+ Întrebare compusă” și, pe fiecare
  răspuns, „+ Întrebare după „X”” (redenumirea răspunsului mută și urmările). Migrația 0024 a șters (logic) copiile personale ale primelor fișe UVALO. Logica: `src/lib/insp.ts`; API unic `POST /api/inspectii {action}`.
- Pagini: `/inspectii` (`InspList`: file **Toate** (implicit) / **Ale mele** (inclusiv cele făcute de colegi sau colaboratori pentru mine — nu mai au filă separată) / Făcute pentru colegi (+ Ale firmei); stările ca tab-uri segmentate `.inTabs` (cu numere)
  și căutarea `.inSearchBox` (adresă, nr. cad., contact, cod; numărul de rezultate) pe același rând, în cardul `.inFilterBar`; vederi Listă / **Listă + hartă** (`.inSplit`:
  carduri în stânga, harta lipicioasă în dreapta; cardul atins aprinde pinul, pinul derulează la card) / Hartă (Leaflet) / Calendar
  săptămânal cu „De programat” trase pe o oră → `schedule`; header închis la culoare (`AppShell dark` → `.top.topDark`, titlu alb, nu gros), în colțul de sus
  clopoțelul `InspBell` (`phoneNotifs`: ce fac alții pe inspecțiile mele, 30 de zile; necitite după `localStorage` `insp-web-notif-seen`) și **Setări**
  (`InspSettings`, meniu: Fișe de inspecție + viitoare setări marcate „În curând”); „Inspecție nouă” stă deasupra tabelului, în `.inBar`), `/inspectii/nou[?id=]` (`InspForm`: CF citit cu `/api/amplasament/plan`, încăperi,
  fișa, contact, programare, cine o face: eu / coleg din birou / Colaborări), `/inspectii/<id>` (fișa ca document: cuprins în stânga, conținut;
  „Descarcă PDF” = print; antetul fișei = logo-ul firmei inspecției (`inspections.org_id`, doar dacă are logo) + nr. autorizație; în test „Simulează inspecția” completează fișa ca telefonul), `/inspectii/fise` (`InspTemplates`: editor de grupuri și
  întrebări, răspunsuri precompletate, publicare pe versiuni).
- **Fișe pe tipuri de imobil**: fișele UVALO se numesc „Template UVALO” (tipul e dat de `prop`), cele personalizate cum le denumește
  utilizatorul (copia unei fișe UVALO: „Fișa mea · <tip>”). În editor (`InspTemplates`) lista e **grupată pe tipul imobilului** (în fiecare:
  biroul, ale mele, UVALO), câmpul „Tipul imobilului” + **„+ Tip nou”** (tip propriu, text liber, salvat în `prop_type`). La inspecție nouă (web
  și telefon) apar doar tipurile care au fișă (`typesOf()` în `insp-shared.ts`), iar după alegere doar fișele acelui tip (+ cele pentru orice
  imobil). Urmează o bibliotecă de fișe.
- **Ștergerea inspecției** (`InspDelete`): coșul din ultima coloană a listei (`.inDelIco`, doar la cele pregătite de mine sau ale firmei —
  `canDel` în `InspList`) și „Șterge inspecția” în bara fișei web (`canPrepare`); confirmare, avertisment mai tare la cele finalizate. Acțiunea
  `delete` = logică (`deleted_at`), cu jurnal „Inspecția a fost ștearsă” (notificare celui care o face); dispare din liste, Acasă, telefon.
- **Realocă inspectorul** (`InspReassign` în bara fișei web, cât timp inspecția nu e finalizată, pentru `canPrepare`): „Eu” (nu pentru operațional) sau
  cineva din birou (`TeamPick` cu disponibilitatea) → acțiunea `reassign`: răspunsurile, pozele și actele rămân; la colaborator → solicitare
  (`assign_state = pending`); jurnal „Realocată lui X” (notificare „Inspecție nouă pentru tine”), iar fostul inspector primește „Inspecție realocată”.
- În listă, inspecțiile începute / programate deschid **fișa** (`/inspectii/<id>`), nu formularul de editare (doar „De programat” → formular);
  în lucru, fișa web arată răspunsurile de pe telefon (salvate la 4 s după fiecare schimbare) și nota „În lucru pe telefon · N din M răspunsuri ·
  actualizat …”.
- **Mentenanța nu blochează asocierile**: „Contul meu” (`page({ maint: true })`) și `/api/office/links` (`api("user", { maint: true })`) merg și în
  mentenanță, iar pagina „Revenim în curând” arată invitația de asociere în așteptare („Vezi invitația →”); linkurile din emailurile de asociere =
  `/login?next=%2Fcont%23asocieri`. Restul platformei (inspecții, telefon) rămâne blocat pentru non-super-admini cât e mentenanța pornită.
- `merge.ts` (unire/ștergere conturi) acoperă tabelele noi. Evenimente `inspectii` (meta `{test:1}`).
- **Fișa = o înregistrare a bunului** (migrația 0033): la primul răspuns trimis de pe telefon (sau la simulare) primește **număr și dată**
  (`numberSheet` în `insp.ts`: `inspections.sheet_no` „FI-2026-0001”, `sheet_at`; numerotare pe an în `insp_sheets`, nereutilizată). Pe telefon,
  în detaliu, cardul „Fișa” are zona Nr. fișă / Data fișei (`.mbSheetNo`; înainte: „se dau când începi completarea”); pe web în antet, eyebrow,
  „Nr. și data fișei”; în fișa publică în antet. **„Șterge fișa”** (`InspSheetDelete` în bara fișei web, `canPrepare`, după ce a fost începută,
  inclusiv finalizată): acțiunea `sheet_delete` golește răspunsurile, încăperile, constatările, semnătura, redo-ul și numărul (opțional și
  fotografiile, `photos: true`), starea revine la Programată / De programat, `sheet_rev + 1`; bunul, contactul, actele, istoricul rămân;
  copia fișei șterse (JSON) + motivul în `insp_sheets.snapshot`. În aceeași fereastră: rămâne la inspectorul de acum / Eu / cineva din birou
  (→ `reassign` cu `again`). Ciorna de pe telefon are `rev`: `progress` / `finish` cu alt `rev` sunt refuzate, iar aplicația aruncă ciorna veche
  la deschidere („Fișa a fost ștearsă de pe web: începi o fișă nouă.”). Fișa nouă primește alt număr.
- **Semnătura evaluatorului** (migrația 0039 `users.signature`, PNG data URL ≤ 160 KB cu fundal transparent): în „Contul meu” cardul
  „Semnătura ta” (`SignatureCard`, `#semnatura`, pentru evaluatori și super-admini): desenată pe canvas (mouse / deget, se decupează doar zona
  desenată) sau încărcată dintr-o poză (`fromImage`: hârtia albă devine transparentă) → `PATCH /api/account/signature {signature | null}`.
  Pe fișa web (`inspRow` dă `assignee_sig` + `assignee_legit`), la „Evaluator”, imaginea apare **doar când fișa e finalizată** (`finished_at`;
  retrimiterea îl golește, deci dispare până la noua finalizare), altfel linia goală + nota că se aplică automat; intră în PDF (print).
  API-ul de integrare: `inspector.signature` (același data URL) **doar la fișa finalizată**, altfel `null`. Fișa publică nu o arată.
  **Pe telefon**: „Contul meu” → cardul „Semnătura mea” (`SigCard` în `src/components/mobile/SigCard.tsx`): desenată cu degetul (`.mbSig`,
  decupată la zona desenată, fundal transparent) → același `PATCH /api/account/signature`; `GET /api/account/signature` dă imaginea la cerere,
  `/api/m/state` dă doar `user.has_sig`. **Semnătura persoanei prezente** (fișierul `kind = signature` urcat de telefon la finalizare, ultimul
  dacă s-a semnat din nou) apare pe fișa web la „Persoana prezentă” când `signed_at` e setat (`sigFile` în pagina fișei).
- **Pagina inspecției pe web** (`/inspectii/<id>`): **fișa ca document apare doar la inspecțiile finalizate** (`gata` / `pred`). Până atunci pagina
  arată **detaliile** (`.inDetails`, carduri): Proprietatea (tip, adresă, cad, CF, localitate, suprafețe din acte, încăperile din releveu, client /
  utilizator, `facts`), Inspecția (stare, programare, cine o face + `assign_state`, pregătită de, fișa, nr. fișei, completarea pe telefon N din M
  răspunsuri + poze la `lucru`, instrucțiunile), Contact, Acte (cu încărcare), Locația de pe telefon sau adresa pe hartă (`InspLocMap`),
  Fotografiile trimise până atunci, Istoric. Bara de acțiuni (realocare, link public, ștergere fișă / inspecție, simulare) rămâne aceeași.
- **Locația inspecției (GPS de pe telefon)** (migrația 0040 `inspections.gps_lat/gps_lng/gps_acc/gps_at/gps_src`, separată de `lat/lng` =
  adresa geocodată la pregătire): la deschiderea fișei pe telefon (`Form`) se ia o poziție GPS (`gpsFix` în `src/components/mobile/LocPick.tsx`,
  `enableHighAccuracy`, 15 s) în ciorna `draft.loc` (`{lat, lng, acc, at, src: gps|manual}`); pe ultimul ecran, înainte de semnătură (`Sign`),
  cardul „Locația inspecției” (`LocPick`): hartă Leaflet cu pinul auriu tras pe imobil (→ `src = manual`), cercul de precizie, punctul albastru =
  telefonul acum, „Folosește / Ia din nou GPS-ul”, „Pune pinul pe adresă”, distanța față de adresa din pregătire. `loc` pleacă cu `progress` și
  `finish` → `gpsOf()` în `insp.ts` (doar puncte din România, 6 zecimale) → coloanele `gps_*`; „Simulează” pune un punct lângă adresă;
  „Șterge fișa” le golește (copie în `insp_sheets.snapshot.gps`). Fișa web: secțiunea „Locația inspecției” înainte de Semnături
  (`InspLocMap` în `src/components/InspLocMap.tsx`, hartă mică neinteractivă `.inLocMap` cu pinul `.inLocPin`, cercul de precizie și punctul
  adresei; `.inLocFacts`: coordonate, sursă ± precizie, ora, distanța față de adresă, linkuri Google Maps / Analiză amplasament; intră în PDF).
  API-ul de integrare: `location: {lat, lng, accuracy_m, at, source}` sau `null`. Fișa publică nu o arată.
- **Poza de profil a fișei** (migrația 0027 `inspections.cover_file_id`): `coverPhoto()` în `insp-shared.ts` = cea aleasă, altfel prima de la
  exterior, altfel prima; sus în rezumatul fișei web (`.inCover`); se alege din Fotografii cu „Alege ca profil” (`InspCoverPick`, acțiunea `cover`).
- **Link public** (`InspShare` în bara fișei, doar cine a pregătit-o / super-admin; acțiunea `share` `{on}` → `share_token` aleator, `share_at`;
  `on: false` îl șterge și linkul moare): pagina publică `/fisa/<token>` (`src/app/fisa/[token]/page.tsx`, fără cont, `noindex`, OG cu poza de profil;
  **doar brandingul firmei de evaluare** — logo, nume, autorizație în bara de sus, subsol, titlu, iconița filei; fără logo / nume UVALO, nici în OG/Twitter):
  poza de profil mare, firma (logo), datele bunului, răspunsurile (fără întrebările despre persoane — `PRIVATE_Q`), încăperile cu finisaje,
  constatările, fotografiile pe categorii. Fără contact, telefon, acte, semnătură, istoric. Compactă (stiluri `.fs*`, 13 px), bara de secțiuni
  lipicioasă (`.fsNav`), încăperile ca tabel, galeria pe tot ecranul (`FsGallery` în `src/components/FsGallery.tsx`: săgeți, taste, swipe),
  „Vezi pe hartă” (Google Maps) și „Descarcă PDF” (print, cu stiluri de tipar). Pozele și logo-ul prin `/api/fisa/<token>/<fileId|logo>`
  (doar `kind = photo` ale inspecției). `sharedInspection()` în `insp.ts`. Confidențialitatea (secțiunea 6) pomenește linkul.
- Fișiere: bucket R2 privat **`uvalo-inspectii`**, binding `FILES` în `wrangler.jsonc` (`getFiles()` în `db.ts`). Încărcare `POST /api/inspectii/files`
  (multipart: id, kind cf|releveu|doc|photo|signature, file; ≤ 15 MB; cheie `insp/<inspecție>/<id>.<ext>`), servire `GET /api/inspectii/file/<id>`
  (doar proprietarul, cel care face inspecția, super-adminii), `DELETE` la fel. Formularul urcă CF-ul citit și releveul după salvare; fișa are
  „Adaugă extras CF / releveu / alt document” și, în test, „Adaugă fotografii (test)”. Confidențialitatea (secțiunea 6) spune că doar actele
  atașate la o inspecție se păstrează.

### Aplicația de telefon (PWA, `inspectii.uvalo.ro`)

- Numele propus la instalare = **„UVALO”** (manifest `name` / `short_name`, `appleWebApp.title` și titlul paginii `/m`).
- `worker.ts`: pe `INSP_HOSTS` (implicit `inspectii.uvalo.ro`) `/` → pagina `/m` (cu query), `/sw.js` → `/api/m/sw`, `/manifest.webmanifest` →
  `/api/m/manifest`; trec `/api/`, `/_next/`, iconițele și logo-urile; orice altă cale → 302 la `/`. Linkul din web: `inspUrl()` (var `INSP_URL`).
  Domeniul trebuie adăugat ca custom domain pe workerul `tools`. Cookie-ul `vf_tools` e host-only: telefonul are sesiunea lui.
- `src/app/m/page.tsx` → `src/components/mobile/MobileApp.tsx` (UI după canvasul aplicației mobile, clase `.mb*` în `globals.css`): autentificare cu
  codul din email (ca platforma: `/api/auth/request|verify`) sau cu codul / QR-ul de pe web (`POST /api/m/pair` → `usePairCode` + `createSession`);
  `POST /api/m/device` înregistrează telefonul; `GET /api/m/state` = utilizatorul + inspecțiile atribuite lui (`myAssigned`); `GET /api/m/insp/<id>`.
- Ecrane: Acasă (următoarea, statistici, filtre), detaliu (navigație, contact, acte), fișa pe secțiuni + Constatări, Încăperi, Fotografii pe
  încăperi, Semnătură → finalizare; meniu jos Acasă / De trimis / Contul meu. Butonul Înapoi al telefonului e prins înaintea routerului Next
  (`popstate` în captură, starea `mbv`), altfel pagina se reîncarcă. Înapoi din fișă = `history.back()` (nu împinge o intrare nouă — altfel bucla
  fișă ↔ detaliu), „‹” din detaliu = Acasă (înlocuiește intrarea), iar după „Inspecție nouă” intrarea ecranului nou e înlocuită cu Acasă. În fișă, chip-ul secțiunii curente se derulează singur în vedere (`secsRef`).
- Offline: ciorna în `localStorage` `insp-draft-<id>` (trimisă ca `progress` la 4 s), pozele (micșorate 2000 px) și finalizările în IndexedDB
  `uvalo-insp` (`store.ts`, `flush()` la revenirea rețelei și la 30 s).
- **Pornire rapidă** (măsurat cu latență 300 ms: prima deschidere ~2,2 s, următoarele ~0,1 s): service worker-ul (`uvalo-insp-v5`; versiunea crește ca să se golească memoria veche după schimbări vizibile) servește
  pagina din memorie (stale-while-revalidate) și o reîmprospătează în fundal împreună cu scripturile ei (le adaugă în cache înainte de a
  înlocui pagina, ca după un deploy să nu lipsească nimic); `/_next/static/` = cache-first. Răspunsul `/api/m/state` se păstrează în
  `localStorage` `insp-state` → aplicația apare imediat, apoi se actualizează (golit la 401, fără acces, „Ieși din cont”). Detaliul unei
  inspecții se arată din `insp-<id>` și se reîmprospătează după; la 2,5 s după pornire se descarcă în fundal detaliile primelor 15 inspecții
  active. `/api/m/device` se cheamă după listă, nu în paralel.
- Instalare după dispozitiv (`InstallHint.tsx`): iPhone Safari → Partajează → „Adaugă pe ecranul principal” (balon cu săgeată spre bara Safari);
  iPhone în alt browser → „Deschide în Safari” (`x-safari-https://…`, nu merge peste tot) + „Copiază linkul”; Android → `beforeinstallprompt`
  sau meniul ⋮; Android în aplicații (Instagram, WhatsApp…) → `intent://…package=com.android.chrome`; calculator → QR. Ascuns 3 zile la ×.
- **Acasă pe telefon**: în hero, cardurile de perioadă Toate / Azi / Săpt. asta / De programat (`scope`; „Toate” selectat la fiecare deschidere
  a aplicației, starea ține cât e deschisă); lista derulantă filtrează doar starea telefonului (`mstat`: Completări = retrimisă cu `redo_note`,
  În lucru = începută, De făcut = programată, De programat, Finalizate), iar cu „Toate stările” lista e grupată pe stări (`MSTAT_ORDER`),
  comutatorul Listă / Hartă / Calendar (`localStorage` `insp-view`) și „+”. Harta: Leaflet de pe cdnjs + OSM, pini numerotați pe culoarea stării,
  punctul albastru = telefonul, atingerea unui pin dă cardul inspecției (fără listă sub hartă; `.mbMapBox` cu `isolation: isolate`,
  altfel straturile Leaflet trec peste meniul de jos). Calendarul: săptămâna (‹ ›, Azi), punctele = inspecții pe zi, agenda
  zilei alese și „De programat” cu buton.
- **Tragere în jos = reîncărcare** (Acasă, De trimis, Contul meu, detaliul inspecției): evenimente touch pe `window` când pagina e sus
  (nu pe hartă, semnătură, foaia de programare, câmpuri), prag 64 px → `refresh()` = trimite coada, `load()`, reîncarcă inspecția deschisă;
  tot ecranul (`.mbPage`) coboară cu degetul, iar în spațiul de sus apare indicatorul `.mbPull`. `overscroll-behavior-y: none` ca să nu se suprapună cu reîncărcarea browserului.
- **Fotografii** pe telefon: „Fotografiază” (camera, o poză) și „Din galerie” (alegere multiplă din telefon); pozele merg la categoria aleasă
  (lista „Pozele noi merg la” sau atingerea titlului unei categorii, marcată cu auriu; în fiecare categorie căsuța cameră / galerie). Din galerie, ora și
  locul se iau din EXIF (`readExif` în `store.ts`: DateTimeOriginal + GPS), altfel data fișierului și fără loc; `addPhotos` le pune în coadă și trimite o dată.
  Butoanele cameră / galerie = două iconițe mici lângă titlul categoriei (`.mbPhHead`). Fiecare grup e selectabil (atingere oriunde pe el,
  bulina `.mbPhRadio`) → acolo merg pozele noi; o categorie fără poze se alege din lista de jos, apare ca grup gol selectat și se derulează în vedere.
  „Am terminat” (`.mbDone`, în bara de sus) închide ecranul pozelor.
- **Bara de jos** (`.mbFoot`) e `position: fixed` (pe iPhone `sticky` rămânea în mijlocul ecranului): înălțimea ei e măsurată (ResizeObserver în
  `MobileApp`) în `--foot-h`, iar `.mbBody:has(~ .mbFoot)` lasă loc dedesubt. În fișă, bara are **„←”** (secțiunea anterioară; din prima → detaliu)
  și **„Secțiunea următoare”**, dezactivată cât timp în secțiunea curentă sunt întrebări obligatorii necompletate („Mai ai N întrebări
  obligatorii”; obligatorii = cele care nu sunt `isOptional`).
- **Finisajele pe încăperi sunt o opțiune a fișei** (`Template.rooms`, implicit oprită, și la fișele UVALO; bifa „Finisaje pe încăperi” în editorul
  de fișe `InspTemplates`): oprită → pe telefon dispar cardul „Finisaje încăperi” (și ecranul încăperilor cu „Preia din RLV”) și condiția la
  finalizare; în fișa web și în cea publică tabelul încăperilor are doar numele și suprafața (finisajele apar dacă opțiunea e pornită sau au fost
  completate înainte). Ce urmează despre finisaje se aplică doar cu opțiunea pornită.
- **Cardurile obligatorii din fișă** (`Tiles`, `.mbTile`, verzi cu ✓ când sunt gata): „Finisaje încăperi” (N din M; o încăpere e gata când are
  pardoseală, pereți, plafon și stare — `roomDone` în `insp-shared.ts`), „Fotografii” (N încărcate), „Semnătură” (semnată). „Finalizează și trimite”
  cere toate trei. Semnătura se păstrează în ciornă (`draft.sig` dataURL + `draft.signer`) cât se mai completează fișa; „Șterge” o scoate.
  Fără încăperi din releveu (și nu e teren) → încăperile standard `STANDARD_ROOMS` (Bucătărie, Băi (spații umede), Dormitoare, Living, Alte
  dependințe; `std: true`, la poze cu numele lor). **„Preia din RLV”** sus pe ecranul încăperilor: releveul atașat sau fotografiat / ales pe telefon
  → `POST /api/inspectii/rlv` (multipart `id` + `fileId` sau `file`; Claude cu structured output → `{rooms: [{n, a}]}`; fișierul nou se atașează ca
  `releveu`; limita = `aiLimitError(..., "plan")`, eveniment `inspectii`/`ai_rlv`) → încăperile de acum se șterg și se creează cele din releveu. Mutare între categorii: ține apăsat ~0,35 s pe o poză și
  trage-o peste altă categorie (cât tragi apar toate categoriile) → `movePhoto`: în coadă se schimbă `room`, cele trimise prin
  `PATCH /api/inspectii/file/<id>` `{room}` (`moveFile` în `insp.ts`); categoria în care a căzut devine cea selectată.
  Fișierele alese se citesc imediat în copii proprii (pe iPhone, după ce câmpul se schimbă, ele pot deveni ilizibile), câmpul se golește după.
  Bara de progres `.mbUp` sus („Se pregătesc / Se trimit fotografiile · N din M”) din evenimentul `insp-upload` (`progress()` în `store.ts`);
  „×” pe fiecare poză (`deletePhoto`): cea de pe telefon iese din coadă, cea trimisă se șterge de pe server (`DELETE /api/inspectii/file/<id>`).
  `flush()` rulează o singură dată simultan (altfel o poză s-ar trimite de două ori), ce se adaugă între timp intră în rularea următoare.
- **Actele în timpul fișei** (`src/components/mobile/DocViewer.tsx`, în `Form` și `Rooms`): buton rotund mic, flotant deasupra barei de jos
  (`.mbDocFab`, cu numărul actelor; apare doar dacă inspecția are CF / releveu / documente), deschide actele **peste fișă** (`.mbDocView`, fără să
  schimbe ecranul, fișa rămâne unde era): chip-uri pentru alegerea actului, zoom − / + (100–300%) sau atingere dublă, „×” sau același buton (acum
  auriu, „Înapoi la fișă”) închide. Imaginile ca atare; PDF-urile desenate pagină cu pagină cu pdf.js-ul add-in-ului Word (`/word/lib/pdfjs/`,
  importat ca modul cu URL absolut; `worker.ts` îl lasă să treacă pe `INSP_HOSTS`). Fiecare fișier e descărcat o dată (tipul din răspuns, nu din
  nume) și ținut în memorie cât e deschisă fișa; fără rețea → mesaj. „Deschide separat” = fișierul într-o filă nouă.
- **Detaliul inspecției** pe telefon (`Detail`): hartă mică (`MiniMap`, Leaflet fără interacțiune; **atingerea o mărește** la 70svh (`.mbMini.big`),
  mobilă și cu zoom, cu „Centrează”, bara de prindere `.mbMiniGrip` jos (liniuța; harta urmează degetul, tragere în sus > 60 px sau atingere
  = restrânge) și comutatorul **Hartă / Satelit** (`.mbMiniBase`, Esri World Imagery + străzi și localități,
  alegerea în `localStorage` `insp-base`); harta mărită nu declanșează tragerea-în-jos; **„Vezi în localizator”** (pastila portocalie pe hartă,
  `.mbMiniBtn.loc`) doar când numărul cadastral e găsit în planul localizatorului (`GET /api/m/inplan?nr=&uat=&lat=&lng=` → `{found: {key, nr}}`:
  UAT-ul după nume, apoi planurile care cuprind poziția; ținut în memorie per inspecție) → tab-ul Localizator pe parcelă (prima deschidere
  `#key-nr` în adresa cadrului, altfel `postMessage({uvLoc: "show"})` → `loadUat` + `show`, fără ca GPS-ul să mai mute harta) și pastila
  **„‹ Înapoi la fișă”** sus (`.mbLocBack`, `locFrom`; dispare la ieșirea din tab); navigația = butoanele Google Maps / Waze), statut + tip,
  Google Maps / Waze, programarea, contactul (Sună / SMS), „Proprietatea” (doar câmpurile completate: tip, cad., CF, UAT, județ, suprafețe din
  acte, încăperi, cine a pregătit / cine face), încăperile din releveu, actele încărcate (doar dacă există), fotografiile trimise, notele, fișa.
- **Notificări** (clopoțelul de lângă avatar, pe Acasă; avatarul → Contul meu): „De făcut” = inspecțiile mele de azi și mâine neîncepute
  (calculate în aplicație) + „Activitate” = `phoneNotifs` (`insp_log` pe inspecțiile atribuite mie sau ale mele, făcute de alții, 30 de zile,
  în `/api/m/state` ca `notifs`). Necitite = după `localStorage` `insp-notif-seen` (`{at, keys}`), marcate la ieșirea din ecran.
- **Retrimite pe telefon** (fișa web a unei inspecții finalizate / predate, doar cine a pregătit-o sau super-admin): nota „ce trebuie completat”
  → acțiunea `reopen`: stare `lucru`, `finished_at` / `signed_at` golite, `redo_note` + `redo_at` (migrația 0026); răspunsurile, pozele și actele rămân;
  jurnalul „Retrimisă pe telefon pentru completare: …” trimite notificare celui care o face. Pe telefon cardul „De completat” (detaliu și fișă);
  la noua finalizare (semnătură din nou) nota se golește, jurnal „Completată și semnată din nou”. Pe web, nota apare sus, iar răspunsurile se văd și în lucru.
  La retrimitere, pe web se alege „Semnătura salvată rămâne” (implicit, dacă există) sau „Se semnează din nou” (`keep_sig`; migrația 0028:
  `redo_keep_sig`, `redo_prev_at` = data la care fusese completată). Pe telefon, detaliul arată „Întoarsă pentru completări”: completată pe
  data / ora, motivul, semnătura; butonul devine „Modifică fișa” (și pe cardul de sus). Cu semnătura păstrată (`keptSig`), cardul „Semnătură”
  e verde „păstrată”, ecranul de semnare arată semnătura salvată (cu „Ia totuși o semnătură nouă”) și „Finalizează” merge fără semnătură nouă;
  serverul păstrează `signed_at` / `signed_name` (`new_sig: false`), jurnal „Completată pe telefon (semnătura lui X păstrată)”.
- **Cardul de sus pe Acasă (telefon)**: următoarea inspecție programată neîncepută (`plan`, cât timp nu i-a trecut intervalul; „ACUM” în interval);
  fără ea, cea mai urgentă cu completări (retrimisă, cea mai veche întâi; eticheta roșie „DE COMPLETAT”, motivul sub adresă), apoi una în lucru.
  Altă zi decât azi → în căsuță ziua și luna. În listă și în agenda calendarului, ora inspecțiilor finalizate e verde (`.mbDay.done`, `.mbSlotT.done`).
  **Data inspecției = momentul finalizării** (`whenOf()`): la cele finalizate `finished_at`, la cele întoarse pentru completări `redo_prev_at`,
  altfel programarea; folosită în listă („Făcută …”), în cardurile Azi / Săpt. asta și în calendar. Detaliul arată „Data inspecției” în
  Proprietatea și „Inspecție făcută pe … la …”; încăperile NU mai apar în detaliu (doar în fișă).
  La o inspecție întoarsă și trimisă din nou, `finished_at` rămâne **data primei finalizări** (`redo_prev_at`).
- **Navigarea pe telefon**: meniul de jos (`.mbNav`, bară închisă plutitoare, rotunjită, cu blur) = **Inspecții** (ecranul de start, intern `home`) /
  **Localizator** în mijloc (doar semnul de locație, cerc portocaliu ridicat, `.mbNavLoc`) / **Colaborări**. **Contul meu nu mai e în meniu**: se
  deschide din avatarul de sus (Acasă și antetul Colaborărilor, `.mbHeadMe`), ca ecran cu „‹ Înapoi”. Acasă arată doar inspecțiile nefinalizate (filtrul: „Toate” +
  Completări / În lucru / De făcut / De programat, fără Finalizate); finalizatele (ultimele 90 de zile, `myAssigned`) sunt în Contul meu,
  „Inspecții finalizate”. „De trimis” nu mai e în meniu: iconița cu săgeată și numărul apare lângă clopoțel doar când există fișe / poze
  netrimise (`.mbQueueBtn` → ecranul coadă). Tab-ul Colaborări (`Collab`) arată deocamdată „În curând”; `phoneCollab()`
  în `insp.ts` („Fac pentru alții” = eu o fac, a pregătit-o altcineva; „Alții pentru mine” = am pregătit-o eu, o face altcineva), în
  `/api/m/state` ca `collab`. Detaliul nu are „Începe fișa” când inspecția nu e a mea de făcut.
  Cardurile obligatorii din fișă (`.mbTile`) sunt compacte: iconiță mică în stânga, titlul și starea pe două rânduri. Și cardul de sus
  (`.mbNext`) e compact: căsuța 44 px (ora; în altă zi „16 oct” deasupra orei), adresa pe max. 2 rânduri, nota pe un rând, butoane de 34 px.
  Fără nimic de arătat: doar „Nicio inspecție programată”, centrat, estompat, fără buton (inspecția nouă se adaugă din „+”).
- **Notificări push** (Web Push; pe iPhone doar cu aplicația instalată, iOS 16.4+): `src/lib/webpush.ts` = cheile VAPID făcute la prima folosire
  și ținute în `app_settings` „vapid”, criptare aes128gcm (RFC 8291) + semnătură ES256, totul cu WebCrypto (fără bibliotecă). Abonările în
  `insp_push` (migrația 0025; 404/410 de la serviciul de push → abonare ștearsă), `/api/m/push` (GET cheia, POST `{sub}` / `{action: test}`, DELETE).
  **Forma notificării** (`notifyLog`): titlul = felul evenimentului („Inspecție nouă alocată”, „Solicitare de inspecție”, „Inspecție realocată”,
  „Inspecție întoarsă în lucru”, „Fișă de inspecție ștearsă”, „Inspecție ștearsă”, „Inspecție programată”, „Solicitare acceptată / refuzată”,
  „Inspecție începută / finalizată / predată”, „Document adăugat”, altfel „Inspecție actualizată”); corpul = tipul bunului · adresa, apoi mesajul
  pentru evaluator când există (`notes` / instrucțiunile la alocare, nota „ce trebuie completat”, motivul ștergerii / refuzului, data programării,
  de la cine). Memento-urile din cron au și ele tipul bunului.
  Se trimit: (1) din `logIt()` în `insp.ts`, ce face cineva pe o inspecție ajunge la ceilalți implicați (cine a pregătit-o / cine o face; o acțiune
  făcută de pe web — alt host decât `INSP_HOSTS` — ajunge și la telefonul propriu dacă ești cel care face inspecția, ex. retrimiterea; nu pozele, nu
  simulările; „Inspecție nouă pentru tine” la atribuire); (2) din program: `wrangler.jsonc` „triggers” la 15 minute → `worker.ts` `scheduled` →
  `/api/m/cron` cu cheia din `app_settings` „cron_key” (făcută la prima rulare): cu o oră înainte de fiecare inspecție programată și la 7:00 (ora
  României) „Azi ai N inspecții”; o singură dată fiecare (`insp_push_sent`). Service worker-ul arată notificarea și, la atingere, deschide
  `/?open=<id>` (aplicația deschide detaliul). Cardul „Notificări pe telefon” (`PushCard`) în Notificări și în Contul meu: pornește / test / oprește.
- **Programare de pe telefon**: foaia `ScheduleSheet` (Azi / Mâine / Poimâine, zi, oră, durată 30 min–2 h) din calendar și din detaliul
  inspecției (cardul „Programare”, doar la stările prog / plan) → `POST /api/inspectii {action: schedule, scheduled_at, duration_min}`.
- **Inspecție nouă de pe telefon** (`+ Inspecție nouă` pe Acasă → ecranul `NewInsp`): „Sunt la proprietate” = GPS + adresa din
  `GET /api/m/where` (`reverseGeocode` în `gmaps.ts`, fără cheie Google rămân coordonatele), tipul bunului (alege fișa potrivită), nr. cad., CF,
  contact, „Acum, sunt acolo” (programată la ora curentă, deschide fișa), „O programez acum” (zi și oră) sau **„Programez ulterior”** (fără dată →
  starea „De programat”). Tipul bunului e obligatoriu și vine primul (doar tipurile cu fișă, `typesOf`); fișele apar abia după alegerea tipului,
  ca listă de carduri (`.mbTplPick`): ale tipului + cele pentru orice imobil, prima preselectată. `POST /api/m/new` → `saveInspection` cu `assignee_kind = me`,
  istoricul „Creată pe telefon”, eveniment `phone_new`. Cere rețea.
- **Localizatorul în aplicație** (tab-ul din mijloc, `LocTab` în `MobileApp.tsx`; `/api/m/state` dă `locOn` = modulul `localizare`, altfel
  „Nu este în planul contului tău”): un iframe pe **aceeași pagină ca pe web**, `/localizare?app=1&t=<safe-area sus>&b=<spațiul meniului>`
  (`worker.ts` lasă `/localizare` pe `INSP_HOSTS`; sesiunea e a telefonului), montat la prima deschidere și doar ascuns la schimbarea tab-ului
  (harta își păstrează locul). Ruta (`src/app/localizare/route.ts`, `inApp`) pune `APP_HEAD` + `appScript(origin())` din `src/lib/locator-app.ts` în
  locul PWA-ului propriu, `presence.js` și `feedback.js`; 401 / mentenanță → mesaj în cadru, fără redirecționare. Modul aplicație: harta pe tot
  ecranul (sub meniul plutitor), **lupa plutitoare** în dreapta jos (`.uvFind`, deasupra fișei când e pe jumătate, ascunsă cu fișa pe tot
  ecranul) care deschide formularul localizatorului (`#f`: nr. cadastral / topo cu UAT, adresă / coordonate / Stereo 70) ca panou **de sus**
  (`body.uvSearch`; jos l-ar acoperi tastatura), butoanele hărții și **Straturi** sus; bara GPS jos lasă loc lupei, iar pastila „Vezi fișa ↑”
  urcă deasupra ei (`--gpsh`); **fișa parcelei** (`#out` + nota + descărcările, mutate în `.uvSheet`) urcă de jos când `#out` primește un rezultat
  (MutationObserver): jumătate de ecran (`uvPeek`), tot ecranul (`uvFull`) sau închisă, trasă de liniuța `.uvGrip` (atingerea comută); închisă cu
  rezultat → pastila „Vezi fișa ↑” (`.uvOpen`); **cât e fișa deschisă, meniul aplicației se ascunde** (iframe → `postMessage({uvLoc: "sheet", state})`
  → `locSheet` în `MobileApp`; în cadru `--uvb` trece de la `b` la `s` = doar zona de jos a telefonului); iframe-ul are `width/height: 1px` +
  `min-*: 100%` (iPhone mărește altfel cadrul după conținut și harta / fișa ies din ecran), iar nimic din fișă nu e mai lat decât ecranul; la deschidere parcela se reîncadrează în zona liberă (`fitFree`, stratul `sel`). **La deschidere pornește singur „Locația mea”** (`gpsStart()` fără busolă — pe iPhone ea cere o atingere,
  butonul de pe hartă o pornește): punctul GPS cu cercul de precizie, planul localității încărcat, harta pe loc, parcelele din rază evidențiate și
  lista lor în fișă (parcela pe care stai prima), bara GPS „Ești pe parcela …”; nu și cu un link spre o parcelă (`#uat-nr`). Căutarea oprește
  urmărirea GPS (`gpsFollow = false`), ca harta să nu fie trasă înapoi la tine. **Fără analiza amplasamentului în aplicație** (`.ampBtn`, `#npAmp` ascunse). Alte linkuri spre
  restul platformei se deschid pe `APP_URL`, în browser. Eveniment `localizare`/`page` cu `{app:1}`. Service
  worker-ul aplicației (`uvalo-insp-v6`) servește din memorie doar navigarea spre `/`, nu și pe cea din iframe. Cheia Google Maps trebuie să
  accepte și referrer-ul `inspectii.uvalo.ro/*` pentru hărțile Google din localizator.
- **Radar colegi** (prima fază: **doar super-adminii**, `user.super` din `/api/m/state`; design în canvasul „Radar colegi UVALO”): pornește **din
  detaliul unei inspecții a mele neefectuate** (`Detail`: cardul compact `RadarBanner` — un buton întreg, înalt cât mini-radarul de 40 px, „Scanează după colegi · TEST” + „›”, doar dacă eu o fac,
  nu e finalizată / solicitare în așteptare și are coordonate; **nu mai e pe Acasă și nu folosește GPS-ul telefonului**) → ecranul `Radar`
  (`src/components/mobile/Radar.tsx`, view `{v: radar, id}`, ecran întreg închis, stiluri `.mbRd*`; `.mbRadar` e `position: fixed` peste tot ecranul
  cu derulare doar verticală — pe iPhone `100svh` lăsa jos fundalul deschis — iar fasciculul rotit stă în cercul `.rot` cu `overflow: hidden`, altfel pătratul
  lui rotit lățea pagina și se putea trage lateral): **centrul = inspecția mea** (punctul albastru
  cu eticheta „Tu · 15:00”), **ziua = ziua ei** (chip fix „Azi, 15:00”; neprogramată → Azi / Mâine), chip-uri 5 / 10 / 25 km, discul cu inelele
  etichetate (km/3, 2km/3, km), fasciculul auriu la 3 s (`rdSweep`), punctele colegilor (`.blip`, azimut + distanță față de inspecția mea, scalate
  la rază; se aprind cu `rdBlip` când trece fasciculul — întârzierea = azimut/360 × 3 s), rezumatul și foaia de jos cu cardurile (nume, tip ·
  zonă · oră, „N km de inspecția ta de la HH:MM”). Atingerea unui punct / card → ecranul colegului: „Inspecția lui” / „Inspecția ta” (adresa mea,
  distanța), mesaj propus (numele cu `given()`: primul prenume + numele de familie, din numele scris ca în Tablou — „Stan Claudiu Bogdan” → „Claudiu Stan”, majusculele → „Claudiu”; programată: „am și eu o inspecție azi la …, la N km de a ta”; neprogramată: „o pot face pe a mea tot atunci”), Sună
  (`tel:`), Trimite SMS (`sms:?body=`) sau email, WhatsApp (`wa.me`). Fără colegi: „Caută în 10 / 25 km”. Rescanează la fiecare schimbare și la
  60 s. `GET /api/m/radar?insp=<id>&km=&day=` (403 pentru non-super-admini; 404 dacă inspecția nu e a mea de făcut sau e finalizată; fără
  coordonate → eroare): centrul și ziua din inspecție (`day` doar pentru cea neprogramată), inspecțiile `plan` / `lucru` ale **altor** utilizatori
  activi din acea zi (`scheduled_at LIKE 'YYYY-MM-DD%'`), în caseta apoi în raza cerută (`found`: nume, telefon, email, legitimație, birou,
  `prop_type`, `zone` = `uat` sau localitatea din adresă — **nu adresa**, `lat`/`lng` rotunjite la 3 zecimale ≈ 100 m, `dist_m` față de inspecția
  mea) + `anchor` (inspecția mea). Eveniment `inspectii`/`radar` (țintă = inspecția) `{km, day, n}`. Urmează: deschiderea pentru toți (cu opțiunea
  „apar pe radar”), notificare când apare un coleg, mesaj prin Colaborări în loc de SMS.
- **Contul meu** pe telefon: poza contului (`/api/avatar/<id>`), legitimația, județul, biroul (cu logo, `user.org` din `/api/m/state`);
  activitatea (`phoneInfo`: luna asta, total, timp mediu, fotografii, ultima trimisă); telefonul acesta (instalată sau în browser, conectat din,
  permisiuni cameră / locație cu buton, spațiul folosit, „Golește memoria aplicației” = cache-ul detaliilor și al SW, nu ciornele și coada);
  sincronizarea (`localStorage` `insp-sync` = ultima trimitere completă, de trimis, rețea); „Ieși din cont” și „Deconectează telefonul”
  (`DELETE /api/m/device` → `disconnectPhone`: scos din lista de pe web + sesiunea închisă, datele locale șterse).

## Instrumente în admin (`/admin/instrumente`)

- **Localizări efectuate** (evenimentul `locate`, „Localizare efectuată”, în `track-js`): un imobil găsit efectiv — după nr. cadastral (`show()`
  dintr-o căutare, nu click pe hartă, și numărul există în plan), topo, adresă / coordonate (`goToPoint`) sau Stereo 70 (`stereo_locate`);
  meta `{uat, how: nr|topo|adresa|stereo, src: acasa|localizator}` — `src = acasa` pentru căutarea pornită din bara de pe Acasă (`?q=` / `?adr=`,
  prima, automată, până la prima atingere a paginii). `toolUsage()` din `tools.ts` întoarce `locates {n, u, home}` → pe `/admin/instrumente` cardul
  Localizatorului și pe pagina lui KPI-ul principal „Localizări · 30 zile” (`.kpiMain`: din bara de pe Acasă / din localizator / persoane).
- Listă cu fiecare instrument (localizare, amplasament, comparabile, word, chrome, colaborari — acesta cu moduri, nu on/off) + pagină `/admin/instrumente/<cheie>`: comutator
  activ/dezactivat, statistici pe 30 de zile (evenimentele din `events` cu `module = <cheie>`), activitate recentă.
- Setările: `app_settings` cheia `tools` = `{off: [...], limits: {ai_text, ai_plan, total_text_day, total_plan_day,
  total_text_month, total_plan_month}}` (per utilizator / 24 h; plafoane pe platformă pe zi și lună calendaristică, 0 = fără);
  excepții pe utilizator în `limits:users` = `{<userId>: {ai_text?, ai_plan?}}`; verificarea în `aiLimitError()`; prompturile analizei de
  amplasament în `prompts:amplasament` (doar cele schimbate; implicitele în `src/lib/tools.ts` → `PROMPT_DEFAULTS`).
- Un instrument dezactivat e scos din `c.modules` pentru toți, mai puțin super-adminii (`context()` în `access.ts`);
  pagina lui afișează „dezactivat temporar”, iar din meniu și de pe Acasă dispare.
- Planurile cadastrale sunt acum pe pagina Localizatorului cadastral (`/admin/instrumente/localizare#planuri`);
  `/admin/planuri` redirecționează acolo.

## Planuri cadastrale din admin (`/admin/instrumente/localizare`)

1. Browserul comprimă fișierul (gzip, CompressionStream) și îl trimite la `/api/admin/plans`.
2. Workerul îl pune ca asset în release-ul draft `plan-uploads` din GitHub și pornește `.github/workflows/plan.yml`
   (`workflow_dispatch`, `mode=convert`) → rezultatul pe branch `plan/<id>`.
3. „Publică” (unul sau „Publică toate”) → `mode=publish`, id-uri separate prin virgulă → commit pe `main`
   (sau `PLANS_GITHUB_BRANCH`) → deploy.
- Starea se citește din `display_title` al rulărilor („plan {mode} {ids}”). Concurență: grup separat per conversie,
  `plans-publish` pentru publicări (altfel GitHub anulează rulările în așteptare). Butoane „Reîncearcă (toate)”.
- Secret-uri worker: `PLANS_GITHUB_TOKEN` (fine-grained, Contents + Actions read/write pe repo),
  opțional `PLANS_GITHUB_REPO` (implicit `ValuefyTM/uvalo`), `PLANS_GITHUB_BRANCH`.
- Publicările scriu pe `main` → înainte de push fă mereu `git pull --rebase`. Conflict în `localizare-data/index.html`
  → rezolvă rulând din nou `convert.py --entry <key>` pentru UAT-urile afectate.
- UAT-urile sunt grupate pe **județ** peste tot (selector Județ în localizator, tabele în admin). UAT nou = cere județul.

## Vezi ca utilizatorul (super-admin, doar vizualizare)

- Pe Acasă (pagina veche și dashboard-ul) super-adminul are „Vezi platforma ca un utilizator” (`ViewAsPicker` în `src/components/ViewAs.tsx`:
  căutare după nume / email / firmă în lista de la `GET /api/admin/view`, conturi active + închise / dezactivate, fără super-admini) →
  `POST /api/admin/view {user_id}` pune cookie-ul **`vf_view`** (`VIEW_COOKIE`, httpOnly, 8 ore; verifică super-adminul real cu `currentSession`,
  nu cu `context()`). `context()` în `access.ts`: dacă sesiunea e a unui super-admin și cookie-ul există → `contextOf(target, pseudo-sesiune
  `view:<id>`)` = platforma exact cum o vede persoana (firma, planul, modulele, `super = false`), cu `c.viewAs = {id, name, email, by}` și
  sesiunea reală păstrată (logout). Mentenanța nu-l blochează pe cel care vizualizează (`!c.viewAs` în `guard.page`, `api()`, `locatorAccess`).
- **Doar citire**: `worker.ts` (`readOnlyView`) refuză cu 403 orice cerere non-GET cât timp există cookie-ul, înainte de aplicație, cu excepția
  `/api/admin/view` (ieșirea) și `/api/auth/logout`; `track()` nu scrie nimic când `c.viewAs` e setat (fără evenimente pe persoana vizualizată).
- Bara neagră `ViewAsStrip` în `AppShell` pe toate paginile („Vezi platforma ca X · doar vizualizare” + „Ieși din vizualizare” = `DELETE /api/admin/view`).
  Paginile de admin redirecționează la `/` cât timp vizualizezi (contextul nu mai e super).

## Mod mentenanță

Tabel `app_settings`, cheia `maintenance` = `{on, message}` (migrația 0009). Verificat în `guard.page()`, `api()`,
`locatorAccess()`, paginile și API-urile publice. Super-adminii (`TOOLS_SUPERADMINS`) trec mereu; splash pe
`/mentenanta` (`?preview=1` pentru admin). Comutator în admin (`MaintenanceCard`). **În producție e PORNIT** până
decide utilizatorul să-l oprească.

## Medii și deploy

- **Producție**: worker `tools`, domeniu `app.uvalo.ro` (+ `tools.valuefy.ro` vechi, `uvalo.ro`/`www` de adăugat
  ca custom domains). Deploy acum prin **Cloudflare Workers Builds** la push pe `main` (`npm run cf:deploy` aplică și
  migrațiile).
- **Staging** (branch `staging`): worker `tools-staging`, D1 `valuefy-tools-staging-db`, `env.staging` în
  `wrangler.jsonc`, `MAIL_ALLOW` (emailurile spre alte adrese ajung în tabelul `dev_mail`, vizibil la `/dev/mail`).
  Pe staging există: `src/lib/config.ts` (appEnv/appName/envBanner), `scripts/dev.mjs`, `scripts/db-copy.mjs`
  (copie prod → local/staging, anonimizată, tabele ordonate după FK), `.github/workflows/deploy.yml`
  (staging automat, producție cu aprobare), `db-staging.yml`, `.dev.vars.example`, secțiunea din README.
  Lucrurile noi se fac pe `main`, apoi `git merge origin/main` în `staging`.
- **Local**: `npm run cf:build` apoi `npx wrangler dev --port 8797` (D1 local; `npm run db:migrate:local`).
  Testare cu Playwright (`/opt/node22/lib/node_modules/playwright/index.mjs` în mediul cloud). Pentru sesiune de test:
  inserează în `sessions` un rând cu `sha256(token)` și pune cookie-ul `vf_tools=<token>`.
  Oprește serverul cu `pkill -f "wrangler dev --port 8797"` într-o comandă separată (exit 144 e normal).

Variabile/secret-uri worker: `APP_URL`, `OLD_HOSTS`, `SITE_HOSTS`, `RESEND_API_KEY`, `TOOLS_EMAIL_FROM`,
`TOOLS_SUPERADMINS`, `GOOGLE_MAPS_KEY`, `LOCATOR_API_TOKEN`, `PLANS_GITHUB_*`, `ANTHROPIC_API_KEY`, `OVERPASS_URL` (opțional), `INSP_HOSTS`/`INSP_URL` (opționale).

## Legături cu VALUEFY (de separat treptat)

- CRM-ul VALUEFY (`ValuefyTM` CRM, alt repo) cheamă `/api/localizare/centroid` (centrul parcelei după nr. cadastral)
  cu `LOCATOR_API_TOKEN`; la el `LOCATOR_API_URL` trebuie mutat pe `https://app.uvalo.ro`.
- Numele vechi rămân intern: pachetul `valuefy-tools`, D1 `valuefy-tools-db`, cookie `vf_tools`. Nu le redenumi
  fără plan de migrare (D1 nu se redenumește; cookie nou = toți utilizatorii se reloghează).

## Rămase deschise (la 9 oct 2026)

- Email de autentificare care nu sosește după mutarea pe app.uvalo.ro — de verificat în Resend (Logs) dacă
  `TOOLS_EMAIL_FROM` e pe un domeniu verificat; limită 5 coduri/oră/email (`DELETE FROM auth_codes WHERE email=…`).
- Cheia Google Maps: referrer `app.uvalo.ro/*` de adăugat.
- `uvalo.ro` și `www.uvalo.ro` de adăugat ca custom domains pe workerul `tools`.
- Setup staging/CI de făcut de utilizator: deconectare Workers Builds, environment `production` cu aprobatori în
  GitHub, secret-urile `CLOUDFLARE_*` și cele de staging, PR `staging` → `main`.
- Oprirea modului de mentenanță când e gata lansarea UVALO.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## API de integrare (`/api/v1/*`, aplicația proprie a unei firme, ex. CRM-ul)

- Migrația 0035: `api_keys` (cheia firmei: `prefix`, `key_hash` = sha256, `webhook_url`, `webhook_secret`, `revoked_at`), `inspections.ext_ref` și
  `insp_templates.ext_ref` (id-ul din aplicația firmei, unic pe firmă), `api_hooks` (ultimele apeluri webhook, 200 pe cheie). Logica: `src/lib/integration.ts`.
- Cheile: **Firma mea → Integrare** (`IntegrationPanel`, `#integrare`, doar pentru cine are modulul Inspecții sau super-admin; API sesiune
  `/api/org/integration`: `create` → cheia `uvk_…` arătată o singură dată, `revoke`, `webhook {url, new_secret?}` → secretul `whs_…` arătat o dată).
- Autentificare: `Authorization: Bearer uvk_…` (`keyApi`; firma activă; `last_used_at`). Fără mentenanță pe aceste rute.
- Rute: `GET /api/v1` (ping) · `GET /api/v1/inspectors?legit=` · `GET /api/v1/templates` · `PUT|DELETE /api/v1/templates/<ref>`
  (`{name, prop_type, template, enforced?}`, publicată imediat, versiune nouă doar la schimbare) · `POST /api/v1/inspections`
  (`{ref, legit, address, …, instructions?, due_on?, template_ref? | template_id?}`; același `ref` = actualizare / realocare cât nu e finalizată,
  409 după) · `GET|DELETE /api/v1/inspections/<id|ref>` (`?reason=`; o inspecție finalizată se șterge doar cu `?force=1`) · `POST /api/v1/inspections/<id|ref>/files` (multipart `file`, `kind` cf|releveu|doc)
  · `GET /api/v1/files/<id>`.
- **Evaluatorul se găsește după legitimația ANEVAR** (`inspectorByLegit`: `users.anevar_no` fără spații/puncte/cratime, cont `active`); primește
  inspecția **direct** (`assignee_kind = 'office'`, `assign_state` NULL, fără solicitare de acceptat), chiar dacă nu e membru / asociat al biroului;
  `created_by` = cine a creat cheia, `org_id` = firma cheii. `GET …/inspections/<id>` dă `inspector: {name, legit, signature}` (semnătura din
  contul evaluatorului, PNG data URL, doar la fișa finalizată) și `location: {lat, lng, accuracy_m, at, source: gps|manual}` (locul inspecției
  de pe telefon, `null` până la primul răspuns trimis). Instrucțiunile și termenul (`due_on`) intră în `notes`. Fișa: a firmei (după ref / id),
  `uvalo:<key>`, altfel cea UVALO după `prop_type`; la actualizare fișa se păstrează după ce a început completarea.
- Fișele trimise prin API (`ext_ref`) nu se modifică / publică / șterg din editorul UVALO (`tplAction` refuză: „se modifică în aplicația firmei”); se pot duplica.
- **Webhook**: `logIt` (orice rând de istoric) → `postHook` (în `waitUntil`) pentru inspecțiile cu `ext_ref`, la toate cheile active ale firmei cu webhook:
  `{event, id, ref, status, scheduled_at, started_at, finished_at, sheet_no, text, at}`, `event` = inspection.created | scheduled | started | finished |
  reopened | deleted | updated (fără apeluri pentru poze / fișiere șterse / link public). Semnătura `X-Uvalo-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<body>")>`,
  timeout 8 s, rezultatul în `api_hooks` (arătat în panou). Aplicația citește apoi inspecția cu `GET /api/v1/inspections/<id>`.
- Test local: `next dev -p 3300`, cheie + birou de test inserate în D1 local, un receptor HTTP pe 127.0.0.1 (webhook-ul acceptă `http://localhost|127.0.0.1` doar local).

## Server MCP (`/api/mcp`, pentru Claude și alți asistenți)

- Model Context Protocol, transport **Streamable HTTP fără sesiuni** (JSON-RPC pe POST; GET/DELETE → 405; notificările → 202), scris de mână în
  `src/app/api/mcp/[[...key]]/route.ts` (fără SDK): `initialize` (versiunile 2025-06-18 / 2025-03-26 / 2024-11-05, `instructions` cu numele firmei),
  `ping`, `tools/list`, `tools/call`, `resources/list` și `prompts/list` goale. Erorile instrumentelor (`ToolError`) = `isError: true` cu mesaj în română.
- **Conectarea simplă = OAuth 2.1** (migrația 0037, `src/lib/oauth.ts`): în claude.ai / Claude Desktop (Setări → Conectori → conector personalizat cu
  `https://app.uvalo.ro/api/mcp`) sau Claude Code (`claude mcp add --transport http uvalo <url>` + `/mcp`) → clientul se înregistrează singur
  (`POST /api/oauth/register`, RFC 7591, fără secret, redirect https sau localhost), deschide `/oauth/authorize` (pagina de consimțământ în stil
  login, `src/app/oauth/authorize/page.tsx`; nelogat → `/login?next=…`; merge și în mentenanță) → „Permite” (`POST /api/oauth/authorize`) → cod de
  10 min, o singură folosire, PKCE S256 → `POST /api/oauth/token` (form sau JSON; `authorization_code` / `refresh_token` rotit) → `uvt_…` 30 de zile +
  `uvr_…` 180 de zile (sha256 în `oauth_tokens`). Discovery: `/.well-known/oauth-authorization-server` și `/.well-known/oauth-protected-resource[/api/mcp]`
  (rute Next cu `[[...p]]`, CORS); 401-ul MCP-ului are `WWW-Authenticate: Bearer resource_metadata="…"`. Tokenul acționează **pentru persoană**:
  `contextOf(db, user, session)` din `access.ts` (pseudo-sesiune `oauth:<id>`, fără UPDATE pe `sessions`), deci modulele ei; în mentenanță
  non-super-adminii primesc „Platforma este în mentenanță”. **Contul meu → „UVALO în Claude”** (`ClaudeCard`, `#claude`, doar cu `localizare`): adresa
  cu „Copiază”, pașii, aplicațiile conectate cu „Deconectează” (`/api/account/apps` GET / DELETE → `listApps` / `revokeApp`). `merge.ts` acoperă
  `oauth_tokens` / `oauth_codes`. Eveniment `auth`/`oauth_allow` la consimțământ.
- Alternativa fără OAuth = **cheia API a firmei** (Firma mea → Integrare, `uvk_…`): `Authorization: Bearer uvk_…`, în cale `/api/mcp/uvk_…` sau `?key=`;
  modulele = planul firmei. Fără mentenanță pe cheie. Folosirea → `events` (`module = localizare`, `action = mcp_<instrument>`, `meta {key}` sau
  `{oauth:1}`). Panoul „Integrare” apare și pentru firmele cu doar localizator (`IntegrationPanel` cu `app` + `inspectii`; blocul `McpHelp` trimite la
  Contul meu și explică cheia).
- Instrumentele (`src/lib/mcp-localizare.ts`, deocamdată doar Localizatorul): **`localitati`** (UAT-urile cu plan + satele → comună din `VILLAGES`),
  **`parcela`** (`nr` [+ `localitate`, `geojson`]: suprafața din plan, perimetrul, inventarul de coordonate X/Y + GPS + laturi, centrul, construcțiile
  cu suprafața la sol și POT, vecinii, nr. topo, observații (`shared`, `o`), cartier + zonă de impozitare în Timișoara, grila notarială 2026 cu toate
  valorile, linkuri localizator / amplasament / Google Maps; fără localitate caută în toate planurile prin centroide), **`parcela_la_coordonate`**
  (lat/lng sau Stereo 70 x = nord / y = est; ordinea se decide după ce cade în România), **`parcela_la_adresa`** (Google Geocoding → același lucru),
  **`grila_notariala`** (punct sau localitate + zonă → valorile; doar localitatea → schema zonelor), **`conversie_coordonate`** (Stereo 70 ↔ WGS84,
  `wgs84ToStereo70` = Newton pe formulele directe, în `src/lib/stereo70.ts`).
- Datele: nu se parsează un plan întreg în worker (Timișoara 8,5 MB). `scripts/copy-localizare.mjs` scrie la build, pe lângă centroide
  (`_localizare/c/<uat>.json`, acum `id → [lat, lng, suprafață, rază]`, raza = cel mai depărtat colț de centru, în m; `c/index.json` are și `date`, `b`),
  **shard-urile** `_localizare/s/<uat>/<nn>.json` (32 pe UAT, după hash-ul numărului — `shardOf` identic în script și în `mcp-localizare.ts`; fiecare
  parcelă cu construcțiile ei `b: [[nume, z]]`). Parcela de sub un punct: candidații din centroide (distanța ≤ rază + 5 m) → shard-uri → punct în
  poligon (în planul Stereo 70; la suprapuneri cea curentă, apoi cea mai mică). Straturile (`straturi/timisoara.json`, `grila-*.json`, `grila-valori.json`)
  se citesc din assets și se țin în memorie (`grAt` / `grValues` portate din `index.html`, cu valorile ca obiect, nu HTML).
- Test local: `npm run cf:build`, `npx wrangler dev --port 8797`, o cheie în `api_keys` (sha256) pe o firmă cu `localizare`, apoi
  `curl -X POST http://127.0.0.1:8797/api/mcp -H "Authorization: Bearer uvk_…" -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"parcela","arguments":{"nr":"405240","localitate":"Giroc"}}}'`.
