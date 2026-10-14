import type { Crop } from "./crop";
import { INSET } from "./geometry";
import { releaseImage, type SourceImage } from "./images";

export interface CardEntry {
  id: number;
  image: SourceImage;
  crop: Crop;
  artist: string;
  title: string;
}

let nextId = 1;

/** The session's card list and inset. Kept in memory only. */
class Cards {
  list = $state<CardEntry[]>([]);
  inset = $state<number>(INSET.default);

  add(image: SourceImage, crop: Crop, artist = "", title = ""): CardEntry {
    this.list.push({ id: nextId++, image, crop, artist, title });
    return this.list[this.list.length - 1]!;
  }

  remove(id: number) {
    const index = this.list.findIndex((c) => c.id === id);
    if (index < 0) return;
    const [removed] = this.list.splice(index, 1);
    // Keep the image alive while the entry slides out.
    setTimeout(() => releaseImage(removed!.image), 1000);
  }
}

export const cards = new Cards();
