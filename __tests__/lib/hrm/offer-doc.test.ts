import { clampOfferMargins, pdfFontName } from "@/lib/hrm/offer-doc";
import { sanitizeOfferHtml } from "@/lib/hrm/offer-html";

describe("offer letter doc", () => {
  it("keeps margins inside a small range", () => {
    expect(clampOfferMargins({ top: 0, right: 400, bottom: "18", left: null })).toEqual({
      top: 8,
      right: 96,
      bottom: 18,
      left: 40,
    });
  });

  it("turns a plain paste into paragraphs and drops scripts", () => {
    expect(sanitizeOfferHtml("Hello\n\nThere")).toBe("<p>Hello</p><p>There</p>");
    expect(sanitizeOfferHtml("<p>Ok</p><script>alert(1)</script>")).toBe("<p>Ok</p>");
  });

  it("maps a light set of fonts onto the PDF faces", () => {
    expect(pdfFontName("Arial", true, false)).toBe("Helvetica-Bold");
    expect(pdfFontName("Times New Roman", false, true)).toBe("Times-Italic");
    expect(pdfFontName("times", true, true)).toBe("Times-BoldItalic");
  });
});
