'use strict';

const express = require('express');
const fetch   = require('node-fetch');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = 3000;

const DATA_DIR           = path.join(__dirname, 'data');
const SAVED_ADDRESS_FILE = path.join(DATA_DIR, 'saved-address.json');
const VESTFOR_BASE       = 'https://selvbetjening.vestfor.dk';

// ── Waste type metadata ───────────────────────────────────────────────────────
function wasteType(title) {
  const t = title.toLowerCase();
  if (t.includes('dagrenovation'))                 return { icon: '🗑️', color: '#94A3B8', bg: '#F1F5F9', fg: '#475569' };
  if (t.includes('papir'))                         return { icon: '📄', color: '#3B82F6', bg: '#DBEAFE', fg: '#1D4ED8' };
  if (t.includes('pap'))                           return { icon: '📦', color: '#A16207', bg: '#FEF9C3', fg: '#78350F' };
  if (t.includes('glas'))                          return { icon: '🍾', color: '#14B8A6', bg: '#CCFBF1', fg: '#134E4A' };
  if (t.includes('plast') && t.includes('metal'))  return { icon: '♻️', color: '#F59E0B', bg: '#FEF3C7', fg: '#78350F' };
  if (t.includes('plast'))                         return { icon: '♻️', color: '#FBBF24', bg: '#FEF9C3', fg: '#713F12' };
  if (t.includes('metal'))                         return { icon: '🔩', color: '#F97316', bg: '#FFEDD5', fg: '#7C2D12' };
  if (t.includes('haveaffald') || t.includes('have')) return { icon: '🌿', color: '#22C55E', bg: '#DCFCE7', fg: '#14532D' };
  if (t.includes('madaffald')  || t.includes('mad'))  return { icon: '🍕', color: '#84CC16', bg: '#ECFCCB', fg: '#365314' };
  if (t.includes('restaffald'))                    return { icon: '⚫', color: '#6B7280', bg: '#F3F4F6', fg: '#374151' };
  if (t.includes('storskrald'))                    return { icon: '🛋️', color: '#D97706', bg: '#FEF3C7', fg: '#78350F' };
  if (t.includes('farlig'))                        return { icon: '⚠️', color: '#EF4444', bg: '#FEE2E2', fg: '#991B1B' };
  return                                                  { icon: '🗓️', color: '#CBD5E0', bg: '#F1F5F9', fg: '#4A5568' };
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
let sessionCookies  = {};   // { name: value, ... }
let currentAddressId = null;

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
  let cookies    = { ...sessionCookies };
  let currentUrl = startUrl;

  for (let hop = 0; hop < 10; hop++) {
    const resp = await fetch(currentUrl, {
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
 * Visit MinSide for the given address, collect all cookies, store globally.
 */
async function establishSession(addressId) {
  const url = `${VESTFOR_BASE}/Home/MinSide?address-selected-id=${encodeURIComponent(addressId)}`;
  const { cookies } = await fetchFollowingRedirects(url);
  sessionCookies   = cookies;
  currentAddressId = addressId;
}

/**
 * Fetch tømmedatoer for the next 12 months.
 * Automatically retries once by re-establishing the session if the response
 * is not a valid JSON array (session expired / never set).
 */
async function fetchTommeDates(retry = true) {
  const now    = new Date();
  const future = new Date(now);
  future.setFullYear(future.getFullYear() + 1);

  const start = now.toISOString().slice(0, 10);
  const end   = future.toISOString().slice(0, 10);
  const url   = `${VESTFOR_BASE}/Adresse/ToemmeDates?start=${start}&end=${end}`;

  const resp = await fetch(url, {
    headers: {
      'Cookie':            cookieString(sessionCookies),
      'Referer':           `${VESTFOR_BASE}/Home/MinSide?address-selected-id=${currentAddressId}`,
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

  if (retry && currentAddressId) {
    await establishSession(currentAddressId);
    return fetchTommeDates(false);
  }

  throw new Error('Kunne ikke hente data fra Vestfor (ugyldigt svar)');
}

/** Restore currentAddressId from disk and establish a fresh session if needed. */
async function ensureAddressLoaded() {
  if (!currentAddressId && fs.existsSync(SAVED_ADDRESS_FILE)) {
    const saved      = JSON.parse(fs.readFileSync(SAVED_ADDRESS_FILE, 'utf8'));
    currentAddressId = saved.id;
    // No session exists yet (e.g. server just started) – establish one now
    // so ToemmeDates gets a valid cookie on the very first call.
    await establishSession(currentAddressId);
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/saved-address
app.get('/api/saved-address', (req, res) => {
  if (fs.existsSync(SAVED_ADDRESS_FILE)) {
    res.json(JSON.parse(fs.readFileSync(SAVED_ADDRESS_FILE, 'utf8')));
  } else {
    res.json(null);
  }
});

// GET /api/search?term=…
app.get('/api/search', async (req, res) => {
  const term = (req.query.term || '').trim();
  if (!term) return res.json([]);

  try {
    const r = await fetch(
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
    const dates = await fetchTommeDates();
    res.json(dates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/calendar.ics
app.get('/api/calendar.ics', async (req, res) => {
  await ensureAddressLoaded();
  if (!currentAddressId) return res.status(400).send('Ingen adresse valgt');

  try {
    const dates  = await fetchTommeDates();
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
