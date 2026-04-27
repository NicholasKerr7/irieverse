import { memo } from "react";
import Map, { Layer, Marker, Source, ViewStateChangeEvent } from "react-map-gl";
import type { Destination } from "../types/travel";
import { MapPin } from "lucide-react";
import { classNames } from "../utils/classNames";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

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
}: TravelMapProps) {
  const geojson = {
    type: "FeatureCollection" as const,
    features: destinations.map((destination) => ({
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
      },
    })),
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
        mapLib={import("maplibre-gl")}
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
                "#22d3ee",
                "#0ea5e9",
              ],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#0f172a",
            }}
          />
        </Source>

        {destinations.map((destination) => (
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
              className={`${
                selectedDestinationId === destination.id
                  ? "scale-110 drop-shadow-[0_0_8px_rgba(45,212,191,0.7)]"
                  : "opacity-80"
              } transition`}
            >
              <MapPin className="w-5 h-5 text-cyan-300" />
            </div>
          </Marker>
        ))}
      </Map>
    </div>
  );
});
