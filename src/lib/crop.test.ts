import { describe, expect, it } from "vitest";
import { MAX_ZOOM, clampCrop, initialCrop, panCrop, roundCrop, zoomCrop, zoomOf } from "./crop";

const wide = { width: 1600, height: 900 };

describe("initialCrop", () => {
  it("is the centred square of a wide image", () => {
    expect(initialCrop(wide)).toEqual({ x: 350, y: 0, size: 900 });
  });

  it("is the centred square of a tall image", () => {
    expect(initialCrop({ width: 600, height: 1000 })).toEqual({ x: 0, y: 200, size: 600 });
  });

  it("is the whole image when square", () => {
    expect(initialCrop({ width: 1200, height: 1200 })).toEqual({ x: 0, y: 0, size: 1200 });
  });
});

describe("zoom", () => {
  it("is 1 at the minimum and 8 at the maximum", () => {
    expect(zoomOf(wide, { x: 0, y: 0, size: 900 })).toBe(1);
    expect(zoomOf(wide, { x: 0, y: 0, size: 900 / 8 })).toBe(8);
  });

  it("keeps the frame centre when zooming", () => {
    const c = zoomCrop(wide, initialCrop(wide), 2);
    expect(c).toEqual({ x: 575, y: 225, size: 450 });
  });

  it("keeps an anchor point fixed", () => {
    // Zoom 2× around the frame's top-left corner.
    const c = zoomCrop(wide, { x: 100, y: 0, size: 900 }, 2, { x: 0, y: 0 });
    expect(c).toEqual({ x: 100, y: 0, size: 450 });
  });

  it("is limited to 1..8", () => {
    expect(zoomCrop(wide, initialCrop(wide), 20).size).toBeCloseTo(900 / MAX_ZOOM, 10);
    expect(zoomCrop(wide, initialCrop(wide), 0.1).size).toBe(900);
  });

  it("zooming out near an edge pulls the crop back inside", () => {
    const c = zoomCrop(wide, { x: 1600 - 450, y: 450, size: 450 }, 1);
    expect(c).toEqual({ x: 700, y: 0, size: 900 });
  });
});

describe("pan and clamp", () => {
  it("moves the crop", () => {
    expect(panCrop(wide, { x: 350, y: 0, size: 900 }, -100, 0)).toEqual({
      x: 250,
      y: 0,
      size: 900,
    });
  });

  it("never extends past the image edges", () => {
    expect(panCrop(wide, { x: 350, y: 0, size: 900 }, -1000, -50)).toEqual({
      x: 0,
      y: 0,
      size: 900,
    });
    expect(panCrop(wide, { x: 350, y: 0, size: 900 }, 1000, 50)).toEqual({
      x: 700,
      y: 0,
      size: 900,
    });
  });

  it("clamps an oversized crop", () => {
    expect(clampCrop(wide, { x: -5, y: 3, size: 2000 })).toEqual({ x: 0, y: 0, size: 900 });
  });
});

describe("roundCrop", () => {
  it("rounds to whole pixels and stays inside", () => {
    expect(roundCrop(wide, { x: 700.6, y: 0.4, size: 899.6 })).toEqual({ x: 700, y: 0, size: 900 });
    expect(roundCrop(wide, { x: 10.4, y: 20.5, size: 100.4 })).toEqual({ x: 10, y: 21, size: 100 });
  });
});
