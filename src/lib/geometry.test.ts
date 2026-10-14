import { describe, expect, it } from "vitest";
import {
  A4,
  artPixelSize,
  clampInset,
  cropDpi,
  isLowResolution,
  paginate,
  sheetCount,
  sheetLayout,
  stickerGeometry,
} from "./geometry";

describe("stickerGeometry", () => {
  it("is 51 × 82.6 mm with a 51 mm art area at the default inset", () => {
    const g = stickerGeometry(1.5);
    expect(g.width).toBeCloseTo(51, 10);
    expect(g.height).toBeCloseTo(82.6, 10);
    expect(g.art).toEqual({ x: 0, y: 0, width: g.width, height: g.width });
    expect(g.textArea.y).toBeCloseTo(51, 10);
    expect(g.textArea.height).toBeCloseTo(31.6, 10);
  });

  it.each([
    [0, 54, 85.6],
    [3, 48, 79.6],
  ])("follows the formulas at inset %d", (inset, w, h) => {
    const g = stickerGeometry(inset);
    expect(g.width).toBeCloseTo(w, 10);
    expect(g.height).toBeCloseTo(h, 10);
    expect(g.art.width).toBeCloseTo(w, 10);
    expect(g.textArea.height).toBeCloseTo(31.6, 10);
  });

  it("pads the text box by 3 mm sideways and 2.5 mm top and bottom", () => {
    const g = stickerGeometry(1.5);
    expect(g.textBox.x).toBeCloseTo(3, 10);
    expect(g.textBox.y).toBeCloseTo(51 + 2.5, 10);
    expect(g.textBox.width).toBeCloseTo(45, 10);
    expect(g.textBox.height).toBeCloseTo(26.6, 10);
  });
});

describe("clampInset", () => {
  it("clamps to 0..3 and rounds to 0.1", () => {
    expect(clampInset(5, 1.5)).toBe(3);
    expect(clampInset(-1, 1.5)).toBe(0);
    expect(clampInset(1.234, 1.5)).toBe(1.2);
    expect(clampInset(2.96, 1.5)).toBe(3);
  });

  it("falls back for non-numbers", () => {
    expect(clampInset(Number.NaN, 1.7)).toBe(1.7);
  });
});

describe("sheetCount", () => {
  it.each([
    [0, 0],
    [1, 1],
    [9, 1],
    [10, 2],
    [11, 2],
    [18, 2],
    [19, 3],
  ])("%d cards need %d sheets", (cards, sheets) => {
    expect(sheetCount(cards)).toBe(sheets);
  });
});

describe("paginate", () => {
  it("splits into pages of 9", () => {
    const pages = paginate(Array.from({ length: 11 }, (_, i) => i));
    expect(pages).toHaveLength(2);
    expect(pages[0]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(pages[1]).toEqual([9, 10]);
  });
});

describe("resolution", () => {
  it("renders the art at 300 dpi of its size", () => {
    expect(artPixelSize(1.5)).toBe(602);
    expect(artPixelSize(0)).toBe(638);
  });

  it("computes the dpi of a crop", () => {
    expect(cropDpi(250, 1.5)).toBe(124);
    expect(cropDpi(1200, 1.5)).toBe(597);
  });

  it("warns below 150 dpi", () => {
    expect(isLowResolution(250, 1.5)).toBe(true);
    expect(isLowResolution(1200, 1.5)).toBe(false);
    // 150 dpi exactly is not low: 51 mm at 150 dpi is 301.18 px.
    expect(isLowResolution(302, 1.5)).toBe(false);
    expect(isLowResolution(301, 1.5)).toBe(true);
  });
});

describe("sheetLayout", () => {
  const layout = sheetLayout(1.5);

  it("is A4 portrait", () => {
    expect(A4).toEqual({ width: 210, height: 297 });
  });

  it("centres a gapless 3 × 3 grid", () => {
    expect(layout.grid.width).toBeCloseTo(153, 10);
    expect(layout.grid.height).toBeCloseTo(247.8, 10);
    expect(layout.grid.x).toBeCloseTo(28.5, 10);
    expect(layout.grid.y).toBeCloseTo(24.6, 10);
    expect(layout.slots).toHaveLength(9);
    // row by row, left to right, sharing edges
    const [a, b, , d] = layout.slots;
    expect(a!.x).toBeCloseTo(28.5, 10);
    expect(a!.y).toBeCloseTo(24.6, 10);
    expect(b!.x).toBeCloseTo(a!.x + a!.width, 10);
    expect(b!.y).toBeCloseTo(a!.y, 10);
    expect(d!.x).toBeCloseTo(a!.x, 10);
    expect(d!.y).toBeCloseTo(a!.y + a!.height, 10);
  });

  it("has 16 cut marks, 5 mm long and 2 mm off the grid, on the grid lines", () => {
    const { grid, cutMarks } = layout;
    expect(cutMarks).toHaveLength(16);
    const vertical = cutMarks.filter((m) => m.x1 === m.x2);
    const horizontal = cutMarks.filter((m) => m.y1 === m.y2);
    expect(vertical).toHaveLength(8);
    expect(horizontal).toHaveLength(8);
    for (const m of cutMarks) {
      expect(Math.hypot(m.x2 - m.x1, m.y2 - m.y1)).toBeCloseTo(5, 10);
    }
    const xs = [...new Set(vertical.map((m) => m.x1.toFixed(6)))].map(Number);
    expect(xs).toEqual([28.5, 79.5, 130.5, 181.5]);
    const ys = [...new Set(horizontal.map((m) => m.y1.toFixed(6)))].map(Number);
    expect(ys).toEqual([24.6, 107.2, 189.8, 272.4]);
    const top = vertical.filter((m) => m.y2 < grid.y);
    expect(top).toHaveLength(4);
    for (const m of top) {
      expect(m.y1).toBeCloseTo(grid.y - 7, 10);
      expect(m.y2).toBeCloseTo(grid.y - 2, 10);
    }
    const right = horizontal.filter((m) => m.x1 > grid.x + grid.width);
    expect(right).toHaveLength(4);
    for (const m of right) {
      expect(m.x1).toBeCloseTo(grid.x + grid.width + 2, 10);
      expect(m.x2).toBeCloseTo(grid.x + grid.width + 7, 10);
    }
    expect(layout.markThickness).toBe(0.2);
  });

  it("has 8 grid lines, 0.1 mm thick, across the whole grid", () => {
    const { grid, gridLines } = layout;
    expect(gridLines).toHaveLength(8);
    expect(layout.gridLineThickness).toBe(0.1);
    const vertical = gridLines.filter((l) => l.x1 === l.x2);
    const horizontal = gridLines.filter((l) => l.y1 === l.y2);
    [28.5, 79.5, 130.5, 181.5].forEach((x, i) => {
      expect(vertical[i]!.x1).toBeCloseTo(x, 10);
      expect(vertical[i]!.y1).toBeCloseTo(grid.y, 10);
      expect(vertical[i]!.y2).toBeCloseTo(grid.y + grid.height, 10);
    });
    [24.6, 107.2, 189.8, 272.4].forEach((y, i) => {
      expect(horizontal[i]!.y1).toBeCloseTo(y, 10);
      expect(horizontal[i]!.x1).toBeCloseTo(grid.x, 10);
      expect(horizontal[i]!.x2).toBeCloseTo(grid.x + grid.width, 10);
    });
  });

  it("puts a 100 mm calibration line 10 mm below the grid", () => {
    const { grid, calibration } = layout;
    const y = grid.y + grid.height + 10;
    expect(calibration.line).toEqual({ x1: grid.x, y1: y, x2: grid.x + 100, y2: y });
    expect(calibration.ticks).toHaveLength(2);
    expect(calibration.ticks[0].x1).toBeCloseTo(grid.x, 10);
    expect(calibration.ticks[1].x1).toBeCloseTo(grid.x + 100, 10);
    expect(calibration.label.text).toBe("Should measure 100 mm");
    expect(calibration.label.x).toBeCloseTo(grid.x + 103, 10);
    expect(calibration.label.size).toBe(6);
  });

  it("keeps everything on the page at the extreme insets", () => {
    for (const inset of [0, 3]) {
      const l = sheetLayout(inset);
      const all = [...l.cutMarks, l.calibration.line, ...l.calibration.ticks];
      for (const m of all) {
        for (const x of [m.x1, m.x2]) expect(x).toBeGreaterThan(5);
        for (const x of [m.x1, m.x2]) expect(x).toBeLessThan(A4.width - 5);
        for (const y of [m.y1, m.y2]) expect(y).toBeGreaterThan(5);
        for (const y of [m.y1, m.y2]) expect(y).toBeLessThan(A4.height - 5);
      }
    }
  });
});
