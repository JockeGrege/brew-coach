import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves the repo at /<repo-name>/, so every asset path needs
// that prefix — Vite's `base` handles it everywhere except values we build
// by hand (index.html icon links, the manifest's start_url/scope below).
const base = "/brew-coach/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Brew Coach",
        short_name: "Brew Coach",
        description: "Guided Chemex and V60 brewing with recipe coaching that learns from your feedback.",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#E7E5DC",
        theme_color: "#1B1D19",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
