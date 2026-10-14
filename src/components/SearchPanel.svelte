<script lang="ts">
  import { loadArtwork, type SourceImage } from "../lib/images";
  import { searchAlbums, type Album } from "../lib/itunes";

  let { onadd }: { onadd: (image: SourceImage, album: Album) => void } = $props();

  let term = $state("");
  let albums = $state<Album[]>([]);
  let status = $state<"idle" | "searching" | "done" | "failed">("idle");
  let artFailed = $state(false);
  let pending = $state(0);
  let controller: AbortController | undefined;
  // Entries are added in click order, even if a later artwork loads first.
  let lastAdd: Promise<void> = Promise.resolve();

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const query = term.trim();
    if (!query) return;
    controller?.abort();
    const current = (controller = new AbortController());
    status = "searching";
    albums = [];
    try {
      const found = await searchAlbums(query, fetch, current.signal);
      if (current !== controller) return;
      albums = found;
      status = "done";
    } catch {
      if (current !== controller) return;
      status = "failed";
    }
  }

  function pick(album: Album) {
    artFailed = false;
    pending++;
    const loading = loadArtwork(album.artworkUrl);
    const previous = lastAdd;
    lastAdd = (async () => {
      await previous;
      try {
        onadd(await loading, album);
      } catch {
        artFailed = true;
      } finally {
        pending--;
      }
    })();
  }
</script>

<form class="search" role="search" onsubmit={submit}>
  <input
    type="search"
    aria-label="Artist or album"
    placeholder="Artist or album"
    bind:value={term}
  />
  <button class="primary">Search</button>
</form>

{#if status === "searching"}
  <p class="msg" role="status">Searching…</p>
{:else if status === "failed"}
  <p class="msg error" role="alert">Search failed. Check your connection and try again.</p>
{:else if status === "done" && albums.length === 0}
  <p class="msg" role="status">No albums found</p>
{/if}
{#if artFailed}
  <p class="msg error" role="alert">Could not load cover art</p>
{/if}

<ul class="results" aria-label="Search results" aria-busy={pending > 0}>
  {#each albums as album, i (i)}
    <li>
      <button type="button" class="result" onclick={() => pick(album)}>
        <img class="thumb" src={album.thumbnailUrl} alt="" width="100" height="100" />
        <span class="artist">{album.artist}</span>
        <span class="title">{album.title}</span>
      </button>
    </li>
  {/each}
</ul>

<style>
  .search {
    display: flex;
    gap: 8px;
  }

  .results {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    max-height: calc(100vh - 230px);
    min-height: 120px;
    overflow-y: auto;
  }

  .results:empty {
    display: none;
  }

  .result {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
    padding: 6px;
    width: 100%;
    height: 100%;
    transition:
      transform 0.15s ease,
      border-color 0.15s ease;
  }

  .result:active {
    transform: translateY(1px);
  }

  .thumb {
    width: 100%;
    height: auto;
    aspect-ratio: 1;
    border-radius: 4px;
    background: var(--line);
    object-fit: cover;
  }

  .artist {
    font-size: 12px;
    color: var(--muted);
  }

  .title {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.25;
  }
</style>
