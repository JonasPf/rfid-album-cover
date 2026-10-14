export const SEARCH_ENDPOINT = "https://itunes.apple.com/search";
export const RESULT_LIMIT = 25;

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
    entity: "album",
    country: "US",
    limit: String(RESULT_LIMIT),
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

export function parseResults(json: unknown): Album[] {
  const results = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) throw new Error("Unexpected search response");
  return results.slice(0, RESULT_LIMIT).map((r: Record<string, unknown>) => {
    const thumbnailUrl = text(r.artworkUrl100);
    return {
      artist: text(r.artistName),
      title: text(r.collectionName),
      thumbnailUrl,
      artworkUrl: fullSizeArtworkUrl(thumbnailUrl),
    };
  });
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
