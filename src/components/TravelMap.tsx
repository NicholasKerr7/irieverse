import { memo } from "react";
import Map, { Layer, Marker, Source, type ViewStateChangeEvent } from "react-map-gl/maplibre";
import type { Destination } from "../types/travel";
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
}: TravelMapProps) {
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
    features: routeDestinations.length > 1
      ? [
          {
            type: "Feature" as const,
            geometry: {
              type: "LineString" as const,
              coordinates: routeDestinations.map((destination) => [destination.longitude, destination.latitude]),
            },
            properties: {},
          },
        ]
      : [],
  };
  const routeIndexByDestination = new globalThis.Map(
    routeDestinations.map((destination, index) => [destination.id, index + 1])
  );

  return (
    <div
      className={classNames(
        "rounded-3xl border border-slate-800 overflow-hidden bg-slate-950/60",
        className
      )}
    >
      <Map
        reuseMaps
        scrollZoom={scrollZoom}
        dragRotate={false}
        mapStyle={MAP_STYLE}
        style={{ width: "100%", height }}
        {...viewState}
        onMove={onMove}
      >
        {!!routeGeojson.features.length && (
          <Source id="route-preview" type="geojson" data={routeGeojson}>
            <Layer
              id="route-preview-glow"
              type="line"
              paint={{
                "line-color": "#22d3ee",
                "line-width": 12,
                "line-opacity": 0.18,
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
                "line-color": "#67e8f9",
                "line-width": 3.4,
                "line-opacity": 0.9,
                "line-dasharray": [0.4, 1.5],
              }}
              layout={{
                "line-cap": "round",
                "line-join": "round",
              }}
            />
          </Source>
        )}

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
