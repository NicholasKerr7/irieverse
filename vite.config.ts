import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  build: {
    // MapLibre is an intentionally isolated, lazy-loaded map renderer chunk.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("maplibre-gl")) {
            return "maplibre";
          }
          if (id.includes("react-map-gl")) {
            return "map";
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      // React Map GL lists mapbox-gl as an optional peer; alias it to maplibre so optional chunks resolve.
      "mapbox-gl": "maplibre-gl",
    },
  },
});
