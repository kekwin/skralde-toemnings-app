'use strict';

const express = require('express');
const fetch   = require('node-fetch');
const fs      = require('fs');
const path    = require('path');

const { wasteType } = require('./public/waste-types.js');

const app  = express();
const PORT = Number(process.env.PORT) || 3000;

const DATA_DIR           = path.join(__dirname, 'data');
const SAVED_ADDRESS_FILE = path.join(DATA_DIR, 'saved-address.json');
const VESTFOR_BASE       = 'https://selvbetjening.vestfor.dk';
const FETCH_TIMEOUT_MS   = 10000;

/**
 * fetch() with a hard timeout, so a hung Vestfor request can't leave the
 * app spinning forever. Throws a friendly error on timeout instead of the
 * raw AbortError.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Vestfor svarede ikke inden for ${timeoutMs / 1000} sekunder`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Build a stable RFC-5545-safe UID token from event title.
function uidToken(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '') || 'event';
}

// ── ICS helpers ─────────────────────────────────────────────────────────────

/**
 * Fold a single ICS content line at 75 octets per RFC 5545 §3.1.
 * Continuation lines are prefixed with a single SPACE.
 */
function foldLine(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts = [];
  let offset   = 0;
  let maxBytes = 75;        // first chunk: 75 octets
  while (offset < bytes.length) {
    let end = Math.min(offset + maxBytes, bytes.length);
    // Back up if we're in the middle of a multi-byte UTF-8 sequence
    while (end > offset && (bytes[end] & 0xC0) === 0x80) end--;
    parts.push(bytes.slice(offset, end).toString('utf8'));
    offset   = end;
    maxBytes = 74;           // continuation chunks: 74 octets (1 reserved for leading space)
  }
  return parts.join('\r\n ');
}

/**
 * Build a fully validated ICS string from a list of event objects.
 * Throws if BEGIN:VEVENT / END:VEVENT counts don't match or
 * END:VCALENDAR is missing.
 */
function buildIcs(events) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Skraldetomning//DA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Skraldetømning',
    'X-WR-TIMEZONE:Europe/Copenhagen',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Copenhagen',
    'X-LIC-LOCATION:Europe/Copenhagen',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];

  for (const ev of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.uid}`,
      `DTSTART;TZID=Europe/Copenhagen:${ev.start}`,
      `DTEND;TZID=Europe/Copenhagen:${ev.end}`,
      `SUMMARY:${ev.summary}`,
      'TRANSP:TRANSPARENT',
      'X-MICROSOFT-CDO-BUSYSTATUS:FREE',
      'X-MICROSOFT-CDO-INTENDEDSTATUS:FREE',
      'BEGIN:VALARM',
      'TRIGGER:-PT9H30M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Tømning i morgen',
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');

  // ── Structural validation ─────────────────────────────────────────────────
  const begins = lines.filter(l => l === 'BEGIN:VEVENT').length;
  const ends   = lines.filter(l => l === 'END:VEVENT').length;
  if (begins !== ends) {
    throw new Error(`ICS struktur ugyldig: ${begins} BEGIN:VEVENT / ${ends} END:VEVENT`);
  }
  if (lines[lines.length - 1] !== 'END:VCALENDAR') {
    throw new Error('ICS struktur ugyldig: mangler END:VCALENDAR');
  }

  return lines.map(foldLine).join('\r\n') + '\r\n';
}

// ── In-memory session state ──────────────────────────────────────────────────
// Én Vestfor-session pr. adresse: Vestfor husker den valgte adresse i sessionen, så hjemmet og den
// adresse, man kigger på, må ikke dele cookies.
const sessions       = new Map();   // addressId → { name: value, ... }
let currentAddressId = null;        // den adresse, appen viser (saved-address.json)

// Hjemmeadressen (HOME_ADDRESS, fx "Rendsagervej 130, 2625 Vallensbæk") står i hub'ens .env. Den
// ændres ikke, når man slår andre adresser op, og det er den, hub'ens forside viser.
const HOME_ADDRESS = (process.env.HOME_ADDRESS || '').trim();
let home = null;                    // { id, navn, postnr }, når adressen er fundet hos Vestfor

// ── Startup ──────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ── Cookie helpers ────────────────────────────────────────────────────────────
function cookieString(cookies) {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/**
 * Manually follow redirects so we can collect Set-Cookie headers from every
 * hop (node-fetch v2 discards them when auto-following).
 */
async function fetchFollowingRedirects(startUrl) {
  let cookies    = {};
  let currentUrl = startUrl;

  for (let hop = 0; hop < 10; hop++) {
    const resp = await fetchWithTimeout(currentUrl, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Skraldetomning/1.0)',
        'Accept':     'text/html,application/xhtml+xml,*/*',
        'Cookie':     cookieString(cookies),
      },
    });

    // Collect any Set-Cookie headers from this hop
    const setCookieHeaders = resp.headers.raw()['set-cookie'] || [];
    for (const c of setCookieHeaders) {
      const [nameValue] = c.split(';');
      const eqIdx = nameValue.indexOf('=');
      if (eqIdx > 0) {
        cookies[nameValue.slice(0, eqIdx).trim()] = nameValue.slice(eqIdx + 1).trim();
      }
    }

    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get('location');
      if (!location) break;
      currentUrl = location.startsWith('http')
        ? location
        : new URL(location, VESTFOR_BASE).href;
    } else {
      return { resp, cookies };
    }
  }

  throw new Error('For mange omdirigeringer fra Vestfor');
}

/**
 * Visit MinSide for the given address in a fresh session and remember its cookies.
 */
async function establishSession(addressId) {
  const url = `${VESTFOR_BASE}/Home/MinSide?address-selected-id=${encodeURIComponent(addressId)}`;
  const { cookies } = await fetchFollowingRedirects(url);
  sessions.set(addressId, cookies);
  return cookies;
}

/**
 * Fetch tømmedatoer for the next 12 months.
 * Automatically retries once by re-establishing the session if the response
 * is not a valid JSON array (session expired / never set).
 */
async function fetchTommeDates(addressId, retry = true) {
  const cookies = sessions.get(addressId) || await establishSession(addressId);
  const now    = new Date();
  const future = new Date(now);
  future.setFullYear(future.getFullYear() + 1);

  const start = now.toISOString().slice(0, 10);
  const end   = future.toISOString().slice(0, 10);
  const url   = `${VESTFOR_BASE}/Adresse/ToemmeDates?start=${start}&end=${end}`;

  const resp = await fetchWithTimeout(url, {
    headers: {
      'Cookie':            cookieString(cookies),
      'Referer':           `${VESTFOR_BASE}/Home/MinSide?address-selected-id=${addressId}`,
      'Accept':            'application/json',
      'X-Requested-With':  'XMLHttpRequest',
      'User-Agent':        'Mozilla/5.0 (compatible; Skraldetomning/1.0)',
    },
  });

  const text = await resp.text();

  try {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data;
    // Got an object/error – fall through to retry
  } catch {
    // Non-JSON response (usually HTML redirect to login) – retry
  }

  if (retry) {
    await establishSession(addressId);
    return fetchTommeDates(addressId, false);
  }

  throw new Error('Kunne ikke hente data fra Vestfor (ugyldigt svar)');
}

/** Slår HOME_ADDRESS op hos Vestfor én gang. null, hvis den ikke er sat. */
async function resolveHome() {
  if (!HOME_ADDRESS) return null;
  if (home) return home;
  const r = await fetchWithTimeout(
    `${VESTFOR_BASE}/Adresse/AddressByName?term=${encodeURIComponent(HOME_ADDRESS)}&numberOfResults=10`,
    { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }
  );
  const list = await r.json();
  const norm = s => String(s || '').toLowerCase().replace(/s+/g, ' ').trim();
  const hit  = list.find(a => norm(a.FuldtVejnavn) === norm(HOME_ADDRESS)) || (list.length === 1 ? list[0] : null);
  if (!hit) throw new Error(`Hjemmeadressen "${HOME_ADDRESS}" blev ikke fundet hos Vestfor`);
  home = { id: hit.Id, navn: hit.FuldtVejnavn, postnr: hit.Postnr };
  return home;
}

/** Den viste adresse: den gemte, ellers hjemmet. */
async function ensureAddressLoaded() {
  if (currentAddressId) return;
  if (fs.existsSync(SAVED_ADDRESS_FILE)) {
    currentAddressId = JSON.parse(fs.readFileSync(SAVED_ADDRESS_FILE, 'utf8')).id;
  } else {
    currentAddressId = (await resolveHome().catch(() => null))?.id ?? null;
  }
}

/** Tømmedatoer med ikonet pr. affaldstype, så hub'ens forside viser de samme ikoner som appen. */
const withIcons = dates => dates.map(ev => ({ ...ev, icon: wasteType(ev.title).icon }));

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/saved-address
app.get('/api/saved-address', async (req, res) => {
  if (fs.existsSync(SAVED_ADDRESS_FILE)) {
    res.json(JSON.parse(fs.readFileSync(SAVED_ADDRESS_FILE, 'utf8')));
  } else {
    res.json(await resolveHome().catch(() => null));
  }
});

// GET /api/home – hjemmeadressen fra HOME_ADDRESS (null, hvis den ikke er sat)
app.get('/api/home', async (req, res) => {
  try {
    res.json(await resolveHome());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/home/dates – tømmedatoer for hjemmet, uanset hvilken adresse appen viser
app.get('/api/home/dates', async (req, res) => {
  try {
    const h = await resolveHome();
    if (!h) return res.status(404).json({ error: 'HOME_ADDRESS er ikke sat' });
    res.json(withIcons(await fetchTommeDates(h.id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/search?term=…
app.get('/api/search', async (req, res) => {
  const term = (req.query.term || '').trim();
  if (!term) return res.json([]);

  try {
    const r = await fetchWithTimeout(
      `${VESTFOR_BASE}/Adresse/AddressByName?term=${encodeURIComponent(term)}&numberOfResults=100`,
      { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }
    );
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/set-address  { id, navn, postnr }
app.post('/api/set-address', async (req, res) => {
  const { id, navn, postnr } = req.body;
  if (!id) return res.status(400).json({ error: 'Mangler adresse-ID' });

  try {
    await establishSession(id);
    currentAddressId = id;
    fs.writeFileSync(SAVED_ADDRESS_FILE, JSON.stringify({ id, navn, postnr }, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dates
app.get('/api/dates', async (req, res) => {
  await ensureAddressLoaded();
  if (!currentAddressId) return res.status(400).json({ error: 'Ingen adresse valgt' });

  try {
    res.json(withIcons(await fetchTommeDates(currentAddressId)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/calendar.ics
app.get('/api/calendar.ics', async (req, res) => {
  await ensureAddressLoaded();
  if (!currentAddressId) return res.status(400).send('Ingen adresse valgt');

  try {
    const dates  = await fetchTommeDates(currentAddressId);
    const events = dates.map(ev => {
      const ymd        = ev.start.slice(0, 10).replace(/-/g, '');  // "20250422"
      const { icon }   = wasteType(ev.title);
      // RFC 5545 text escaping: backslash, semicolon, comma must be escaped
      const summary    = `${icon} ${ev.title}`.replace(/[\\;,]/g, '\\$&');
      return {
        uid:     `${ymd}-${uidToken(ev.title)}@skraldetomning.local`,
        start:   `${ymd}T060000`,
        end:     `${ymd}T063000`,
        summary,
      };
    });

    const ics = buildIcs(events);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="skraldetomning.ics"');
    res.send(ics);
  } catch (err) {
    res.status(500).send('Fejl: ' + err.message);
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  Skraldetømningsapp kører på  http://localhost:${PORT}\n`);
});
