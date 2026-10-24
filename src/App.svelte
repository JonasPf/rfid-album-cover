<script lang="ts">
  import { tick } from "svelte";
  import CardList from "./components/CardList.svelte";
  import CropDialog from "./components/CropDialog.svelte";
  import EmojiPanel from "./components/EmojiPanel.svelte";
  import SearchPanel from "./components/SearchPanel.svelte";
  import Toolbar from "./components/Toolbar.svelte";
  import UploadPanel from "./components/UploadPanel.svelte";
  import { cards, type CardEntry } from "./lib/cards.svelte";
  import { initialCrop, type Crop } from "./lib/crop";
  import { loadFonts } from "./lib/fonts";
  import { releaseImage, type SourceImage } from "./lib/images";
  import type { Album } from "./lib/itunes";
  import type { PdfFonts } from "./lib/pdf";

  type CropJob =
    | { id: number; kind: "new"; image: SourceImage }
    | { id: number; kind: "recrop"; entry: CardEntry };

  let tab = $state(0);
  let fonts = $state<PdfFonts | null>(null);
  let fontError = $state(false);
  let jobs = $state<CropJob[]>([]);
  let nextJob = 1;
  const job = $derived(jobs[0]);

  loadFonts().then(
    (f) => (fonts = f),
    () => (fontError = true),
  );

  $effect(() => {
    if (cards.list.length === 0) return;
    const confirmLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Older browsers need returnValue set to show the prompt.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", confirmLeave);
    return () => window.removeEventListener("beforeunload", confirmLeave);
  });

  function addFromSearch(image: SourceImage, album: Album) {
    cards.add(image, initialCrop(image), album.artist, album.title);
  }

  function addFromEmoji(image: SourceImage) {
    cards.add(image, initialCrop(image));
  }

  function queueUploads(images: SourceImage[]) {
    jobs.push(...images.map((image) => ({ id: nextJob++, kind: "new" as const, image })));
  }

  function recrop(entry: CardEntry) {
    jobs.push({ id: nextJob++, kind: "recrop", entry });
  }

  async function confirmCrop(crop: Crop) {
    const current = jobs.shift();
    if (!current) return;
    if (current.kind === "recrop") {
      current.entry.crop = crop;
      return;
    }
    const entry = cards.add(current.image, crop);
    if (jobs.length === 0) {
      await tick();
      document.getElementById(`title-${entry.id}`)?.focus();
    }
  }

  function cancelCrop() {
    const current = jobs.shift();
    if (current?.kind === "new") releaseImage(current.image);
  }
</script>

<header>
  <h1>RFID Album Cover</h1>
  <p>Print album covers as stickers for RFID cards.</p>
</header>

<main class="layout">
  <section class="panel" aria-labelledby="add-heading" style:--tab={tab}>
    <h2 id="add-heading">Add cards</h2>
    <div class="tabs" role="tablist">
      <button
        id="tab-search"
        role="tab"
        aria-selected={tab === 0}
        aria-controls="panel-search"
        onclick={() => (tab = 0)}>Search</button
      >
      <button
        id="tab-upload"
        role="tab"
        aria-selected={tab === 1}
        aria-controls="panel-upload"
        onclick={() => (tab = 1)}>Upload</button
      >
      <button
        id="tab-emoji"
        role="tab"
        aria-selected={tab === 2}
        aria-controls="panel-emoji"
        onclick={() => (tab = 2)}>Emoji</button
      >
      <span class="indicator"></span>
    </div>
    <div class="viewport">
      <div class="track">
        <div id="panel-search" role="tabpanel" aria-labelledby="tab-search" inert={tab !== 0}>
          <SearchPanel onadd={addFromSearch} />
        </div>
        <div id="panel-upload" role="tabpanel" aria-labelledby="tab-upload" inert={tab !== 1}>
          <UploadPanel onimages={queueUploads} />
        </div>
        <div id="panel-emoji" role="tabpanel" aria-labelledby="tab-emoji" inert={tab !== 2}>
          <EmojiPanel active={tab === 2} onadd={addFromEmoji} />
        </div>
      </div>
    </div>
  </section>

  <section class="panel" aria-label="Card list">
    <Toolbar />
    {#if fontError}
      <p class="msg error" role="alert">Could not load the font. Reload the page to try again.</p>
    {/if}
    <CardList {fonts} onrecrop={recrop} />
  </section>
</main>

{#if job}
  <CropDialog
    image={job.kind === "new" ? job.image : job.entry.image}
    initial={job.kind === "new" ? null : job.entry.crop}
    mode={job.kind}
    key={job.id}
    onconfirm={confirmCrop}
    oncancel={cancelCrop}
  />
{/if}

<style>
  header {
    padding: 16px;
    border-bottom: 1px solid var(--line);
    max-width: 1280px;
    margin: 0 auto;
  }

  h1 {
    margin: 0;
    font-size: 20px;
  }

  header p {
    margin: 2px 0 0;
    color: var(--muted);
    font-size: 14px;
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(300px, 380px) 1fr;
    gap: 16px;
    padding: 16px;
    max-width: 1280px;
    margin: 0 auto;
    align-items: start;
  }

  @media (max-width: 760px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }

  .panel {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 16px;
    min-width: 0;
  }

  h2 {
    font-size: 16px;
    margin: 0 0 12px;
  }

  .tabs {
    position: relative;
    display: flex;
    border-bottom: 1px solid var(--line);
    margin-bottom: 12px;
  }

  .tabs button {
    flex: 1;
    border: 0;
    background: none;
    padding: 8px;
    border-radius: 0;
    color: var(--muted);
  }

  .tabs button[aria-selected="true"] {
    color: var(--fg);
    font-weight: 600;
  }

  .indicator {
    position: absolute;
    bottom: -1px;
    left: 0;
    width: calc(100% / 3);
    height: 2px;
    background: var(--accent);
    transform: translateX(calc(var(--tab) * 100%));
    transition: transform 0.3s ease;
  }

  .viewport {
    overflow: hidden;
  }

  .track {
    display: flex;
    align-items: flex-start;
    width: 300%;
    transform: translateX(calc(var(--tab) * -100% / 3));
    transition: transform 0.35s ease;
  }

  .track > div {
    width: calc(100% / 3);
    padding: 2px;
  }

  /* Hidden panels still show while they slide, but don't make the open one taller. */
  .track > div[inert] {
    height: 0;
  }
</style>
