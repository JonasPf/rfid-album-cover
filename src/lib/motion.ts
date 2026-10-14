/** Transition duration, or 0 when the user prefers reduced motion. */
export function duration(ms: number): number {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 0
    : ms;
}
