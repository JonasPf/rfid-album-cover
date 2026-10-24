import { expect, test, type Locator } from "@playwright/test";
import {
  addFromSearch,
  emojiButton,
  emojiButtons,
  emojiNames,
  emojiPanel,
  entries,
  openEmoji,
  searchEmoji,
  sticker,
  stubItunes,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await stubItunes(page);
  await page.goto("/");
});

/** The box around the entry image's non-white pixels, in image pixels, and its corner colour. */
async function artBounds(entry: Locator) {
  return sticker(entry)
    .locator("image")
    .evaluate(async (el) => {
      const img = new Image();
      img.src = el.getAttribute("href")!;
      await img.decode();
      const canvas = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let [left, top, right, bottom] = [width, height, -1, -1];
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          if (Math.min(data[i]!, data[i + 1]!, data[i + 2]!) > 240) continue;
          left = Math.min(left, x);
          right = Math.max(right, x + 1);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y + 1);
        }
      }
      return { left, top, right, bottom, corner: [...data.slice(0, 4)] };
    });
}

test.describe("Emoji", () => {
  test("AC-EMOJI-1: the tab lists the emoji by category, in Unicode order, with names", async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/emoji/")) requests.push(r.url());
    });
    await page.waitForLoadState("networkidle");
    expect(requests).toEqual([]);

    await openEmoji(page);
    await expect(emojiPanel(page).getByRole("heading")).toHaveText([
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
    const names = await emojiNames(page);
    expect(names.slice(0, 3)).toEqual([
      "Grinning face",
      "Grinning face with big eyes",
      "Grinning face with smiling eyes",
    ]);
    expect(names.length).toBeGreaterThan(1500);
    expect(names.filter((n) => n.includes("skin tone"))).toEqual([]);
    expect(names.indexOf("Lion")).toBeLessThan(names.indexOf("Rocket"));

    const first = emojiButtons(page).first();
    await expect(first).toHaveAttribute("title", "Grinning face");
    const img = first.locator("img");
    await expect(img).toHaveAttribute("src", /emoji\/1f600\.svg$/);
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth))
      .toBe(128);
  });

  test("AC-EMOJI-2: a term matches the start of words in names and keywords", async ({ page }) => {
    await searchEmoji(page, "LION");
    await expect.poll(() => emojiNames(page)).toEqual(["Lion", "Seal", "Leo"]);
    await expect(emojiPanel(page).getByRole("heading")).toHaveCount(0);

    await searchEmoji(page, "rock");
    await expect.poll(() => emojiNames(page)).toEqual(expect.arrayContaining(["Rock", "Rocket"]));
    expect(await emojiNames(page)).not.toContain("Tiger face");
  });

  test("AC-EMOJI-3: a term made of emoji shows exactly those", async ({ page }) => {
    await searchEmoji(page, "🦁🚀");
    await expect.poll(() => emojiNames(page)).toEqual(["Lion", "Rocket"]);

    await searchEmoji(page, "👋🏽");
    await expect.poll(() => emojiNames(page)).toEqual(["Waving hand: medium skin tone"]);
    await expect(emojiButtons(page).locator("img")).toHaveAttribute(
      "src",
      /emoji\/1f44b-1f3fd\.svg$/,
    );
  });

  for (const term of ["xyzzy", "🇩🇪"]) {
    test(`AC-EMOJI-4: "${term}" shows "No emoji found"`, async ({ page }) => {
      await searchEmoji(page, term);
      await expect(emojiPanel(page).getByText("No emoji found")).toBeVisible();
      await expect(emojiButtons(page)).toHaveCount(0);
    });
  }

  test("AC-EMOJI-5: clicking an emoji appends an entry with a 1200 px image", async ({ page }) => {
    await addFromSearch(page);
    await searchEmoji(page, "lion");
    await emojiButton(page, "Lion").click();
    await expect(entries(page)).toHaveCount(2);

    const entry = entries(page).nth(1);
    await expect(entry.getByLabel("Artist", { exact: true })).toHaveValue("");
    await expect(entry.getByLabel("Title", { exact: true })).toHaveValue("");
    await expect(sticker(entry)).toHaveAttribute("data-image-size", "1200x1200");
    await expect(sticker(entry)).toHaveAttribute("data-crop", "0,0,1200");
    await expect(entry.getByText("Low resolution")).toBeHidden();
    await expect(entry.getByText("Text too long")).toBeHidden();

    await emojiButton(page, "Lion").click();
    await expect(entries(page)).toHaveCount(3);
    await expect(sticker(entries(page).nth(2))).toHaveAttribute("data-image-size", "1200x1200");
  });

  test("AC-EMOJI-6: the emoji is centred on white and fills 84 % of the image", async ({
    page,
  }) => {
    await searchEmoji(page, "🔴➖");
    await emojiButton(page, "Red circle").click();
    await expect(entries(page)).toHaveCount(1);
    await emojiButton(page, "Minus").click();
    await expect(entries(page)).toHaveCount(2);

    const circle = await artBounds(entries(page).nth(0));
    expect(circle.corner).toEqual([255, 255, 255, 255]);
    for (const edge of [circle.left, circle.top])
      expect(Math.abs(edge - 96)).toBeLessThanOrEqual(3);
    for (const edge of [circle.right, circle.bottom]) {
      expect(Math.abs(edge - 1104)).toBeLessThanOrEqual(3);
    }

    const minus = await artBounds(entries(page).nth(1));
    expect(minus.corner).toEqual([255, 255, 255, 255]);
    expect(Math.abs(minus.left - 96)).toBeLessThanOrEqual(3);
    expect(Math.abs(minus.right - 1104)).toBeLessThanOrEqual(3);
    expect(minus.bottom - minus.top).toBeLessThan(600);
    expect(Math.abs((minus.top + minus.bottom) / 2 - 600)).toBeLessThanOrEqual(3);
  });

  test("AC-EMOJI-7: if the graphic fails to load, nothing is added and an error shows", async ({
    page,
  }) => {
    await page.route("**/emoji/1f981.svg", (route) => route.fulfill({ status: 404 }));
    await searchEmoji(page, "lion");
    await emojiButton(page, "Lion").click();
    await expect(emojiPanel(page).getByText("Could not load emoji", { exact: true })).toBeVisible();
    await expect(entries(page)).toHaveCount(0);
  });

  test("AC-EMOJI-7: if the list fails to load, the tab says so", async ({ page }) => {
    await page.route("**/emoji/index.json", (route) => route.fulfill({ status: 404 }));
    await openEmoji(page);
    await expect(emojiPanel(page).getByText("Could not load the emoji list")).toBeVisible();
    await expect(emojiButtons(page)).toHaveCount(0);
  });
});
