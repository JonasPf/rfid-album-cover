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
