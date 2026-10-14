import { readFileSync } from "node:fs";
import { expect, type Locator, type Page } from "@playwright/test";
import { inspectPdf } from "../testing/pdf-inspect";

export const fixture = (name: string) => `fixtures/${name}`;

const cors = { "Access-Control-Allow-Origin": "*" };

export interface ItunesStub {
  /** Search request URLs, in order. */
  searches: string[];
  /** Artwork request URLs, in order. */
  artwork: string[];
}

export interface StubOptions {
  search?: "results" | "empty" | "http-error" | "network-error";
  /** Make the 1200 px artwork fail to load. */
  failArtwork?: boolean;
}

/** Stubs the iTunes API and artwork server. Any other external request fails. */
export async function stubItunes(page: Page, options: StubOptions = {}): Promise<ItunesStub> {
  const stub: ItunesStub = { searches: [], artwork: [] };
  await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
  await page.route("https://itunes.apple.com/search?**", async (route) => {
    stub.searches.push(route.request().url());
    switch (options.search ?? "results") {
      case "results":
        return route.fulfill({ path: fixture("itunes-search.json"), headers: cors });
      case "empty":
        return route.fulfill({ path: fixture("itunes-empty.json"), headers: cors });
      case "http-error":
        return route.fulfill({ status: 503, body: "unavailable", headers: cors });
      case "network-error":
        return route.abort("internetdisconnected");
    }
  });
  await page.route("https://is1-ssl.mzstatic.com/**", async (route) => {
    const url = route.request().url();
    stub.artwork.push(url);
    if (url.includes("1200x1200bb")) {
      if (options.failArtwork) return route.fulfill({ status: 404, headers: cors });
      return route.fulfill({ path: fixture("art-1200.jpg"), headers: cors });
    }
    return route.fulfill({ path: fixture("art-100.jpg"), headers: cors });
  });
  return stub;
}

export function cardList(page: Page): Locator {
  return page.getByRole("list", { name: "Cards" });
}

export function entries(page: Page): Locator {
  return cardList(page).getByRole("listitem");
}

export function count(page: Page): Locator {
  return page.getByTestId("count");
}

export function results(page: Page): Locator {
  return page.getByRole("list", { name: "Search results" }).getByRole("button");
}

export async function search(page: Page, term = "beatles") {
  await page.getByRole("tab", { name: "Search" }).click();
  await page.getByRole("searchbox", { name: "Artist or album" }).fill(term);
  await page.getByRole("button", { name: "Search", exact: true }).click();
}

/** Searches and clicks the result at `index` `times` times, waiting for each entry. */
export async function addFromSearch(page: Page, times = 1, index = 0) {
  await page.getByRole("tab", { name: "Search" }).click();
  if (!(await results(page).count())) {
    await search(page);
    await expect(results(page)).toHaveCount(3);
  }
  for (let i = 0; i < times; i++) {
    const before = await entries(page).count();
    await results(page).nth(index).click();
    await expect(entries(page)).toHaveCount(before + 1);
  }
}

export function uploadInput(page: Page): Locator {
  return page.getByLabel("Image files");
}

export async function upload(page: Page, files: Parameters<Locator["setInputFiles"]>[0]) {
  await page.getByRole("tab", { name: "Upload" }).click();
  await uploadInput(page).setInputFiles(files);
}

export function cropDialog(page: Page): Locator {
  return page.getByRole("dialog");
}

/** Waits for the dialog's slide-in to end, so positions read from it are final. */
export async function settled(locator: Locator) {
  await expect(locator).toBeVisible();
  await locator.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
  );
}

export function cropFrame(page: Page): Locator {
  return cropDialog(page).getByTestId("crop-frame");
}

export async function cropOf(locator: Locator): Promise<number[]> {
  const value = await locator.getAttribute("data-crop");
  return value!.split(",").map(Number);
}

export async function uploadAndConfirm(page: Page, file: string) {
  const before = await entries(page).count();
  await upload(page, file);
  await cropDialog(page).getByRole("button", { name: "Add card" }).click();
  await expect(cropDialog(page)).toBeHidden();
  await expect(entries(page)).toHaveCount(before + 1);
}

export function sticker(entry: Locator): Locator {
  return entry.getByTestId("sticker");
}

/** The preview's text lines as [text, size in pt]. */
export async function previewLines(entry: Locator): Promise<[string, number][]> {
  return sticker(entry)
    .locator("text")
    .evaluateAll((els) =>
      els.map((e) => [e.textContent ?? "", Number(e.getAttribute("data-size"))]),
    );
}

export async function downloadPdf(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download PDF" }).click(),
  ]);
  const path = await download.path();
  const bytes = new Uint8Array(readFileSync(path));
  return { filename: download.suggestedFilename(), bytes, pages: await inspectPdf(bytes) };
}

export async function setInset(page: Page, value: string) {
  const input = page.getByLabel("Inset (mm)");
  await input.fill(value);
  await input.blur();
}

/**
 * Takes a screenshot of `locator` and returns the colours at the given
 * fractional positions, decoded in the page.
 */
export async function sampleColours(
  page: Page,
  locator: Locator,
  points: [number, number][],
): Promise<[number, number, number][]> {
  const png = (await locator.screenshot({ animations: "disabled" })).toString("base64");
  return page.evaluate(
    async ({ png, points }) => {
      const blob = await (await fetch(`data:image/png;base64,${png}`)).blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      return points.map(([fx, fy]) => {
        const d = ctx.getImageData(
          Math.floor(fx * bitmap.width),
          Math.floor(fy * bitmap.height),
          1,
          1,
        ).data;
        return [d[0]!, d[1]!, d[2]!] as [number, number, number];
      });
    },
    { png, points },
  );
}

export const RED = [230, 30, 30];
export const GREEN = [30, 170, 60];
export const BLUE = [30, 60, 220];
export const YELLOW = [250, 210, 30];

export function expectColour(actual: number[], expected: number[], tolerance = 40) {
  const distance = Math.max(...actual.map((v, i) => Math.abs(v - expected[i]!)));
  expect(distance, `${actual} ≈ ${expected}`).toBeLessThanOrEqual(tolerance);
}
