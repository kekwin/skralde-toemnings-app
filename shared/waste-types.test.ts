import { describe, expect, it } from "vitest";
import { wasteType } from "./waste-types.ts";

describe("wasteType", () => {
  it("kender Vestfors affaldstyper", () => {
    expect(wasteType("Dagrenovation").cls).toBe("type-dagrenov");
    expect(wasteType("Mad/Rest affald").cls).toBe("type-mad");
    expect(wasteType("Haveaffald").icon).toBe("🌿");
    expect(wasteType("Storskrald").cls).toBe("type-stor");
    expect(wasteType("Farligt affald").cls).toBe("type-farlig");
  });

  it("papir og pap er to forskellige typer, og plast+metal står for sig", () => {
    expect(wasteType("Papir/Plast & MDK").cls).toBe("type-papir");
    expect(wasteType("Pap").cls).toBe("type-pap");
    expect(wasteType("Plast og metal").cls).toBe("type-plast-metal");
    expect(wasteType("Plast").cls).toBe("type-plast");
  });

  it("ukendte titler og tomme værdier får standardtypen", () => {
    expect(wasteType("Noget nyt").cls).toBe("type-default");
    expect(wasteType(undefined).cls).toBe("type-default");
    expect(wasteType(null).icon).toBe("🗓️");
  });
});
