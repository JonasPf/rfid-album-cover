import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative asset URLs, so the build works under the GitHub Pages sub-path.
  base: "./",
  plugins: [svelte()],
  optimizeDeps: {
    // Only imported lazily by Download PDF. Without this, the dev server optimizes them on the
    // first click and reloads the page, which the leave-page guard turns into a prompt.
    include: ["pdf-lib", "@pdf-lib/fontkit"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // fontkit alone is ~760 kB; it is loaded lazily with the fonts.
    chunkSizeWarningLimit: 800,
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
