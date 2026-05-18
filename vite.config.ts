import { defineConfig, loadEnv, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react-swc";
import type { IncomingMessage, ServerResponse } from "node:http";
import bookingsHandler from "./api/bookings";
import flightsHandler from "./api/flights";
import importMetadataHandler from "./api/import-metadata";
import placeDetailsHandler from "./api/place-details";
import roadRouteHandler from "./api/road-route";
import type { ApiHandler, ApiResponse, QueryRecord } from "./src/types/api";

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
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/bookings", async (req, res) => {
        await runLocalApiHandler(bookingsHandler, req, res);
      });
      server.middlewares.use("/api/flights", async (req, res) => {
        await runLocalApiHandler(flightsHandler, req, res);
      });
      server.middlewares.use("/api/import-metadata", async (req, res) => {
        await runLocalApiHandler(importMetadataHandler, req, res);
      });
      server.middlewares.use("/api/place-details", async (req, res) => {
        await runLocalApiHandler(placeDetailsHandler, req, res);
      });
      server.middlewares.use("/api/road-route", async (req, res) => {
        await runLocalApiHandler(roadRouteHandler, req, res);
      });
    },
  };
}

async function runLocalApiHandler(handler: ApiHandler, req: IncomingMessage, res: ServerResponse) {
  const requestUrl = new URL(req.url ?? "", "http://localhost");
  await handler(
    {
      method: req.method,
      query: readQueryParams(requestUrl.searchParams),
    },
    createResponseAdapter(res)
  );
}

function readQueryParams(searchParams: URLSearchParams): QueryRecord {
  const query: QueryRecord = {};
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

function createResponseAdapter(res: ServerResponse): ApiResponse {
  const adapter: ApiResponse = {
    setHeader(name: string, value: string) {
      res.setHeader(name, value);
      return adapter;
    },
    status(statusCode: number) {
      res.statusCode = statusCode;
      return adapter;
    },
    json(payload: unknown) {
      if (!res.getHeader("Content-Type")) {
        res.setHeader("Content-Type", "application/json");
      }
      res.end(JSON.stringify(payload));
      return adapter;
    },
    end(payload?: string) {
      res.end(payload);
      return adapter;
    },
  };
  return adapter;
}
