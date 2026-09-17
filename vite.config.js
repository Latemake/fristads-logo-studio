import { defineConfig } from "vite";
import catalog from "./data/pages-products.json" with { type: "json" };
export default defineConfig(({ mode }) => ({
  base: mode === "pages" ? "./" : "/",
  build: { outDir: mode === "pages" ? "dist-pages" : "dist" },
  plugins:
    mode === "pages"
      ? [
          {
            name: "pages-catalog",
            generateBundle() {
              this.emitFile({
                type: "asset",
                fileName: "catalog.json",
                source: JSON.stringify(catalog),
              });
            },
          },
        ]
      : [],
}));
