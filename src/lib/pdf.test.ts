import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { inspectPdf, type PdfPage } from "../../testing/pdf-inspect";
import { createMetrics } from "./fontmetrics";
import { sheetLayout, stickerGeometry } from "./geometry";
import { buildPdf, type PdfCard, type PdfFonts } from "./pdf";
import { fitText } from "./textfit";

const regular = readFileSync("src/assets/fonts/Inter-Regular.ttf");
const bold = readFileSync("src/assets/fonts/Inter-Bold.ttf");
const fonts: PdfFonts = {
  regular,
  bold,
  metrics: { regular: createMetrics(regular), bold: createMetrics(bold) },
};
const art = new Uint8Array(readFileSync("fixtures/art-100.jpg"));

const TOL = 0.05; // mm

function cards(n: number): PdfCard[] {
  return Array.from({ length: n }, (_, i) => ({
    artist: `Artist ${i + 1}`,
    title: `Album ${i + 1}`,
    art,
  }));
}

function near(actual: number, expected: number, tol = TOL) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);
}

describe("buildPdf at the default inset with 11 cards", () => {
  let pages: PdfPage[];
  const layout = sheetLayout(1.5);
  const sticker = stickerGeometry(1.5);

  beforeAll(async () => {
    pages = await inspectPdf(await buildPdf(cards(11), 1.5, fonts));
  });

  it("has two exact A4 pages", () => {
    expect(pages).toHaveLength(2);
    for (const p of pages) {
      near(p.widthPt, 595.28, 0.01);
      near(p.heightPt, 841.89, 0.01);
    }
  });

  it("places 9 then 2 art images, row by row, at 51 × 51 mm", () => {
    expect(pages[0]!.images).toHaveLength(9);
    expect(pages[1]!.images).toHaveLength(2);
    const placed = [...pages[0]!.images, ...pages[1]!.images];
    placed.forEach((img, i) => {
      const slot = layout.slots[i % 9]!;
      near(img.x, slot.x);
      near(img.y, slot.y);
      near(img.width, 51);
      near(img.height, 51);
      expect([img.pixelWidth, img.pixelHeight]).toEqual([100, 100]);
    });
  });

  it("draws 16 cut marks per page, 0.2 mm thick, as laid out", () => {
    for (const p of pages) {
      const marks = p.lines.filter((l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1) < 5.01);
      const calibrationTicks = 2;
      expect(marks).toHaveLength(16 + calibrationTicks);
      for (const m of layout.cutMarks) {
        const found = marks.find(
          (l) =>
            Math.abs(l.x1 - m.x1) < TOL &&
            Math.abs(l.y1 - m.y1) < TOL &&
            Math.abs(l.x2 - m.x2) < TOL &&
            Math.abs(l.y2 - m.y2) < TOL,
        );
        expect(found, JSON.stringify(m)).toBeDefined();
        near(found!.width, 0.2, 0.001);
      }
    }
  });

  it("draws 8 grey grid lines, 0.1 mm thick, over the art", () => {
    for (const p of pages) {
      const grey = p.lines.filter((l) => l.color === "#999999");
      expect(grey).toHaveLength(8);
      const lastArt = Math.max(...p.images.map((img) => img.order));
      for (const g of layout.gridLines) {
        const found = grey.find(
          (l) =>
            Math.abs(l.x1 - g.x1) < TOL &&
            Math.abs(l.y1 - g.y1) < TOL &&
            Math.abs(l.x2 - g.x2) < TOL &&
            Math.abs(l.y2 - g.y2) < TOL,
        );
        expect(found, JSON.stringify(g)).toBeDefined();
        near(found!.width, 0.1, 0.001);
        expect(found!.order).toBeGreaterThan(lastArt);
      }
    }
  });

  it("draws the 100 mm calibration line and its label on every page", () => {
    for (const p of pages) {
      const line = p.lines.find((l) => Math.abs(l.x2 - l.x1 - 100) < TOL);
      expect(line).toBeDefined();
      near(line!.x1, layout.grid.x);
      near(line!.y1, layout.grid.y + layout.grid.height + 10);
      const label = p.texts.find((t) => t.text === "Should measure 100 mm");
      expect(label).toBeDefined();
      expect(label!.size).toBe(6);
      near(label!.x, layout.grid.x + 103);
    }
  });

  it("draws the fitted text, clipped to the text box", () => {
    const all = cards(11);
    for (let i = 0; i < all.length; i++) {
      const card = all[i]!;
      const page = pages[Math.floor(i / 9)]!;
      const slot = layout.slots[i % 9]!;
      const fit = fitText(card, sticker.textBox, fonts.metrics);
      for (const line of fit.lines) {
        const drawn = page.texts.find((t) => t.text === line.text);
        expect(drawn, line.text).toBeDefined();
        expect(drawn!.size).toBeCloseTo(line.size, 6);
        near(drawn!.x, slot.x + sticker.textBox.x + line.x, 0.01);
        near(drawn!.baseline, slot.y + sticker.textBox.y + line.baseline, 0.01);
        expect(drawn!.color).toBe(line.bold ? "#000000" : "#555555");
        expect(drawn!.clip).not.toBeNull();
        near(drawn!.clip!.x, slot.x + sticker.textBox.x, 0.01);
        near(drawn!.clip!.y, slot.y + sticker.textBox.y, 0.01);
        near(drawn!.clip!.width, sticker.textBox.width, 0.01);
        near(drawn!.clip!.height, sticker.textBox.height, 0.01);
      }
    }
  });
});

describe("buildPdf geometry at other insets", () => {
  it.each([
    [0, 54],
    [3, 48],
  ])("at inset %d the art is %d mm and the grid follows", async (inset, side) => {
    const [page] = await inspectPdf(await buildPdf(cards(9), inset, fonts));
    const layout = sheetLayout(inset);
    expect(page!.images).toHaveLength(9);
    page!.images.forEach((img, i) => {
      near(img.width, side);
      near(img.height, side);
      near(img.x, layout.slots[i]!.x);
      near(img.y, layout.slots[i]!.y);
    });
    // Rows are a sticker height apart: 85.6 − 2i.
    near(page!.images[3]!.y - page!.images[0]!.y, 85.6 - 2 * inset);
  });
});

describe("buildPdf text that does not fit", () => {
  it("draws it at 7 pt with the same line breaks, clipped", async () => {
    const card = {
      artist: "Someone",
      title: Array.from({ length: 120 }, (_, i) => `word${i}`).join(" "),
      art,
    };
    const fit = fitText(card, stickerGeometry(1.5).textBox, fonts.metrics);
    expect(fit.fits).toBe(false);
    const [page] = await inspectPdf(await buildPdf([card], 1.5, fonts));
    const drawn = page!.texts.filter((t) => t.text !== "Should measure 100 mm");
    expect(drawn.map((t) => t.text)).toEqual(fit.lines.map((l) => l.text));
    expect(drawn.every((t) => t.clip !== null)).toBe(true);
    expect(drawn.filter((t) => t.size === 7).length).toBe(fit.lines.length - 1);
  });
});
