// Regenerates the image fixtures in fixtures/: run `node scripts/make-fixtures.ts`.
// Each image has four coloured quadrants, so tests can tell which region a crop shows.
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const images = [
  { file: "art-100.jpg", width: 100, height: 100, type: "image/jpeg" },
  { file: "art-1200.jpg", width: 1200, height: 1200, type: "image/jpeg" },
  { file: "wide-1600x900.jpg", width: 1600, height: 900, type: "image/jpeg" },
  { file: "small-250.png", width: 250, height: 250, type: "image/png" },
  { file: "photo-800x600.webp", width: 800, height: 600, type: "image/webp" },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const image of images) {
  const base64 = await page.evaluate(async ({ width, height, type }) => {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d")!;
    const w = width / 2;
    const h = height / 2;
    ctx.fillStyle = "rgb(230,30,30)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgb(30,170,60)";
    ctx.fillRect(w, 0, w, h);
    ctx.fillStyle = "rgb(30,60,220)";
    ctx.fillRect(0, h, w, h);
    ctx.fillStyle = "rgb(250,210,30)";
    ctx.fillRect(w, h, w, h);
    const blob = await canvas.convertToBlob({ type, quality: 0.95 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }, image);
  writeFileSync(`fixtures/${image.file}`, Buffer.from(base64, "base64"));
}
await browser.close();
