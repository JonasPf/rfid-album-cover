import { expect, test } from "@playwright/test";
import { downloadPdf, fixture, stubItunes, uploadAndConfirm } from "./helpers";

// Runs against `vite --force`, so dependencies are optimized from scratch as on a first `task run`.
// A dependency Vite only discovers when Download PDF lazy-loads it makes Vite reload the page,
// and the leave-page guard then asks the user whether to throw their cards away.
test("the first Download PDF on the dev server does not reload the page", async ({ page }) => {
  const interruptions: string[] = [];
  page.on("dialog", (dialog) => {
    interruptions.push(`${dialog.type()} dialog`);
    void dialog.dismiss();
  });
  page.on("websocket", (ws) =>
    ws.on("framereceived", ({ payload }) => {
      if (String(payload).includes('"full-reload"')) interruptions.push("full reload");
    }),
  );
  await stubItunes(page);
  await page.goto("/");
  await uploadAndConfirm(page, fixture("art-1200.jpg"));

  await downloadPdf(page);

  expect(interruptions).toEqual([]);
});
