// All lengths are in millimetres, with the origin at the top left, unless noted.

export const MM_PER_INCH = 25.4;
export const PT_PER_MM = 72 / MM_PER_INCH;

/** ISO/IEC 7810 ID-1, used upright. */
export const CARD = { width: 54, height: 85.6, radius: 3.18 } as const;
export const TEXT_AREA_HEIGHT = 31.6;
export const TEXT_PADDING = { x: 3, y: 2.5 } as const;
export const A4 = { width: 210, height: 297 } as const;

export const INSET = { min: 0, max: 3, step: 0.1, default: 1.5 } as const;

export const GRID_SIZE = 3;
export const STICKERS_PER_SHEET = GRID_SIZE * GRID_SIZE;

export const ART_DPI = 300;
export const LOW_RESOLUTION_DPI = 150;

export const CUT_MARK = { offset: 2, length: 5, thickness: 0.2 } as const;
export const CALIBRATION = {
  length: 100,
  gap: 10,
  tick: 3,
  labelGap: 3,
  labelSize: 6,
  label: "Should measure 100 mm",
} as const;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface StickerGeometry {
  width: number;
  height: number;
  /** Relative to the sticker's top-left corner. */
  art: Rect;
  /** The strip below the art, relative to the sticker. */
  textArea: Rect;
  /** The text area minus its padding: where text is laid out and clipped. */
  textBox: Rect;
}

export function stickerGeometry(inset: number): StickerGeometry {
  const width = CARD.width - 2 * inset;
  const height = CARD.height - 2 * inset;
  return {
    width,
    height,
    art: { x: 0, y: 0, width, height: width },
    textArea: { x: 0, y: width, width, height: TEXT_AREA_HEIGHT },
    textBox: {
      x: TEXT_PADDING.x,
      y: width + TEXT_PADDING.y,
      width: width - 2 * TEXT_PADDING.x,
      height: TEXT_AREA_HEIGHT - 2 * TEXT_PADDING.y,
    },
  };
}

/** Clamps to the allowed range and rounds to the input's 0.1 mm step. */
export function clampInset(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const clamped = Math.min(INSET.max, Math.max(INSET.min, value));
  return Math.round(clamped * 10) / 10;
}

export function sheetCount(cards: number): number {
  return Math.ceil(cards / STICKERS_PER_SHEET);
}

export function paginate<T>(items: readonly T[]): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += STICKERS_PER_SHEET) {
    pages.push(items.slice(i, i + STICKERS_PER_SHEET));
  }
  return pages;
}

function artInches(inset: number): number {
  return stickerGeometry(inset).art.width / MM_PER_INCH;
}

/** Side in pixels of the art image at 300 dpi. */
export function artPixelSize(inset: number): number {
  return Math.round(artInches(inset) * ART_DPI);
}

/** Side in pixels of the art image for a crop: 300 dpi, but never upscaled. */
export function artPixelSizeForCrop(cropSize: number, inset: number): number {
  return Math.max(1, Math.min(artPixelSize(inset), Math.round(cropSize)));
}

export function cropDpi(cropSize: number, inset: number): number {
  return Math.floor(cropSize / artInches(inset));
}

export function isLowResolution(cropSize: number, inset: number): boolean {
  return cropSize / artInches(inset) < LOW_RESOLUTION_DPI;
}

export interface SheetLayout {
  grid: Rect;
  /** Sticker positions, row by row, left to right. */
  slots: Rect[];
  cutMarks: Line[];
  markThickness: number;
  calibration: {
    line: Line;
    ticks: [Line, Line];
    label: { text: string; x: number; y: number; size: number };
  };
}

export function sheetLayout(inset: number): SheetLayout {
  const sticker = stickerGeometry(inset);
  const width = GRID_SIZE * sticker.width;
  const height = GRID_SIZE * sticker.height;
  const grid = { x: (A4.width - width) / 2, y: (A4.height - height) / 2, width, height };

  const slots: Rect[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      slots.push({
        x: grid.x + col * sticker.width,
        y: grid.y + row * sticker.height,
        width: sticker.width,
        height: sticker.height,
      });
    }
  }

  const near = CUT_MARK.offset;
  const far = CUT_MARK.offset + CUT_MARK.length;
  const right = grid.x + grid.width;
  const bottom = grid.y + grid.height;
  const cutMarks: Line[] = [];
  for (let i = 0; i <= GRID_SIZE; i++) {
    const x = grid.x + i * sticker.width;
    cutMarks.push({ x1: x, y1: grid.y - far, x2: x, y2: grid.y - near });
    cutMarks.push({ x1: x, y1: bottom + near, x2: x, y2: bottom + far });
  }
  for (let i = 0; i <= GRID_SIZE; i++) {
    const y = grid.y + i * sticker.height;
    cutMarks.push({ x1: grid.x - far, y1: y, x2: grid.x - near, y2: y });
    cutMarks.push({ x1: right + near, y1: y, x2: right + far, y2: y });
  }

  const y = bottom + CALIBRATION.gap;
  const x2 = grid.x + CALIBRATION.length;
  const half = CALIBRATION.tick / 2;
  return {
    grid,
    slots,
    cutMarks,
    markThickness: CUT_MARK.thickness,
    calibration: {
      line: { x1: grid.x, y1: y, x2, y2: y },
      ticks: [
        { x1: grid.x, y1: y - half, x2: grid.x, y2: y + half },
        { x1: x2, y1: y - half, x2, y2: y + half },
      ],
      label: {
        text: CALIBRATION.label,
        x: x2 + CALIBRATION.labelGap,
        // Baseline that roughly centres the cap height on the line.
        y: y + 0.36 * CALIBRATION.labelSize * (MM_PER_INCH / 72),
        size: CALIBRATION.labelSize,
      },
    },
  };
}
