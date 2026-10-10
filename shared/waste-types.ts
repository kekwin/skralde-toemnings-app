// ── Waste-type metadata ────────────────────────────────────────────────────
// Single source of truth for icon / colours per waste type, shared by the server (backend/app.ts),
// the main page (src/main.ts) and the print page (src/print.ts).
//
// icon  – emoji, used where only text works (the calendar feed, /api/dates for the front page)
// fa    – Font Awesome Free icon (Solid) shown on the pages; the repo is public, so never Pro (summer-hub/design/fontawesome-free)
// cls   – CSS class used by src/main.ts + style.css (--row-color / --badge-*)
// color – left-border colour, used directly by the print page
// bg/fg – badge background/text colour, used directly by the print page
//
// Colours are the Sommer palette (summer-hub/docs/FARVER.md): colour = the palette hue,
// bg = its tint on the light surface, fg = ink. style.css uses the same palette via CSS variables.

export interface WasteType {
  icon: string;
  fa: string;
  cls: string;
  color: string;
  bg: string;
  fg: string;
}

const INK = "#1C1A17";

const WASTE_TYPES: (WasteType & { test: (t: string) => boolean })[] = [
  { test: (t) => t.includes("dagrenovation"), icon: "🗑️", fa: "trash-alt", cls: "type-dagrenov", color: "#8A857A", bg: "#F1EEE7", fg: INK },
  { test: (t) => t.includes("papir"), icon: "📄", fa: "newspaper", cls: "type-papir", color: "#2F6FD0", bg: "#E4EBF4", fg: INK },
  { test: (t) => t.includes("pap"), icon: "📦", fa: "box", cls: "type-pap", color: "#E0A100", bg: "#FAEFD4", fg: INK },
  { test: (t) => t.includes("glas"), icon: "🍾", fa: "wine-bottle", cls: "type-glas", color: "#14A38B", bg: "#E0F1EB", fg: INK },
  { test: (t) => t.includes("plast") && t.includes("metal"), icon: "♻️", fa: "recycle", cls: "type-plast-metal", color: "#C8579B", bg: "#F8E7ED", fg: INK },
  { test: (t) => t.includes("plast"), icon: "♻️", fa: "recycle", cls: "type-plast", color: "#C8579B", bg: "#F8E7ED", fg: INK },
  { test: (t) => t.includes("metal"), icon: "🔩", fa: "cog", cls: "type-metal", color: "#E8603C", bg: "#FCE9E0", fg: INK },
  { test: (t) => t.includes("haveaffald") || t.includes("have"), icon: "🌿", fa: "leaf", cls: "type-have", color: "#3F8F2A", bg: "#E6EFDE", fg: INK },
  { test: (t) => t.includes("madaffald") || t.includes("mad"), icon: "🍕", fa: "apple-alt", cls: "type-mad", color: "#3F8F2A", bg: "#E6EFDE", fg: INK },
  { test: (t) => t.includes("restaffald"), icon: "⚫", fa: "trash", cls: "type-rest", color: "#57534B", bg: "#F1EEE7", fg: INK },
  { test: (t) => t.includes("storskrald"), icon: "🛋️", fa: "couch", cls: "type-stor", color: "#6A4FC9", bg: "#ECE6F3", fg: INK },
  { test: (t) => t.includes("farlig"), icon: "⚠️", fa: "exclamation-triangle", cls: "type-farlig", color: "#D6404E", bg: "#FAE4E3", fg: INK },
];

const DEFAULT_WASTE_TYPE: WasteType = { icon: "🗓️", fa: "calendar-alt", cls: "type-default", color: "#CFC8BA", bg: "#F1EEE7", fg: INK };

/** Classify a Vestfor event title into { icon, fa, cls, color, bg, fg }. */
export const wasteType = (title: unknown): WasteType => {
  const t = String(title || "").toLowerCase();
  for (const { test, ...type } of WASTE_TYPES) {
    if (test(t)) return type;
  }
  return DEFAULT_WASTE_TYPE;
};
