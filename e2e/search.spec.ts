import { expect, test } from "@playwright/test";
import {
  addFromSearch,
  entries,
  results,
  search,
  sticker,
  stubItunes,
  previewLines,
} from "./helpers";

test.describe("Search", () => {
  test("AC-SEARCH-1: Enter or the button sends one request with the parameters, term encoded", async ({
    page,
  }) => {
    const stub = await stubItunes(page);
    await page.goto("/");
    const box = page.getByRole("searchbox", { name: "Artist or album" });

    await box.fill("AC/DC & Friends");
    await box.press("Enter");
    await expect(results(page)).toHaveCount(3);
    expect(stub.searches).toHaveLength(1);

    const url = new URL(stub.searches[0]!);
    expect(url.origin + url.pathname).toBe("https://itunes.apple.com/search");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      term: "AC/DC & Friends",
      media: "music",
      entity: "album",
      country: "US",
      limit: "25",
    });
    expect(url.search).not.toContain("AC/DC & Friends");
    expect(url.search).toContain("term=AC%2FDC+%26+Friends");

    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect.poll(() => stub.searches.length).toBe(2);
  });

  test("AC-SEARCH-2: results show thumbnail, artist and title in API order", async ({ page }) => {
    await stubItunes(page);
    await page.goto("/");
    await search(page);
    await expect(results(page)).toHaveCount(3);
    await expect(results(page).nth(0)).toContainText("The Beatles");
    await expect(results(page).nth(0)).toContainText("Abbey Road (Remastered)");
    await expect(results(page).nth(1)).toContainText("Revolver");
    await expect(results(page).nth(2)).toContainText("Rolf Zuckowski");
    const thumb = results(page).nth(0).locator("img");
    await expect(thumb).toHaveAttribute("src", /fixture\/abbey\/source\/100x100bb\.jpg$/);
    await expect
      .poll(() => thumb.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
      .toBe(100);
  });

  test("AC-SEARCH-3: clicking a result appends an entry with its artist, title and 1200 px art", async ({
    page,
  }) => {
    const stub = await stubItunes(page);
    await page.goto("/");
    await addFromSearch(page, 1, 1);
    const entry = entries(page).first();
    await expect(entry.getByLabel("Artist", { exact: true })).toHaveValue("The Beatles");
    await expect(entry.getByLabel("Title", { exact: true })).toHaveValue("Revolver");
    expect(stub.artwork).toContain(
      "https://is1-ssl.mzstatic.com/image/thumb/Music/v4/fixture/revolver/source/1200x1200bb.jpg",
    );
    await expect(sticker(entry)).toHaveAttribute("data-image-size", "1200x1200");
    await expect(sticker(entry)).toHaveAttribute("data-crop", "0,0,1200");
    expect(await previewLines(entry)).toEqual([
      ["The Beatles", 8.25],
      ["Revolver", 11],
    ]);

    // Appends to the end.
    await addFromSearch(page, 1, 0);
    await expect(entries(page).nth(1).getByLabel("Title", { exact: true })).toHaveValue(
      "Abbey Road (Remastered)",
    );
  });

  test("AC-SEARCH-4: clicking the same result twice adds two entries", async ({ page }) => {
    await stubItunes(page);
    await page.goto("/");
    await addFromSearch(page, 2, 0);
    await expect(entries(page)).toHaveCount(2);
    await expect(results(page)).toHaveCount(3);
    for (const entry of await entries(page).all()) {
      await expect(entry.getByLabel("Title", { exact: true })).toHaveValue(
        "Abbey Road (Remastered)",
      );
    }
  });

  test("AC-SEARCH-5: zero results show 'No albums found'", async ({ page }) => {
    await stubItunes(page, { search: "empty" });
    await page.goto("/");
    await search(page, "zzzzqqq");
    await expect(page.getByText("No albums found")).toBeVisible();
    await expect(results(page)).toHaveCount(0);
  });

  for (const failure of ["http-error", "network-error"] as const) {
    test(`AC-SEARCH-6: a ${failure} shows the failure message and keeps entries`, async ({
      page,
    }) => {
      const stub = await stubItunes(page);
      await page.goto("/");
      await addFromSearch(page, 2);
      await page.unrouteAll();
      await stubItunes(page, { search: failure });
      await search(page, "something else");
      await expect(
        page.getByText("Search failed. Check your connection and try again."),
      ).toBeVisible();
      await expect(entries(page)).toHaveCount(2);
      expect(stub.searches).toHaveLength(1);
    });
  }

  test("AC-SEARCH-7: if the artwork fails, nothing is added and an error shows", async ({
    page,
  }) => {
    await stubItunes(page, { failArtwork: true });
    await page.goto("/");
    await search(page);
    await results(page).first().click();
    await expect(page.getByText("Could not load cover art")).toBeVisible();
    await expect(entries(page)).toHaveCount(0);
  });

  test("AC-SEARCH-8: an empty or whitespace-only term sends no request", async ({ page }) => {
    const stub = await stubItunes(page);
    await page.goto("/");
    const box = page.getByRole("searchbox", { name: "Artist or album" });
    await box.fill("");
    await box.press("Enter");
    await box.fill("   ");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    // Then a real search, to show the page was able to send one.
    await search(page, "beatles");
    await expect(results(page)).toHaveCount(3);
    expect(stub.searches).toHaveLength(1);
    expect(new URL(stub.searches[0]!).searchParams.get("term")).toBe("beatles");
  });
});
