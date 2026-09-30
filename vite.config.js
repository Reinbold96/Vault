import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// base: "./" -> funktioniert auf GitHub Pages unter beliebigem Unterpfad
// Dateinamen mit Inhalts-Hash: eine neue Version kann nie aus einem alten Cache
// beantwortet werden (wichtig fuer die installierte PWA, speziell auf iOS).
export default defineConfig({
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/app-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        // Vendor-Chunks aendern sich selten -> bleiben im Service-Worker-Cache,
        // waehrend der App-Code bei jedem Release neu kommt.
        /* Vendor-Gruppen: React und die Chart-Bibliothek getrennt. Ohne
           includeDependenciesRecursively:false zöge die Chart-Gruppe React als
           Abhängigkeit mit in ihren Chunk – die Charts lägen wieder auf dem Startpfad. */
        advancedChunks: {
          includeDependenciesRecursively: false,
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 20 },
            { name: "charts", test: /node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|react-redux|@reduxjs|immer|reselect|redux|es-toolkit|decimal\.js-light|eventemitter3|use-sync-external-store|tiny-invariant|clsx|react-is)[\\/]/, priority: 10 },
          ],
        },
        // Das Web-App-Manifest MUSS im Site-Root bleiben (nicht unter assets/),
        // sonst loesen die relativen "start_url"/"scope" auf .../Vault/assets/
        // auf -> iOS-Homescreen-App startet ins Leere (GitHub-Pages-404).
        assetFileNames: (info) => {
          const n = info.name || (info.names && info.names[0]) || "";
          return n.endsWith(".webmanifest") ? "[name][extname]" : "assets/[name][extname]";
        },
      },
    },
  },
  plugins: [react()],
  test: { environment: "node", include: ["test/**/*.test.js"] },
});
