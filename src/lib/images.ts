import { emojiPlacement, opaqueBounds } from "./emoji";

export const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SUPPORTED_EXTENSIONS = /\.(jpe?g|png|webp)$/i;

export interface SourceImage {
  /** Object URL of the full-resolution image. */
  url: string;
  width: number;
  height: number;
  element: HTMLImageElement;
}

export class UnsupportedImageError extends Error {
  constructor(public readonly fileName: string) {
    super(`${fileName} is not a supported image (JPEG, PNG, WebP)`);
  }
}

export async function decodeImage(blob: Blob): Promise<SourceImage> {
  const url = URL.createObjectURL(blob);
  const element = new Image();
  element.src = url;
  try {
    await element.decode();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return { url, width: element.naturalWidth, height: element.naturalHeight, element };
}

export async function loadArtwork(url: string): Promise<SourceImage> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Artwork failed with HTTP ${response.status}`);
  return decodeImage(await response.blob());
}

/** Side in pixels of an emoji's image, as for the iTunes artwork. */
const EMOJI_PX = 1200;
/** Side in pixels of the canvas the emoji's visible bounds are measured on. */
const MEASURE_PX = 1024;

function canvas2d(side: number) {
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available");
  return { canvas, ctx };
}

/** Draws the emoji SVG at `url` large and centred on a white square image. */
export async function loadEmoji(url: string): Promise<SourceImage> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Emoji failed with HTTP ${response.status}`);
  const svg = await decodeImage(await response.blob());
  try {
    // The Noto SVGs are square, so the graphic fills the measuring canvas.
    const measure = canvas2d(MEASURE_PX);
    measure.ctx.drawImage(svg.element, 0, 0, MEASURE_PX, MEASURE_PX);
    const { data } = measure.ctx.getImageData(0, 0, MEASURE_PX, MEASURE_PX);
    const bounds = opaqueBounds(data, MEASURE_PX, MEASURE_PX);
    if (!bounds) throw new Error("The emoji is empty");

    const { canvas, ctx } = canvas2d(EMOJI_PX);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, EMOJI_PX, EMOJI_PX);
    // Drawn from the vector graphic at full size, not scaled up from the measuring canvas.
    const at = emojiPlacement(bounds, { width: MEASURE_PX, height: MEASURE_PX }, EMOJI_PX);
    ctx.drawImage(svg.element, at.x, at.y, at.width, at.height);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not encode the emoji"))),
        "image/png",
      ),
    );
    return await decodeImage(png);
  } finally {
    releaseImage(svg);
  }
}

function isSupported(file: File): boolean {
  // Some systems report no type; fall back to the extension.
  return file.type ? SUPPORTED_TYPES.includes(file.type) : SUPPORTED_EXTENSIONS.test(file.name);
}

export async function loadUpload(file: File): Promise<SourceImage> {
  if (!isSupported(file)) throw new UnsupportedImageError(file.name);
  try {
    return await decodeImage(file);
  } catch {
    throw new UnsupportedImageError(file.name);
  }
}

export function releaseImage(image: SourceImage) {
  URL.revokeObjectURL(image.url);
}
