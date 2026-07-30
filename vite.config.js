import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" -> funktioniert auf GitHub Pages unter beliebigem Unterpfad
// Dateinamen mit Inhalts-Hash: eine neue Version kann nie aus einem alten Cache
// beantwortet werden (wichtig fuer die installierte PWA, speziell auf iOS).
export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/app-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  plugins: [react()],
});
