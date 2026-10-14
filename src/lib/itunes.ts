export const SEARCH_ENDPOINT = "https://itunes.apple.com/search";
export const RESULT_LIMIT = 25;
/** The API's maximum. Songs of one album repeat, so this leaves enough distinct albums. */
export const REQUEST_LIMIT = 200;

export interface Album {
  artist: string;
  title: string;
  thumbnailUrl: string;
  artworkUrl: string;
}

export function searchUrl(term: string): string {
  const params = new URLSearchParams({
    term,
    media: "music",
    // The album search misses some albums (e.g. Nirvana's Nevermind) that the song search finds.
    entity: "album,song",
    country: "US",
    limit: String(REQUEST_LIMIT),
  });
  return `${SEARCH_ENDPOINT}?${params}`;
}

/** The thumbnail URL pattern also serves larger sizes; this is not a documented API. */
export function fullSizeArtworkUrl(thumbnailUrl: string): string {
  return thumbnailUrl.replace("100x100bb", "1200x1200bb");
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** One album per collection, in order of first appearance; a song stands for its album. */
export function parseResults(json: unknown): Album[] {
  const results = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) throw new Error("Unexpected search response");
  const albums: Album[] = [];
  const seen = new Set<unknown>();
  for (const [i, r] of (results as Record<string, unknown>[]).entries()) {
    const key = r.collectionId ?? `result ${i}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const thumbnailUrl = text(r.artworkUrl100);
    albums.push({
      // The album artist, e.g. "Various Artists" for a song on a compilation.
      artist: text(r.collectionArtistName) || text(r.artistName),
      title: text(r.collectionName),
      thumbnailUrl,
      artworkUrl: fullSizeArtworkUrl(thumbnailUrl),
    });
    if (albums.length === RESULT_LIMIT) break;
  }
  return albums;
}

export async function searchAlbums(
  term: string,
  fetchFn: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<Album[]> {
  const response = await fetchFn(searchUrl(term), { signal });
  if (!response.ok) throw new Error(`Search failed with HTTP ${response.status}`);
  return parseResults(await response.json());
}
