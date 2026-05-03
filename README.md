# Skraldetømningsapp

Lokal app der henter tømmedatoer fra Vestfor og viser dem i et overskueligt interface. Giver også mulighed for at downloade tømmedatoer som .ics fil, eller at printe som pdf.

## Hvad er nyt

- Appen henter nu tømmedatoer for det næste år.
- Download af kalenderfil (`/api/calendar.ics`) laver nu tidsbestemte events kl. 06:00-06:30 på tømmedagen (Europe/Copenhagen).
- Kalenderfilen indeholder en påmindelse kl. 20:30 aftenen før hver tømning.
- Kalenderfilen markerer events som ledig tid (free), inkl. Outlook/Microsoft-specifikke felter for bedre import-kompatibilitet.
- UID i kalenderfilen genereres nu RFC-5545-kompatibelt (uden ugyldige tegn som `/`) for bedre Outlook-import.

## Første gang

Åbn en terminal (PowerShell eller CMD) i mappen og kør:

```
npm install
```

## Start appen

```
node server.js
```

Åbn derefter **http://localhost:3000** i din browser.

## Stop appen

Tryk **Ctrl+C** i terminalen.
