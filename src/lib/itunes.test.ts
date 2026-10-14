import { describe, expect, it, vi } from "vitest";
import { fullSizeArtworkUrl, parseResults, searchAlbums, searchUrl } from "./itunes";

const art100 = "https://is1-ssl.mzstatic.com/image/thumb/Music/v4/aa/bb/cc/source/100x100bb.jpg";

describe("searchUrl", () => {
  it("builds the album search request with the term encoded", () => {
    const url = new URL(searchUrl("AC/DC & friends"));
    expect(url.origin + url.pathname).toBe("https://itunes.apple.com/search");
    expect([...url.searchParams]).toEqual([
      ["term", "AC/DC & friends"],
      ["media", "music"],
      ["entity", "album"],
      ["country", "US"],
      ["limit", "25"],
    ]);
    expect(searchUrl("a b&c")).toContain("term=a+b%26c&");
  });
});

describe("fullSizeArtworkUrl", () => {
  it("swaps the 100 px size for 1200 px", () => {
    expect(fullSizeArtworkUrl(art100)).toBe(
      "https://is1-ssl.mzstatic.com/image/thumb/Music/v4/aa/bb/cc/source/1200x1200bb.jpg",
    );
  });
});

describe("parseResults", () => {
  it("maps the fields in API order", () => {
    const albums = parseResults({
      resultCount: 2,
      results: [
        { artistName: "A", collectionName: "One", artworkUrl100: art100 },
        { artistName: "B", collectionName: "Two", artworkUrl100: art100 },
      ],
    });
    expect(albums).toEqual([
      { artist: "A", title: "One", thumbnailUrl: art100, artworkUrl: fullSizeArtworkUrl(art100) },
      { artist: "B", title: "Two", thumbnailUrl: art100, artworkUrl: fullSizeArtworkUrl(art100) },
    ]);
  });

  it("tolerates missing fields and caps at 25", () => {
    const results = Array.from({ length: 30 }, () => ({}));
    const albums = parseResults({ results });
    expect(albums).toHaveLength(25);
    expect(albums[0]).toEqual({ artist: "", title: "", thumbnailUrl: "", artworkUrl: "" });
  });

  it("rejects a malformed response", () => {
    expect(() => parseResults(null)).toThrow();
    expect(() => parseResults({ results: "nope" })).toThrow();
  });
});

describe("searchAlbums", () => {
  it("fetches and parses", async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify({ results: [{ artistName: "A", collectionName: "One" }] })),
    );
    const albums = await searchAlbums("abba", fetchFn);
    expect(fetchFn).toHaveBeenCalledWith(searchUrl("abba"), expect.anything());
    expect(albums.map((a) => a.title)).toEqual(["One"]);
  });

  it("fails on an HTTP error", async () => {
    const fetchFn = vi.fn(async () => new Response("", { status: 503 }));
    await expect(searchAlbums("abba", fetchFn)).rejects.toThrow();
  });
});
