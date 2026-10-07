import { describe, expect, it } from "vitest";
import { buildIcs, eventsFromDates, foldLine, uidToken } from "./ics.ts";

describe("uidToken", () => {
  it("gør titlen sikker til et UID (RFC 5545): ingen /, mellemrum eller danske bogstaver", () => {
    expect(uidToken("Mad/Rest affald")).toBe("mad-rest-affald");
    expect(uidToken("Papir/Plast & MDK")).toBe("papir-plast-mdk");
    expect(uidToken("")).toBe("event");
  });
});

describe("foldLine", () => {
  it("lader korte linjer være og folder lange ved 75 oktetter uden at klippe et tegn over", () => {
    expect(foldLine("SUMMARY:kort")).toBe("SUMMARY:kort");
    const long = "SUMMARY:" + "æøå".repeat(40);
    const lines = foldLine(long).split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
    for (const [i, l] of lines.entries()) {
      expect(Buffer.byteLength(i === 0 ? l : l.slice(1))).toBeLessThanOrEqual(i === 0 ? 75 : 74);
      if (i > 0) expect(l.startsWith(" ")).toBe(true);
    }
    expect(lines.map((l, i) => (i === 0 ? l : l.slice(1))).join("")).toBe(long);
  });
});

describe("eventsFromDates", () => {
  it("lægger begivenheden kl. 06:00-06:30 på tømmedagen med ikon og escapet tekst", () => {
    const [ev] = eventsFromDates([{ start: "2026-10-13T00:00:00", title: "Papir/Plast, MDK" }]);
    expect(ev).toEqual({
      uid: "20261013-papir-plast-mdk@skraldetomning.local",
      start: "20261013T060000",
      end: "20261013T063000",
      summary: "📄 Papir/Plast\\, MDK",
    });
  });
});

describe("buildIcs", () => {
  it("giver en gyldig kalender med fri tid og påmindelse aftenen før", () => {
    const ics = buildIcs(eventsFromDates([{ start: "2026-10-13", title: "Pap" }, { start: "2026-10-20", title: "Haveaffald" }]));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("X-MICROSOFT-CDO-BUSYSTATUS:FREE");
    expect(ics).toContain("TRIGGER:-PT9H30M");
    expect(ics).toContain("DTSTART;TZID=Europe/Copenhagen:20261013T060000");
  });

  it("virker uden begivenheder", () => {
    expect(buildIcs([])).not.toContain("BEGIN:VEVENT");
  });
});
