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
        // Das Web-App-Manifest MUSS im Site-Root bleiben (nicht unter assets/),
        // sonst loesen die relativen "start_url"/"scope" auf .../Vault/assets/
        // auf -> iOS-Homescreen-App startet ins Leere (GitHub-Pages-404).
        assetFileNames: (info) => {
          const n = info.name || (info.names && info.names[0]) || "";
          return n.endsWith(".webmanifest")
            ? "[name][extname]"
            : "assets/[name][extname]";
        },
      },
    },
  },
  plugins: [react()],
});
