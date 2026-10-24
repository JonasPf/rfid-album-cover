import type { Size } from "./crop";
import type { Rect } from "./geometry";

export interface Emoji {
  /** Code points as lowercase hex, joined by "-", without U+FE0F. Also the SVG's file name. */
  hex: string;
  name: string;
  /** Index into `EmojiIndex.groups`. Variants such as skin tones have none: they are only found by pasting them. */
  group?: number;
  keywords?: string[];
}

export interface EmojiIndex {
  groups: string[];
  /** In Unicode order. */
  emoji: Emoji[];
}

/** The share of the image side that the emoji's longer side fills. */
export const EMOJI_FILL = 0.84;

const VARIATION_SELECTOR = 0xfe0f;

/** The `Emoji.hex` of an emoji typed as text. */
export function emojiKey(text: string): string {
  return [...text]
    .map((c) => c.codePointAt(0)!)
    .filter((cp) => cp !== VARIATION_SELECTOR)
    .map((cp) => cp.toString(16).padStart(4, "0"))
    .join("-");
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function pasted(index: EmojiIndex, term: string): Emoji[] | null {
  const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(term);
  const found = new Set<Emoji>();
  for (const { segment } of graphemes) {
    if (!segment.trim()) continue;
    const key = emojiKey(segment);
    const emoji = index.emoji.find((e) => e.hex === key);
    if (!emoji) return null;
    found.add(emoji);
  }
  return [...found];
}

/**
 * The emoji to list for a search term: all with a group for an empty term, exactly the emoji in a
 * term made of emoji, or else those where each word starts a word of the name or of a keyword.
 */
export function searchEmoji(index: EmojiIndex, term: string): Emoji[] {
  const listed = index.emoji.filter((e) => e.group !== undefined);
  if (!term.trim()) return listed;
  const emoji = pasted(index, term);
  if (emoji) return emoji;
  const wanted = words(term);
  if (!wanted.length) return [];
  return listed.filter((e) => {
    const own = [e.name, ...(e.keywords ?? [])].flatMap(words);
    return wanted.every((w) => own.some((o) => o.startsWith(w)));
  });
}

/**
 * Where to draw a graphic of size `graphic` on a `side` × `side` image so that `bounds`, its
 * visible part, is centred and its longer side fills `EMOJI_FILL` of the image.
 */
export function emojiPlacement(bounds: Rect, graphic: Size, side: number): Rect {
  const scale = (side * EMOJI_FILL) / Math.max(bounds.width, bounds.height);
  return {
    x: side / 2 - (bounds.x + bounds.width / 2) * scale,
    y: side / 2 - (bounds.y + bounds.height / 2) * scale,
    width: graphic.width * scale,
    height: graphic.height * scale,
  };
}

/** The box around all pixels of RGBA `data` that are not fully transparent. */
export function opaqueBounds(data: Uint8ClampedArray, width: number, height: number): Rect | null {
  let [left, top, right, bottom] = [width, height, -1, -1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) return null;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}
