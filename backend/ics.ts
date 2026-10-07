import type { WasteDate } from "../shared/types.ts";
import { wasteType } from "../shared/waste-types.ts";

export interface IcsEvent {
  uid: string;
  start: string;
  end: string;
  summary: string;
}

// Build a stable RFC-5545-safe UID token from event title.
export const uidToken = (text: unknown): string =>
  String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "") || "event";

/**
 * Fold a single ICS content line at 75 octets per RFC 5545 §3.1.
 * Continuation lines are prefixed with a single SPACE.
 */
export const foldLine = (line: string): string => {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let offset = 0;
  let maxBytes = 75; // first chunk: 75 octets
  while (offset < bytes.length) {
    let end = Math.min(offset + maxBytes, bytes.length);
    // Back up if we're in the middle of a multi-byte UTF-8 sequence
    while (end > offset && ((bytes[end] ?? 0) & 0xc0) === 0x80) end--;
    parts.push(bytes.subarray(offset, end).toString("utf8"));
    offset = end;
    maxBytes = 74; // continuation chunks: 74 octets (1 reserved for leading space)
  }
  return parts.join("\r\n ");
};

/**
 * Build a fully validated ICS string from a list of event objects.
 * Throws if BEGIN:VEVENT / END:VEVENT counts don't match or
 * END:VCALENDAR is missing.
 */
export const buildIcs = (events: IcsEvent[]): string => {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Skraldetomning//DA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Skraldetømning",
    "X-WR-TIMEZONE:Europe/Copenhagen",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Copenhagen",
    "X-LIC-LOCATION:Europe/Copenhagen",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0200",
    "TZNAME:CEST",
    "DTSTART:19700329T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "TZNAME:CET",
    "DTSTART:19701025T030000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  for (const ev of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}`,
      `DTSTART;TZID=Europe/Copenhagen:${ev.start}`,
      `DTEND;TZID=Europe/Copenhagen:${ev.end}`,
      `SUMMARY:${ev.summary}`,
      "TRANSP:TRANSPARENT",
      "X-MICROSOFT-CDO-BUSYSTATUS:FREE",
      "X-MICROSOFT-CDO-INTENDEDSTATUS:FREE",
      "BEGIN:VALARM",
      "TRIGGER:-PT9H30M",
      "ACTION:DISPLAY",
      "DESCRIPTION:Tømning i morgen",
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  // ── Structural validation ─────────────────────────────────────────────────
  const begins = lines.filter((l) => l === "BEGIN:VEVENT").length;
  const ends = lines.filter((l) => l === "END:VEVENT").length;
  if (begins !== ends) {
    throw new Error(`ICS struktur ugyldig: ${begins} BEGIN:VEVENT / ${ends} END:VEVENT`);
  }
  if (lines[lines.length - 1] !== "END:VCALENDAR") {
    throw new Error("ICS struktur ugyldig: mangler END:VCALENDAR");
  }

  return lines.map(foldLine).join("\r\n") + "\r\n";
};

/** Tømmedatoerne som kalenderbegivenheder kl. 06:00–06:30 på tømmedagen. */
export const eventsFromDates = (dates: WasteDate[]): IcsEvent[] =>
  dates.map((ev) => {
    const ymd = ev.start.slice(0, 10).replace(/-/g, ""); // "20250422"
    const { icon } = wasteType(ev.title);
    // RFC 5545 text escaping: backslash, semicolon, comma must be escaped
    const summary = `${icon} ${ev.title}`.replace(/[\\;,]/g, "\\$&");
    return {
      uid: `${ymd}-${uidToken(ev.title)}@skraldetomning.local`,
      start: `${ymd}T060000`,
      end: `${ymd}T063000`,
      summary,
    };
  });
