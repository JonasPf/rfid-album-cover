/** A square region of the source image, in source pixels. */
export interface Crop {
  x: number;
  y: number;
  size: number;
}

export interface Size {
  width: number;
  height: number;
}

/** The maximum zoom, relative to the zoom at which the image just covers the frame. */
export const MAX_ZOOM = 8;

function minSide(image: Size): number {
  return Math.min(image.width, image.height);
}

/** The largest centred square: minimum zoom, centred. */
export function initialCrop(image: Size): Crop {
  const size = minSide(image);
  return { x: (image.width - size) / 2, y: (image.height - size) / 2, size };
}

export function zoomOf(image: Size, crop: Crop): number {
  return minSide(image) / crop.size;
}

/** Keeps the crop inside the image and its zoom within 1..MAX_ZOOM. */
export function clampCrop(image: Size, crop: Crop): Crop {
  const max = minSide(image);
  const size = Math.min(max, Math.max(max / MAX_ZOOM, crop.size));
  return {
    x: Math.min(image.width - size, Math.max(0, crop.x)),
    y: Math.min(image.height - size, Math.max(0, crop.y)),
    size,
  };
}

/**
 * Sets the zoom while keeping the image point under `anchor` in place.
 * `anchor` is a position in the frame, from 0 to 1 on each axis.
 */
export function zoomCrop(
  image: Size,
  crop: Crop,
  zoom: number,
  anchor: { x: number; y: number } = { x: 0.5, y: 0.5 },
): Crop {
  const z = Math.min(MAX_ZOOM, Math.max(1, zoom));
  const size = minSide(image) / z;
  const px = crop.x + anchor.x * crop.size;
  const py = crop.y + anchor.y * crop.size;
  return clampCrop(image, { x: px - anchor.x * size, y: py - anchor.y * size, size });
}

/** Moves the crop by (dx, dy) source pixels. */
export function panCrop(image: Size, crop: Crop, dx: number, dy: number): Crop {
  return clampCrop(image, { x: crop.x + dx, y: crop.y + dy, size: crop.size });
}

export function roundCrop(image: Size, crop: Crop): Crop {
  const size = Math.min(minSide(image), Math.max(1, Math.round(crop.size)));
  return {
    x: Math.min(image.width - size, Math.max(0, Math.round(crop.x))),
    y: Math.min(image.height - size, Math.max(0, Math.round(crop.y))),
    size,
  };
}
