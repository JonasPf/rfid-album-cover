import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { FontPair } from "./fontmetrics";
import {
  A4,
  PT_PER_MM,
  paginate,
  sheetLayout,
  stickerGeometry,
  type Line,
  type Rect,
} from "./geometry";
import { fitText } from "./textfit";

export interface PdfCard {
  artist: string;
  title: string;
  /** JPEG of the art area, already cropped and sized. */
  art: Uint8Array;
}

export interface PdfFonts {
  regular: Uint8Array;
  bold: Uint8Array;
  metrics: FontPair;
}

const BLACK = rgb(0, 0, 0);
const ARTIST_GREY = rgb(0x55 / 255, 0x55 / 255, 0x55 / 255);
const GRID_LINE_GREY = rgb(0x99 / 255, 0x99 / 255, 0x99 / 255);

const pt = (mm: number) => mm * PT_PER_MM;
// pdf-lib's origin is the bottom left; the layout's is the top left.
const ptY = (mm: number) => pt(A4.height - mm);

function drawLine(page: PDFPage, l: Line, thickness: number, color = BLACK) {
  page.drawLine({
    start: { x: pt(l.x1), y: ptY(l.y1) },
    end: { x: pt(l.x2), y: ptY(l.y2) },
    thickness: pt(thickness),
    color,
  });
}

function clipTo(page: PDFPage, r: Rect) {
  page.pushOperators(
    pushGraphicsState(),
    rectangle(pt(r.x), ptY(r.y + r.height), pt(r.width), pt(r.height)),
    clip(),
    endPath(),
  );
}

export async function buildPdf(
  cards: readonly PdfCard[],
  inset: number,
  fonts: PdfFonts,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("RFID cards");
  doc.setCreator("RFID Album Cover");
  doc.registerFontkit(fontkit);
  // Subsetting is skipped: fontkit's subsetter breaks some glyphs.
  const regular: PDFFont = await doc.embedFont(fonts.regular, { subset: false });
  const bold: PDFFont = await doc.embedFont(fonts.bold, { subset: false });

  const layout = sheetLayout(inset);
  const sticker = stickerGeometry(inset);

  for (const pageCards of paginate(cards)) {
    const page = doc.addPage([pt(A4.width), pt(A4.height)]);

    for (const [i, card] of pageCards.entries()) {
      const slot = layout.slots[i]!;
      const art = await doc.embedJpg(card.art);
      page.drawImage(art, {
        x: pt(slot.x + sticker.art.x),
        y: ptY(slot.y + sticker.art.y + sticker.art.height),
        width: pt(sticker.art.width),
        height: pt(sticker.art.height),
      });

      const box = sticker.textBox;
      const fit = fitText(card, box, fonts.metrics);
      clipTo(page, { ...box, x: slot.x + box.x, y: slot.y + box.y });
      for (const line of fit.lines) {
        page.drawText(line.text, {
          x: pt(slot.x + box.x + line.x),
          y: ptY(slot.y + box.y + line.baseline),
          size: line.size,
          font: line.bold ? bold : regular,
          color: line.bold ? BLACK : ARTIST_GREY,
        });
      }
      page.pushOperators(popGraphicsState());
    }

    for (const line of layout.gridLines) {
      drawLine(page, line, layout.gridLineThickness, GRID_LINE_GREY);
    }
    for (const mark of layout.cutMarks) drawLine(page, mark, layout.markThickness);

    const { calibration } = layout;
    drawLine(page, calibration.line, layout.markThickness);
    for (const tick of calibration.ticks) drawLine(page, tick, layout.markThickness);
    page.drawText(calibration.label.text, {
      x: pt(calibration.label.x),
      y: ptY(calibration.label.y),
      size: calibration.label.size,
      font: regular,
      color: BLACK,
    });
  }

  return doc.save();
}
