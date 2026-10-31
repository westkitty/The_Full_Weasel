import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const embedded = process.env.FULL_WEASEL_EMBED === "1";

const museumEmbedPlugin = {
  name: "full-weasel-museum-embed",
  enforce: "pre",
  transformIndexHtml(html) {
    if (!embedded) return html;
    return html
      .replace(/\s*<link rel="manifest"[^>]*>/g, "")
      .replace(/\s*<link rel="(?:icon|apple-touch-icon)"[^>]*>/g, "")
      .replace(/\s*<link rel="preconnect"[^>]*>/g, "");
  },
  transform(code, id) {
    if (!embedded || !id.endsWith("/src/App.css")) return null;
    return code.replace(/\/\* Google Font import \*\/\s*@import url\([^)]*\);\s*/, "");
  },
};

export default defineConfig({
  plugins: [react(), museumEmbedPlugin],
  base: embedded ? "./" : "/The_Full_Weasel/",
  define: { __FULL_WEASEL_EMBED__: JSON.stringify(embedded) },
  build: { outDir: embedded ? "dist-embed" : "dist" },
});
