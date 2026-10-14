import type { Crop } from "./crop";
import type { SourceImage } from "./images";

/** Renders the crop as a `px` × `px` JPEG. */
export async function renderArtJpeg(
  image: SourceImage,
  crop: Crop,
  px: number,
): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  // JPEG has no alpha: put transparent areas on white paper, not black.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, px, px);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image.element, crop.x, crop.y, crop.size, crop.size, 0, 0, px, px);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode the art"))),
      "image/jpeg",
      0.92,
    ),
  );
  return new Uint8Array(await blob.arrayBuffer());
}
