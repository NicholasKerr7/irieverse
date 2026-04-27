import { memo } from "react";
import Map, { Layer, Marker, Source, type ViewStateChangeEvent } from "react-map-gl/maplibre";
import type { Destination } from "../types/travel";
import { MapPin } from "lucide-react";
import { classNames } from "../utils/classNames";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

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
              <div
                className={classNames(
                  "rounded-full bg-slate-950/80 p-1 shadow-lg ring-2 ring-slate-950 transition",
                  isSelected ? "scale-125 ring-cyan-200" : "opacity-90 hover:scale-110"
                )}
                style={{
                  boxShadow: isSelected ? `0 0 18px ${color}` : undefined,
                }}
              >
                <MapPin className="h-5 w-5" fill={color} color={color} />
              </div>
            </Marker>
          );
        })}
      </Map>
    </div>
  );
});
