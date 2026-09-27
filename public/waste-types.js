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

const WASTE_TYPES = [
  { test: t => t.includes('dagrenovation'),
    icon: '🗑️', cls: 'type-dagrenov',    color: '#94A3B8', bg: '#F1F5F9', fg: '#475569' },
  { test: t => t.includes('papir'),
    icon: '📄', cls: 'type-papir',       color: '#3B82F6', bg: '#DBEAFE', fg: '#1D4ED8' },
  { test: t => t.includes('pap'),
    icon: '📦', cls: 'type-pap',         color: '#A16207', bg: '#FEF9C3', fg: '#78350F' },
  { test: t => t.includes('glas'),
    icon: '🍾', cls: 'type-glas',        color: '#14B8A6', bg: '#CCFBF1', fg: '#134E4A' },
  { test: t => t.includes('plast') && t.includes('metal'),
    icon: '♻️', cls: 'type-plast-metal', color: '#F59E0B', bg: '#FEF3C7', fg: '#78350F' },
  { test: t => t.includes('plast'),
    icon: '♻️', cls: 'type-plast',       color: '#FBBF24', bg: '#FEF9C3', fg: '#713F12' },
  { test: t => t.includes('metal'),
    icon: '🔩', cls: 'type-metal',       color: '#F97316', bg: '#FFEDD5', fg: '#7C2D12' },
  { test: t => t.includes('haveaffald') || t.includes('have'),
    icon: '🌿', cls: 'type-have',        color: '#22C55E', bg: '#DCFCE7', fg: '#14532D' },
  { test: t => t.includes('madaffald') || t.includes('mad'),
    icon: '🍕', cls: 'type-mad',         color: '#84CC16', bg: '#ECFCCB', fg: '#365314' },
  { test: t => t.includes('restaffald'),
    icon: '⚫', cls: 'type-rest',        color: '#6B7280', bg: '#F3F4F6', fg: '#374151' },
  { test: t => t.includes('storskrald'),
    icon: '🛋️', cls: 'type-stor',        color: '#D97706', bg: '#FEF3C7', fg: '#78350F' },
  { test: t => t.includes('farlig'),
    icon: '⚠️', cls: 'type-farlig',      color: '#EF4444', bg: '#FEE2E2', fg: '#991B1B' },
];

const DEFAULT_WASTE_TYPE = {
  icon: '🗓️', cls: 'type-default', color: '#CBD5E0', bg: '#F1F5F9', fg: '#4A5568',
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
