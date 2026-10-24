<script lang="ts">
  import { searchEmoji, type Emoji, type EmojiIndex } from "../lib/emoji";
  import { loadEmoji, type SourceImage } from "../lib/images";

  let { active, onadd }: { active: boolean; onadd: (image: SourceImage) => void } = $props();

  const base = `${import.meta.env.BASE_URL}emoji/`;

  let index = $state.raw<EmojiIndex | null>(null);
  let status = $state<"idle" | "loading" | "ready" | "failed">("idle");
  let term = $state("");
  let artFailed = $state(false);
  let pending = $state(0);
  // Entries are added in click order, even if a later emoji renders first.
  let lastAdd: Promise<void> = Promise.resolve();

  const shown = $derived(index ? searchEmoji(index, term) : []);
  const groups = $derived.by(() => {
    if (!index || term.trim()) return null;
    return index.groups
      .map((name, i) => ({ name, emoji: shown.filter((e) => e.group === i) }))
      .filter((g) => g.emoji.length);
  });

  // Loaded the first time the tab opens.
  $effect(() => {
    if (active && status === "idle") void load();
  });

  async function load() {
    status = "loading";
    try {
      const response = await fetch(`${base}index.json`);
      if (!response.ok) throw new Error(`Emoji index failed with HTTP ${response.status}`);
      index = await response.json();
      status = "ready";
    } catch {
      status = "failed";
    }
  }

  function pick(emoji: Emoji) {
    artFailed = false;
    pending++;
    const loading = loadEmoji(`${base}${emoji.hex}.svg`);
    const previous = lastAdd;
    lastAdd = (async () => {
      await previous;
      try {
        onadd(await loading);
      } catch {
        artFailed = true;
      } finally {
        pending--;
      }
    })();
  }
</script>

{#snippet grid(list: Emoji[], label: string)}
  <ul class="grid" aria-label={label}>
    {#each list as emoji (emoji.hex)}
      <li>
        <button
          type="button"
          class="emoji"
          title={emoji.name}
          aria-label={emoji.name}
          onclick={() => pick(emoji)}
        >
          <img src="{base}{emoji.hex}.svg" alt="" width="32" height="32" loading="lazy" />
        </button>
      </li>
    {/each}
  </ul>
{/snippet}

<input type="search" aria-label="Search emoji" placeholder="Search emoji" bind:value={term} />

{#if status === "loading"}
  <p class="msg" role="status">Loading emoji…</p>
{:else if status === "failed"}
  <p class="msg error" role="alert">Could not load the emoji list</p>
{:else if status === "ready" && shown.length === 0}
  <p class="msg" role="status">No emoji found</p>
{/if}
{#if artFailed}
  <p class="msg error" role="alert">Could not load emoji</p>
{/if}

{#if shown.length}
  <div class="list" aria-busy={pending > 0}>
    {#if groups}
      {#each groups as group (group.name)}
        <h3>{group.name}</h3>
        {@render grid(group.emoji, group.name)}
      {/each}
    {:else}
      {@render grid(shown, "Matching emoji")}
    {/if}
  </div>
{/if}

<style>
  .list {
    margin-top: 12px;
    max-height: calc(100vh - 230px);
    min-height: 120px;
    overflow-y: auto;
  }

  h3 {
    position: sticky;
    top: 0;
    z-index: 1;
    margin: 0;
    padding: 6px 0 4px;
    background: var(--panel);
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
  }

  .grid {
    list-style: none;
    margin: 0 0 8px;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
    gap: 2px;
  }

  .emoji {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    aspect-ratio: 1;
    padding: 4px;
    border-color: transparent;
    background: none;
    transition: transform 0.15s ease;
  }

  .emoji:hover {
    background: var(--bg);
  }

  .emoji:active {
    transform: scale(0.92);
  }

  img {
    width: 32px;
    height: 32px;
  }
</style>
