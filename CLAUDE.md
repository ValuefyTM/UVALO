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
- Fără framework CSS: totul în `src/app/globals.css`. Brand: fundal închis `#141414`, auriu `#E0AD4F`.
  Logo-uri în `public/uvalo-*.svg` (lockup alb, simbol, vertical ink, logo text); favicon `src/app/icon.svg`;
  iconițe PWA `public/loc-icon-*.png`.

## Structură

- Meniul (`AppShell`): doar **Acasă**, **Instrumente** (+ **Colaborări** pentru cine are acces în modul curent) (`/instrumente`, toate instrumentele pe o pagină, grupate „Pe platformă”
  și „În Word și în browser”; paginile instrumentelor aprind „Instrumente”) și **În curând**. Pe telefon: Acasă, Instrumente, Contul meu.
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

## Inspecții (`/inspectii`, modulul `inspectii`) — ÎN TEST, doar super-adminii

- Pregătite pe web, făcute pe telefon (aplicația UVALO, încă de construit), văzute pe web. Mockup: canvasul „UVALO — Inspecții” (pagini Web / Mobil).
- Acces: `context()` adaugă `inspectii` în `c.modules` doar pentru super-admini (nu e în planuri); meniul arată „Inspecții” cu eticheta TEST.
  Pentru lansare: un mod ca la Colaborări (off/test/on) sau modulul în planuri.
- Fără telefon conectat (`insp_devices`) → pagina de activare (`InspActivate`: cod de 6 cifre în `insp_pair_codes`, 10 min, pentru aplicație);
  în test, „Continuă fără telefon (test)” creează un dispozitiv `platform = 'test'`.
- Migrația 0023: `inspections` (bunul, contact, programare, fișa ca instantaneu `template` + versiune, `answers`, `room_answers`, `findings`, semnătura,
  `test = 1`), `insp_templates` (fișele firmei `org` — pot fi impuse — și ale persoanei `user`; `draft` + `published` + `version`), `insp_files`
  (poze/acte, fișierele vor sta în R2 — bucket de legat), `insp_log` (istoric), `insp_devices`, `insp_pair_codes`. Fișele UVALO stau în cod
  (`UVALO_TEMPLATES` în `src/lib/insp-shared.ts`, doar citire, se duplică). Logica: `src/lib/insp.ts`; API unic `POST /api/inspectii {action}`.
- Pagini: `/inspectii` (`InspList`: file Ale mele / Făcute pentru colegi / Făcute pentru mine, filtre pe stare, Listă / Hartă (Leaflet) / Calendar
  săptămânal cu „De programat” trase pe o oră → `schedule`), `/inspectii/nou[?id=]` (`InspForm`: CF citit cu `/api/amplasament/plan`, încăperi,
  fișa, contact, programare, cine o face: eu / coleg din birou / Colaborări), `/inspectii/<id>` (fișa ca document: cuprins în stânga, conținut;
  „Descarcă PDF” = print; în test „Simulează inspecția” completează fișa ca telefonul), `/inspectii/fise` (`InspTemplates`: editor de grupuri și
  întrebări, răspunsuri precompletate, publicare pe versiuni).
- `merge.ts` (unire/ștergere conturi) acoperă tabelele noi. Evenimente `inspectii` (meta `{test:1}`).
- Fișiere: bucket R2 privat **`uvalo-inspectii`**, binding `FILES` în `wrangler.jsonc` (`getFiles()` în `db.ts`). Încărcare `POST /api/inspectii/files`
  (multipart: id, kind cf|releveu|doc|photo|signature, file; ≤ 15 MB; cheie `insp/<inspecție>/<id>.<ext>`), servire `GET /api/inspectii/file/<id>`
  (doar proprietarul, cel care face inspecția, super-adminii), `DELETE` la fel. Formularul urcă CF-ul citit și releveul după salvare; fișa are
  „Adaugă extras CF / releveu / alt document” și, în test, „Adaugă fotografii (test)”. Confidențialitatea (secțiunea 6) spune că doar actele
  atașate la o inspecție se păstrează.

## Instrumente în admin (`/admin/instrumente`)

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
`TOOLS_SUPERADMINS`, `GOOGLE_MAPS_KEY`, `LOCATOR_API_TOKEN`, `PLANS_GITHUB_*`, `ANTHROPIC_API_KEY`, `OVERPASS_URL` (opțional).

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
