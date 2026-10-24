// Builds the emoji index and one SVG per emoji from the Noto Emoji and Emojibase packages.
// See specs/adr/0007-noto-emoji.html.
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Plugin } from "vite";
import type { Emoji, EmojiIndex } from "../src/lib/emoji.ts";

/** The parts of an Iconify icon set and its `chars.json` that are used. */
export interface NotoSet {
  icons: {
    width?: number;
    height?: number;
    icons: Record<string, { body: string; width?: number; height?: number }>;
  };
  /** Code points as in `Emoji.hex` → icon name. */
  chars: Record<string, string>;
}

interface EmojibaseEmoji {
  label: string;
  hexcode: string;
  tags?: string[];
  group?: number;
  order?: number;
  skins?: EmojibaseEmoji[];
}

/** The parts of `emojibase-data/en` that are used. */
export interface Emojibase {
  groups: { key: string; message: string; order: number }[];
  data: EmojibaseEmoji[];
}

const ICON_SIZE = 16;
const COMPONENT_GROUP = "component";

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const normalise = (hexcode: string) =>
  hexcode
    .toLowerCase()
    .split("-")
    .filter((cp) => cp !== "fe0f")
    .join("-");

export function buildEmojiSet(
  noto: NotoSet,
  emojibase: Emojibase,
): { index: EmojiIndex; svgs: Map<string, string> } {
  const svgOf = new Map<string, string>();
  for (const [hex, name] of Object.entries(noto.chars)) {
    const icon = noto.icons.icons[name];
    if (!icon) continue;
    const width = icon.width ?? noto.icons.width ?? ICON_SIZE;
    const height = icon.height ?? noto.icons.height ?? ICON_SIZE;
    svgOf.set(
      normalise(hex),
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${icon.body}</svg>`,
    );
  }

  const listed = emojibase.data
    .filter(
      (e) => e.group !== undefined && e.order !== undefined && svgOf.has(normalise(e.hexcode)),
    )
    .filter((e) => emojibase.groups.find((g) => g.order === e.group)?.key !== COMPONENT_GROUP)
    .sort((a, b) => a.order! - b.order!);
  const groupOrders = [...new Set(listed.map((e) => e.group!))].sort((a, b) => a - b);
  const groups = groupOrders.map((order) =>
    capitalise(emojibase.groups.find((g) => g.order === order)!.message),
  );

  const emoji: Emoji[] = [];
  const svgs = new Map<string, string>();
  const add = (entry: Emoji) => {
    emoji.push(entry);
    svgs.set(entry.hex, svgOf.get(entry.hex)!);
  };
  for (const e of listed) {
    const name = capitalise(e.label);
    add({
      hex: normalise(e.hexcode),
      name,
      group: groupOrders.indexOf(e.group!),
      keywords: e.tags ?? [],
    });
    for (const skin of e.skins ?? []) {
      if (svgOf.has(normalise(skin.hexcode))) {
        add({ hex: normalise(skin.hexcode), name: capitalise(skin.label) });
      }
    }
  }
  return { index: { groups, emoji }, svgs };
}

/** The files served under `emoji/`: `index.json`, `LICENSE.txt` and `<hex>.svg` per emoji. */
export function emojiFiles(): Map<string, string> {
  const require = createRequire(import.meta.url);
  const json = (id: string) => JSON.parse(readFileSync(require.resolve(id), "utf8"));
  const { index, svgs } = buildEmojiSet(
    { icons: json("@iconify-json/noto/icons.json"), chars: json("@iconify-json/noto/chars.json") },
    {
      groups: json("emojibase-data/en/messages.json").groups,
      data: json("emojibase-data/en/data.json"),
    },
  );
  const apache = readFileSync(
    new URL("../src/assets/emoji/LICENSE-Apache-2.0.txt", import.meta.url),
    "utf8",
  );
  const mit = readFileSync(
    join(dirname(require.resolve("emojibase-data/package.json")), "LICENSE"),
    "utf8",
  );
  const licence = [
    "The emoji graphics are Noto Emoji (https://github.com/googlefonts/noto-emoji),",
    "copyright Google Inc., under the Apache License 2.0:",
    "",
    apache.trim(),
    "",
    "The emoji names, keywords and categories come from Emojibase (https://emojibase.dev):",
    "",
    mit.trim(),
    "",
  ].join("\n");

  const files = new Map<string, string>([
    ["index.json", JSON.stringify(index)],
    ["LICENSE.txt", licence],
  ]);
  for (const [hex, svg] of svgs) files.set(`${hex}.svg`, svg);
  return files;
}

const TYPES: Record<string, string> = {
  json: "application/json",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
};

/** Serves the emoji files from memory in the dev server, and writes them to `emoji/` on build. */
export function emojiAssets(): Plugin {
  let files: Map<string, string> | undefined;
  const load = () => (files ??= emojiFiles());
  return {
    name: "emoji-assets",
    configureServer(server) {
      server.middlewares.use("/emoji/", (req, res, next) => {
        const name = decodeURIComponent((req.url ?? "").split("?")[0]!.slice(1));
        const file = load().get(name);
        if (file === undefined) return next();
        res.setHeader("Content-Type", TYPES[name.split(".").pop()!]!);
        res.end(file);
      });
    },
    async writeBundle({ dir }) {
      const out = join(dir!, "emoji");
      await mkdir(out, { recursive: true });
      await Promise.all([...load()].map(([name, file]) => writeFile(join(out, name), file)));
    },
  };
}
