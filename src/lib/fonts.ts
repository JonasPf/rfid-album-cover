import boldUrl from "../assets/fonts/Inter-Bold.ttf?url";
import regularUrl from "../assets/fonts/Inter-Regular.ttf?url";
import type { PdfFonts } from "./pdf";

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

let loading: Promise<PdfFonts> | undefined;

/** The bundled font files, for the PDF, and their metrics, for text fitting. */
export function loadFonts(): Promise<PdfFonts> {
  // fontkit is large, so it loads alongside the fonts rather than with the page.
  loading ??= Promise.all([
    fetchBytes(regularUrl),
    fetchBytes(boldUrl),
    import("./fontmetrics"),
  ]).then(([regular, bold, { createMetrics }]) => ({
    regular,
    bold,
    metrics: { regular: createMetrics(regular), bold: createMetrics(bold) },
  }));
  return loading;
}
