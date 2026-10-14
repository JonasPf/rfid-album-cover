<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import {
    MAX_ZOOM,
    initialCrop,
    panCrop,
    roundCrop,
    zoomCrop,
    zoomOf,
    type Crop,
  } from "../lib/crop";
  import type { SourceImage } from "../lib/images";
  import { duration } from "../lib/motion";

  let {
    image,
    initial,
    mode,
    key,
    onconfirm,
    oncancel,
  }: {
    image: SourceImage;
    /** The crop to start from; null starts at minimum zoom, centred. */
    initial: Crop | null;
    mode: "new" | "recrop";
    /** Changes for every image, so a queue of images each starts afresh. */
    key: number;
    onconfirm: (crop: Crop) => void;
    oncancel: () => void;
  } = $props();

  // Resets whenever a new image (key) comes in; the user's edits overwrite it.
  let crop = $derived.by<Crop>(() => {
    void key;
    return initial ? { ...initial } : initialCrop(image);
  });
  let frameSize = $state(0);
  let frame: HTMLDivElement;
  let dialog: HTMLDivElement;
  let drag = $state<{ pointer: number; x: number; y: number; start: Crop } | null>(null);

  const scale = $derived(frameSize / crop.size);
  const zoom = $derived(zoomOf(image, crop));
  const shown = $derived(roundCrop(image, crop));

  $effect(() => {
    dialog.focus();
  });

  // Registered by hand: the wheel listener must not be passive to stop page scrolling.
  $effect(() => {
    const onwheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = frame.getBoundingClientRect();
      const anchor = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
      const delta = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaY;
      crop = zoomCrop(image, crop, zoom * Math.exp(-delta * 0.002), anchor);
    };
    frame.addEventListener("wheel", onwheel, { passive: false });
    return () => frame.removeEventListener("wheel", onwheel);
  });

  function onpointerdown(e: PointerEvent) {
    if (e.button !== 0) return;
    frame.setPointerCapture(e.pointerId);
    drag = { pointer: e.pointerId, x: e.clientX, y: e.clientY, start: crop };
  }

  function onpointermove(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointer) return;
    // The button was released where we got no pointerup, e.g. outside the window.
    if (e.pointerType === "mouse" && e.buttons === 0) {
      drag = null;
      return;
    }
    const s = frameSize / drag.start.size;
    // Dragging the image right shows more of its left side.
    crop = panCrop(image, drag.start, -(e.clientX - drag.x) / s, -(e.clientY - drag.y) / s);
  }

  function onpointerup(e: PointerEvent) {
    if (drag?.pointer === e.pointerId) drag = null;
  }

  const ARROWS: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };

  function onframekeydown(e: KeyboardEvent) {
    const arrow = ARROWS[e.key];
    if (!arrow) return;
    e.preventDefault();
    const step = crop.size * 0.05;
    crop = panCrop(image, crop, arrow[0] * step, arrow[1] * step);
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      oncancel();
    }
  }
</script>

<svelte:window {onkeydown} />

<div class="scrim" transition:fade={{ duration: duration(200) }}>
  <div
    bind:this={dialog}
    class="dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="crop-title"
    tabindex="-1"
    transition:fly={{ y: 400, duration: duration(300), opacity: 1 }}
  >
    <h2 id="crop-title">{mode === "recrop" ? "Re-crop image" : "Crop image"}</h2>
    <!-- A focusable application region is how ARIA marks a custom pointer and keyboard
         widget; Svelte's lint counts the role as non-interactive. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      bind:this={frame}
      bind:clientWidth={frameSize}
      class="frame"
      class:dragging={drag !== null}
      role="application"
      aria-label="Crop area: drag or use the arrow keys to move, scroll to zoom"
      tabindex="0"
      onkeydown={onframekeydown}
      data-testid="crop-frame"
      data-crop="{shown.x},{shown.y},{shown.size}"
      {onpointerdown}
      {onpointermove}
      {onpointerup}
      onpointercancel={onpointerup}
    >
      {#key key}
        <img
          src={image.url}
          alt=""
          draggable="false"
          style:width="{image.width * scale}px"
          style:height="{image.height * scale}px"
          style:transform="translate({-crop.x * scale}px, {-crop.y * scale}px)"
          in:fly={{ x: 120, duration: duration(300) }}
        />
      {/key}
    </div>
    <label class="zoom">
      Zoom
      <input
        type="range"
        min="1"
        max={MAX_ZOOM}
        step="0.01"
        value={zoom}
        oninput={(e) => (crop = zoomCrop(image, crop, Number(e.currentTarget.value)))}
      />
    </label>
    <div class="actions">
      <button type="button" onclick={oncancel}>Cancel</button>
      <button type="button" class="primary" onclick={() => onconfirm(roundCrop(image, crop))}>
        {mode === "recrop" ? "Apply" : "Add card"}
      </button>
    </div>
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.45);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 10;
  }

  .dialog {
    background: var(--panel);
    border-radius: 12px 12px 0 0;
    padding: 16px;
    /* Leaves room for the title and buttons on short screens. */
    width: min(440px, 100%, calc(100vh - 140px));
    box-shadow: 0 -8px 32px rgb(0 0 0 / 0.25);
  }

  .dialog:focus {
    outline: none;
  }

  h2 {
    font-size: 16px;
    margin: 0 0 12px;
  }

  .frame {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 4px;
    overflow: hidden;
    position: relative;
    cursor: grab;
    background: #000;
    touch-action: none;
    user-select: none;
  }

  .frame.dragging {
    cursor: grabbing;
  }

  .frame::after {
    content: "";
    position: absolute;
    inset: 0;
    box-shadow: inset 0 0 0 2px rgb(255 255 255 / 0.5);
    pointer-events: none;
  }

  img {
    position: absolute;
    top: 0;
    left: 0;
    max-width: none;
    transform-origin: 0 0;
    pointer-events: none;
  }

  .zoom {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 12px 0;
    font-size: 14px;
  }

  .zoom input {
    flex: 1;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
