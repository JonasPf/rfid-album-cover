import { describe, expect, it } from "vitest";
import { buildEmojiSet, emojiFiles, type Emojibase, type NotoSet } from "./emoji-assets";

const noto: NotoSet = {
  icons: {
    width: 128,
    height: 128,
    icons: {
      "grinning-face": { body: "<path d='g'/>" },
      "waving-hand": { body: "<path d='w'/>" },
      "waving-hand-medium-skin-tone": { body: "<path d='w3'/>" },
      "red-heart": { body: "<path d='h'/>" },
      "keycap-hash": { body: "<path d='k'/>" },
      "light-skin-tone": { body: "<path d='t'/>" },
      "wide-thing": { body: "<path d='x'/>", width: 256 },
    },
  },
  chars: {
    "1f600": "grinning-face",
    "1f44b": "waving-hand",
    "1f44b-1f3fd": "waving-hand-medium-skin-tone",
    "2764": "red-heart",
    "0023-20e3": "keycap-hash",
    "1f3fb": "light-skin-tone",
    "1f4a0": "wide-thing",
  },
};

const emojibase: Emojibase = {
  groups: [
    { key: "smileys-emotion", message: "smileys & emotion", order: 0 },
    { key: "people-body", message: "people & body", order: 1 },
    { key: "component", message: "components", order: 2 },
    { key: "symbols", message: "symbols", order: 8 },
  ],
  data: [
    { label: "red heart", hexcode: "2764", tags: ["love"], group: 0, order: 156 },
    { label: "grinning face", hexcode: "1F600", tags: ["happy"], group: 0, order: 1 },
    {
      label: "waving hand",
      hexcode: "1F44B",
      tags: ["hello"],
      group: 1,
      order: 189,
      skins: [
        { label: "waving hand: light skin tone", hexcode: "1F44B-1F3FB" },
        { label: "waving hand: medium skin tone", hexcode: "1F44B-1F3FD" },
      ],
    },
    { label: "light skin tone", hexcode: "1F3FB", tags: [], group: 2, order: 9000 },
    { label: "keycap: #", hexcode: "0023-FE0F-20E3", tags: ["keycap"], group: 8, order: 4857 },
    { label: "rocket", hexcode: "1F680", tags: ["space"], group: 5, order: 4145 },
    { label: "regional indicator A", hexcode: "1F1E6" },
    { label: "diamond with a dot", hexcode: "1F4A0", tags: [], group: 8, order: 4900 },
  ],
};

describe("buildEmojiSet", () => {
  const { index, svgs } = buildEmojiSet(noto, emojibase);

  it("lists the emoji both sources have, in Emojibase order, without components", () => {
    expect(index.groups).toEqual(["Smileys & emotion", "People & body", "Symbols"]);
    expect(index.emoji).toEqual([
      { hex: "1f600", name: "Grinning face", group: 0, keywords: ["happy"] },
      { hex: "2764", name: "Red heart", group: 0, keywords: ["love"] },
      { hex: "1f44b", name: "Waving hand", group: 1, keywords: ["hello"] },
      { hex: "1f44b-1f3fd", name: "Waving hand: medium skin tone" },
      { hex: "0023-20e3", name: "Keycap: #", group: 2, keywords: ["keycap"] },
      { hex: "1f4a0", name: "Diamond with a dot", group: 2, keywords: [] },
    ]);
  });

  it("makes a standalone SVG for every listed emoji", () => {
    expect([...svgs.keys()].sort()).toEqual(index.emoji.map((e) => e.hex).sort());
    expect(svgs.get("1f600")).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><path d='g'/></svg>`,
    );
    expect(svgs.get("1f4a0")).toContain(`width="256" height="128" viewBox="0 0 256 128"`);
  });
});

describe("emojiFiles", () => {
  const files = emojiFiles();
  const index = JSON.parse(String(files.get("index.json")));

  it("builds the index, the SVGs and the licence from the real packages", () => {
    expect(index.groups).toEqual([
      "Smileys & emotion",
      "People & body",
      "Animals & nature",
      "Food & drink",
      "Travel & places",
      "Activities",
      "Objects",
      "Symbols",
      "Flags",
    ]);
    expect(index.emoji[0]).toMatchObject({ hex: "1f600", name: "Grinning face", group: 0 });
    expect(
      index.emoji.filter((e: { group?: number }) => e.group !== undefined).length,
    ).toBeGreaterThan(1500);
    expect(files.get("1f981.svg")).toMatch(/^<svg [^>]*viewBox="0 0 128 128">/);
    expect(files.get("1f44b-1f3fd.svg")).toBeDefined();
    const licence = String(files.get("LICENSE.txt"));
    expect(licence).toContain("Noto Emoji");
    expect(licence).toContain("Apache License");
    expect(licence).toContain("Emojibase");
    expect(licence).toContain("MIT License");
  });
});
