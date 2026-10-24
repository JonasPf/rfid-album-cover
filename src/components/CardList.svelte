<script lang="ts">
  import { flip } from "svelte/animate";
  import { fly } from "svelte/transition";
  import { cards, type CardEntry } from "../lib/cards.svelte";
  import { duration } from "../lib/motion";
  import type { PdfFonts } from "../lib/pdf";
  import Card from "./Card.svelte";

  let { fonts, onrecrop }: { fonts: PdfFonts | null; onrecrop: (entry: CardEntry) => void } =
    $props();
</script>

{#if cards.list.length === 0}
  <p class="empty">No cards yet. Search for an album, upload an image or pick an emoji.</p>
{/if}
<ul class="list" aria-label="Cards">
  {#each cards.list as entry (entry.id)}
    <li
      animate:flip={{ duration: duration(250) }}
      in:fly={{ x: 60, duration: duration(350) }}
      out:fly={{ x: 80, duration: duration(300) }}
    >
      {#if fonts}
        <Card
          {entry}
          inset={cards.inset}
          metrics={fonts.metrics}
          onrecrop={() => onrecrop(entry)}
          onremove={() => cards.remove(entry.id)}
        />
      {:else}
        <p class="msg">Loading…</p>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .empty {
    color: var(--muted);
    text-align: center;
    padding: 48px 16px;
    border: 2px dashed var(--line);
    border-radius: 8px;
    margin: 0;
  }
</style>
