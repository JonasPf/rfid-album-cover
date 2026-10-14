import { expect, test, type Page } from "@playwright/test";
import type { PdfPage } from "../testing/pdf-inspect";
import {
  BLUE,
  GREEN,
  RED,
  YELLOW,
  addFromSearch,
  count,
  cropDialog,
  cropFrame,
  downloadPdf,
  entries,
  expectColour,
  fixture,
  previewLines,
  setInset,
  settled,
  sticker,
  stubItunes,
  upload,
  uploadAndConfirm,
} from "./helpers";

const TOL = 0.05; // mm
const LABEL = "Should measure 100 mm";

function near(actual: number, expected: number, tol = TOL) {
  expect(Math.abs(actual - expected), `${actual} ≈ ${expected}`).toBeLessThanOrEqual(tol);
}

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const isMark = (l: Segment) => Math.abs(Math.hypot(l.x2 - l.x1, l.y2 - l.y1) - 5) < 0.01;

/** Same end points, in either direction. */
function sameSegment(a: Segment, b: Segment) {
  const at = (x: number, y: number, px: number, py: number) =>
    Math.abs(x - px) < TOL && Math.abs(y - py) < TOL;
  return (
    (at(a.x1, a.y1, b.x1, b.y1) && at(a.x2, a.y2, b.x2, b.y2)) ||
    (at(a.x1, a.y1, b.x2, b.y2) && at(a.x2, a.y2, b.x1, b.y1))
  );
}

/** Distinct x positions of vertical cut marks and y positions of horizontal ones. */
function gridLines(page: PdfPage) {
  const marks = page.lines.filter(isMark);
  const uniq = (values: number[]) =>
    [...new Set(values.map((v) => v.toFixed(3)))].map(Number).sort((a, b) => a - b);
  return {
    xs: uniq(marks.filter((m) => Math.abs(m.x1 - m.x2) < 1e-6).map((m) => m.x1)),
    ys: uniq(marks.filter((m) => Math.abs(m.y1 - m.y2) < 1e-6).map((m) => m.y1)),
  };
}

function expectStickerSize(page: PdfPage, inset: number) {
  const w = 54 - 2 * inset;
  const h = 85.6 - 2 * inset;
  const { xs, ys } = gridLines(page);
  expect(xs).toHaveLength(4);
  expect(ys).toHaveLength(4);
  for (let i = 1; i < 4; i++) {
    near(xs[i]! - xs[i - 1]!, w);
    near(ys[i]! - ys[i - 1]!, h);
  }
  for (const img of page.images) {
    near(img.width, w);
    near(img.height, w);
    // The art area sits at the top of its sticker.
    expect(xs.some((x) => Math.abs(x - img.x) < TOL)).toBe(true);
    expect(ys.some((y) => Math.abs(y - img.y) < TOL)).toBe(true);
  }
}

async function addCards(page: Page, n: number) {
  await addFromSearch(page, n);
  await expect(count(page)).toContainText(`${n} card`);
}

test.beforeEach(async ({ page }) => {
  await stubItunes(page);
  await page.goto("/");
});

test.describe("Sticker sheet PDF", () => {
  test("AC-SHEET-1: at inset 1.5 each sticker is 51 × 82.6 mm with a 51 mm art area on top", async ({
    page,
  }) => {
    await addCards(page, 9);
    const { pages } = await downloadPdf(page);
    expect(pages[0]!.images).toHaveLength(9);
    expectStickerSize(pages[0]!, 1.5);
    near(pages[0]!.images[0]!.width, 51);
  });

  for (const [value, inset] of [
    ["0", 0],
    ["3.0", 3],
  ] as const) {
    test(`AC-SHEET-2: at inset ${value} the sizes follow the formulas`, async ({ page }) => {
      await addCards(page, 4);
      await setInset(page, value);
      const { pages } = await downloadPdf(page);
      expect(pages[0]!.images).toHaveLength(4);
      expectStickerSize(pages[0]!, inset);
    });
  }

  test("AC-SHEET-3: the inset is clamped to 0.0..3.0, or restored, when the field loses focus", async ({
    page,
  }) => {
    const input = page.getByLabel("Inset (mm)");
    await expect(input).toHaveValue("1.5");
    await expect(input).toHaveAttribute("min", "0");
    await expect(input).toHaveAttribute("max", "3");
    await expect(input).toHaveAttribute("step", "0.1");
    await setInset(page, "5");
    await expect(input).toHaveValue("3.0");
    await setInset(page, "-1");
    await expect(input).toHaveValue("0.0");
    await setInset(page, "1.2");
    await expect(input).toHaveValue("1.2");
    // Clearing the field restores the last valid value.
    await setInset(page, "");
    await expect(input).toHaveValue("1.2");
  });

  test("AC-SHEET-4: changing the inset updates all previews at once", async ({ page }) => {
    await addCards(page, 2);
    await uploadAndConfirm(page, fixture("small-250.png"));
    const ratio = async (i: number) => {
      const card = await sticker(entries(page).nth(i)).boundingBox();
      const art = await sticker(entries(page).nth(i)).getByTestId("art").boundingBox();
      return art!.width / card!.width;
    };
    for (let i = 0; i < 3; i++) expect(await ratio(i)).toBeCloseTo(51 / 54, 2);
    await page.getByLabel("Inset (mm)").fill("3");
    for (let i = 0; i < 3; i++) await expect.poll(() => ratio(i)).toBeCloseTo(48 / 54, 2);
    await page.getByLabel("Inset (mm)").fill("0");
    for (let i = 0; i < 3; i++) await expect.poll(() => ratio(i)).toBeCloseTo(1, 2);
    // The low-resolution warning follows the art size: 250 px over 54 mm is 117 dpi.
    await expect(entries(page).nth(2).getByText("Low resolution (117 dpi)")).toBeVisible();
  });

  test("AC-SHEET-5: every page is exactly A4", async ({ page }) => {
    await addCards(page, 10);
    const { pages } = await downloadPdf(page);
    expect(pages).toHaveLength(2);
    for (const p of pages) {
      near(p.widthPt, 595.28, 0.01);
      near(p.heightPt, 841.89, 0.01);
    }
  });

  test("AC-SHEET-6: the grid is centred, with adjacent stickers sharing edges", async ({
    page,
  }) => {
    await addCards(page, 9);
    const { pages } = await downloadPdf(page);
    const p = pages[0]!;
    const { xs, ys } = gridLines(p);
    near(xs[0]!, 210 - xs[3]!);
    near(ys[0]!, 297 - ys[3]!);
    const imgs = p.images;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        // Right neighbour starts where this one ends.
        near(imgs[r * 3 + c + 1]!.x, imgs[r * 3 + c]!.x + imgs[r * 3 + c]!.width);
      }
    }
    for (let i = 0; i < 6; i++) near(imgs[i + 3]!.y - imgs[i]!.y, 82.6);
  });

  test("AC-SHEET-7: 11 entries give 2 pages, 9 then 2 in row 1", async ({ page }) => {
    await addCards(page, 11);
    await expect(count(page)).toHaveText("11 cards · 2 sheets");
    const { pages } = await downloadPdf(page);
    expect(pages).toHaveLength(2);
    expect(pages[0]!.images).toHaveLength(9);
    expect(pages[1]!.images).toHaveLength(2);
    const [first, second] = pages[1]!.images;
    near(first!.x, pages[0]!.images[0]!.x);
    near(first!.y, pages[0]!.images[0]!.y);
    near(second!.x, pages[0]!.images[1]!.x);
    near(second!.y, pages[0]!.images[1]!.y);
  });

  test("AC-SHEET-8: each page has 16 cut marks placed as specified", async ({ page }) => {
    await addCards(page, 10);
    const { pages } = await downloadPdf(page);
    for (const p of pages) {
      const marks = p.lines.filter(isMark);
      const { xs, ys } = gridLines(p);
      const [left, right] = [xs[0]!, xs[3]!];
      const [top, bottom] = [ys[0]!, ys[3]!];
      const vertical = marks.filter((m) => Math.abs(m.x1 - m.x2) < 1e-6);
      const horizontal = marks.filter((m) => Math.abs(m.y1 - m.y2) < 1e-6);
      const above = vertical.filter((m) => Math.max(m.y1, m.y2) < top);
      const below = vertical.filter((m) => Math.min(m.y1, m.y2) > bottom);
      const leftSide = horizontal.filter((m) => Math.max(m.x1, m.x2) < left);
      const rightSide = horizontal.filter((m) => Math.min(m.x1, m.x2) > right);
      for (const side of [above, below, leftSide, rightSide]) expect(side).toHaveLength(4);
      expect(marks).toHaveLength(16);
      for (const m of above) {
        near(Math.min(m.y1, m.y2), top - 7);
        near(Math.max(m.y1, m.y2), top - 2);
      }
      for (const m of below) {
        near(Math.min(m.y1, m.y2), bottom + 2);
        near(Math.max(m.y1, m.y2), bottom + 7);
      }
      for (const m of leftSide) {
        near(Math.min(m.x1, m.x2), left - 7);
        near(Math.max(m.x1, m.x2), left - 2);
      }
      for (const m of rightSide) {
        near(Math.min(m.x1, m.x2), right + 2);
        near(Math.max(m.x1, m.x2), right + 7);
      }
      for (const m of marks) near(m.width, 0.2, 0.001);
      // Aligned with the sticker edges, even on the partly filled page 2.
      for (let i = 0; i < 4; i++) {
        near(xs[i]!, left + i * 51);
        near(ys[i]!, top + i * 82.6);
      }
    }
  });

  test("AC-SHEET-13: each page has 8 thin grey lines along the grid lines, over the art", async ({
    page,
  }) => {
    await addCards(page, 10);
    const { pages } = await downloadPdf(page);
    for (const p of pages) {
      const { xs, ys } = gridLines(p);
      const grey = p.lines.filter((l) => l.color === "#999999");
      expect(grey).toHaveLength(8);
      const lastArt = Math.max(...p.images.map((img) => img.order));
      const expected = [
        ...xs.map((x) => ({ x1: x, y1: ys[0]!, x2: x, y2: ys[3]! })),
        ...ys.map((y) => ({ x1: xs[0]!, y1: y, x2: xs[3]!, y2: y })),
      ];
      for (const e of expected) {
        const found = grey.find((l) => sameSegment(l, e));
        expect(found, JSON.stringify(e)).toBeDefined();
        near(found!.width, 0.1, 0.001);
        expect(found!.order).toBeGreaterThan(lastArt);
      }
    }
  });

  test("AC-SHEET-9: each page has the 100 mm calibration line and label", async ({ page }) => {
    await addCards(page, 10);
    const { pages } = await downloadPdf(page);
    for (const p of pages) {
      const { xs, ys } = gridLines(p);
      const line = p.lines.find((l) => Math.abs(Math.abs(l.x2 - l.x1) - 100) < 0.01);
      expect(line).toBeDefined();
      near(Math.min(line!.x1, line!.x2), xs[0]!);
      near(line!.y1, ys[3]! + 10);
      const label = p.texts.find((t) => t.text === LABEL);
      expect(label).toBeDefined();
      expect(label!.size).toBe(6);
      near(label!.x, xs[0]! + 103);
    }
  });

  test("AC-SHEET-10: the art matches each crop, at most 300 dpi and never upscaled", async ({
    page,
  }) => {
    await addCards(page, 1); // 1200 px: downscaled to 602 px
    await uploadAndConfirm(page, fixture("small-250.png")); // 250 px: kept
    await upload(page, fixture("wide-1600x900.jpg"));
    // Pan to the left edge: crop 0,0,900.
    await settled(cropDialog(page));
    const box = (await cropFrame(page).boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect(cropFrame(page)).toHaveAttribute("data-crop", "0,0,900");
    await cropDialog(page).getByRole("button", { name: "Add card" }).click();
    await expect(entries(page)).toHaveCount(3);

    const { pages } = await downloadPdf(page);
    const imgs = pages[0]!.images;
    expect(imgs.map((i) => [i.pixelWidth, i.pixelHeight])).toEqual([
      [602, 602],
      [250, 250],
      [602, 602],
    ]);
    const colours = async (i: number, points: [number, number][]) => {
      const px = await pages[0]!.pixels(imgs[i]!.objId);
      return points.map(([fx, fy]) => {
        const o = (Math.floor(fy * px.height) * px.width + Math.floor(fx * px.width)) * 4;
        return [px.rgba[o]!, px.rgba[o + 1]!, px.rgba[o + 2]!];
      });
    };
    const quadrants: [number, number][] = [
      [0.25, 0.25],
      [0.75, 0.25],
      [0.25, 0.75],
      [0.75, 0.75],
    ];
    for (const i of [0, 1]) {
      const [tl, tr, bl, br] = await colours(i, quadrants);
      expectColour(tl!, RED);
      expectColour(tr!, GREEN);
      expectColour(bl!, BLUE);
      expectColour(br!, YELLOW);
    }
    // Crop 0..900 of 1600 px: the colour boundary is at 800 / 900 = 0.89.
    const [a, b, c, d] = await colours(2, [
      [0.8, 0.25],
      [0.95, 0.25],
      [0.8, 0.75],
      [0.95, 0.75],
    ]);
    expectColour(a!, RED);
    expectColour(b!, GREEN);
    expectColour(c!, BLUE);
    expectColour(d!, YELLOW);
  });

  test("AC-SHEET-11: PDF text has the preview's sizes and line breaks, clipped when too long", async ({
    page,
  }) => {
    await addFromSearch(page, 1, 0);
    await addFromSearch(page, 1, 2);
    await addFromSearch(page, 1, 1);
    const tooLong = entries(page).nth(2);
    await tooLong
      .getByLabel("Title", { exact: true })
      .fill("Donaudampfschifffahrtsgesellschaftskapitänsmützenabzeichen und so weiter");
    await expect(tooLong.getByText("Text too long")).toBeVisible();

    const preview: [string, number][][] = [];
    for (const entry of await entries(page).all()) preview.push(await previewLines(entry));
    const { pages } = await downloadPdf(page);
    const texts = pages[0]!.texts.filter((t) => t.text !== LABEL);
    expect(texts.map((t) => [t.text, t.size])).toEqual(preview.flat());
    expect(texts.every((t) => t.clip !== null)).toBe(true);
    const clipped = texts.slice(texts.length - preview[2]!.length);
    for (const t of clipped.slice(1)) expect(t.size).toBe(7);
    // The long word runs past the clip rectangle's right edge.
    const word = clipped.find((t) => t.text.startsWith("Donau"))!;
    near(word.clip!.width, 45);
  });

  test("AC-SHEET-12: Download PDF saves rfid-cards.pdf", async ({ page }) => {
    await addCards(page, 1);
    await expect(page.getByText("Print at 100 % / Actual size")).toBeVisible();
    const { filename, bytes } = await downloadPdf(page);
    expect(filename).toBe("rfid-cards.pdf");
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});
