# CLAUDE.md – Skraldetømning (waste-collection-dates)

Lille Node-app (TypeScript `strict`, Express) der henter tømmedatoer fra Vestfor for det kommende år og viser dem i et
overskueligt interface. Kan downloade en kalenderfil (.ics) og printe som pdf. Repo:
https://github.com/kekwin/waste-collection-dates (privat). Tal med Kewin på dansk. Push direkte til `main`; kør
`npm run check` før push. Hub'en bygger fra et versionstag.

Fælles regler for alle apps (principper, skabelon til denne fil, git): [summer-hub/CLAUDE.md](https://github.com/kekwin/summer-hub/blob/main/CLAUDE.md).

## Regler

- **Følsomhed lav** (kan bo hvor som helst), men husets adresse er personlig og kommer aldrig i git: den står
  i `HOME_ADDRESS` (i hub'en som `SKRALDE_HOME_ADDRESS` i `.env`), præcis som Vestfor skriver den.
- Hjemmeadressen ændres ikke af opslag på andre adresser ("Skift adresse"). Hver adresse får sin egen session
  hos Vestfor, så hjemmet og den viste adresse ikke blander sig. Uden `HOME_ADDRESS` virker appen som før.
- Kalenderfilen (`/api/calendar.ics`): events kl. 06:00–06:30 på tømmedagen (Europe/Copenhagen), markeret som
  ledig tid, påmindelse kl. 20:30 aftenen før, og RFC-5545-kompatible UID'er (uden fx `/`) for Outlook-import.
- Forsiden og påmindelserne bruger appens API (`/api/home/dates`, `/api/dates` med ikoner). Ændr ikke formatet
  uden at ændre `summer-frontpage`.

## Kør og test

```sh
npm install
npm run check          # typecheck + lint + tests, skal være grøn før push
npm run build          # dist/ (siderne) og dist-server/server.mjs
npm run backend:watch  # serveren på http://localhost:3000 (læser .env)
npm run dev            # genbygger siderne ved ændringer
```

`data/` er gitignored. Stop hub'ens container, før du kører lokalt på port 3000.

## Struktur

- `backend/vestfor.ts`: klienten til Vestfors selvbetjening (session pr. adresse, adresseopslag, tømmedatoer, nyt
  forsøg ved tom liste). Tager `fetch` som parameter, så den kan testes.
- `backend/ics.ts`: kalenderfilen (events, RFC-5545-folding og UID'er).
- `backend/app.ts`: Express-appen med ruterne `/api/saved-address`, `/api/home`, `/api/home/dates`, `/api/search`,
  `/api/set-address` (POST), `/api/dates` og `/api/calendar.ics`. `backend/server.ts` læser miljøet og starter den.
- `shared/`: `waste-types.ts` (ikon og farver pr. affaldstype, bruges af serveren og begge sider) og `types.ts`.
- `src/main.ts` (hovedsiden) og `src/print.ts` (udskriftssiden); `public/`: HTML, CSS og paletten, kopieres til
  `dist/` ved build.
- Tests ligger ved siden af koden (`*.test.ts`, Vitest).
- Port 3000 (127.0.0.1) i hub'en, på Tailscale som `waste-collection-dates`.

## Status

v2.0.1 kører i hub'en (7. oktober 2026; omskrevet til TypeScript `strict` med Express 5 og indbygget `fetch`, uændret funktion og uændret API) på http://127.0.0.1:3000 og https://waste-collection-dates.tailcc94cc.ts.net.
Henter datoer igen med ny session, når Vestfor svarer med en tom liste (v1.4.2).

## Næste skridt

Ingen planlagte.
