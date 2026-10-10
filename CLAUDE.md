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
  față de date (`unverified`). Secret worker: **`ANTHROPIC_API_KEY`**. Limită 60 texte/zi/utilizator.
- Index UAT-uri (`_localizare/c/index.json`) conține acum și `v` (versiunea datelor) și `bb`.

## Planuri cadastrale din admin (`/admin/planuri`)

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
