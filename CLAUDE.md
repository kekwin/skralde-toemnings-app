# CLAUDE.md – Skraldetømning (waste-collection-dates)

Lille Node-app (`server.js`, Express) der henter tømmedatoer fra Vestfor for det kommende år og viser dem i et
overskueligt interface. Kan downloade en kalenderfil (.ics) og printe som pdf. Repo:
https://github.com/kekwin/waste-collection-dates (privat). Tal med Kewin på dansk. Push direkte til `main`.
Hub'en bygger fra et versionstag.

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
node server.js    # http://localhost:3000  (Ctrl+C stopper)
```

Ingen tests endnu. `data/` er gitignored.

## Struktur

- `server.js`: Express-serveren. Ruter: `/api/saved-address`, `/api/home`, `/api/home/dates`, `/api/search`,
  `/api/set-address` (POST), `/api/dates`, `/api/calendar.ics`.
- `public/`: siden.
- Port 3000 (127.0.0.1) i hub'en, på Tailscale som `waste-collection-dates`.

## Status

v1.4.2 kører i hub'en (7. oktober 2026) på http://127.0.0.1:3000 og https://waste-collection-dates.tailcc94cc.ts.net.
Henter datoer igen med ny session, når Vestfor svarer med en tom liste (v1.4.2).

## Næste skridt

Ingen planlagte.
