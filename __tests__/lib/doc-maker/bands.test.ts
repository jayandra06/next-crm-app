import {
  chooseBands,
  contactLinesFromText,
  dividerBandInHeader,
  extendHeaderPastDivider,
  footerStartAtSolidBar,
  headerEndAfterDivider,
  sideMarginRatio,
} from "@/lib/doc-maker/bands";

function inkRows(height: number, headerUntil: number, footerFrom: number): boolean[] {
  return Array.from({ length: height }, (_, y) => y < headerUntil || y >= footerFrom);
}

describe("chooseBands", () => {
  it("cuts the header and footer around the empty middle", () => {
    const bands = chooseBands(inkRows(200, 40, 170));
    expect(bands.headerEnd).toBeGreaterThan(30);
    expect(bands.headerEnd).toBeLessThan(55);
    expect(bands.footerStart).toBeGreaterThan(155);
    expect(bands.footerStart).toBeLessThan(175);
  });

  it("uses a default split when the page is full of ink", () => {
    const bands = chooseBands(Array.from({ length: 100 }, () => true));
    expect(bands.headerEnd).toBe(22);
    expect(bands.footerStart).toBe(86);
  });
});

describe("header divider", () => {
  it("keeps the rule that sits in the gap under the logo", () => {
    const coverage = Array.from({ length: 200 }, () => 0);
    for (let y = 20; y < 50; y += 1) coverage[y] = 0.2;
    for (let y = 70; y < 76; y += 1) coverage[y] = 0.8;
    const extended = extendHeaderPastDivider(coverage, 58);
    expect(extended).toBeGreaterThanOrEqual(76);
    expect(extended).toBeLessThan(85);
    const band = dividerBandInHeader(coverage, extended);
    expect(band).toEqual({ top: 70, bottom: 75 });
  });

  it("stops the header after the rule and starts the footer at the colour bar", () => {
    const coverage = Array.from({ length: 400 }, () => 0.05);
    for (let y = 40; y < 70; y += 1) coverage[y] = 0.25;
    for (let y = 80; y < 86; y += 1) coverage[y] = 0.9;
    for (let y = 100; y < 130; y += 1) coverage[y] = 0.3;
    for (let y = 360; y < 395; y += 1) coverage[y] = 1;
    expect(headerEndAfterDivider(coverage)).toBe(89);
    expect(footerStartAtSolidBar(coverage)).toBe(358);
  });

  it("leaves the header alone when there is no full-width rule", () => {
    const coverage = Array.from({ length: 200 }, (_, y) => (y < 40 ? 0.2 : 0));
    expect(extendHeaderPastDivider(coverage, 46)).toBe(46);
    expect(dividerBandInHeader(coverage, 46)).toBeNull();
  });
});

describe("letterhead text", () => {
  it("keeps the contact lines at the top and bottom", () => {
    const lines = contactLinesFromText(
      "VenSai Labs\nhello@vensai.example\n\nThis is the old sample body that should not lead.\n\nCity\n+91 90000 00000"
    );
    expect(lines[0]).toBe("VenSai Labs");
    expect(lines.some((line) => line.includes("hello@vensai.example"))).toBe(true);
    expect(lines.some((line) => line.includes("+91"))).toBe(true);
    expect(lines.some((line) => line.includes("old sample body"))).toBe(false);
    expect(contactLinesFromText("OFFER LETTER\nDate: 23 October 2026\nCIN:-U72900AP2022PTC122120")).toEqual([
      "CIN:-U72900AP2022PTC122120",
    ]);
  });

  it("reads the quiet side margin", () => {
    const cols = Array.from({ length: 100 }, (_, i) => i >= 10 && i <= 89);
    expect(sideMarginRatio(cols)).toBeCloseTo(0.1);
  });
});
