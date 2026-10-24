import { describe, expect, it } from "vitest";
import {
  EMOJI_FILL,
  emojiKey,
  emojiPlacement,
  opaqueBounds,
  searchEmoji,
  type EmojiIndex,
} from "./emoji";

const index: EmojiIndex = {
  groups: ["Smileys & emotion", "People & body", "Animals & nature", "Symbols"],
  emoji: [
    { hex: "1f600", name: "Grinning face", group: 0, keywords: ["happy", "smile"] },
    { hex: "1f60d", name: "Smiling face with heart-eyes", group: 0, keywords: ["love"] },
    { hex: "1f44b", name: "Waving hand", group: 1, keywords: ["hello"] },
    { hex: "1f44b-1f3fd", name: "Waving hand: medium skin tone" },
    { hex: "1f981", name: "Lion", group: 2, keywords: ["Leo", "zodiac"] },
    { hex: "1f9ad", name: "Seal", group: 2, keywords: ["sea lion"] },
    { hex: "264c", name: "Leo", group: 3, keywords: ["lion", "zodiac"] },
    { hex: "2764", name: "Red heart", group: 3, keywords: ["love"] },
    { hex: "0023-20e3", name: "Keycap: #", group: 3, keywords: ["keycap"] },
  ],
};

const names = (term: string) => searchEmoji(index, term).map((e) => e.name);

describe("emojiKey", () => {
  it("joins the code points as lowercase hex", () => {
    expect(emojiKey("🦁")).toBe("1f981");
    expect(emojiKey("👋🏽")).toBe("1f44b-1f3fd");
    expect(emojiKey("👩‍🚀")).toBe("1f469-200d-1f680");
  });

  it("pads short code points to four digits and drops the variation selector", () => {
    expect(emojiKey("❤️")).toBe("2764");
    expect(emojiKey("#️⃣")).toBe("0023-20e3");
  });
});

describe("searchEmoji", () => {
  it("lists every emoji with a group, in order, for an empty term", () => {
    expect(names("")).toEqual([
      "Grinning face",
      "Smiling face with heart-eyes",
      "Waving hand",
      "Lion",
      "Seal",
      "Leo",
      "Red heart",
      "Keycap: #",
    ]);
    expect(names("   ")).toEqual(names(""));
  });

  it("matches the start of a word in the name or a keyword, ignoring case", () => {
    expect(names("LION")).toEqual(["Lion", "Seal", "Leo"]);
    expect(names("smi")).toEqual(["Grinning face", "Smiling face with heart-eyes"]);
    expect(names("eyes")).toEqual(["Smiling face with heart-eyes"]);
    expect(names("ion")).toEqual([]);
  });

  it("needs every word of the term to match", () => {
    expect(names("face love")).toEqual(["Smiling face with heart-eyes"]);
    expect(names("heart-eyes")).toEqual(["Smiling face with heart-eyes"]);
    expect(names("lion zodiac")).toEqual(["Lion", "Leo"]);
  });

  it("does not list emoji without a group by name", () => {
    expect(names("skin")).toEqual([]);
    expect(names("waving")).toEqual(["Waving hand"]);
  });

  it("shows typed or pasted emoji in order, once each, including variants", () => {
    expect(names("🦁❤️")).toEqual(["Lion", "Red heart"]);
    expect(names(" 👋🏽 ")).toEqual(["Waving hand: medium skin tone"]);
    expect(names("🦁 🦁")).toEqual(["Lion"]);
    expect(names("#️⃣")).toEqual(["Keycap: #"]);
  });

  it("finds nothing for emoji it lacks, or terms without words", () => {
    expect(names("🇩🇪")).toEqual([]);
    expect(names("🦁🇩🇪")).toEqual([]);
    expect(names("xyzzy")).toEqual([]);
    expect(names("!!")).toEqual([]);
  });
});

describe("emojiPlacement", () => {
  it("centres the bounds and scales the longer side to the fill", () => {
    const side = 1200;
    const bounds = { x: 100, y: 200, width: 400, height: 200 };
    const at = emojiPlacement(bounds, { width: 1000, height: 1000 }, side);
    const scale = at.width / 1000;
    expect(bounds.width * scale).toBeCloseTo(side * EMOJI_FILL);
    expect(at.x + (bounds.x + bounds.width / 2) * scale).toBeCloseTo(side / 2);
    expect(at.y + (bounds.y + bounds.height / 2) * scale).toBeCloseTo(side / 2);
    expect(at.height).toBeCloseTo(at.width);
  });

  it("fills 84 % of the side", () => {
    expect(EMOJI_FILL).toBe(0.84);
    const at = emojiPlacement(
      { x: 0, y: 0, width: 100, height: 100 },
      { width: 100, height: 100 },
      1200,
    );
    expect(at).toEqual({ x: 96, y: 96, width: 1008, height: 1008 });
  });

  it("uses the height when it is the longer side", () => {
    const at = emojiPlacement(
      { x: 40, y: 0, width: 20, height: 100 },
      { width: 100, height: 100 },
      100,
    );
    expect(at.height).toBeCloseTo(84);
    expect(at.x + 50 * (at.width / 100)).toBeCloseTo(50);
  });
});

describe("opaqueBounds", () => {
  function image(width: number, height: number, opaque: [number, number][]) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (const [x, y] of opaque) data[(y * width + x) * 4 + 3] = 1;
    return data;
  }

  it("finds the box around every pixel that is not fully transparent", () => {
    const data = image(10, 8, [
      [2, 3],
      [7, 1],
      [4, 6],
    ]);
    expect(opaqueBounds(data, 10, 8)).toEqual({ x: 2, y: 1, width: 6, height: 6 });
  });

  it("returns null for a fully transparent image", () => {
    expect(opaqueBounds(image(4, 4, []), 4, 4)).toBeNull();
  });
});
