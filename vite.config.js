import { defineConfig } from "vite";
import catalog from "./data/pages-products.json" with { type: "json" };
import deployment from "./data/deployment.json" with { type: "json" };
export default defineConfig(({ mode }) => ({
  base: mode === "pages" ? "./" : "/",
  define: {
    "import.meta.env.VITE_API_URL": JSON.stringify(
      mode === "pages" ? process.env.VITE_API_URL || deployment.apiUrl : "",
    ),
  },
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
