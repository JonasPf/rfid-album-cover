<script lang="ts">
  import type { CardEntry } from "../lib/cards.svelte";
  import { CARD, PT_PER_MM, stickerGeometry } from "../lib/geometry";
  import type { TextFit } from "../lib/textfit";

  /** Preview scale in CSS pixels per mm. */
  const PX_PER_MM = 3;

  let { entry, inset, fit }: { entry: CardEntry; inset: number; fit: TextFit } = $props();

  const g = $derived(stickerGeometry(inset));
  const clipId = $derived(`text-clip-${entry.id}`);
  const label = $derived(
    [entry.title, entry.artist].filter((s) => s.trim()).join(" by ") || "Untitled",
  );
</script>

<!-- One SVG user unit is 1 mm; the text uses the same layout as the PDF. -->
<svg
  class="sticker"
  data-testid="sticker"
  viewBox="0 0 {CARD.width} {CARD.height}"
  width={CARD.width * PX_PER_MM}
  height={CARD.height * PX_PER_MM}
  role="img"
  aria-label="Sticker preview: {label}"
  data-crop="{entry.crop.x},{entry.crop.y},{entry.crop.size}"
  data-image-size="{entry.image.width}x{entry.image.height}"
  data-title-size={fit.titleSize}
  data-fits={fit.fits}
>
  <defs>
    <clipPath id={clipId}>
      <rect x={g.textBox.x} y={g.textBox.y} width={g.textBox.width} height={g.textBox.height} />
    </clipPath>
  </defs>
  <rect
    class="card"
    x="0.15"
    y="0.15"
    width={CARD.width - 0.3}
    height={CARD.height - 0.3}
    rx={CARD.radius}
  />
  <g transform="translate({inset} {inset})">
    <rect class="paper" width={g.width} height={g.height} />
    <svg
      width={g.art.width}
      height={g.art.height}
      viewBox="{entry.crop.x} {entry.crop.y} {entry.crop.size} {entry.crop.size}"
      preserveAspectRatio="none"
    >
      <image
        href={entry.image.url}
        width={entry.image.width}
        height={entry.image.height}
        preserveAspectRatio="none"
      />
    </svg>
    <rect data-testid="art" class="art" width={g.art.width} height={g.art.height} />
    <g clip-path="url(#{clipId})">
      {#each fit.lines as line, i (i)}
        <text
          x={g.textBox.x + line.x}
          y={g.textBox.y + line.baseline}
          font-size={line.size / PT_PER_MM}
          font-weight={line.bold ? 700 : 400}
          class:artist={!line.bold}
          data-size={line.size}>{line.text}</text
        >
      {/each}
    </g>
    <rect class="outline" width={g.width} height={g.height} />
  </g>
</svg>

<style>
  .sticker {
    flex: none;
    display: block;
  }

  .card {
    fill: #fff;
    stroke: var(--card-edge);
    stroke-width: 0.3;
  }

  .paper {
    fill: #fff;
  }

  .art {
    fill: transparent;
  }

  .outline {
    fill: none;
    stroke: rgb(0 0 0 / 0.2);
    stroke-width: 0.25;
    stroke-dasharray: 1 0.8;
  }

  text {
    font-family: "Inter RFID", sans-serif;
    /* The PDF has no kerning, so the preview leaves it out too. */
    font-kerning: none;
    fill: #000;
    white-space: pre;
  }

  text.artist {
    fill: #555;
  }
</style>
