<script lang="ts">
  import { SUPPORTED_TYPES, loadUpload, type SourceImage } from "../lib/images";

  let { onimages }: { onimages: (images: SourceImage[]) => void } = $props();

  let errors = $state<string[]>([]);
  let dragging = $state(false);
  let input: HTMLInputElement;

  async function add(files: Iterable<File>) {
    errors = [];
    const images: SourceImage[] = [];
    for (const file of files) {
      try {
        images.push(await loadUpload(file));
      } catch {
        errors.push(`${file.name} is not a supported image (JPEG, PNG, WebP)`);
      }
    }
    if (images.length) onimages(images);
  }

  function onchange(e: Event & { currentTarget: HTMLInputElement }) {
    const files = [...(e.currentTarget.files ?? [])];
    // Allow choosing the same file again.
    e.currentTarget.value = "";
    void add(files);
  }

  function ondragover(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    dragging = true;
  }

  function ondrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    void add([...(e.dataTransfer?.files ?? [])]);
  }
</script>

<section
  class="drop"
  class:dragging
  data-testid="drop-zone"
  aria-label="Upload images"
  ondragenter={ondragover}
  {ondragover}
  ondragleave={() => (dragging = false)}
  {ondrop}
>
  <p>Drop images here</p>
  <p class="hint">JPEG, PNG or WebP</p>
  <button type="button" onclick={() => input.click()}>Choose files…</button>
  <input
    bind:this={input}
    type="file"
    accept={SUPPORTED_TYPES.join(",")}
    multiple
    hidden
    aria-label="Image files"
    {onchange}
  />
</section>
{#each errors as error, i (i)}
  <p class="msg error" role="alert">{error}</p>
{/each}

<style>
  .drop {
    border: 2px dashed var(--line);
    border-radius: 8px;
    padding: 32px 16px;
    text-align: center;
    color: var(--muted);
    transition:
      border-color 0.2s ease,
      background-color 0.2s ease;
  }

  .drop.dragging {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  p {
    margin: 0;
  }

  button {
    margin-top: 12px;
  }
</style>
