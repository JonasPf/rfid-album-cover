<script lang="ts">
  import type { CardEntry } from "../lib/cards.svelte";
  import type { FontPair } from "../lib/fontmetrics";
  import { cropDpi, isLowResolution, stickerGeometry } from "../lib/geometry";
  import { fitText } from "../lib/textfit";
  import StickerPreview from "./StickerPreview.svelte";

  let {
    entry,
    inset,
    metrics,
    onrecrop,
    onremove,
  }: {
    entry: CardEntry;
    inset: number;
    metrics: FontPair;
    onrecrop: () => void;
    onremove: () => void;
  } = $props();

  const fit = $derived(
    fitText({ artist: entry.artist, title: entry.title }, stickerGeometry(inset).textBox, metrics),
  );
  const lowResolution = $derived(isLowResolution(entry.crop.size, inset));
</script>

<article class="entry">
  <StickerPreview {entry} {inset} {fit} />
  <div class="fields">
    <label>
      Artist
      <input type="text" autocomplete="off" spellcheck="false" bind:value={entry.artist} />
    </label>
    <label>
      Title
      <input
        id="title-{entry.id}"
        type="text"
        autocomplete="off"
        spellcheck="false"
        bind:value={entry.title}
      />
    </label>
    {#if !fit.fits || lowResolution}
      <div class="warnings">
        {#if !fit.fits}<span class="warn">Text too long</span>{/if}
        {#if lowResolution}
          <span class="warn">Low resolution ({cropDpi(entry.crop.size, inset)} dpi)</span>
        {/if}
      </div>
    {/if}
    <div class="actions">
      <button type="button" onclick={onrecrop}>Re-crop</button>
      <button type="button" onclick={onremove}>Remove</button>
    </div>
  </div>
</article>

<style>
  .entry {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 12px;
  }

  @media (max-width: 480px) {
    .entry {
      flex-direction: column;
    }
  }

  .fields {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  label {
    font-size: 12px;
    color: var(--muted);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  label input {
    color: var(--fg);
    font-size: 15px;
  }

  .warnings {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .warn {
    background: var(--warnbg);
    color: var(--warn);
    font-size: 12px;
    border-radius: 4px;
    padding: 2px 6px;
  }

  .actions {
    display: flex;
    gap: 8px;
  }
</style>
