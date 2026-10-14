import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  BLUE,
  GREEN,
  RED,
  YELLOW,
  cropDialog,
  cropFrame,
  cropOf,
  entries,
  expectColour,
  fixture,
  sampleColours,
  settled,
  sticker,
  stubItunes,
  upload,
  uploadAndConfirm,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await stubItunes(page);
  await page.goto("/");
});

test.describe("Upload", () => {
  for (const file of ["wide-1600x900.jpg", "small-250.png", "photo-800x600.webp"]) {
    test(`AC-UPLOAD-1: choosing ${file} opens the crop dialog`, async ({ page }) => {
      await upload(page, fixture(file));
      await expect(cropDialog(page)).toBeVisible();
      await expect(cropDialog(page)).toHaveAccessibleName("Crop image");
      await expect(cropFrame(page).locator("img")).toBeVisible();
    });
  }

  test("AC-UPLOAD-2: dropping a file on the upload zone opens the crop dialog", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: "Upload" }).click();
    const bytes = [...readFileSync(fixture("wide-1600x900.jpg"))];
    const dataTransfer = await page.evaluateHandle((bytes) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(bytes)], "wide.jpg", { type: "image/jpeg" }));
      return dt;
    }, bytes);
    const zone = page.getByTestId("drop-zone");
    await zone.dispatchEvent("dragenter", { dataTransfer });
    await zone.dispatchEvent("dragover", { dataTransfer });
    await zone.dispatchEvent("drop", { dataTransfer });
    await expect(cropDialog(page)).toBeVisible();
    await expect(cropFrame(page)).toHaveAttribute("data-crop", "350,0,900");
  });

  test("AC-UPLOAD-3: unsupported or unreadable files show an error and add nothing", async ({
    page,
  }) => {
    await upload(page, [
      { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") },
      { name: "broken.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not really a jpeg") },
      { name: "anim.gif", mimeType: "image/gif", buffer: readFileSync(fixture("small-250.png")) },
    ]);
    for (const name of ["notes.txt", "broken.jpg", "anim.gif"]) {
      await expect(
        page.getByText(`${name} is not a supported image (JPEG, PNG, WebP)`),
      ).toBeVisible();
    }
    await expect(cropDialog(page)).toBeHidden();
    await expect(entries(page)).toHaveCount(0);
  });

  test("AC-UPLOAD-4: three files open the crop dialog three times, one entry each", async ({
    page,
  }) => {
    await upload(page, [
      fixture("wide-1600x900.jpg"),
      fixture("small-250.png"),
      fixture("photo-800x600.webp"),
    ]);
    const expected = ["350,0,900", "0,0,250", "100,0,600"];
    for (const [i, crop] of expected.entries()) {
      await expect(cropFrame(page)).toHaveAttribute("data-crop", crop);
      await cropDialog(page).getByRole("button", { name: "Add card" }).click();
      await expect(entries(page)).toHaveCount(i + 1);
    }
    await expect(cropDialog(page)).toBeHidden();
    const crops = await Promise.all((await entries(page).all()).map((e) => cropOf(sticker(e))));
    expect(crops.map((c) => c.join(","))).toEqual(expected);
  });

  test("AC-UPLOAD-5: confirming adds an entry with empty text and focuses its title", async ({
    page,
  }) => {
    await uploadAndConfirm(page, fixture("wide-1600x900.jpg"));
    const entry = entries(page).first();
    await expect(entry.getByLabel("Artist", { exact: true })).toHaveValue("");
    await expect(entry.getByLabel("Title", { exact: true })).toHaveValue("");
    await expect(entry.getByLabel("Title", { exact: true })).toBeFocused();
  });

  test("AC-UPLOAD-6: cancelling by button or Esc adds nothing; for a re-crop, changes nothing", async ({
    page,
  }) => {
    await upload(page, fixture("wide-1600x900.jpg"));
    await cropDialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(cropDialog(page)).toBeHidden();

    await upload(page, fixture("photo-800x600.webp"));
    await expect(cropDialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(cropDialog(page)).toBeHidden();
    await expect(entries(page)).toHaveCount(0);

    await uploadAndConfirm(page, fixture("wide-1600x900.jpg"));
    const preview = sticker(entries(page).first());
    for (const cancel of ["button", "Escape"]) {
      await entries(page).first().getByRole("button", { name: "Re-crop" }).click();
      await expect(cropDialog(page)).toHaveAccessibleName("Re-crop image");
      await cropDialog(page).getByRole("slider", { name: "Zoom" }).fill("3");
      await expect(cropFrame(page)).not.toHaveAttribute("data-crop", "350,0,900");
      if (cancel === "button") {
        await cropDialog(page).getByRole("button", { name: "Cancel" }).click();
      } else {
        await page.keyboard.press("Escape");
      }
      await expect(cropDialog(page)).toBeHidden();
      await expect(preview).toHaveAttribute("data-crop", "350,0,900");
    }
    await expect(entries(page)).toHaveCount(1);
  });

  test("AC-UPLOAD-6: with several files, cancelling moves on to the next file", async ({
    page,
  }) => {
    await upload(page, [fixture("wide-1600x900.jpg"), fixture("small-250.png")]);
    await expect(cropFrame(page)).toHaveAttribute("data-crop", "350,0,900");
    await page.keyboard.press("Escape");
    await expect(cropFrame(page)).toHaveAttribute("data-crop", "0,0,250");
    await cropDialog(page).getByRole("button", { name: "Add card" }).click();
    await expect(cropDialog(page)).toBeHidden();
    await expect(entries(page)).toHaveCount(1);
    await expect(sticker(entries(page).first())).toHaveAttribute("data-image-size", "250x250");
  });
});

test.describe("Crop dialog", () => {
  test("AC-CROP-1: a 1600 × 900 image starts with the centred 900 × 900 square", async ({
    page,
  }) => {
    await upload(page, fixture("wide-1600x900.jpg"));
    await expect(cropFrame(page)).toHaveAttribute("data-crop", "350,0,900");
    await expect(cropDialog(page).getByRole("slider", { name: "Zoom" })).toHaveValue("1");
  });

  test("AC-CROP-2: dragging moves the region, never past the image edges", async ({ page }) => {
    await upload(page, fixture("wide-1600x900.jpg"));
    const frame = cropFrame(page);
    await expect(frame).toHaveAttribute("data-crop", "350,0,900");
    await settled(cropDialog(page));
    const box = (await frame.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Drag the image a quarter frame to the left: the region moves right by 225 px.
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - box.width / 4, cy, { steps: 5 });
    await page.mouse.up();
    const [x, y, size] = await cropOf(frame);
    expect(size).toBe(900);
    expect(y).toBe(0);
    expect(x).toBeGreaterThanOrEqual(570);
    expect(x).toBeLessThanOrEqual(580);

    // Far to the left and down: stops at the right and top edges.
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - box.width * 3, cy + box.height, { steps: 5 });
    await page.mouse.up();
    await expect(frame).toHaveAttribute("data-crop", "700,0,900");

    // Far to the right: stops at the left edge.
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + box.width * 3, cy - box.height, { steps: 5 });
    await page.mouse.up();
    await expect(frame).toHaveAttribute("data-crop", "0,0,900");
  });

  test("AC-CROP-2: arrow keys move the region, never past the image edges", async ({ page }) => {
    await upload(page, fixture("wide-1600x900.jpg"));
    const frame = cropFrame(page);
    await frame.focus();
    await page.keyboard.press("ArrowRight");
    await expect(frame).toHaveAttribute("data-crop", "395,0,900");
    for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowLeft");
    await expect(frame).toHaveAttribute("data-crop", "0,0,900");
    await page.keyboard.press("ArrowDown");
    await expect(frame).toHaveAttribute("data-crop", "0,0,900");
  });

  test("AC-CROP-3: zoom stays between the minimum and 8× the minimum", async ({ page }) => {
    await upload(page, fixture("wide-1600x900.jpg"));
    const slider = cropDialog(page).getByRole("slider", { name: "Zoom" });
    await expect(slider).toHaveAttribute("min", "1");
    await expect(slider).toHaveAttribute("max", "8");

    await slider.fill("8");
    await expect(cropFrame(page)).toHaveAttribute("data-crop", "744,394,113");

    // The mouse wheel cannot go beyond either limit.
    await settled(cropDialog(page));
    const box = (await cropFrame(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 10; i++) await page.mouse.wheel(0, -500);
    expect((await cropOf(cropFrame(page)))[2]).toBe(113);
    for (let i = 0; i < 20; i++) await page.mouse.wheel(0, 500);
    await expect.poll(async () => (await cropOf(cropFrame(page)))[2]).toBe(900);
    await expect(slider).toHaveValue("1");
  });

  test("AC-CROP-4: the card preview shows the same region the frame did", async ({ page }) => {
    await upload(page, fixture("wide-1600x900.jpg"));
    const slider = cropDialog(page).getByRole("slider", { name: "Zoom" });
    await slider.fill("2"); // 450 px around the centre: all four quadrants meet in the middle
    const frame = cropFrame(page);
    await settled(cropDialog(page));
    const box = (await frame.boundingBox())!;
    // Pan so the quadrant corner sits a quarter in from the top left.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25, { steps: 5 });
    await page.mouse.up();
    const crop = await cropOf(frame);
    const points: [number, number][] = [
      [0.1, 0.1],
      [0.5, 0.1],
      [0.1, 0.5],
      [0.5, 0.5],
      [0.9, 0.2],
    ];
    const inFrame = await sampleColours(page, frame, points);
    await cropDialog(page).getByRole("button", { name: "Add card" }).click();
    await expect(cropDialog(page)).toBeHidden();

    const preview = sticker(entries(page).first());
    await expect(preview).toHaveAttribute("data-crop", crop.join(","));
    const inPreview = await sampleColours(page, preview.getByTestId("art"), points);
    for (const [i, colour] of inFrame.entries()) expectColour(inPreview[i]!, colour, 30);
    expectColour(inPreview[0]!, RED);
    expectColour(inPreview[1]!, GREEN);
    expectColour(inPreview[2]!, BLUE);
    expectColour(inPreview[3]!, YELLOW);
    expectColour(inPreview[4]!, GREEN);
  });
});
