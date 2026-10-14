import type { FontMetrics, FontPair } from "./fontmetrics";
import { PT_PER_MM } from "./geometry";

export const TITLE_SIZE = { max: 11, min: 7, step: 0.5 } as const;
export const ARTIST_RATIO = 0.75;
export const LINE_HEIGHT = 1.15;

const EPSILON = 1e-9;

export interface CardText {
  artist: string;
  title: string;
}

export interface TextLine {
  role: "artist" | "title";
  text: string;
  bold: boolean;
  /** Font size in pt. */
  size: number;
  /** Left edge in mm, relative to the text box. */
  x: number;
  /** Baseline in mm, relative to the top of the text box. */
  baseline: number;
}

export interface TextFit {
  fits: boolean;
  titleSize: number;
  artistSize: number;
  lines: TextLine[];
}

export interface Wrapped {
  lines: string[];
  /** A single word is wider than the line. */
  overflow: boolean;
}

/** Greedy wrap at spaces. `maxWidth` is in pt. */
export function wrapText(text: string, maxWidth: number, size: number, font: FontMetrics): Wrapped {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let overflow = false;
  let line = "";
  for (const word of words) {
    if (font.widthOf(word, size) > maxWidth + EPSILON) overflow = true;
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOf(candidate, size) > maxWidth + EPSILON) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return { lines, overflow };
}

interface Block {
  fits: boolean;
  height: number;
  lines: TextLine[];
}

/** Lays out the text with the title at `titleSize` pt; positions assume the block starts at 0. */
export function layoutAtSize(
  text: CardText,
  box: { width: number; height: number },
  fonts: FontPair,
  titleSize: number,
): Block {
  const maxWidth = box.width * PT_PER_MM;
  const parts = [
    {
      role: "artist" as const,
      text: text.artist,
      size: titleSize * ARTIST_RATIO,
      font: fonts.regular,
    },
    { role: "title" as const, text: text.title, size: titleSize, font: fonts.bold },
  ];
  const lines: TextLine[] = [];
  let overflow = false;
  let y = 0;
  for (const part of parts) {
    const wrapped = wrapText(part.text, maxWidth, part.size, part.font);
    overflow ||= wrapped.overflow;
    const lineHeight = (LINE_HEIGHT * part.size) / PT_PER_MM;
    // CSS-style half leading: the font's ascent + descent box is centred in the line.
    const baselineOffset =
      (((LINE_HEIGHT + part.font.ascent + part.font.descent) / 2) * part.size) / PT_PER_MM;
    for (const t of wrapped.lines) {
      lines.push({
        role: part.role,
        text: t,
        bold: part.role === "title",
        size: part.size,
        x: 0,
        baseline: y + baselineOffset,
      });
      y += lineHeight;
    }
  }
  return { fits: !overflow && y <= box.height + EPSILON, height: y, lines };
}

/**
 * Picks the largest title size, in 0.5 pt steps from 11 down to 7 pt, at which
 * the artist and title fit the box (in mm). A block that fits is centred
 * vertically; one that doesn't is drawn at 7 pt from the top and must be clipped.
 */
export function fitText(
  text: CardText,
  box: { width: number; height: number },
  fonts: FontPair,
): TextFit {
  const steps = Math.round((TITLE_SIZE.max - TITLE_SIZE.min) / TITLE_SIZE.step);
  for (let i = 0; i <= steps; i++) {
    const size = TITLE_SIZE.max - i * TITLE_SIZE.step;
    const block = layoutAtSize(text, box, fonts, size);
    if (block.fits) {
      const top = (box.height - block.height) / 2;
      return {
        fits: true,
        titleSize: size,
        artistSize: size * ARTIST_RATIO,
        lines: block.lines.map((l) => ({ ...l, baseline: l.baseline + top })),
      };
    }
  }
  const block = layoutAtSize(text, box, fonts, TITLE_SIZE.min);
  return {
    fits: false,
    titleSize: TITLE_SIZE.min,
    artistSize: TITLE_SIZE.min * ARTIST_RATIO,
    lines: block.lines,
  };
}
