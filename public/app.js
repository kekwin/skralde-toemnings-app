'use strict';

// ── Danish locale data ────────────────────────────────────────────────────────
const DAYS_SHORT  = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
const MONTHS_DA   = ['januar','februar','marts','april','maj','juni',
                     'juli','august','september','oktober','november','december'];
const MONTHS_FULL = ['Januar','Februar','Marts','April','Maj','Juni',
                     'Juli','August','September','Oktober','November','December'];

// ── Waste-type classifier ─────────────────────────────────────────────────────
function classifyType(title) {
  const t = title.toLowerCase();
  if (t.includes('dagrenovation'))                 return { icon: '🗑️',  cls: 'type-dagrenov' };
  if (t.includes('papir'))                         return { icon: '📄',  cls: 'type-papir'      };
  if (t.includes('pap'))                           return { icon: '📦',  cls: 'type-pap'        };
  if (t.includes('glas'))                          return { icon: '🍾',  cls: 'type-glas' };
  if (t.includes('plast') && t.includes('metal'))  return { icon: '♻️',  cls: 'type-plast-metal' };
  if (t.includes('plast'))                         return { icon: '♻️',  cls: 'type-plast' };
  if (t.includes('metal'))                         return { icon: '🔩',  cls: 'type-metal' };
  if (t.includes('haveaffald') || t.includes('have')) return { icon: '🌿',  cls: 'type-have' };
  if (t.includes('madaffald')  || t.includes('mad'))  return { icon: '🍕', cls: 'type-mad'   };
  if (t.includes('restaffald'))                    return { icon: '⚫',  cls: 'type-rest' };
  if (t.includes('storskrald'))                    return { icon: '🛋️',  cls: 'type-stor' };
  if (t.includes('farlig'))                        return { icon: '⚠️',  cls: 'type-farlig' };
  return                                                  { icon: '🗓️',  cls: 'type-default' };
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Parse "2025-04-22T00:00:00" (or "2025-04-22") without timezone drift. */
function parseLocalDate(dateStr) {
  const [datePart] = dateStr.split('T');
  const [y, m, d]  = datePart.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Returns { key, label } for grouping by month. */
function getMonthKey(dateStr) {
  const d = parseLocalDate(dateStr);
  return {
    key:   `${d.getFullYear()}-${d.getMonth()}`,
    label: `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`,
  };
}

/**
 * Returns { label, cls } for an urgency pill if the event is within 3 days.
 * Returns null otherwise.
 */
function getUrgency(dateStr) {
  const event = parseLocalDate(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((event - today) / 864e5);
  if (diff === 0) return { label: 'I dag',         cls: 'today'    };
  if (diff === 1) return { label: 'I morgen',      cls: 'tomorrow' };
  if (diff === 2) return { label: 'Om 2 dage',     cls: 'soon'     };
  if (diff === 3) return { label: 'Om 3 dage',     cls: 'soon'     };
  return null;
}

// ── Security ──────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const searchInput      = document.getElementById('search-input');
const autocompleteEl   = document.getElementById('autocomplete');
const headerSubtitle   = document.getElementById('current-address');
const searchSection    = document.getElementById('search-section');
const loadingEl        = document.getElementById('loading');
const errorCard        = document.getElementById('error-msg');
const errorText        = document.getElementById('error-text');
const retryBtn         = document.getElementById('retry-btn');
const datesSection     = document.getElementById('dates-section');
const datesList        = document.getElementById('dates-list');
const actionBar        = document.getElementById('action-bar');
const refreshBtn       = document.getElementById('refresh-btn');
const changeAddressBtn = document.getElementById('change-address-btn');

// ── App state ─────────────────────────────────────────────────────────────────
let currentAddress = null;
let searchTimer    = null;

// ── View helpers ──────────────────────────────────────────────────────────────
function showSearchView() {
  searchSection.classList.remove('hidden');
  datesSection.classList.add('hidden');
  actionBar.classList.add('hidden');
  errorCard.classList.add('hidden');
  headerSubtitle.textContent = 'Søg din adresse for at se tømmedatoer';
  searchInput.focus();
}

function showDatesView() {
  if (currentAddress) {
    const postnr = currentAddress.postnr ? `, ${currentAddress.postnr}` : '';
    headerSubtitle.textContent = `📍 ${currentAddress.navn || ''}${postnr}`;
  }
  searchSection.classList.add('hidden');
  datesSection.classList.remove('hidden');
  actionBar.classList.remove('hidden');
}

function showError(msg) {
  errorText.textContent = msg;
  errorCard.classList.remove('hidden');
  loadingEl.classList.add('hidden');
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadDates() {
  loadingEl.classList.remove('hidden');
  errorCard.classList.add('hidden');
  datesList.innerHTML = '';

  try {
    const r = await fetch('/api/dates');
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      throw new Error(err.error || `HTTP ${r.status}`);
    }
    const dates = await r.json();
    renderDates(dates);
  } catch (e) {
    showError(e.message);
  } finally {
    loadingEl.classList.add('hidden');
  }
}

// ── Rendering ─────────────────────────────────────────────────────────────────
function renderDates(dates) {
  if (!dates.length) {
    datesList.innerHTML = '<p class="empty-msg">Ingen tømninger fundet i de næste 6 måneder.</p>';
    return;
  }

  // Group by month
  const groups = new Map();
  for (const ev of dates) {
    const { key, label } = getMonthKey(ev.start);
    if (!groups.has(key)) groups.set(key, { label, events: [] });
    groups.get(key).events.push(ev);
  }

  let html = '';
  for (const [, { label, events }] of groups) {
    html += `<div class="month-group">
      <h2 class="month-header">${escapeHtml(label)}</h2>
      <div class="events-card">`;

    for (const ev of events) {
      const { icon, cls } = classifyType(ev.title);
      const d        = parseLocalDate(ev.start);
      const dayShort = DAYS_SHORT[d.getDay()];
      const dayNum   = d.getDate();
      const urgency  = getUrgency(ev.start);
      const urgHtml  = urgency
        ? `<span class="urgent ${urgency.cls}">${urgency.label}</span>`
        : '';

      html += `<div class="event-row ${cls}">
        <div class="event-date">
          <span class="event-day">${dayShort}</span>
          <span class="event-daynum">${dayNum}.</span>
        </div>
        <div class="event-badge">
          <span class="event-icon" aria-hidden="true">${icon}</span>
          <span class="event-title">${escapeHtml(ev.title)}</span>
        </div>
        ${urgHtml}
      </div>`;
    }

    html += `</div></div>`;
  }

  datesList.innerHTML = html;

  // Staggered fade-in animation
  datesList.querySelectorAll('.event-row').forEach((el, i) => {
    el.style.animationDelay = `${i * 22}ms`;
  });
}

// ── Autocomplete search ───────────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  const term = searchInput.value.trim();
  clearTimeout(searchTimer);
  if (term.length < 2) {
    autocompleteEl.classList.add('hidden');
    return;
  }
  searchTimer = setTimeout(() => doSearch(term), 300);
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    autocompleteEl.classList.add('hidden');
  }
});

document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrapper')) {
    autocompleteEl.classList.add('hidden');
  }
});

async function doSearch(term) {
  try {
    const r       = await fetch(`/api/search?term=${encodeURIComponent(term)}`);
    const results = await r.json();
    renderAutocomplete(results);
  } catch {
    autocompleteEl.classList.add('hidden');
  }
}

function renderAutocomplete(results) {
  if (!results.length) {
    autocompleteEl.classList.add('hidden');
    return;
  }

  autocompleteEl.innerHTML = results.slice(0, 10).map(r => `
    <div class="autocomplete-item" role="option" tabindex="0"
         data-id="${escapeHtml(r.Id)}"
         data-navn="${escapeHtml(r.FuldtVejnavn)}"
         data-postnr="${escapeHtml(r.Postnr || '')}">
      <span class="ac-icon" aria-hidden="true">📍</span>
      <span class="ac-name">${escapeHtml(r.FuldtVejnavn)}</span>
      ${r.Postnr ? `<span class="ac-postnr">${escapeHtml(r.Postnr)}</span>` : ''}
    </div>
  `).join('');

  autocompleteEl.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('click',  () => selectAddress(item.dataset));
    item.addEventListener('keydown', e => { if (e.key === 'Enter') selectAddress(item.dataset); });
  });

  autocompleteEl.classList.remove('hidden');
}

// ── Address selection ─────────────────────────────────────────────────────────
async function selectAddress({ id, navn, postnr }) {
  autocompleteEl.classList.add('hidden');
  searchInput.value = '';
  loadingEl.classList.remove('hidden');
  errorCard.classList.add('hidden');

  try {
    const r = await fetch('/api/set-address', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, navn, postnr }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || 'Kunne ikke sætte adresse');
    }
    currentAddress = { id, navn, postnr };
    showDatesView();
    await loadDates();
  } catch (e) {
    loadingEl.classList.add('hidden');
    showError(e.message);
  }
}

// ── Button handlers ───────────────────────────────────────────────────────────
refreshBtn.addEventListener('click', loadDates);
changeAddressBtn.addEventListener('click', showSearchView);

retryBtn.addEventListener('click', () => {
  errorCard.classList.add('hidden');
  if (currentAddress) {
    showDatesView();
    loadDates();
  } else {
    showSearchView();
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const r     = await fetch('/api/saved-address');
    const saved = await r.json();
    if (saved?.id) {
      currentAddress = saved;
      showDatesView();
      loadDates();          // auto-retry in server handles stale/missing cookie
    } else {
      showSearchView();
    }
  } catch {
    showSearchView();
  }
}

init();
