# UVALO — app.uvalo.ro

Repo: `ValuefyTM/uvalo` (fost `ValuefyTM/tools`).

Platformă SaaS pentru evaluatori imobiliari (fostă „VALUEFY Tools”). Modulul principal este **Localizatorul cadastral**
(hartă cu parcele/clădiri din exporturile ANCPI, căutare după nr. cadastral/topo/adresă, export PDF/Word/PNG, GPS).
Proprietar: VALUEFY (firmă de evaluări imobiliare, Timișoara). UVALO devine un produs separat de site-ul și CRM-ul VALUEFY.

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

## Stack

- Next.js 16 (App Router) pe **Cloudflare Workers** prin **OpenNext** (`@opennextjs/cloudflare`).
- Bază de date **D1** `valuefy-tools-db` (binding `DB`) — separată de CRM (`valuefy-db`). Migrații în `migrations/`.
- `worker.ts` = intrarea workerului (wrangler `"main"`), un strat peste aplicația OpenNext:
  - `OLD_HOSTS` (implicit `tools.valuefy.ro`) → **301** către `APP_URL`, păstrând calea și query-ul; `/api/` NU se
    redirecționează (CRM-ul VALUEFY îl folosește încă);
  - `SITE_HOSTS` (implicit `uvalo.ro,www.uvalo.ro`) → **302** temporar către aplicație, până există site de prezentare;
  - șterge `x-forwarded-*` (linkurile din emailuri se construiesc doar din `APP_URL`/Host — `src/lib/site.ts`).
- Fără framework CSS: totul în `src/app/globals.css`. Brand: fundal închis `#141414`, auriu `#E0AD4F`.
  Logo-uri în `public/uvalo-*.svg` (lockup alb, simbol, vertical ink, logo text); favicon `src/app/icon.svg`;
  iconițe PWA `public/loc-icon-*.png`.

## Structură

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
- `tools/dxf/convert.py` — convertorul DXF ANCPI → date localizator (ezdxf, shapely, pyproj; Stereo70 → WGS84).
  Citește stratul `T_A1S1_<UAT>_<data>` și `*constructii*`; face **merge** cu datele existente.
  `--entry <key>` reface intrarea din `UATS` (versiune sha1[:10], dată, județ).

## Analiza amplasamentului (`/amplasament`)

- Pagina: `localizare-data/amplasament.html` (servită de `src/app/amplasament/route.ts`, modulul `amplasament`, în toate
  planurile prin migrația 0012). Intrări: `?uat=&nr=` (bara de pe pagina de start → „Analiză amplasament”, butonul din
  fișa parcelei din localizator), `?adr=` (adresă/coordonate), `?lat=&lng=`. Nr. negăsit → cere adresa; dacă adresa
  cade pe o parcelă din planuri, o identifică (WGS84 → Stereo 70 prin iterații Newton).
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
- Deschiderea: doar laturi aproape paralele (< 30°) cu o stradă OSM la ≤ 25 m; altfel „neidentificată automat”, cu
  laturile fără vecin înscris și dreptunghiul încadrator (nu se ghicește frontul).
- Index UAT-uri (`_localizare/c/index.json`) conține acum și `v` (versiunea datelor) și `bb`.

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

## Instrumente în admin (`/admin/instrumente`)

- Listă cu fiecare instrument (localizare, amplasament, comparabile, word) + pagină `/admin/instrumente/<cheie>`: comutator
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
