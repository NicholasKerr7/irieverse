import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const flightsHandler = require("./api/flights.js");
const roadRouteHandler = require("./api/road-route.js");

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    plugins: [react(), localApiRoutes()],
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
  };
});

function localApiRoutes() {
  return {
    name: "irieverse-local-api-routes",
    configureServer(server) {
      server.middlewares.use("/api/flights", async (req, res) => {
        await runLocalApiHandler(flightsHandler, req, res);
      });
      server.middlewares.use("/api/road-route", async (req, res) => {
        await runLocalApiHandler(roadRouteHandler, req, res);
      });
    },
  };
}

async function runLocalApiHandler(handler, req, res) {
  const requestUrl = new URL(req.url ?? "", "http://localhost");
  await handler(
    {
      method: req.method,
      query: readQueryParams(requestUrl.searchParams),
    },
    createResponseAdapter(res)
  );
}

function readQueryParams(searchParams: URLSearchParams): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  searchParams.forEach((value, key) => {
    const existingValue = query[key];
    if (Array.isArray(existingValue)) {
      existingValue.push(value);
    } else if (existingValue) {
      query[key] = [existingValue, value];
    } else {
      query[key] = value;
    }
  });
  return query;
}

function createResponseAdapter(res) {
  const adapter = {
    setHeader(name, value) {
      res.setHeader(name, value);
      return adapter;
    },
    status(statusCode) {
      res.statusCode = statusCode;
      return adapter;
    },
    json(payload) {
      if (!res.getHeader("Content-Type")) {
        res.setHeader("Content-Type", "application/json");
      }
      res.end(JSON.stringify(payload));
      return adapter;
    },
    end(payload) {
      res.end(payload);
      return adapter;
    },
  };
  return adapter;
}
