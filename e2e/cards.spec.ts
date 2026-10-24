import { expect, test } from "@playwright/test";
import {
  addFromSearch,
  count,
  cropDialog,
  cropFrame,
  cropOf,
  entries,
  fixture,
  previewLines,
  sticker,
  stubItunes,
  uploadAndConfirm,
} from "./helpers";

const ROLF =
  "Rolfs Vogelhochzeit, Weihnachtsbäckerei und viele andere Lieder für die ganze Familie zum Mitsingen, Tanzen und Träumen";
const LONG_WORD = "Donaudampfschifffahrtsgesellschaftskapitänsmützenabzeichen";

test.beforeEach(async ({ page }) => {
  await stubItunes(page);
  await page.goto("/");
});

test.describe("Card list", () => {
  test("AC-CARD-1: with no entries, the empty message shows and the PDF button is disabled", async ({
    page,
  }) => {
    await expect(
      page.getByText("No cards yet. Search for an album, upload an image or pick an emoji."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeDisabled();
    await expect(count(page)).toHaveText("0 cards · 0 sheets");
  });

  test("AC-CARD-2: entries appear in the order added, with card and sheet counts", async ({
    page,
  }) => {
    await addFromSearch(page, 1, 1);
    await expect(count(page)).toHaveText("1 card · 1 sheet");
    await uploadAndConfirm(page, fixture("small-250.png"));
    await addFromSearch(page, 1, 0);
    await expect(count(page)).toHaveText("3 cards · 1 sheet");
    const titles = await entries(page)
      .getByLabel("Title", { exact: true })
      .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
    expect(titles).toEqual(["Revolver", "", "Abbey Road (Remastered)"]);
    await expect(page.getByText("No cards yet.")).toBeHidden();
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeEnabled();

    await addFromSearch(page, 6);
    await expect(count(page)).toHaveText("9 cards · 1 sheet");
    await addFromSearch(page, 1);
    await expect(count(page)).toHaveText("10 cards · 2 sheets");
  });

  test("AC-CARD-3: editing artist or title updates the preview at once", async ({ page }) => {
    await addFromSearch(page);
    const entry = entries(page).first();
    await entry.getByLabel("Artist", { exact: true }).fill("Fab Four");
    await entry.getByLabel("Title", { exact: true }).fill("Something New");
    await expect
      .poll(() => previewLines(entry))
      .toEqual([
        ["Fab Four", 8.25],
        ["Something New", 11],
      ]);
    await entry.getByLabel("Artist", { exact: true }).fill("");
    await expect.poll(() => previewLines(entry)).toEqual([["Something New", 11]]);
  });

  test("AC-CARD-4: re-crop opens with the current crop and applying updates the preview", async ({
    page,
  }) => {
    await uploadAndConfirm(page, fixture("wide-1600x900.jpg"));
    const entry = entries(page).first();
    await entry.getByRole("button", { name: "Re-crop" }).click();
    await expect(cropDialog(page)).toHaveAccessibleName("Re-crop image");
    await expect(cropFrame(page)).toHaveAttribute("data-crop", "350,0,900");
    await cropDialog(page).getByRole("slider", { name: "Zoom" }).fill("2");
    await expect(cropFrame(page)).toHaveAttribute("data-crop", "575,225,450");
    await cropDialog(page).getByRole("button", { name: "Apply" }).click();
    await expect(cropDialog(page)).toBeHidden();
    await expect(sticker(entry)).toHaveAttribute("data-crop", "575,225,450");
    await expect(entries(page)).toHaveCount(1);

    // Re-cropping again starts from the new crop.
    await entry.getByRole("button", { name: "Re-crop" }).click();
    expect(await cropOf(cropFrame(page))).toEqual([575, 225, 450]);
    await expect(cropDialog(page).getByRole("slider", { name: "Zoom" })).toHaveValue("2");
  });

  test("AC-CARD-5: remove deletes at once, without confirmation, and updates the counts", async ({
    page,
  }) => {
    let dialogs = 0;
    page.on("dialog", (d) => {
      dialogs++;
      void d.dismiss();
    });
    await addFromSearch(page, 1, 0);
    await addFromSearch(page, 1, 1);
    await expect(count(page)).toHaveText("2 cards · 1 sheet");
    await entries(page).first().getByRole("button", { name: "Remove" }).click();
    await expect(count(page)).toHaveText("1 card · 1 sheet");
    await expect(entries(page)).toHaveCount(1);
    await expect(entries(page).first().getByLabel("Title", { exact: true })).toHaveValue(
      "Revolver",
    );
    await entries(page).first().getByRole("button", { name: "Remove" }).click();
    await expect(count(page)).toHaveText("0 cards · 0 sheets");
    await expect(page.getByText("No cards yet.")).toBeVisible();
    expect(dialogs).toBe(0);
  });

  test("AC-CARD-6: a short artist and title render at 11 pt with no warning", async ({ page }) => {
    await addFromSearch(page, 1, 1);
    const entry = entries(page).first();
    await expect(sticker(entry)).toHaveAttribute("data-title-size", "11");
    expect(await previewLines(entry)).toEqual([
      ["The Beatles", 8.25],
      ["Revolver", 11],
    ]);
    await expect(entry.getByText("Text too long")).toHaveCount(0);
    await expect(entry.getByText(/Low resolution/)).toHaveCount(0);
  });

  test("AC-CARD-7: a long title renders at the largest 0.5 pt step that fits, no warning", async ({
    page,
  }) => {
    await addFromSearch(page, 1, 2);
    const entry = entries(page).first();
    await expect(entry.getByLabel("Title", { exact: true })).toHaveValue(ROLF);
    await expect(sticker(entry)).toHaveAttribute("data-title-size", "9.5");
    await expect(sticker(entry)).toHaveAttribute("data-fits", "true");
    const lines = await previewLines(entry);
    expect(lines[0]).toEqual(["Rolf Zuckowski", 7.125]);
    expect(lines.length).toBeGreaterThan(3);
    for (const [, size] of lines.slice(1)) expect(size).toBe(9.5);
    expect(
      lines
        .slice(1)
        .map(([t]) => t)
        .join(" "),
    ).toBe(ROLF);
    await expect(entry.getByText("Text too long")).toHaveCount(0);
  });

  test("AC-CARD-8: a title that doesn't fit at 7 pt warns until shortened", async ({ page }) => {
    await addFromSearch(page, 1, 1);
    const entry = entries(page).first();
    const title = entry.getByLabel("Title", { exact: true });
    await title.fill(`The ${LONG_WORD} Collection`);
    await expect(entry.getByText("Text too long")).toBeVisible();
    await expect(sticker(entry)).toHaveAttribute("data-title-size", "7");
    await expect(sticker(entry)).toHaveAttribute("data-fits", "false");

    await title.fill("The Collection");
    await expect(entry.getByText("Text too long")).toHaveCount(0);
    await expect(sticker(entry)).toHaveAttribute("data-title-size", "11");

    // Too many lines also does not fit.
    await title.fill(Array.from({ length: 60 }, () => ROLF.split(" ")[0]).join(" "));
    await expect(entry.getByText("Text too long")).toBeVisible();
  });

  test("AC-CARD-9: a 250 px crop warns of low resolution, a 1200 px crop doesn't", async ({
    page,
  }) => {
    await uploadAndConfirm(page, fixture("small-250.png"));
    await addFromSearch(page);
    const [small, large] = await entries(page).all();
    await expect(small!.getByText("Low resolution (124 dpi)")).toBeVisible();
    await expect(large!.getByText(/Low resolution/)).toHaveCount(0);
  });

  test("AC-CARD-10: reloading asks for confirmation only while the list is not empty", async ({
    page,
  }) => {
    const seen: string[] = [];
    page.on("dialog", (d) => {
      seen.push(d.type());
      void d.accept();
    });

    // Interact first: browsers only ask after a user gesture.
    await page.getByRole("searchbox", { name: "Artist or album" }).click();
    await page.reload();
    expect(seen).toEqual([]);

    await addFromSearch(page);
    await page.reload();
    await expect.poll(() => seen).toEqual(["beforeunload"]);
    await expect(entries(page)).toHaveCount(0);
  });
});
