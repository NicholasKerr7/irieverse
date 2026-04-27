import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, Source, type MapRef, type ViewStateChangeEvent } from "react-map-gl/maplibre";
import type { Destination, RouteLeg } from "../types/travel";
import { MapPin } from "lucide-react";
import { classNames } from "../utils/classNames";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export type MapPinCategory =
  | "beaches"
  | "food"
  | "music"
  | "culture"
  | "nightlife"
  | "adventure"
  | "default";

const CATEGORY_COLORS: Record<MapPinCategory, string> = {
  beaches: "#22d3ee",
  food: "#f59e0b",
  music: "#a78bfa",
  culture: "#34d399",
  nightlife: "#fb7185",
  adventure: "#84cc16",
  default: "#38bdf8",
};

const ROUTE_COLORS = ["#fb5573", "#f59e0b", "#d946ef", "#22c55e", "#8b5cf6", "#38bdf8"];

interface TravelMapProps {
  destinations: Destination[];
  selectedDestinationId: string;
  onSelectDestination: (destinationId: string) => void;
  viewState: {
    latitude: number;
    longitude: number;
    zoom: number;
  };
  onMove: (event: ViewStateChangeEvent) => void;
  className?: string;
  height?: number | string;
  scrollZoom?: boolean;
  getMarkerCategory?: (destination: Destination) => MapPinCategory;
  routeDestinations?: Destination[];
  routeLegs?: RouteLeg[];
  autoFitKey?: string;
  bottomInset?: "compact" | "expanded";
}

export const TravelMap = memo(function TravelMap({
  destinations,
  selectedDestinationId,
  onSelectDestination,
  viewState,
  onMove,
  className,
  height = 420,
  scrollZoom = false,
  getMarkerCategory = () => "default",
  routeDestinations = [],
  routeLegs = [],
  autoFitKey = "",
  bottomInset = "compact",
}: TravelMapProps) {
  const mapRef = useRef<MapRef | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const routeSegments = useMemo(
    () => buildRouteSegments(routeDestinations, routeLegs),
    [routeDestinations, routeLegs]
  );
  const geojson = {
    type: "FeatureCollection" as const,
    features: destinations.map((destination) => {
      const category = getMarkerCategory(destination);

      return {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [destination.longitude, destination.latitude],
        },
        properties: {
          id: destination.id,
          name: destination.name,
          region: destination.region,
          vibes: destination.vibes.join(", "),
          category,
        },
      };
    }),
  };
  const routeGeojson = {
    type: "FeatureCollection" as const,
    features: routeSegments.map((segment) => ({
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [segment.from.longitude, segment.from.latitude],
          [segment.to.longitude, segment.to.latitude],
        ],
      },
      properties: {
        id: segment.id,
        color: segment.color,
        label: segment.label,
      },
    })),
  };
  const routeIndexByDestination = new globalThis.Map(
    routeDestinations.map((destination, index) => [destination.id, index + 1])
  );
  const fitTargets = routeDestinations.length > 1 ? routeDestinations : destinations;
  const fitKey = [
    autoFitKey,
    bottomInset,
    fitTargets.map((destination) => destination.id).join("|"),
  ].join(":");

  const fitMapToTargets = useCallback(() => {
    if (!mapReady || fitTargets.length < 2 || !mapRef.current) return;
    const bounds = getDestinationBounds(fitTargets);
    mapRef.current.fitBounds(bounds, {
      padding: getFitPadding(containerRef.current, bottomInset),
      duration: 850,
      maxZoom: 8.9,
    });
  }, [bottomInset, fitTargets, mapReady]);

  useEffect(() => {
    const timeout = window.setTimeout(fitMapToTargets, 120);
    return () => window.clearTimeout(timeout);
  }, [fitKey, fitMapToTargets]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleResize = () => {
      mapRef.current?.resize();
      fitMapToTargets();
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", handleResize);
    };
  }, [fitMapToTargets]);

  return (
    <div
      ref={containerRef}
      className={classNames(
        "rounded-3xl border border-slate-800 overflow-hidden bg-slate-950/60",
        className
      )}
    >
      <Map
        ref={mapRef}
        reuseMaps
        scrollZoom={scrollZoom}
        dragRotate={false}
        mapStyle={MAP_STYLE}
        style={{ width: "100%", height }}
        {...viewState}
        onMove={onMove}
        onLoad={() => setMapReady(true)}
      >
        {!!routeGeojson.features.length && (
          <Source id="route-preview" type="geojson" data={routeGeojson}>
            <Layer
              id="route-preview-glow"
              type="line"
              paint={{
                "line-color": ["get", "color"],
                "line-width": 15,
                "line-opacity": 0.24,
                "line-blur": 5,
              }}
              layout={{
                "line-cap": "round",
                "line-join": "round",
              }}
            />
            <Layer
              id="route-preview-line"
              type="line"
              paint={{
                "line-color": ["get", "color"],
                "line-width": 5,
                "line-opacity": 0.96,
              }}
              layout={{
                "line-cap": "round",
                "line-join": "round",
              }}
            />
          </Source>
        )}

        {routeSegments.map((segment) => (
          <Marker
            key={`label-${segment.id}`}
            longitude={segment.midpoint.longitude}
            latitude={segment.midpoint.latitude}
            anchor="center"
          >
            <div
              className="pointer-events-none rounded-full px-3 py-1.5 text-[0.72rem] font-black text-white shadow-2xl ring-2 ring-white/70 backdrop-blur sm:text-xs"
              style={{
                backgroundColor: segment.color,
                boxShadow: `0 10px 26px ${segment.color}66`,
              }}
            >
              {segment.label}
            </div>
          </Marker>
        ))}

        <Source id="destinations" type="geojson" data={geojson}>
          <Layer
            id="destination-points"
            type="circle"
            paint={{
              "circle-radius": [
                "case",
                ["==", ["get", "id"], selectedDestinationId],
                11,
                7,
              ],
              "circle-color": [
                "case",
                ["==", ["get", "id"], selectedDestinationId],
                "#f8fafc",
                [
                  "match",
                  ["get", "category"],
                  "beaches",
                  CATEGORY_COLORS.beaches,
                  "food",
                  CATEGORY_COLORS.food,
                  "music",
                  CATEGORY_COLORS.music,
                  "culture",
                  CATEGORY_COLORS.culture,
                  "nightlife",
                  CATEGORY_COLORS.nightlife,
                  "adventure",
                  CATEGORY_COLORS.adventure,
                  CATEGORY_COLORS.default,
                ],
              ],
              "circle-stroke-width": [
                "case",
                ["==", ["get", "id"], selectedDestinationId],
                4,
                2,
              ],
              "circle-stroke-color": [
                "case",
                ["==", ["get", "id"], selectedDestinationId],
                "#22d3ee",
                "#0f172a",
              ],
            }}
          />
        </Source>

        {destinations.map((destination) => {
          const isSelected = selectedDestinationId === destination.id;
          const color = CATEGORY_COLORS[getMarkerCategory(destination)];
          const routeIndex = routeIndexByDestination.get(destination.id);

          return (
            <Marker
              key={destination.id}
              longitude={destination.longitude}
              latitude={destination.latitude}
              anchor="center"
              style={{ cursor: "pointer" }}
              onClick={(event) => {
                event.originalEvent.stopPropagation();
                onSelectDestination(destination.id);
              }}
            >
              <button
                type="button"
                aria-label={`Select ${destination.name}`}
                className={classNames(
                  "group relative flex h-10 w-10 items-center justify-center rounded-full border shadow-2xl transition duration-200",
                  isSelected
                    ? "scale-125 border-white bg-white text-slate-950 shadow-cyan-950/80"
                    : "border-slate-950 bg-slate-950/90 text-slate-100 opacity-95 hover:scale-110 hover:border-white/70"
                )}
                style={{
                  boxShadow: isSelected ? `0 0 0 6px ${color}33, 0 0 28px ${color}` : `0 0 18px ${color}55`,
                }}
              >
                {isSelected && (
                  <span
                    className="absolute inset-0 -z-10 animate-ping rounded-full opacity-25"
                    style={{ backgroundColor: color }}
                  />
                )}
                {routeIndex ? (
                  <span className="text-sm font-black">{routeIndex}</span>
                ) : (
                  <MapPin className="h-5 w-5" fill={color} color={color} />
                )}
                {isSelected && (
                  <span className="pointer-events-none absolute left-1/2 top-11 hidden -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 bg-slate-950/90 px-2.5 py-1 text-[0.62rem] font-semibold text-cyan-100 shadow-xl shadow-slate-950/50 backdrop-blur md:block">
                    {destination.name}
                  </span>
                )}
              </button>
            </Marker>
          );
        })}
      </Map>
    </div>
  );
});

type RouteSegment = {
  id: string;
  from: Destination;
  to: Destination;
  color: string;
  label: string;
  midpoint: {
    longitude: number;
    latitude: number;
  };
};

function buildRouteSegments(routeDestinations: Destination[], routeLegs: RouteLeg[]): RouteSegment[] {
  const destinationById = new globalThis.Map(routeDestinations.map((destination) => [destination.id, destination]));

  if (routeLegs.length) {
    return routeLegs
      .map((leg, index) => {
        const from = destinationById.get(leg.fromDestinationId);
        const to = destinationById.get(leg.toDestinationId);
        if (!from || !to) return null;
        return createRouteSegment(from, to, index, leg.distanceKm);
      })
      .filter((segment): segment is RouteSegment => Boolean(segment));
  }

  return routeDestinations.slice(1).map((destination, index) =>
    createRouteSegment(routeDestinations[index], destination, index, 0)
  );
}

function createRouteSegment(from: Destination, to: Destination, index: number, distanceKm: number): RouteSegment {
  const day = index + 2;
  return {
    id: `${from.id}-${to.id}-${index}`,
    from,
    to,
    color: ROUTE_COLORS[index % ROUTE_COLORS.length],
    label: `Day ${day} · ${formatMiles(distanceKm)}`,
    midpoint: {
      longitude: (from.longitude + to.longitude) / 2,
      latitude: (from.latitude + to.latitude) / 2,
    },
  };
}

function formatMiles(distanceKm: number): string {
  if (!distanceKm) return "route";
  return `${Math.max(1, Math.round(distanceKm * 0.621371))} mi`;
}

function getDestinationBounds(destinations: Destination[]): [[number, number], [number, number]] {
  const longitudes = destinations.map((destination) => destination.longitude);
  const latitudes = destinations.map((destination) => destination.latitude);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const lngPadding = Math.max((maxLng - minLng) * 0.08, 0.08);
  const latPadding = Math.max((maxLat - minLat) * 0.1, 0.05);

  return [
    [minLng - lngPadding, minLat - latPadding],
    [maxLng + lngPadding, maxLat + latPadding],
  ];
}

function getFitPadding(container: HTMLDivElement | null, bottomInset: "compact" | "expanded") {
  const width = container?.clientWidth ?? window.innerWidth;
  if (width < 640) {
    return {
      top: 130,
      bottom: bottomInset === "expanded" ? 370 : 190,
      left: 38,
      right: 38,
    };
  }
  if (width < 1024) {
    return {
      top: 170,
      bottom: bottomInset === "expanded" ? 330 : 210,
      left: 64,
      right: 64,
    };
  }
  return {
    top: 155,
    bottom: bottomInset === "expanded" ? 300 : 190,
    left: 330,
    right: 370,
  };
}
