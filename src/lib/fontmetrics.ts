import fontkit from "@pdf-lib/fontkit";

export interface FontMetrics {
  /** Advance width in pt of `text` set at `size` pt. */
  widthOf(text: string, size: number): number;
  /** Ascent and descent as fractions of the em; descent is negative. */
  ascent: number;
  descent: number;
}

export interface FontPair {
  regular: FontMetrics;
  bold: FontMetrics;
}

/**
 * Measures like pdf-lib does when it draws the text: the sum of the glyph
 * advances after shaping, without kerning offsets. The preview turns kerning
 * off so it matches.
 */
export function createMetrics(bytes: Uint8Array): FontMetrics {
  const font = fontkit.create(bytes);
  const em = font.unitsPerEm;
  const cache = new Map<string, number>();
  return {
    widthOf(text, size) {
      let units = cache.get(text);
      if (units === undefined) {
        units = 0;
        for (const glyph of font.layout(text).glyphs) units += glyph.advanceWidth;
        cache.set(text, units);
      }
      return (units / em) * size;
    },
    ascent: font.ascent / em,
    descent: font.descent / em,
  };
}
