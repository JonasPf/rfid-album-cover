import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createMetrics, type FontMetrics, type FontPair } from "./fontmetrics";
import { stickerGeometry } from "./geometry";
import { fitText, layoutAtSize, wrapText } from "./textfit";

const PT = 25.4 / 72;

/** Every character is half an em wide; ascent 0.8, descent -0.2. */
function fakeFont(): FontMetrics {
  return { widthOf: (text, size) => text.length * 0.5 * size, ascent: 0.8, descent: -0.2 };
}
const fake: FontPair = { regular: fakeFont(), bold: fakeFont() };

const inter: FontPair = {
  regular: createMetrics(readFileSync("src/assets/fonts/Inter-Regular.ttf")),
  bold: createMetrics(readFileSync("src/assets/fonts/Inter-Bold.ttf")),
};

const box = stickerGeometry(1.5).textBox; // 45 × 26.6 mm

describe("wrapText", () => {
  it("wraps at spaces, greedily", () => {
    // 10 pt: 5 pt per character; a 52 pt line holds 10 characters.
    const r = wrapText("aaa bbb ccc ddd", 52, 10, fakeFont());
    expect(r).toEqual({ lines: ["aaa bbb", "ccc ddd"], overflow: false });
  });

  it("collapses whitespace", () => {
    expect(wrapText("  a \n  b  ", 100, 10, fakeFont()).lines).toEqual(["a b"]);
  });

  it("flags a word wider than the line and keeps it on its own line", () => {
    const r = wrapText("ab abcdefghijkl cd", 52, 10, fakeFont());
    expect(r.overflow).toBe(true);
    expect(r.lines).toEqual(["ab", "abcdefghijkl", "cd"]);
  });

  it("returns no lines for empty text", () => {
    expect(wrapText("   ", 52, 10, fakeFont())).toEqual({ lines: [], overflow: false });
  });
});

describe("fitText", () => {
  it("uses 11 pt for the title and 0.75 × for the artist when it fits", () => {
    const fit = fitText({ artist: "The Band", title: "An Album" }, box, fake);
    expect(fit.fits).toBe(true);
    expect(fit.titleSize).toBe(11);
    expect(fit.artistSize).toBe(8.25);
    expect(fit.lines.map((l) => [l.role, l.text, l.size, l.bold])).toEqual([
      ["artist", "The Band", 8.25, false],
      ["title", "An Album", 11, true],
    ]);
  });

  it("left-aligns and centres the block vertically", () => {
    const fit = fitText({ artist: "The Band", title: "An Album" }, box, fake);
    const blockHeight = (8.25 + 11) * 1.15 * PT;
    const top = (box.height - blockHeight) / 2;
    const [artist, title] = fit.lines;
    expect(artist!.x).toBe(0);
    expect(title!.x).toBe(0);
    // baseline = line top + (1.15 + ascent + descent) / 2 × size
    expect(artist!.baseline).toBeCloseTo(top + ((1.15 + 0.6) / 2) * 8.25 * PT, 10);
    expect(title!.baseline).toBeCloseTo(top + 8.25 * 1.15 * PT + ((1.15 + 0.6) / 2) * 11 * PT, 10);
  });

  it("gives an empty field no space", () => {
    const onlyTitle = fitText({ artist: " ", title: "An Album" }, box, fake);
    expect(onlyTitle.lines.map((l) => l.role)).toEqual(["title"]);
    const top = (box.height - 11 * 1.15 * PT) / 2;
    expect(onlyTitle.lines[0]!.baseline).toBeCloseTo(top + ((1.15 + 0.6) / 2) * 11 * PT, 10);

    const none = fitText({ artist: "", title: "" }, box, fake);
    expect(none).toMatchObject({ fits: true, titleSize: 11, lines: [] });
  });

  it("shrinks to the largest 0.5 pt step that fits", () => {
    const title = Array.from({ length: 30 }, () => "word").join(" ");
    const fit = fitText({ artist: "Someone", title }, box, fake);
    expect(fit.fits).toBe(true);
    expect(fit.titleSize).toBeLessThan(11);
    expect(fit.titleSize).toBeGreaterThanOrEqual(7);
    expect((fit.titleSize * 2) % 1).toBe(0);
    expect(fit.artistSize).toBe(fit.titleSize * 0.75);
    expect(layoutAtSize({ artist: "Someone", title }, box, fake, fit.titleSize).fits).toBe(true);
    expect(layoutAtSize({ artist: "Someone", title }, box, fake, fit.titleSize + 0.5).fits).toBe(
      false,
    );
  });

  it("shrinks when one word is too wide at 11 pt but fits smaller", () => {
    // 45 mm = 127.56 pt; 24 characters are 132 pt at 11 pt and 126 pt at 10.5 pt.
    const fit = fitText({ artist: "", title: "x".repeat(24) }, box, fake);
    expect(fit).toMatchObject({ fits: true, titleSize: 10.5 });
  });

  it("does not fit a word too wide at 7 pt, and draws it at 7 pt from the top", () => {
    const fit = fitText({ artist: "Someone", title: "x".repeat(40) }, box, fake);
    expect(fit.fits).toBe(false);
    expect(fit.titleSize).toBe(7);
    expect(fit.artistSize).toBe(5.25);
    expect(fit.lines[0]!.baseline).toBeCloseTo(((1.15 + 0.6) / 2) * 5.25 * PT, 10);
  });

  it("does not fit a block too tall at 7 pt", () => {
    const title = Array.from({ length: 200 }, () => "word").join(" ");
    const fit = fitText({ artist: "", title }, box, fake);
    expect(fit.fits).toBe(false);
    expect(fit.titleSize).toBe(7);
    expect(fit.lines.length).toBeGreaterThan(10);
  });

  it("wraps to the box width", () => {
    const title = "abcdefghij abcdefghij"; // 21 chars = 115.5 pt at 11 pt
    expect(fitText({ artist: "", title }, box, fake).lines).toHaveLength(1);
    const narrow = { ...box, width: 30 }; // 85 pt
    expect(fitText({ artist: "", title }, narrow, fake).lines).toHaveLength(2);
  });
});

describe("fitText with Inter", () => {
  it("fits a short artist and title at 11 pt", () => {
    const fit = fitText({ artist: "The Beatles", title: "Abbey Road" }, box, inter);
    expect(fit).toMatchObject({ fits: true, titleSize: 11 });
    expect(fit.lines.map((l) => l.text)).toEqual(["The Beatles", "Abbey Road"]);
  });

  it("shrinks a long title without a warning", () => {
    const title =
      "Rolfs Vogelhochzeit, Weihnachtsbäckerei und viele andere Lieder für die ganze Familie zum Mitsingen, Tanzen und Träumen";
    const fit = fitText({ artist: "Rolf Zuckowski", title }, box, inter);
    expect(fit.fits).toBe(true);
    expect(fit.titleSize).toBe(9.5);
  });

  it("does not fit a single very long word", () => {
    const fit = fitText(
      { artist: "", title: "Donaudampfschifffahrtsgesellschaftskapitänsmützenabzeichen" },
      box,
      inter,
    );
    expect(fit).toMatchObject({ fits: false, titleSize: 7 });
  });

  it("measures text width in points like the PDF does", () => {
    const w = inter.bold.widthOf("Abbey Road", 11);
    expect(w).toBeGreaterThan(50);
    expect(w).toBeLessThan(70);
    expect(inter.bold.widthOf("Abbey Road", 22)).toBeCloseTo(2 * w, 10);
  });
});
