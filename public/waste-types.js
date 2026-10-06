'use strict';

// ── Waste-type metadata ────────────────────────────────────────────────────
// Single source of truth for icon / colours per waste type, shared by
// server.js (Node, via require) and the browser (public/app.js,
// public/print.html, via a <script> tag).
//
// icon  – emoji shown next to the event
// cls   – CSS class used by public/app.js + style.css (--row-color / --badge-*)
// color – left-border colour, used directly by public/print.html
// bg/fg – badge background/text colour, used directly by public/print.html
//
// Colours are the Sommer palette (summer-hub/docs/FARVER.md): colour = the palette hue,
// bg = its tint on the light surface, fg = ink. style.css uses the same palette via CSS variables.

const WASTE_TYPES = [
  { test: t => t.includes('dagrenovation'),
    icon: '🗑️', cls: 'type-dagrenov',    color: '#8A857A', bg: '#F1EEE7', fg: '#1C1A17' },
  { test: t => t.includes('papir'),
    icon: '📄', cls: 'type-papir',       color: '#2F6FD0', bg: '#E4EBF4', fg: '#1C1A17' },
  { test: t => t.includes('pap'),
    icon: '📦', cls: 'type-pap',         color: '#E0A100', bg: '#FAEFD4', fg: '#1C1A17' },
  { test: t => t.includes('glas'),
    icon: '🍾', cls: 'type-glas',        color: '#14A38B', bg: '#E0F1EB', fg: '#1C1A17' },
  { test: t => t.includes('plast') && t.includes('metal'),
    icon: '♻️', cls: 'type-plast-metal', color: '#C8579B', bg: '#F8E7ED', fg: '#1C1A17' },
  { test: t => t.includes('plast'),
    icon: '♻️', cls: 'type-plast',       color: '#C8579B', bg: '#F8E7ED', fg: '#1C1A17' },
  { test: t => t.includes('metal'),
    icon: '🔩', cls: 'type-metal',       color: '#E8603C', bg: '#FCE9E0', fg: '#1C1A17' },
  { test: t => t.includes('haveaffald') || t.includes('have'),
    icon: '🌿', cls: 'type-have',        color: '#3F8F2A', bg: '#E6EFDE', fg: '#1C1A17' },
  { test: t => t.includes('madaffald') || t.includes('mad'),
    icon: '🍕', cls: 'type-mad',         color: '#3F8F2A', bg: '#E6EFDE', fg: '#1C1A17' },
  { test: t => t.includes('restaffald'),
    icon: '⚫', cls: 'type-rest',        color: '#57534B', bg: '#F1EEE7', fg: '#1C1A17' },
  { test: t => t.includes('storskrald'),
    icon: '🛋️', cls: 'type-stor',        color: '#6A4FC9', bg: '#ECE6F3', fg: '#1C1A17' },
  { test: t => t.includes('farlig'),
    icon: '⚠️', cls: 'type-farlig',      color: '#D6404E', bg: '#FAE4E3', fg: '#1C1A17' },
];

const DEFAULT_WASTE_TYPE = {
  icon: '🗓️', cls: 'type-default', color: '#CFC8BA', bg: '#F1EEE7', fg: '#1C1A17',
};

/** Classify a Vestfor event title into { icon, cls, color, bg, fg }. */
function wasteType(title) {
  const t = String(title || '').toLowerCase();
  for (const entry of WASTE_TYPES) {
    if (entry.test(t)) return entry;
  }
  return DEFAULT_WASTE_TYPE;
}

// Export for Node (server.js: `const { wasteType } = require('./public/waste-types.js')`)
// and for the browser (public/app.js, public/print.html: plain global `wasteType`).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { wasteType };
} else {
  window.wasteType = wasteType;
}
