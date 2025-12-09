import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // React Map GL lists mapbox-gl as an optional peer; alias it to maplibre so optional chunks resolve.
      "mapbox-gl": "maplibre-gl",
    },
  },
});
