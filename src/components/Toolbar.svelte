<script lang="ts">
  import { renderArtJpeg } from "../lib/art";
  import { cards } from "../lib/cards.svelte";
  import { saveFile } from "../lib/download";
  import { loadFonts } from "../lib/fonts";
  import { INSET, artPixelSizeForCrop, clampInset, sheetCount } from "../lib/geometry";

  let busy = $state(false);
  let failed = $state(false);

  const n = $derived(cards.list.length);
  const sheets = $derived(sheetCount(n));
  const countText = $derived(
    `${n} card${n === 1 ? "" : "s"} · ${sheets} sheet${sheets === 1 ? "" : "s"}`,
  );

  function onInsetInput(e: Event & { currentTarget: HTMLInputElement }) {
    const value = Number.parseFloat(e.currentTarget.value);
    if (Number.isFinite(value)) cards.inset = clampInset(value, cards.inset);
  }

  function onInsetCommit(e: Event & { currentTarget: HTMLInputElement }) {
    cards.inset = clampInset(Number.parseFloat(e.currentTarget.value), cards.inset);
    e.currentTarget.value = cards.inset.toFixed(1);
  }

  async function download() {
    busy = true;
    failed = false;
    try {
      const inset = cards.inset;
      const [{ buildPdf }, fonts] = await Promise.all([import("../lib/pdf"), loadFonts()]);
      const pdfCards = await Promise.all(
        cards.list.map(async (c) => ({
          artist: c.artist,
          title: c.title,
          art: await renderArtJpeg(c.image, c.crop, artPixelSizeForCrop(c.crop.size, inset)),
        })),
      );
      saveFile(await buildPdf(pdfCards, inset, fonts), "rfid-cards.pdf", "application/pdf");
    } catch (error) {
      console.error(error);
      failed = true;
    } finally {
      busy = false;
    }
  }
</script>

<div class="bar">
  <span class="count" data-testid="count" aria-live="polite">{countText}</span>
  <label>
    Inset (mm)
    <input
      type="number"
      min={INSET.min}
      max={INSET.max}
      step={INSET.step}
      value={INSET.default.toFixed(1)}
      oninput={onInsetInput}
      onchange={onInsetCommit}
      onblur={onInsetCommit}
    />
  </label>
  <div class="download">
    <button class="primary" disabled={n === 0 || busy} aria-busy={busy} onclick={download}
      >Download PDF</button
    >
    <div class="hint">Print at 100 % / Actual size</div>
  </div>
</div>
{#if failed}
  <p class="msg error" role="alert">Could not create the PDF. Try again.</p>
{/if}

<style>
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 16px;
    margin-bottom: 16px;
  }

  .count {
    font-weight: 600;
    margin-right: auto;
  }

  label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    white-space: nowrap;
  }

  input {
    width: 70px;
  }

  .download {
    text-align: right;
  }
</style>
