// Reads back what a PDF draws, for tests: lines, images, text and clip rectangles.
// All positions are in mm with the origin at the top left of the page.
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

const MM_PER_PT = 25.4 / 72;

// Path commands inside pdfjs's constructPath data.
const MOVE_TO = 0;
const LINE_TO = 1;
const CURVE_TO = 2;
const QUAD_TO = 3;
const CLOSE = 4;

type Matrix = [number, number, number, number, number, number];

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Stroke width in mm. */
  width: number;
  color: string;
  /** Position in the page's drawing order. */
  order: number;
}

export interface PdfImage extends Box {
  objId: string;
  pixelWidth: number;
  pixelHeight: number;
  /** Position in the page's drawing order. */
  order: number;
}

export interface PdfText {
  text: string;
  /** Font size in pt. */
  size: number;
  x: number;
  baseline: number;
  color: string;
  clip: Box | null;
}

export interface PdfPage {
  width: number;
  height: number;
  widthPt: number;
  heightPt: number;
  lines: PdfLine[];
  images: PdfImage[];
  texts: PdfText[];
  /** Decodes an image to RGBA, for checking its colours. */
  pixels(objId: string): Promise<{ width: number; height: number; rgba: Uint8ClampedArray }>;
}

interface State {
  ctm: Matrix;
  lineWidth: number;
  fill: string;
  stroke: string;
  clip: Box | null;
}

function compose(outer: Matrix, inner: Matrix): Matrix {
  const [a, b, c, d, e, f] = outer;
  const [a2, b2, c2, d2, e2, f2] = inner;
  return [
    a2 * a + b2 * c,
    a2 * b + b2 * d,
    c2 * a + d2 * c,
    c2 * b + d2 * d,
    e2 * a + f2 * c + e,
    e2 * b + f2 * d + f,
  ];
}

function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export async function inspectPdf(data: Uint8Array): Promise<PdfPage[]> {
  const doc = await getDocument({ data: data.slice(), disableFontFace: true, verbosity: 0 })
    .promise;
  const pages: PdfPage[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const [x0, y0, x1, y1] = page.view as [number, number, number, number];
    const widthPt = x1 - x0;
    const heightPt = y1 - y0;
    const toMm = (x: number, y: number): [number, number] => [
      x * MM_PER_PT,
      (heightPt - y) * MM_PER_PT,
    ];
    const box = (m: Matrix, minX: number, minY: number, maxX: number, maxY: number): Box => {
      const corners = [
        toMm(...apply(m, minX, minY)),
        toMm(...apply(m, maxX, maxY)),
        toMm(...apply(m, minX, maxY)),
        toMm(...apply(m, maxX, minY)),
      ];
      const xs = corners.map((p) => p[0]);
      const ys = corners.map((p) => p[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
    };

    const ops = await page.getOperatorList();
    const lines: PdfLine[] = [];
    const images: PdfImage[] = [];
    const texts: PdfText[] = [];
    let state: State = {
      ctm: [1, 0, 0, 1, 0, 0],
      lineWidth: 1,
      fill: "#000000",
      stroke: "#000000",
      clip: null,
    };
    const stack: State[] = [];
    let pendingClip = false;
    let textMatrix: Matrix = [1, 0, 0, 1, 0, 0];
    let fontSize = 0;

    ops.fnArray.forEach((fn, i) => {
      const args = ops.argsArray[i];
      switch (fn) {
        case OPS.save:
          stack.push({ ...state });
          break;
        case OPS.restore:
          state = stack.pop() ?? state;
          break;
        case OPS.transform:
          state.ctm = compose(state.ctm, args as Matrix);
          break;
        case OPS.setLineWidth:
          state.lineWidth = args[0];
          break;
        case OPS.setFillRGBColor:
          state.fill = args[0];
          break;
        case OPS.setStrokeRGBColor:
          state.stroke = args[0];
          break;
        case OPS.clip:
          pendingClip = true;
          break;
        case OPS.constructPath: {
          const [after, [path], minMax] = args as [number, [ArrayLike<number>], number[]];
          const [minX, minY, maxX, maxY] = minMax as [number, number, number, number];
          if (pendingClip && after === OPS.endPath) {
            state.clip = box(state.ctm, minX, minY, maxX, maxY);
            pendingClip = false;
          }
          if (after === OPS.stroke) {
            let start: [number, number] = [0, 0];
            for (let k = 0; k < path.length;) {
              const cmd = path[k]!;
              if (cmd === MOVE_TO) {
                start = apply(state.ctm, path[k + 1]!, path[k + 2]!);
                k += 3;
              } else if (cmd === LINE_TO) {
                const end = apply(state.ctm, path[k + 1]!, path[k + 2]!);
                const [ax, ay] = toMm(...start);
                const [bx, by] = toMm(...end);
                lines.push({
                  x1: ax,
                  y1: ay,
                  x2: bx,
                  y2: by,
                  width: state.lineWidth * MM_PER_PT,
                  color: state.stroke,
                  order: i,
                });
                start = end;
                k += 3;
              } else if (cmd === CURVE_TO) {
                k += 7;
              } else if (cmd === QUAD_TO) {
                k += 5;
              } else if (cmd === CLOSE) {
                k += 1;
              } else {
                throw new Error(`Unknown path command ${cmd}`);
              }
            }
          }
          break;
        }
        case OPS.beginText:
          textMatrix = [1, 0, 0, 1, 0, 0];
          break;
        case OPS.setFont:
          fontSize = args[1];
          break;
        case OPS.setTextMatrix:
          textMatrix = args[0] as Matrix;
          break;
        case OPS.showText: {
          const glyphs = args[0] as ({ unicode: string } | number)[];
          const text = glyphs.map((g) => (typeof g === "number" ? "" : g.unicode)).join("");
          const [x, baseline] = toMm(...apply(compose(state.ctm, textMatrix), 0, 0));
          texts.push({ text, size: fontSize, x, baseline, color: state.fill, clip: state.clip });
          break;
        }
        case OPS.paintImageXObject: {
          const [objId, pixelWidth, pixelHeight] = args as [string, number, number];
          images.push({ ...box(state.ctm, 0, 0, 1, 1), objId, pixelWidth, pixelHeight, order: i });
          break;
        }
      }
    });

    pages.push({
      width: widthPt * MM_PER_PT,
      height: heightPt * MM_PER_PT,
      widthPt,
      heightPt,
      lines,
      images,
      texts,
      pixels: async (objId) => {
        const img = (await new Promise((resolve) => page.objs.get(objId, resolve))) as {
          width: number;
          height: number;
          data?: Uint8ClampedArray;
          kind?: number;
        };
        if (!img.data) throw new Error("Image data is not available");
        const count = img.width * img.height;
        // kind 2 = RGB, 3 = RGBA
        if (img.data.length === count * 4) {
          return { width: img.width, height: img.height, rgba: img.data };
        }
        const rgba = new Uint8ClampedArray(count * 4);
        for (let p = 0; p < count; p++) {
          rgba[p * 4] = img.data[p * 3]!;
          rgba[p * 4 + 1] = img.data[p * 3 + 1]!;
          rgba[p * 4 + 2] = img.data[p * 3 + 2]!;
          rgba[p * 4 + 3] = 255;
        }
        return { width: img.width, height: img.height, rgba };
      },
    });
  }
  return pages;
}
