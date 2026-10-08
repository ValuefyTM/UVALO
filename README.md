# VALUEFY Tools — tools.valuefy.ro

Platformă pentru colegii evaluatori: instrumente VALUEFY pe bază de cont și abonament.
Primul modul: **Localizare cadastrală ANCPI** (planurile cadastrale din Timiș). Urmează: analize de piață.

## Cum funcționează

- **Acces doar pe invitație.** Nimeni nu își face cont singur. Autentificare fără parolă: cod de 6 cifre sau link pe email.
- **Firme cu abonament și locuri.** Abonamentul (plan, număr de locuri, acces până la o dată) aparține firmei; un evaluator
  independent e o firmă cu un loc. Roluri în firmă: titular cont, administrator, membru.
- **Administratori VALUEFY** (`TOOLS_SUPERADMINS` sau invitați din Administrare → Utilizatori): creează firme, setează
  abonamentul, invită titularul, văd activitatea tuturor.
- **Tracking**: autentificări, localități deschise, căutări, parcele, exporturi, GPS — în tabela `events`, vizibile în
  Administrare → Activitate și, pentru firma lor, în „Firma mea”.
- **Sesiuni pe dispozitive** (60 de zile), vizibile și închise din „Contul meu”; dezactivarea unui cont le închide pe toate.

## Tehnic

Next.js 16 pe Cloudflare Workers (OpenNext), D1 proprie (separată de site și CRM: nu au tabele comune; CRM-ul folosește
doar API-ul de centre de parcele, cu token), emailuri prin Resend.
Datele localizatorului (`localizare-data/`) sunt copiate în asset-urile worker-ului sub `/_localizare/`
(`scripts/copy-localizare.mjs`) și sunt servite doar prin `/api/localizare/*`, după verificarea contului și a abonamentului.
Versiunile `next` / `@opennextjs/cloudflare` / `wrangler` sunt fixate: Next 16.4 nu merge încă cu adaptorul Cloudflare.

## Medii: local, staging, producție

| | Local | Staging (test) | Producție |
|---|---|---|---|
| Pornire / deploy | `npm run dev` | push pe branch-ul `staging` | push pe `main` + **aprobare** |
| Worker | `wrangler dev` (același runtime) | `tools-staging` | `tools` |
| D1 | local (`.wrangler/`) | `valuefy-tools-staging-db` | `valuefy-tools-db` |
| Adresă | http://localhost:8787 | `tools-staging.<cont>.workers.dev` | https://tools.valuefy.ro |
| Emailuri | doar în `/dev/mail` | `/dev/mail` + reale doar pentru `MAIL_ALLOW` (`@valuefy.ro`) | reale |
| Planuri cadastrale din admin | — | branch `staging` | branch `main` |

Aceeași configurare (`wrangler.jsonc`), aceleași migrări, același build (OpenNext) în toate trei. Pe local și staging, o
bandă roșie jos arată mediul. Ce diferă între medii sunt doar variabilele: `APP_ENV`, `APP_URL`, `APP_NAME`,
`SUPPORT_EMAIL`, `MAIL_ALLOW`, `PLANS_GITHUB_BRANCH` (în `wrangler.jsonc`) și secretele (în Cloudflare, pe fiecare worker).
Schimbarea domeniului înseamnă `APP_URL` plus domeniul pe worker, în Resend și la restricția cheii Google.

### Local

```bash
npm ci
npm run dev            # migrări locale + build + wrangler dev → http://localhost:8787
```

- Prima dată se creează `.dev.vars` din `.dev.vars.example`: pune adresa ta în `TOOLS_SUPERADMINS`.
- Autentificare: ceri codul în `/login`, apoi îl iei din **http://localhost:8787/dev/mail** (local nu pleacă emailuri).
- `npm run db:pull` — copie a bazei din **producție**, cu datele personale anonimizate (emailurile și telefoanele
  evaluatorilor și ale solicitărilor; sesiunile și codurile de login se șterg; administratorii VALUEFY își păstrează
  emailul). Cere `npx wrangler login` o dată. `--raw` (fără anonimizare) doar dacă e strict necesar.
- `npm run db:reset` — bază locală goală, doar cu migrările. `npm run dev -- --no-build` repornește fără build.
- `npm run dev:ui` — `next dev` pe portul 3300, doar pentru lucru rapid pe interfață (nu e identic cu Cloudflare).

### Staging

- Deploy: push pe branch-ul `staging` (sau Actions → **Deploy** → Run workflow → staging).
- Datele: Actions → **Copiază producția în staging** → Run workflow (anonimizat, ca `db:pull`), sau
  `npm run db:pull:staging` de pe calculator.
- Secretele workerului `tools-staging` se pun separat: Cloudflare → Workers → tools-staging → Settings → Variables and
  Secrets (`TOOLS_SUPERADMINS`, `RESEND_API_KEY`, `EMAIL_FROM`, opțional `GOOGLE_MAPS_KEY`, `PLANS_GITHUB_TOKEN`).

### Producție

- Deploy: push (sau merge de Pull Request) pe `main` → Actions → **Deploy** așteaptă aprobarea în mediul `production`
  → tipuri, build, migrări D1, deploy. Fără aprobare nu se publică nimic.
- Un Pull Request rulează doar verificarea (tipuri + build), fără deploy.
- Publicarea planurilor din admin pornește tot workflow-ul **Deploy** (cu aprobare).
- Variabile și secrete (Cloudflare → Workers → tools): `TOOLS_SUPERADMINS`, `RESEND_API_KEY` (secret),
  `EMAIL_FROM` (ex. `VALUEFY Tools <tools@valuefy.ro>`; până e setat se folosesc `TOOLS_EMAIL_FROM` / `CRM_EMAIL_FROM`),
  `GOOGLE_MAPS_KEY` (secret, opțional: hărțile Google și căutarea adreselor în localizator, doar pentru firmele al căror plan
  are modulul `google_maps`; în Google Cloud cheia are activate **Map Tiles API** și **Geocoding API**),
  `LOCATOR_API_TOKEN`, `PLANS_GITHUB_TOKEN`.

### Configurare GitHub și Cloudflare (o singură dată)

1. **Cloudflare → Workers → tools → Settings → Build: deconectează repository-ul (Workers Builds).** Deploy-ul se face
   acum din GitHub Actions; altfel Cloudflare ar publica la fiecare push, fără aprobare. (`npm run cf:deploy` se oprește
   intenționat cu un mesaj, ca să nu publice pe ascuns.)
2. **GitHub → tools → Settings → Environments:** `production` cu **Required reviewers** (tu) și „Deployment branches:
   main”; `staging` fără reguli.
3. **GitHub → Settings → Secrets and variables → Actions:** `CLOUDFLARE_API_TOKEN` (Cloudflare → My Profile → API Tokens →
   șablonul „Edit Cloudflare Workers”, plus permisiunea **D1: Edit**) și `CLOUDFLARE_ACCOUNT_ID`.
4. Primul deploy pe `staging` creează workerul `tools-staging` și baza lui; apoi pune-i secretele (vezi Staging) și
   rulează **Copiază producția în staging**.

## Adăugarea unor UAT-uri noi în localizator

Planurile vin ca DWG de la BCPI (straturi `ImobileE3`, `ImobileE3_IE`, `ConstructiiE3`, `limita_intravilan_5000`,
`DEN_INTRAVILANE`, `limita_5000_<UAT>`). Conversia se face local, cu [LibreDWG](https://www.gnu.org/software/libredwg/)
(`dwgread -O JSON`) și `tools/dwg/convert.py` (Python 3 cu `shapely` și `pyproj`):

1. `dwgread -O JSON -o js/<Nume>.json "<Nume> ortofoto.dwg"`
2. adaugă planul în lista `SPEC` din `tools/dwg/convert.py` (cheie, nume cu diacritice, stratul limitei când un plan are
   două comune) și rulează `OUTDIR=out python3 tools/dwg/convert.py <Nume>`;
3. copiază `out/<cheie>.json` în `localizare-data/` și adaugă intrările din `out/uats-<Nume>.json` în lista `UATS`
   din `localizare-data/index.html`; push → deploy.

### Actualizarea unui UAT din exportul DXF ANCPI

Exporturile DXF noi au doar stratul cu parcele `T_A1S1_<UAT>_<data>` (contur + nr. cadastral) și
`<UAT>_constructiie3` (contur + nr. construcție, ex. `400963-C19`). Pentru un UAT care există deja în localizator
(Python 3 cu `ezdxf`, `shapely`, `pyproj`):

    python3 tools/dxf/convert.py <fișier.dxf> <cheie>      # ex. CHEVERESU_MARE.dxf cheveresu-mare

Nu se șterge nimic: parcelele și construcțiile din DXF se adaugă sau le înlocuiesc pe cele cu același număr, iar cele
din versiunea actuală care nu apar în export rămân (construcțiile vechi doar unde nu le acoperă una nouă). Numerele topo și
intravilanul se păstrează (exportul nu le are), iar numerele topo se leagă din nou de parcele. Data exportului (din
numele stratului) apare în localizator: „date cadastrale la …” și în colțul hărții. Scriptul rescrie `localizare-data/<cheie>.json` și
intrarea UAT-ului din `localizare-data/index.html` și afișează ce s-a schimbat față de versiunea anterioară.
Pentru un UAT nou se dau și numele și județul: `python3 tools/dxf/convert.py <fișier.dxf> <cheie> "<Nume>" "<Județ>"`.

### Planuri cadastrale din admin

Admin → **Planuri cadastrale**: alegi unul sau mai multe DXF-uri (oricât de mari; browserul le comprimă de ~8 ori
înainte de trimitere), UAT-ul și data sunt recunoscute din numele stratului (pentru un UAT nou alegi județul), apoi:

1. fișierul comprimat ajunge ca atașament la un release GitHub „plan-uploads” (draft) și pornește workflow-ul
   `.github/workflows/plan.yml` (mod `convert`): conversia cu `tools/dxf/convert.py` într-o ramură `plan/<id>`; rezumatul
   modificărilor apare în admin;
2. **Publică în localizator** (sau **Publică toate**, mai multe planuri cu un singur deploy) pornește din nou workflow-ul
   (mod `publish`): planurile intră în `main`, ramurile se șterg, apoi deploy-ul. **Renunță** șterge ramura și fișierul.

Fiecare UAT are județul în lista din `localizare-data/index.html` (`"county"`); localizatorul are selector de județ, iar
listele de UAT-uri din admin sunt grupate pe județe.

Configurare, o singură dată:

- token GitHub *fine-grained* (github.com → Settings → Developer settings → Personal access tokens → Fine-grained):
  resource owner `ValuefyTM`, doar repository-ul `tools`, permisiuni **Contents: Read and write** și
  **Actions: Read and write**; pus în Cloudflare → Workers → tools → Settings → Variables and Secrets ca secret
  `PLANS_GITHUB_TOKEN`;
- după publicare, deploy-ul îl face workflow-ul **Deploy** (vezi „Medii”): în producție cu aprobare.

## API: centrul parcelei după numărul cadastral

`/api/localizare/centroid` dă coordonatele GPS ale centrului unei parcele din planurile localizatorului (Timiș), pentru
amplasarea proprietăților pe hartă în CRM. Centrele se calculează la build (`scripts/copy-localizare.mjs`, aceeași
conversie Stereo 70 → WGS84 ca pagina localizatorului) în `/_localizare/c/<uat>.json`.

- `GET ?nr=259154-C1-U20&city=Timișoara` → `{ nr: "259154", uat, lat, lng, match }` sau `{ nr, error }`. La unități
  individuale („…-C1-U20”) se folosește rădăcina (primele 6 cifre).
- `POST { items: [{ id, nr, city }] }` (max. 200) → `{ results: [...] }`.
- Acces: `Authorization: Bearer <LOCATOR_API_TOKEN>` (variabilă secretă în Cloudflare, aceeași valoare în CRM) sau
  un utilizator autentificat cu acces la localizator.
