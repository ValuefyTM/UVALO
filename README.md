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

Next.js 16 pe Cloudflare Workers (OpenNext), D1 `valuefy-tools-db` (separată de site și CRM), emailuri prin Resend.
Datele localizatorului (`localizare-data/`) sunt copiate în asset-urile worker-ului sub `/_localizare/`
(`scripts/copy-localizare.mjs`) și sunt servite doar prin `/api/localizare/*`, după verificarea contului și a abonamentului.
Versiunile `next` / `@opennextjs/cloudflare` / `wrangler` sunt fixate: Next 16.4 nu merge încă cu adaptorul Cloudflare.

### Cloudflare (Workers Builds)

- Worker: `tools` · branch `main` · build command `npm ci` · deploy command `npm run cf:deploy`
  (creează baza de date dacă lipsește, aplică migrările D1, construiește, copiază datele, publică).
- Variabile: `TOOLS_SUPERADMINS` (emailuri separate prin virgulă), `RESEND_API_KEY` (secret),
  `TOOLS_EMAIL_FROM` (ex. `VALUEFY Tools <tools@valuefy.ro>`),
  `GOOGLE_MAPS_KEY` (secret, opțional: hărțile Google și căutarea adreselor în localizator, doar pentru firmele al căror plan
  are modulul `google_maps`; ceilalți rămân pe Esri / OpenStreetMap, chiar dacă cheia e pusă).
  În Google Cloud cheia are activate **Map Tiles API** și **Geocoding API**; restricție recomandată: doar aceste două API-uri.
- Domeniu: `tools.valuefy.ro` (Custom domain pe worker).

### Local

```bash
npm ci
printf 'TOOLS_SUPERADMINS=office@valuefy.ro\n' > .dev.vars
npm run db:migrate:local
npm run cf:build && npx wrangler dev --port 8798
```
Fără `RESEND_API_KEY`, emailurile (codul de autentificare, invitațiile) apar în logul lui wrangler.

## Adăugarea unor UAT-uri noi în localizator

Planurile vin ca DWG de la BCPI (straturi `ImobileE3`, `ImobileE3_IE`, `ConstructiiE3`, `limita_intravilan_5000`,
`DEN_INTRAVILANE`, `limita_5000_<UAT>`). Conversia se face local, cu [LibreDWG](https://www.gnu.org/software/libredwg/)
(`dwgread -O JSON`) și `tools/dwg/convert.py` (Python 3 cu `shapely` și `pyproj`):

1. `dwgread -O JSON -o js/<Nume>.json "<Nume> ortofoto.dwg"`
2. adaugă planul în lista `SPEC` din `tools/dwg/convert.py` (cheie, nume cu diacritice, stratul limitei când un plan are
   două comune) și rulează `OUTDIR=out python3 tools/dwg/convert.py <Nume>`;
3. copiază `out/<cheie>.json` în `localizare-data/` și adaugă intrările din `out/uats-<Nume>.json` în lista `UATS`
   din `localizare-data/index.html`; push → deploy.
