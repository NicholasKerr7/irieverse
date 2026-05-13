import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Compass,
  Globe2,
  Heart,
  Layers3,
  MapPin,
  Navigation,
  Phone,
  Plus,
  Route,
  Search,
  Sparkles,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";
import { TravelMap, type MapExtraMarker, type RouteDetail, type RouteRenderStatus } from "../components/TravelMap";
import type { MobileTabId } from "../components/mobile/BottomNav";
import { DESTINATIONS } from "../data/content";
import type { TravelOS } from "../hooks/useTravelOS";
import { fetchPlaceDetails, type PlaceDetails } from "../services/placeDetails";
import type { Destination, Experience, ImportedIdea, PlannerDay, RouteLeg } from "../types/travel";
import { classNames } from "../utils/classNames";
import { formatDriveTime, formatMiles } from "../utils/format";
import { logRecoverableWarning } from "../utils/logging";
import {
  MAP_CATEGORIES,
  buildDrivingGuideUrl,
  destinationMatchesCategory,
  getDestinationPinCategory,
  getLinkedExperiences,
  getNearbyExperiences,
  getRouteColor,
  getRouteLegId,
  getRouteStatusLabel,
  mergeDestinations,
  type MapCategoryId,
  type MapPinCategory,
} from "../utils/mapRoutes";

type MapScreenProps = {
  app: TravelOS;
  onNavigate: (tab: MobileTabId) => void;
};

type MapDrawerTab = "overview" | "unplanned" | `day-${number}`;
type PlaceDetailTarget =
  | { type: "destination"; destination: Destination; day?: number }
  | { type: "experience"; experience: Experience; day?: number; linkedDestination?: Destination };
type ImportedPlacePin = MapExtraMarker & {
  idea: ImportedIdea;
  address: string;
  mapsUrl: string;
  websiteUrl: string;
  phone: string;
  rating?: number;
  userRatingCount?: number;
  primaryType: string;
  linkedDestination?: Destination;
};

export function MapScreen({ app, onNavigate }: MapScreenProps) {
  const [activeCategory, setActiveCategory] = useState<MapCategoryId>("all");
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<MapDrawerTab>("overview");
  const [placeDetail, setPlaceDetail] = useState<PlaceDetailTarget | null>(null);
  const [selectedImportedPlaceId, setSelectedImportedPlaceId] = useState<string | null>(null);
  const [livePlaceDetails, setLivePlaceDetails] = useState<PlaceDetails | null>(null);
  const [isPlaceDetailsLoading, setIsPlaceDetailsLoading] = useState(false);
  const [focusedDestinationId, setFocusedDestinationId] = useState(app.plannerBaseId);
  const [selectedRouteLegId, setSelectedRouteLegId] = useState<string | null>(null);
  const [routeStatus, setRouteStatus] = useState<RouteRenderStatus>({
    isLoading: false,
    totalLegs: 0,
    roadLegs: 0,
    fallbackLegs: 0,
    failedLegs: 0,
  });
  const [routeDetails, setRouteDetails] = useState<RouteDetail[]>([]);

  const visibleDestinations = useMemo(() => {
    const query = app.search.trim().toLowerCase();

    return DESTINATIONS.filter((destination) => {
      const linkedExperiences = getLinkedExperiences(destination.id);
      const searchableText = [
        destination.name,
        destination.region,
        destination.headline,
        destination.description,
        destination.highlights.join(" "),
        destination.vibes.join(" "),
        linkedExperiences.map((experience) => `${experience.title} ${experience.type} ${experience.description}`).join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!query || searchableText.includes(query)) &&
        destinationMatchesCategory(destination, activeCategory)
      );
    });
  }, [activeCategory, app.search]);
  const allImportedPlacePins = useMemo(
    () => buildImportedPlacePins(app.importedIdeas, "", "all"),
    [app.importedIdeas]
  );
  const importedPlacePins = useMemo(
    () => buildImportedPlacePins(app.importedIdeas, app.search, activeCategory),
    [activeCategory, app.importedIdeas, app.search]
  );
  const selectedImportedPlacePin = selectedImportedPlaceId
    ? allImportedPlacePins.find((pin) => pin.id === selectedImportedPlaceId) ?? null
    : null;
  const visiblePinCount = visibleDestinations.length + importedPlacePins.length;

  useEffect(() => {
    if (!visibleDestinations.length) return;
    if (visibleDestinations.some((destination) => destination.id === focusedDestinationId)) return;
    setFocusedDestinationId(visibleDestinations[0].id);
  }, [focusedDestinationId, visibleDestinations]);

  useEffect(() => {
    if (!selectedImportedPlaceId) return;
    if (allImportedPlacePins.some((pin) => pin.id === selectedImportedPlaceId)) return;
    setSelectedImportedPlaceId(null);
  }, [allImportedPlacePins, selectedImportedPlaceId]);

  useEffect(() => {
    if (DESTINATIONS.some((destination) => destination.id === app.plannerBaseId)) {
      setFocusedDestinationId(app.plannerBaseId);
    }
  }, [app.plannerBaseId]);

  useEffect(() => {
    if (!placeDetail) {
      setLivePlaceDetails(null);
      setIsPlaceDetailsLoading(false);
      return;
    }

    const controller = new AbortController();
    setLivePlaceDetails(null);
    setIsPlaceDetailsLoading(true);

    const lookup = placeDetail.type === "destination"
      ? { kind: "destination" as const, destination: placeDetail.destination }
      : {
          kind: "experience" as const,
          experience: placeDetail.experience,
          linkedDestination: placeDetail.linkedDestination,
        };

    fetchPlaceDetails(lookup, controller.signal)
      .then((details) => setLivePlaceDetails(details))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        logRecoverableWarning("Place details unavailable; using curated details.", error);
        setLivePlaceDetails(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsPlaceDetailsLoading(false);
      });

    return () => controller.abort();
  }, [placeDetail]);

  const selectedDestination =
    DESTINATIONS.find((destination) => destination.id === focusedDestinationId) ?? visibleDestinations[0] ?? DESTINATIONS[0];
  const routeSummary = app.itinerary.routeSummary;
  const routeLegOptions = useMemo(
    () => routeSummary.legs.map((leg, index) => ({
      id: getRouteLegId(leg, index),
      day: index + 2,
      index,
      leg,
    })),
    [routeSummary.legs]
  );
  const routeDetailsById = useMemo(
    () => new Map(routeDetails.map((detail) => [detail.id, detail])),
    [routeDetails]
  );
  const activeCategoryLabel = MAP_CATEGORIES.find((category) => category.id === activeCategory)?.label ?? "All";
  const routeDestinations = useMemo(
    () =>
      routeSummary.stops
        .map((stop) => DESTINATIONS.find((destination) => destination.id === stop.destinationId))
        .filter((destination): destination is Destination => Boolean(destination)),
    [routeSummary.stops]
  );
  const mapDestinations = useMemo(
    () => mergeDestinations(visibleDestinations, routeDestinations),
    [routeDestinations, visibleDestinations]
  );
  const routeDestinationIds = useMemo(
    () => new Set(routeSummary.stops.map((stop) => stop.destinationId)),
    [routeSummary.stops]
  );
  const unplannedDestinations = useMemo(
    () => visibleDestinations.filter((destination) => !routeDestinationIds.has(destination.id)).slice(0, 6),
    [routeDestinationIds, visibleDestinations]
  );
  const activeDrawerDay = getDrawerDay(activeDrawerTab);
  const activeDrawerStop = activeDrawerDay
    ? routeSummary.stops.find((stop) => stop.day === activeDrawerDay) ?? null
    : null;
  const activeDrawerDestination = activeDrawerStop
    ? DESTINATIONS.find((destination) => destination.id === activeDrawerStop.destinationId) ?? null
    : null;
  const activeDrawerRouteLeg = activeDrawerDay
    ? routeLegOptions.find((option) => option.day === activeDrawerDay) ?? null
    : null;
  const activeDrawerRouteDetail = activeDrawerRouteLeg
    ? routeDetails.find((detail) => detail.id === activeDrawerRouteLeg.id) ?? null
    : null;
  const activePlannerDay = activeDrawerDay
    ? app.itinerary.daysPlan.find((day) => day.day === activeDrawerDay) ?? null
    : null;
  const activeDrawerImportedStops = useMemo(() => {
    if (!activeDrawerDestination || !activeDrawerDay) return [];
    return allImportedPlacePins
      .filter((pin) =>
        importedPinBelongsToDay(pin, activeDrawerDay, activeDrawerDestination.id, app.importedIdeaDayAssignments)
      )
      .slice(0, 5);
  }, [activeDrawerDay, activeDrawerDestination, allImportedPlacePins, app.importedIdeaDayAssignments]);
  const numberedActiveDrawerImportedStops = useMemo(
    () => activeDrawerImportedStops.map((pin, index) => ({ ...pin, sequenceLabel: String(index + 1) })),
    [activeDrawerImportedStops]
  );
  const mapImportedPlacePins = useMemo(
    () => mergeImportedPlacePins(
      importedPlacePins,
      selectedImportedPlacePin ? [selectedImportedPlacePin] : [],
      numberedActiveDrawerImportedStops
    ),
    [importedPlacePins, numberedActiveDrawerImportedStops, selectedImportedPlacePin]
  );
  const focusDestinations = useMemo(() => {
    if (activeDrawerTab === "overview") return routeDestinations;
    if (activeDrawerTab === "unplanned") return unplannedDestinations.length ? unplannedDestinations : visibleDestinations;
    if (activeDrawerDay && activeDrawerDestination && activeDrawerImportedStops.length) {
      return [activeDrawerDestination];
    }
    if (activeDrawerRouteLeg) {
      const from = DESTINATIONS.find((destination) => destination.id === activeDrawerRouteLeg.leg.fromDestinationId);
      const to = DESTINATIONS.find((destination) => destination.id === activeDrawerRouteLeg.leg.toDestinationId);
      return [from, to].filter((destination): destination is Destination => Boolean(destination));
    }
    return activeDrawerDestination ? [activeDrawerDestination] : routeDestinations;
  }, [
    activeDrawerDay,
    activeDrawerDestination,
    activeDrawerImportedStops.length,
    activeDrawerRouteLeg,
    activeDrawerTab,
    routeDestinations,
    unplannedDestinations,
    visibleDestinations,
  ]);
  const focusImportedPlacePins = useMemo(() => {
    if (selectedImportedPlacePin) return [selectedImportedPlacePin];
    if (numberedActiveDrawerImportedStops.length) return numberedActiveDrawerImportedStops;
    if (activeDrawerTab === "unplanned") return importedPlacePins.slice(0, 6);
    return [];
  }, [activeDrawerTab, importedPlacePins, numberedActiveDrawerImportedStops, selectedImportedPlacePin]);
  const tripTitle = `${app.plannerDays}-day ${app.destination.region}`;

  useEffect(() => {
    if (!selectedRouteLegId) return;
    if (routeLegOptions.some((option) => option.id === selectedRouteLegId)) return;
    setSelectedRouteLegId(null);
  }, [routeLegOptions, selectedRouteLegId]);

  const handleSelectDestination = (destinationId: string) => {
    setSelectedImportedPlaceId(null);
    setFocusedDestinationId(destinationId);
    const matchingLeg = routeLegOptions.find((option) => option.leg.toDestinationId === destinationId);
    const matchingStop = routeSummary.stops.find((stop) => stop.destinationId === destinationId);
    setSelectedRouteLegId(matchingLeg?.id ?? null);
    setActiveDrawerTab(matchingStop ? `day-${matchingStop.day}` : "overview");
    setSheetExpanded(true);
  };

  const handleSelectImportedPlace = (placeId: string, options: { keepDrawerTab?: boolean } = {}) => {
    setSelectedImportedPlaceId(placeId);
    setPlaceDetail(null);
    setSelectedRouteLegId(null);
    if (!options.keepDrawerTab) setActiveDrawerTab("unplanned");
    setSheetExpanded(true);
  };

  const handleSelectRouteLeg = (routeLegId: string | null) => {
    setSelectedRouteLegId(routeLegId);
    if (!routeLegId) {
      setActiveDrawerTab("overview");
      setSheetExpanded(true);
      return;
    }
    const routeLeg = routeLegOptions.find((option) => option.id === routeLegId);
    if (routeLeg) {
      setFocusedDestinationId(routeLeg.leg.toDestinationId);
      setActiveDrawerTab(`day-${routeLeg.day}`);
    }
    setSheetExpanded(true);
  };

  const handleSelectDrawerTab = (tab: MapDrawerTab) => {
    setActiveDrawerTab(tab);
    setSheetExpanded(true);

    const day = getDrawerDay(tab);
    if (!day) {
      setSelectedRouteLegId(null);
      return;
    }

    const stop = routeSummary.stops.find((routeStop) => routeStop.day === day);
    const routeLeg = routeLegOptions.find((option) => option.day === day);
    if (stop) setFocusedDestinationId(stop.destinationId);
    setSelectedRouteLegId(routeLeg?.id ?? null);
  };

  const handleAddToTrip = () => {
    app.savePlace(selectedDestination.id);
    onNavigate("trips");
  };

  const handleNearbyExperience = (experience: Experience) => {
    app.saveExperience(experience.id);
    if (experience.linkedDestinationId) {
      app.setPlannerBaseId(experience.linkedDestinationId);
    }
    onNavigate("trips");
  };

  const handleOpenDrivingGuide = () => {
    if (routeDestinations.length < 2) return;
    window.open(buildDrivingGuideUrl(routeDestinations), "_blank", "noreferrer");
  };

  const handleOpenDestinationMaps = (destination: Destination) => {
    window.open(buildDestinationMapsUrl(destination), "_blank", "noreferrer");
  };

  const handleOpenExperienceMaps = (experience: Experience) => {
    window.open(buildExperienceMapsUrl(experience), "_blank", "noreferrer");
  };

  const handleOpenImportedPlaceMaps = (pin: ImportedPlacePin) => {
    window.open(pin.mapsUrl || buildImportedPlaceMapsUrl(pin), "_blank", "noreferrer");
  };

  const handleOpenPlaceDetailMaps = (target: PlaceDetailTarget, details: PlaceDetails | null) => {
    if (details?.mapsUrl) {
      window.open(details.mapsUrl, "_blank", "noreferrer");
      return;
    }

    if (target.type === "destination") {
      handleOpenDestinationMaps(target.destination);
    } else {
      handleOpenExperienceMaps(target.experience);
    }
  };

  const handleSavePlaceDetail = (target: PlaceDetailTarget) => {
    if (target.type === "destination") {
      app.toggleSavedPlace(target.destination.id);
    } else {
      app.toggleSavedExperience(target.experience.id);
    }
  };

  const handleAddPlaceDetailToTrip = (target: PlaceDetailTarget) => {
    if (target.type === "destination") {
      app.savePlace(target.destination.id);
    } else {
      handleNearbyExperience(target.experience);
      setPlaceDetail(null);
      return;
    }

    setPlaceDetail(null);
    onNavigate("trips");
  };

  const handleAddImportedPlaceToTrip = (pin: ImportedPlacePin) => {
    if (pin.idea.linkedDestinationId) {
      app.buildTripFromDestinations([pin.idea.linkedDestinationId]);
    }
    setSelectedImportedPlaceId(null);
    onNavigate(pin.idea.linkedDestinationId ? "trips" : "saved");
  };

  return (
    <section
      className={classNames(
        "relative isolate h-[calc(100svh-5.5rem)] min-h-[560px] overflow-hidden bg-slate-950 sm:h-[calc(100vh-7rem)] sm:min-h-[700px]",
        placeDetail || selectedImportedPlacePin ? "z-[60]" : "z-0"
      )}
    >
      <TravelMap
        destinations={mapDestinations}
        selectedDestinationId={selectedImportedPlacePin ? "" : selectedDestination.id}
        onSelectDestination={handleSelectDestination}
        viewState={app.mapViewState}
        onMove={app.handleMapMove}
        className="rounded-none border-0"
        height="100%"
        scrollZoom
        getMarkerCategory={getDestinationPinCategory}
        routeDestinations={routeDestinations}
        routeLegs={routeSummary.legs}
        focusDestinations={focusDestinations}
        extraMarkers={mapImportedPlacePins}
        selectedExtraMarkerId={selectedImportedPlacePin?.id ?? null}
        focusExtraMarkers={focusImportedPlacePins}
        onSelectExtraMarker={handleSelectImportedPlace}
        selectedRouteLegId={selectedRouteLegId}
        onSelectRouteLeg={(routeLegId) => handleSelectRouteLeg(routeLegId)}
        onRouteStatusChange={setRouteStatus}
        onRouteDetailsChange={setRouteDetails}
        autoFitKey={`${activeCategory}-${app.search}-${selectedDestination.id}-${selectedImportedPlacePin?.id ?? ""}-${sheetExpanded}-${routeSummary.stops.length}-${mapImportedPlacePins.length}-${activeDrawerImportedStops.map((pin) => pin.id).join("|")}`}
        bottomInset={sheetExpanded ? "expanded" : "compact"}
        theme={app.theme}
      />

      <div className="map-screen-scrim pointer-events-none absolute inset-0 z-10" />
      <div className="map-screen-left-fade pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3" />
      <div className="map-screen-right-fade pointer-events-none absolute inset-y-0 right-0 z-10 w-1/4" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 p-3 sm:p-5">
        <div className="pointer-events-auto mx-auto flex max-w-7xl items-start justify-between gap-3">
          <div className="map-glass-toolbar min-w-0 rounded-full border px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/30">
                <Compass className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">IrieVerse Map</span>
                <span className="block truncate text-xs text-slate-500">
                  {activeCategoryLabel} layer · {visiblePinCount} pins
                </span>
              </span>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <FloatingMapButton
              icon={Search}
              label="Search and filters"
              onClick={() => {
                setActiveDrawerTab("overview");
                setSheetExpanded(true);
              }}
            />
            <FloatingMapButton icon={CalendarDays} label="Open Trips" onClick={() => onNavigate("trips")} />
          </div>
        </div>
      </div>

      {!visiblePinCount && (
        <div className="absolute left-1/2 top-1/2 z-50 w-[min(90vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-white/10 bg-slate-950/92 p-6 text-center shadow-2xl shadow-slate-950/70 backdrop-blur-2xl">
          <MapPin className="mx-auto h-8 w-8 text-cyan-300" />
          <h2 className="mt-3 text-lg font-semibold">No map pins match</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Clear search or switch layers to bring Jamaica pins back onto the map.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {!!app.search && (
              <button
                type="button"
                onClick={() => app.setSearch("")}
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950"
              >
                Clear search
              </button>
            )}
            {activeCategory !== "all" && (
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-cyan-300/50 px-4 py-2 text-xs font-bold text-cyan-100"
              >
                Show all layers
              </button>
            )}
          </div>
        </div>
      )}

      <aside
        data-testid="map-trip-drawer"
        className={classNames(
          "map-glass-drawer absolute inset-x-2 bottom-3 z-40 mx-auto max-w-5xl overflow-hidden rounded-[2rem] border transition-[max-height,transform] duration-300 sm:inset-x-5",
          sheetExpanded ? "max-h-[82vh]" : "max-h-[21.5rem]"
        )}
      >
        <button
          type="button"
          onClick={() => setSheetExpanded((prev) => !prev)}
          className="flex w-full items-center justify-center py-3 text-slate-400"
          aria-label={sheetExpanded ? "Collapse trip drawer" : "Expand trip drawer"}
        >
          <span className="h-1.5 w-14 rounded-full bg-slate-300" />
        </button>

        <div className="px-4 pb-4">
          <div className="flex gap-3">
            <img
              src={app.destination.heroImage}
              alt={app.destination.name}
              className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-lg shadow-slate-300/60 sm:h-24 sm:w-24"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-sky-600">Jamaica trip map</p>
                  <h1 className="mt-1 truncate text-2xl font-black tracking-tight sm:text-3xl">{tripTitle}</h1>
                  <p className="mt-2 truncate text-sm font-semibold text-slate-500">
                    {app.plannerDays} days · {routeSummary.stops.length} stops · {formatDriveTime(routeSummary.totalDriveMinutes)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate("trips")}
                  className="map-glass-control inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition hover:text-sky-300"
                  aria-label="Open Trips"
                >
                  <ArrowUpRight className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex min-h-9 items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  {getRouteStatusLabel(routeStatus)}
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate("trips")}
                  className="inline-flex min-h-9 items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700"
                >
                  Choose dates
                </button>
              </div>
            </div>
          </div>

          <TripDrawerTabs
            activeTab={activeDrawerTab}
            stops={routeSummary.stops}
            routeLegOptions={routeLegOptions}
            routeDetailsById={routeDetailsById}
            onSelectTab={handleSelectDrawerTab}
          />

          {sheetExpanded && (
            <div className="mt-4 max-h-[calc(82vh-16.5rem)] overflow-y-auto pr-1">
              {activeDrawerTab === "overview" && (
                <TripOverviewPanel
                  app={app}
                  activeCategory={activeCategory}
                  visiblePins={visiblePinCount}
                  routeStatus={routeStatus}
                  routeSummary={routeSummary}
                  selectedDestinationId={selectedDestination.id}
                  onCategoryChange={setActiveCategory}
                  onSelectDestination={handleSelectDestination}
                  onOpenTrips={() => onNavigate("trips")}
                />
              )}

              {activeDrawerTab === "unplanned" && (
                <UnplannedPlacesPanel
                  destinations={unplannedDestinations}
                  importedPlaces={importedPlacePins}
                  onSelectDestination={handleSelectDestination}
                  onSelectImportedPlace={handleSelectImportedPlace}
                  onOpenExplore={() => onNavigate("explore")}
                />
              )}

              {activeDrawerDay && activeDrawerDestination && activeDrawerStop && (
                <DayPlanPanel
                  day={activeDrawerDay}
                  destination={activeDrawerDestination}
                  stop={activeDrawerStop}
                  routeLeg={activeDrawerRouteLeg}
                  routeDetail={activeDrawerRouteDetail}
                  routeStatus={routeStatus}
                  plannerDay={activePlannerDay}
                  dayNote={app.dayNotes[String(activeDrawerDay)] ?? ""}
                  isSaved={app.savedPlaces.has(activeDrawerDestination.id)}
                  nearbyExperiences={getNearbyExperiences(activeDrawerDestination).slice(0, 3)}
                  importedStops={activeDrawerImportedStops}
                  onSetDayNote={(note) => app.setDayNote(activeDrawerDay, note)}
                  onToggleSaved={() => app.toggleSavedPlace(activeDrawerDestination.id)}
                  onAddToTrip={() => {
                    app.savePlace(activeDrawerDestination.id);
                    onNavigate("trips");
                  }}
                  onOpenDestinationMaps={() => handleOpenDestinationMaps(activeDrawerDestination)}
                  onOpenMaps={handleOpenDrivingGuide}
                  onNearbyExperience={handleNearbyExperience}
                  onOpenImportedStop={(pin) => handleSelectImportedPlace(pin.id, { keepDrawerTab: true })}
                  onOpenImportedStopMaps={handleOpenImportedPlaceMaps}
                  plannerDays={app.plannerDays}
                  importedIdeaDayAssignments={app.importedIdeaDayAssignments}
                  onAssignImportedStopToDay={app.assignImportedIdeaToDay}
                  onClearImportedStopDay={app.clearImportedIdeaDayAssignment}
                  onOpenDestinationDetail={() => setPlaceDetail({ type: "destination", destination: activeDrawerDestination, day: activeDrawerDay })}
                  onOpenExperienceDetail={(experience) =>
                    setPlaceDetail({ type: "experience", experience, day: activeDrawerDay, linkedDestination: activeDrawerDestination })
                  }
                />
              )}
            </div>
          )}
        </div>
      </aside>

      {placeDetail && (
        <PlaceDetailSheet
          target={placeDetail}
          liveDetails={livePlaceDetails}
          isLiveDetailsLoading={isPlaceDetailsLoading}
          dayNote={placeDetail.day ? app.dayNotes[String(placeDetail.day)] ?? "" : ""}
          isSaved={
            placeDetail.type === "destination"
              ? app.savedPlaces.has(placeDetail.destination.id)
              : app.savedExperiences.has(placeDetail.experience.id)
          }
          onSetDayNote={(note) => {
            if (placeDetail.day) app.setDayNote(placeDetail.day, note);
          }}
          onClose={() => setPlaceDetail(null)}
          onSave={() => handleSavePlaceDetail(placeDetail)}
          onAddToTrip={() => handleAddPlaceDetailToTrip(placeDetail)}
          onOpenMaps={() => handleOpenPlaceDetailMaps(placeDetail, livePlaceDetails)}
        />
      )}

      {selectedImportedPlacePin && (
        <ImportedPlaceDetailSheet
          pin={selectedImportedPlacePin}
          onClose={() => setSelectedImportedPlaceId(null)}
          onOpenMaps={() => handleOpenImportedPlaceMaps(selectedImportedPlacePin)}
          onAddToTrip={() => handleAddImportedPlaceToTrip(selectedImportedPlacePin)}
          onOpenSaved={() => onNavigate("saved")}
        />
      )}
    </section>
  );
}

type RouteSummary = TravelOS["itinerary"]["routeSummary"];
type RouteStop = RouteSummary["stops"][number];

type RouteLegOption = {
  id: string;
  day: number;
  index: number;
  leg: RouteLeg;
};

function getDrawerDay(tab: MapDrawerTab): number | null {
  if (!tab.startsWith("day-")) return null;
  const day = Number(tab.replace("day-", ""));
  return Number.isFinite(day) ? day : null;
}

function buildDestinationMapsUrl(destination: Destination): string {
  const params = new URLSearchParams({
    api: "1",
    query: `${destination.name}, ${destination.region}, Jamaica`,
  });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

function buildExperienceMapsUrl(experience: Experience): string {
  const params = new URLSearchParams({
    api: "1",
    query: `${experience.title}, ${experience.location}, ${experience.region}, Jamaica`,
  });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

function buildImportedPlaceMapsUrl(pin: ImportedPlacePin): string {
  const params = new URLSearchParams({
    api: "1",
    query: `${pin.latitude},${pin.longitude}`,
  });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

function buildImportedPlacePins(
  importedIdeas: ImportedIdea[],
  search: string,
  activeCategory: MapCategoryId
): ImportedPlacePin[] {
  const query = search.trim().toLowerCase();

  return importedIdeas
    .map((idea): ImportedPlacePin | null => {
      const place = idea.place;
      if (!place) return null;
      const latitude = asFiniteNumber(place.latitude);
      const longitude = asFiniteNumber(place.longitude);
      if (latitude === undefined || longitude === undefined) return null;

      const linkedDestination = idea.linkedDestinationId
        ? DESTINATIONS.find((destination) => destination.id === idea.linkedDestinationId)
        : undefined;
      const name = firstNonEmpty(place.name, idea.extractedPlaceName, idea.title);
      const address = firstNonEmpty(place.shortAddress, place.address);
      const category = getImportedPlacePinCategory(idea);
      const searchableText = [
        idea.title,
        idea.note,
        idea.description,
        idea.category,
        idea.sourceLabel,
        idea.siteName,
        place.name,
        place.address,
        place.shortAddress,
        place.primaryType,
        place.types?.join(" "),
        linkedDestination?.name,
      ].join(" ").toLowerCase();

      if (query && !searchableText.includes(query)) return null;
      if (!importedPlaceMatchesCategory(category, activeCategory)) return null;

      return {
        id: `import-${idea.id}`,
        name,
        subtitle: firstNonEmpty(address, linkedDestination?.name, formatImportedCategoryLabel(idea.category), "Saved Jamaica idea"),
        latitude,
        longitude,
        category,
        idea,
        address,
        mapsUrl: firstNonEmpty(place.mapsUrl, idea.canonicalUrl, idea.url),
        websiteUrl: place.websiteUrl ?? "",
        phone: place.phone ?? "",
        rating: place.rating,
        userRatingCount: place.userRatingCount,
        primaryType: firstNonEmpty(place.primaryType, humanizePlaceType(place.types?.[0] ?? "")),
        linkedDestination,
      } satisfies ImportedPlacePin;
    })
    .filter((pin): pin is ImportedPlacePin => Boolean(pin));
}

function mergeImportedPlacePins(...groups: ImportedPlacePin[][]): ImportedPlacePin[] {
  const byId = new globalThis.Map<string, ImportedPlacePin>();
  groups.flat().forEach((pin) => byId.set(pin.id, pin));
  return Array.from(byId.values());
}

function importedPinBelongsToDay(
  pin: ImportedPlacePin,
  day: number,
  destinationId: string,
  assignments: Record<string, string>
): boolean {
  const assignedDay = getAssignedImportedIdeaDay(pin.idea.id, assignments);
  if (assignedDay) return assignedDay === day;
  return pin.idea.linkedDestinationId === destinationId;
}

function getAssignedImportedIdeaDay(ideaId: string, assignments: Record<string, string>): number | undefined {
  const day = Number(assignments[ideaId]);
  return Number.isInteger(day) && day > 0 ? day : undefined;
}

function getImportedPlacePinCategory(idea: ImportedIdea): MapPinCategory {
  const text = [
    idea.category,
    idea.title,
    idea.note,
    idea.description,
    idea.place?.primaryType,
    idea.place?.types?.join(" "),
  ].join(" ").toLowerCase();

  if (idea.category === "food" || /restaurant|food|cafe|barbecue|jerk|dining/.test(text)) return "food";
  if (idea.category === "beach" || /beach|cove|falls|waterfall|river|lagoon|reef/.test(text)) return "beaches";
  if (idea.category === "music" || /music|reggae|dancehall|sound/.test(text)) return "music";
  if (idea.category === "culture" || /museum|culture|history|heritage|gallery|market/.test(text)) return "culture";
  if (idea.category === "nightlife" || /nightlife|club|bar|lounge|party/.test(text)) return "nightlife";
  return "default";
}

function importedPlaceMatchesCategory(category: MapPinCategory, activeCategory: MapCategoryId): boolean {
  if (activeCategory === "all") return true;
  if (activeCategory === "beaches") return category === "beaches";
  return category === activeCategory;
}

function formatImportedCategoryLabel(category: ImportedIdea["category"]): string {
  return category
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function asFiniteNumber(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() ?? "";
}

function FloatingMapButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="map-glass-control inline-flex h-14 w-14 items-center justify-center rounded-full border transition hover:text-cyan-300"
      aria-label={label}
      title={label}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

function TripDrawerTabs({
  activeTab,
  stops,
  routeLegOptions,
  routeDetailsById,
  onSelectTab,
}: {
  activeTab: MapDrawerTab;
  stops: RouteStop[];
  routeLegOptions: RouteLegOption[];
  routeDetailsById: Map<string, RouteDetail>;
  onSelectTab: (tab: MapDrawerTab) => void;
}) {
  return (
    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
      <TripDrawerTabButton active={activeTab === "overview"} icon={Route} label="Overview" onClick={() => onSelectTab("overview")} />
      <TripDrawerTabButton active={activeTab === "unplanned"} icon={Layers3} label="Unplanned" onClick={() => onSelectTab("unplanned")} muted />
      {stops.map((stop) => {
        const tab: MapDrawerTab = `day-${stop.day}`;
        const routeLeg = routeLegOptions.find((option) => option.day === stop.day);
        const routeDetail = routeLeg ? routeDetailsById.get(routeLeg.id) : null;
        const color = routeLeg ? getRouteColor(routeLeg.index) : "#0ea5e9";
        const dotClass = routeLeg && !routeDetail
          ? "animate-pulse bg-sky-400"
          : routeDetail?.source === "fallback"
            ? "bg-amber-400"
            : "bg-emerald-400";

        return (
          <button
            key={tab}
            type="button"
            onClick={() => onSelectTab(tab)}
            className={classNames(
              "inline-flex min-h-14 shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-black transition",
              activeTab === tab
                ? "border-[#020617] bg-[#020617] text-white shadow-lg shadow-slate-300"
                : "border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300 hover:text-slate-800"
            )}
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white"
              style={{ backgroundColor: color }}
            >
              {stop.day}
            </span>
            Day {stop.day}
            <span className={classNames("h-2 w-2 rounded-full", dotClass)} />
          </button>
        );
      })}
    </div>
  );
}

function TripDrawerTabButton({
  active,
  icon: Icon,
  label,
  onClick,
  muted,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "inline-flex min-h-14 shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-black transition",
        active
          ? "border-[#020617] bg-[#020617] text-white shadow-lg shadow-slate-300"
          : muted
            ? "border-slate-200 bg-slate-100 text-slate-400 hover:border-slate-300 hover:text-slate-800"
            : "border-slate-200 bg-slate-100 text-slate-600 hover:border-slate-300 hover:text-slate-900"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function TripOverviewPanel({
  app,
  activeCategory,
  visiblePins,
  routeStatus,
  routeSummary,
  selectedDestinationId,
  onCategoryChange,
  onSelectDestination,
  onOpenTrips,
}: {
  app: TravelOS;
  activeCategory: MapCategoryId;
  visiblePins: number;
  routeStatus: RouteRenderStatus;
  routeSummary: RouteSummary;
  selectedDestinationId: string;
  onCategoryChange: (category: MapCategoryId) => void;
  onSelectDestination: (destinationId: string) => void;
  onOpenTrips: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0">
        <div className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-sky-600" />
          <input
            type="search"
            value={app.search}
            onChange={(event) => app.setSearch(event.target.value)}
            placeholder="Search beaches, food, music, culture..."
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {!!app.search && (
            <button
              type="button"
              onClick={() => app.setSearch("")}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {MAP_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => onCategoryChange(category.id)}
              className={classNames(
                "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.12em] transition",
                activeCategory === category.id
                  ? "border-[#020617] bg-[#020617] text-white"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900"
              )}
            >
              <span className={classNames("h-2.5 w-2.5 rounded-full", category.color)} />
              {category.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <DrawerFact icon={Clock3} label="Drive" value={formatDriveTime(routeSummary.totalDriveMinutes)} />
          <DrawerFact icon={MapPin} label="Stops" value={routeSummary.stops.length.toString()} />
          <DrawerFact icon={Layers3} label="Pins" value={visiblePins.toString()} />
        </div>

        {!!routeSummary.warnings.length && (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
            {routeSummary.warnings[0].title}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-slate-400">Route Flow</p>
            <h2 className="mt-1 text-lg font-black">{routeSummary.routeTone}</h2>
          </div>
          <button
            type="button"
            onClick={onOpenTrips}
            className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full bg-sky-500 px-3 py-2 text-xs font-black text-white"
          >
            Edit <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
          {routeSummary.stops.map((stop, index) => (
            <RouteStopRow
              key={stop.destinationId}
              stop={stop}
              index={index}
              selected={stop.destinationId === selectedDestinationId}
              onSelect={() => onSelectDestination(stop.destinationId)}
            />
          ))}
        </div>

        <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold leading-5 text-emerald-800">
          {getRouteStatusLabel(routeStatus)}. Use the map to compare the plan; open Maps when it is time to drive.
        </p>
      </div>
    </div>
  );
}

function UnplannedPlacesPanel({
  destinations,
  importedPlaces,
  onSelectDestination,
  onSelectImportedPlace,
  onOpenExplore,
}: {
  destinations: Destination[];
  importedPlaces: ImportedPlacePin[];
  onSelectDestination: (destinationId: string) => void;
  onSelectImportedPlace: (placeId: string) => void;
  onOpenExplore: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-slate-400">Not In This Route</p>
          <h2 className="mt-1 text-xl font-black">Good Jamaica ideas to add next.</h2>
        </div>
        <button
          type="button"
          onClick={onOpenExplore}
          className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full bg-[#020617] px-3 py-2 text-xs font-black text-white"
        >
          Explore <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {importedPlaces.map((pin) => (
          <button
            key={pin.id}
            type="button"
            onClick={() => onSelectImportedPlace(pin.id)}
            className="overflow-hidden rounded-3xl border border-cyan-200 bg-cyan-50 text-left transition hover:border-sky-300"
          >
            <span className="flex h-28 w-full items-center justify-center bg-gradient-to-br from-cyan-100 via-white to-emerald-100">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-cyan-200 shadow-xl">
                <Sparkles className="h-6 w-6" />
              </span>
            </span>
            <span className="block p-3">
              <span className="block truncate text-sm font-black">{pin.name}</span>
              <span className="mt-1 block truncate text-xs font-semibold text-slate-500">{pin.subtitle}</span>
            </span>
          </button>
        ))}
        {destinations.map((destination) => (
          <button
            key={destination.id}
            type="button"
            onClick={() => onSelectDestination(destination.id)}
            className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 text-left transition hover:border-sky-300"
          >
            <img src={destination.heroImage} alt={destination.name} className="h-28 w-full object-cover" />
            <span className="block p-3">
              <span className="block truncate text-sm font-black">{destination.name}</span>
              <span className="mt-1 block truncate text-xs font-semibold text-slate-500">{destination.region}</span>
            </span>
          </button>
        ))}
      </div>

      {!destinations.length && !importedPlaces.length && (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-sky-500" />
          <p className="mt-2 text-sm font-black">Every visible pin is already part of this route.</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Change the layer or search to discover more ideas.</p>
        </div>
      )}
    </div>
  );
}

function DayPlanPanel({
  day,
  destination,
  stop,
  routeLeg,
  routeDetail,
  routeStatus,
  plannerDay,
  dayNote,
  isSaved,
  nearbyExperiences,
  importedStops,
  onSetDayNote,
  onToggleSaved,
  onAddToTrip,
  onOpenDestinationMaps,
  onOpenMaps,
  onNearbyExperience,
  onOpenImportedStop,
  onOpenImportedStopMaps,
  plannerDays,
  importedIdeaDayAssignments,
  onAssignImportedStopToDay,
  onClearImportedStopDay,
  onOpenDestinationDetail,
  onOpenExperienceDetail,
}: {
  day: number;
  destination: Destination;
  stop: RouteStop;
  routeLeg: RouteLegOption | null;
  routeDetail: RouteDetail | null;
  routeStatus: RouteRenderStatus;
  plannerDay: PlannerDay | null;
  dayNote: string;
  isSaved: boolean;
  nearbyExperiences: Experience[];
  importedStops: ImportedPlacePin[];
  onSetDayNote: (note: string) => void;
  onToggleSaved: () => void;
  onAddToTrip: () => void;
  onOpenDestinationMaps: () => void;
  onOpenMaps: () => void;
  onNearbyExperience: (experience: Experience) => void;
  onOpenImportedStop: (pin: ImportedPlacePin) => void;
  onOpenImportedStopMaps: (pin: ImportedPlacePin) => void;
  plannerDays: number;
  importedIdeaDayAssignments: Record<string, string>;
  onAssignImportedStopToDay: (ideaId: string, day: number) => void;
  onClearImportedStopDay: (ideaId: string) => void;
  onOpenDestinationDetail: () => void;
  onOpenExperienceDetail: (experience: Experience) => void;
}) {
  const dayExperience = plannerDay?.experience ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-sky-600">Day {day} Plan</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">{destination.name}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">{destination.region} · {plannerDay?.energyLevel ?? "balanced"} pace</p>
            </div>
            <button
              type="button"
              onClick={onOpenDestinationDetail}
              className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700"
            >
              Details <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {(plannerDay?.weatherNote || plannerDay?.routeNote) && (
            <div className="mt-3 rounded-2xl border border-sky-200 bg-white px-3 py-2 text-xs font-semibold leading-5 text-slate-600">
              {plannerDay.weatherNote && <p>{plannerDay.weatherNote}</p>}
              {plannerDay.routeNote && <p className={plannerDay.weatherNote ? "mt-1" : ""}>{plannerDay.routeNote}</p>}
            </div>
          )}

          {!!importedStops.length && (
            <DayFocusCard destination={destination} importedStops={importedStops} />
          )}

          <div className="relative mt-4 pl-9">
            <span className="absolute bottom-4 left-4 top-4 w-px border-l border-dashed border-slate-300" />
            <TimelineDestinationCard
              day={day}
              destination={destination}
              plannerDay={plannerDay}
              isSaved={isSaved}
              onOpenDetail={onOpenDestinationDetail}
              onToggleSaved={onToggleSaved}
              onAddToTrip={onAddToTrip}
              onOpenMaps={onOpenDestinationMaps}
            />

            <TimelineDriveChip stop={stop} routeLeg={routeLeg} routeDetail={routeDetail} />

            {!!importedStops.length && (
              <div className="mt-3 grid gap-2">
                <p className="pl-1 text-[0.62rem] font-black uppercase tracking-[0.16em] text-sky-600">
                  Exact stops from your board
                </p>
                {importedStops.map((pin, index) => (
                  <TimelineImportedStopCard
                    key={pin.id}
                    pin={pin}
                    index={index}
                    onOpen={() => onOpenImportedStop(pin)}
                    onOpenMaps={() => onOpenImportedStopMaps(pin)}
                    plannerDays={plannerDays}
                    assignedDay={getAssignedImportedIdeaDay(pin.idea.id, importedIdeaDayAssignments)}
                    onAssignDay={(day) => onAssignImportedStopToDay(pin.idea.id, day)}
                    onClearDay={() => onClearImportedStopDay(pin.idea.id)}
                  />
                ))}
              </div>
            )}

            {dayExperience ? (
              <TimelineExperienceCard
                experience={dayExperience}
                onOpenDetail={() => onOpenExperienceDetail(dayExperience)}
                onAddToTrip={() => onNearbyExperience(dayExperience)}
              />
            ) : (
              <div className="relative mt-3 rounded-3xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm font-semibold text-slate-500">
                <TimelineDot label="+" tone="muted" />
                Pick a nearby add-on from the side panel when you want this day to feel fuller.
              </div>
            )}
          </div>

          <DayNoteEditor day={day} note={dayNote} onSetNote={onSetDayNote} />
        </div>

        <RoutePreviewCard routeLeg={routeLeg} routeDetail={routeDetail} routeStatus={routeStatus} onOpenMaps={onOpenMaps} />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-slate-400">Nearby</p>
            <h3 className="mt-1 text-base font-black">Add-ons for Day {day}</h3>
          </div>
        </div>

        <div className="mt-3 grid gap-2">
          {nearbyExperiences.map((experience) => (
            <article
              key={experience.id}
              className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-2 text-left"
            >
              <img src={experience.imageUrl} alt={experience.title} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              <span className="min-w-0 flex-1 py-1">
                <span className="block truncate text-sm font-black">{experience.title}</span>
                <span className="mt-1 block text-xs font-semibold capitalize text-slate-500">
                  {experience.type} · {experience.bestTime}
                </span>
                <span className="mt-1 block text-xs font-bold text-emerald-600">{experience.approxCost}</span>
              </span>
              <span className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => onOpenExperienceDetail(experience)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-sky-300 hover:text-sky-700"
                  aria-label={`Open ${experience.title}`}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onNearbyExperience(experience)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-white"
                  aria-label={`Add ${experience.title} to trip`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </span>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function DayFocusCard({
  destination,
  importedStops,
}: {
  destination: Destination;
  importedStops: ImportedPlacePin[];
}) {
  const visibleStopNames = importedStops.slice(0, 2).map((pin) => pin.name);
  const hiddenCount = Math.max(0, importedStops.length - visibleStopNames.length);
  const stopLabel = `${importedStops.length} saved stop${importedStops.length === 1 ? "" : "s"}`;

  return (
    <section className="mt-3 rounded-3xl border border-cyan-200 bg-cyan-50/80 p-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-100">
          <MapPin className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-sky-600">Day focus</p>
          <p className="mt-1 text-sm font-black leading-5 text-slate-900">
            {stopLabel} pinned into this day.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {visibleStopNames.map((name) => (
              <MiniPill key={name}>{name}</MiniPill>
            ))}
            {!!hiddenCount && <MiniPill>{`+${hiddenCount} more`}</MiniPill>}
          </div>
        </div>
      </div>
    </section>
  );
}

function TimelineDestinationCard({
  day,
  destination,
  plannerDay,
  isSaved,
  onOpenDetail,
  onToggleSaved,
  onAddToTrip,
  onOpenMaps,
}: {
  day: number;
  destination: Destination;
  plannerDay: PlannerDay | null;
  isSaved: boolean;
  onOpenDetail: () => void;
  onToggleSaved: () => void;
  onAddToTrip: () => void;
  onOpenMaps: () => void;
}) {
  return (
    <article className="relative rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
      <TimelineDot label={String(day)} />
      <div className="flex gap-3">
        <img src={destination.heroImage} alt={destination.name} className="h-24 w-24 shrink-0 rounded-2xl object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-sky-600">Main stop</p>
              <h3 className="mt-1 truncate text-lg font-black">{destination.name}</h3>
            </div>
            <button
              type="button"
              onClick={onOpenDetail}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-sky-300 hover:text-sky-700"
              aria-label={`Open ${destination.name}`}
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">
            {plannerDay?.highlight ?? destination.headline}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <MiniPill>{`${destination.rating.toFixed(1)} rating`}</MiniPill>
            <MiniPill>{"$".repeat(destination.priceLevel)}</MiniPill>
            <MiniPill>{plannerDay?.vibe ?? destination.vibes[0]}</MiniPill>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <DrawerAction icon={Heart} label={isSaved ? "Saved" : "Save"} onClick={onToggleSaved} active={isSaved} />
        <DrawerAction icon={Plus} label="Trip" onClick={onAddToTrip} primary />
        <DrawerAction icon={Navigation} label="Maps" onClick={onOpenMaps} />
      </div>
    </article>
  );
}

function TimelineDriveChip({
  stop,
  routeLeg,
  routeDetail,
}: {
  stop: RouteStop;
  routeLeg: RouteLegOption | null;
  routeDetail: RouteDetail | null;
}) {
  const distanceKm = routeDetail?.distanceKm ?? routeLeg?.leg.distanceKm ?? stop.distanceFromPreviousKm;
  const durationMinutes = routeDetail?.durationMinutes ?? routeLeg?.leg.driveMinutes ?? stop.driveMinutesFromPrevious;

  return (
    <div className="relative mt-3 flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm">
      <TimelineDot label="" tone="route" />
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600">
        <Route className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 truncate">
        {durationMinutes ? `${formatDriveTime(durationMinutes)} drive` : "Start in this area"}
      </span>
      <span className="shrink-0 text-slate-400">{distanceKm ? formatMiles(distanceKm) : "Base"}</span>
    </div>
  );
}

function TimelineImportedStopCard({
  pin,
  index,
  onOpen,
  onOpenMaps,
  plannerDays,
  assignedDay,
  onAssignDay,
  onClearDay,
}: {
  pin: ImportedPlacePin;
  index: number;
  onOpen: () => void;
  onOpenMaps: () => void;
  plannerDays: number;
  assignedDay?: number;
  onAssignDay: (day: number) => void;
  onClearDay: () => void;
}) {
  const ratingText = typeof pin.rating === "number"
    ? pin.userRatingCount
      ? `${pin.rating.toFixed(1)} (${formatCompactCount(pin.userRatingCount)})`
      : pin.rating.toFixed(1)
    : "";
  const pills = uniqueStrings([
    pin.primaryType,
    ratingText ? `${ratingText} rating` : "",
    pin.idea.sourceLabel ?? "",
  ]).slice(0, 3);

  return (
    <article className="relative rounded-3xl border border-cyan-200 bg-cyan-50/80 p-3 shadow-sm shadow-cyan-100/60">
      <TimelineDot label={String(index + 1)} tone="imported" />
      <div className="flex gap-3">
        {pin.idea.imageUrl ? (
          <img src={pin.idea.imageUrl} alt={pin.name} className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
        ) : (
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 via-white to-emerald-100">
            <Sparkles className="h-7 w-7 text-sky-600" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-sky-600">Exact stop</p>
              <h3 className="mt-1 truncate text-base font-black">{pin.name}</h3>
            </div>
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-white text-slate-500 transition hover:border-sky-300 hover:text-sky-700"
              aria-label={`Open exact stop ${pin.name}`}
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">
            {pin.address || pin.subtitle}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pills.map((pill) => (
              <MiniPill key={pill}>{pill}</MiniPill>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <DrawerAction icon={ArrowUpRight} label="Details" onClick={onOpen} />
        <DrawerAction icon={Navigation} label="Maps" onClick={onOpenMaps} />
      </div>
      <label className="mt-2 block">
        <span className="sr-only">Move {pin.name} to day</span>
        <select
          value={assignedDay ? String(assignedDay) : ""}
          onChange={(event) => {
            if (event.target.value) {
              onAssignDay(Number(event.target.value));
            } else {
              onClearDay();
            }
          }}
          className="w-full rounded-2xl border border-cyan-200 bg-white px-3 py-2 text-xs font-black text-slate-700"
          aria-label={`Move ${pin.name} to day`}
        >
          <option value="">Auto day</option>
          {Array.from({ length: plannerDays }, (_, dayIndex) => dayIndex + 1).map((dayOption) => (
            <option key={dayOption} value={dayOption}>
              Day {dayOption}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}

function TimelineExperienceCard({
  experience,
  onOpenDetail,
  onAddToTrip,
}: {
  experience: Experience;
  onOpenDetail: () => void;
  onAddToTrip: () => void;
}) {
  return (
    <article className="relative mt-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
      <TimelineDot label="2" tone="experience" />
      <div className="flex gap-3">
        <img src={experience.imageUrl} alt={experience.title} className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-emerald-600">Suggested add-on</p>
              <h3 className="mt-1 truncate text-base font-black">{experience.title}</h3>
            </div>
            <button
              type="button"
              onClick={onOpenDetail}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-sky-300 hover:text-sky-700"
              aria-label={`Open ${experience.title}`}
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{experience.description}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <MiniPill>{experience.type}</MiniPill>
            <MiniPill>{experience.bestTime}</MiniPill>
            <MiniPill>{experience.approxCost}</MiniPill>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onAddToTrip}
        className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl bg-[#020617] px-3 py-2 text-sm font-black text-white"
      >
        <Plus className="h-4 w-4" />
        Add this idea
      </button>
    </article>
  );
}

function TimelineDot({ label, tone = "main" }: { label: string; tone?: "main" | "route" | "experience" | "imported" | "muted" }) {
  const toneClass = {
    main: "bg-sky-500 text-white",
    route: "bg-[#020617] text-white",
    experience: "bg-emerald-500 text-white",
    imported: "bg-cyan-500 text-white",
    muted: "bg-slate-200 text-slate-500",
  }[tone];

  return (
    <span className={classNames("absolute -left-9 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border-4 border-slate-50 text-xs font-black", toneClass)}>
      {label}
    </span>
  );
}

function MiniPill({ children }: { children: string }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-full bg-slate-100 px-2.5 py-1 text-[0.68rem] font-black capitalize text-slate-500">
      {children}
    </span>
  );
}

function DayNoteEditor({
  day,
  note,
  onSetNote,
}: {
  day: number;
  note: string;
  onSetNote: (note: string) => void;
}) {
  return (
    <label className="mt-4 block rounded-3xl border border-slate-200 bg-white p-3">
      <span className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">Day {day} Notes</span>
      <textarea
        value={note}
        onChange={(event) => onSetNote(event.target.value)}
        maxLength={280}
        rows={2}
        placeholder="Reservation times, pickup notes, reminders..."
        className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold leading-5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
      />
      <span className="mt-1 block text-right text-[0.68rem] font-semibold text-slate-400">{note.length}/280</span>
    </label>
  );
}

function ImportedPlaceDetailSheet({
  pin,
  onClose,
  onOpenMaps,
  onAddToTrip,
  onOpenSaved,
}: {
  pin: ImportedPlacePin;
  onClose: () => void;
  onOpenMaps: () => void;
  onAddToTrip: () => void;
  onOpenSaved: () => void;
}) {
  const ratingText = typeof pin.rating === "number"
    ? pin.userRatingCount
      ? `${pin.rating.toFixed(1)} (${formatCompactCount(pin.userRatingCount)})`
      : pin.rating.toFixed(1)
    : "";
  const pills = uniqueStrings([
    pin.primaryType,
    formatImportedCategoryLabel(pin.idea.category),
    pin.idea.sourceLabel ?? "",
    pin.linkedDestination?.name ?? "",
  ]).slice(0, 4);

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-950/55 p-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur-md sm:p-5">
      <article
        data-testid="imported-place-detail-sheet"
        className="map-glass-sheet flex max-h-[84vh] w-full max-w-xl flex-col overflow-hidden rounded-[2rem] border"
      >
        <div className="flex items-start gap-3 p-4 sm:p-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-100 via-white to-emerald-100 shadow-lg shadow-slate-200">
            <Sparkles className="h-8 w-8 text-sky-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-sky-600">Saved map idea</p>
            <h2 className="mt-1 text-3xl font-black leading-tight tracking-tight">{pin.name}</h2>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-500">
              {ratingText && (
                <>
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {ratingText} ·
                </>
              )}
              {pin.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-950"
            aria-label="Close saved idea details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="flex flex-wrap gap-2">
            {pills.map((pill) => (
              <MiniPill key={pill}>{pill}</MiniPill>
            ))}
          </div>

          <section className="mt-4 rounded-3xl border border-cyan-100 bg-cyan-50/80 p-4">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-sky-600">Place facts</p>
            <div className="mt-3 grid gap-2">
              <ImportedPlaceFact icon={MapPin} label="Address" value={pin.address || pin.subtitle} />
              {pin.phone && <ImportedPlaceFact icon={Phone} label="Phone" value={pin.phone} />}
              {pin.websiteUrl && <ImportedPlaceFact icon={Globe2} label="Website" value={readableUrl(pin.websiteUrl)} />}
            </div>
          </section>

          {(pin.idea.note || pin.idea.description) && (
            <section className="mt-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-lg font-black">Why you saved it</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                {pin.idea.note || pin.idea.description}
              </p>
            </section>
          )}

          {!pin.idea.linkedDestinationId && (
            <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
              Attach this saved idea to a Jamaica area in Saved before turning it into a full trip day.
            </p>
          )}
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-2 border-t border-slate-200 bg-white/95 p-4">
          <DrawerAction icon={Heart} label="Saved" onClick={onOpenSaved} active />
          <DrawerAction icon={Navigation} label="Maps" onClick={onOpenMaps} />
          <DrawerAction icon={Plus} label="Trip" onClick={onAddToTrip} primary />
        </div>
      </article>
    </div>
  );
}

function ImportedPlaceFact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/80 bg-white px-3 py-2 shadow-sm shadow-sky-100/60">
      <Icon className="h-4 w-4 shrink-0 text-sky-600" />
      <span className="min-w-0 flex-1">
        <span className="block text-[0.62rem] font-black uppercase tracking-[0.14em] text-slate-400">{label}</span>
        <span className="mt-0.5 block truncate text-sm font-black text-slate-800">{value}</span>
      </span>
    </div>
  );
}

function PlaceDetailSheet({
  target,
  liveDetails,
  isLiveDetailsLoading,
  dayNote,
  isSaved,
  onSetDayNote,
  onClose,
  onSave,
  onAddToTrip,
  onOpenMaps,
}: {
  target: PlaceDetailTarget;
  liveDetails: PlaceDetails | null;
  isLiveDetailsLoading: boolean;
  dayNote: string;
  isSaved: boolean;
  onSetDayNote: (note: string) => void;
  onClose: () => void;
  onSave: () => void;
  onAddToTrip: () => void;
  onOpenMaps: () => void;
}) {
  const isDestination = target.type === "destination";
  const title = isDestination ? target.destination.name : target.experience.title;
  const region = isDestination ? target.destination.region : target.experience.region;
  const imageUrl = isDestination ? target.destination.heroImage : target.experience.imageUrl;
  const description = isDestination ? target.destination.description : target.experience.description;
  const rating = liveDetails?.rating ?? (isDestination ? target.destination.rating : target.experience.rating);
  const ratingText = liveDetails?.userRatingCount
    ? `${rating.toFixed(1)} (${formatCompactCount(liveDetails.userRatingCount)})`
    : rating.toFixed(1);
  const kicker = isDestination ? "Jamaica stop" : `${target.experience.type} idea`;
  const liveTypePill = liveDetails?.primaryType || humanizePlaceType(liveDetails?.types[0] ?? "");
  const pills = isDestination
    ? uniqueStrings([liveTypePill, ...target.destination.vibes]).slice(0, 4)
    : uniqueStrings([liveTypePill, target.experience.type, target.experience.energy, target.experience.bestTime, target.experience.approxCost]).slice(0, 4);
  const curatedFacts = isDestination
    ? [
        { label: "Region", value: target.destination.region },
        { label: "Budget", value: "$".repeat(target.destination.priceLevel) },
        { label: "Airport", value: target.destination.airportCode },
      ]
    : [
        { label: "Location", value: target.experience.location },
        { label: "Best time", value: target.experience.bestTime },
        { label: "Cost", value: target.experience.approxCost },
      ];
  const whatToExpect = isDestination ? target.destination.highlights.slice(0, 4) : target.experience.whatToExpect.slice(0, 4);
  const liveVisitRows = buildLiveVisitRows(liveDetails);
  const openStatusLabel = isLiveDetailsLoading
    ? "Checking latest"
    : liveDetails?.openNow === true
      ? "Open now"
      : liveDetails?.openNow === false
        ? "Closed now"
        : "";

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-950/55 p-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur-md sm:p-5">
      <article
        data-testid="place-detail-sheet"
        className="map-glass-sheet flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border"
      >
        <div className="flex items-start gap-3 p-4 sm:p-5">
          <img src={imageUrl} alt={title} className="h-24 w-24 shrink-0 rounded-3xl object-cover shadow-lg shadow-slate-200 sm:h-28 sm:w-28" />
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-sky-600">{kicker}</p>
            <h2 className="mt-1 text-3xl font-black leading-tight tracking-tight">{title}</h2>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-500">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              {ratingText} · {region}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-950"
            aria-label="Close place details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5">
          <img src={imageUrl} alt="" className="h-56 w-full rounded-3xl object-cover shadow-xl shadow-slate-200" />

          <div className="mt-4 flex flex-wrap gap-2">
            {pills.map((pill) => (
              <MiniPill key={pill}>{pill}</MiniPill>
            ))}
          </div>

          {(isLiveDetailsLoading || liveVisitRows.length > 0) && (
            <section className="mt-4 rounded-3xl border border-sky-100 bg-sky-50/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-sky-600">Visit details</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{liveDetails?.name || title}</p>
                </div>
                {openStatusLabel && (
                  <span
                    className={classNames(
                      "inline-flex min-h-8 items-center rounded-full px-3 py-1 text-xs font-black",
                      isLiveDetailsLoading
                        ? "bg-white text-sky-700"
                        : liveDetails?.openNow
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                    )}
                  >
                    {openStatusLabel}
                  </span>
                )}
              </div>

              <div className="mt-3 grid gap-2">
                {liveVisitRows.map((row) => (
                  <LiveVisitRow key={row.label} {...row} />
                ))}
              </div>
            </section>
          )}

          <section className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-black">About this place</h3>
              {isLiveDetailsLoading && (
                <span className="inline-flex shrink-0 items-center rounded-full bg-sky-50 px-2.5 py-1 text-[0.62rem] font-black text-sky-700">
                  Checking latest
                </span>
              )}
            </div>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{description}</p>
          </section>

          {!!whatToExpect.length && (
            <section className="mt-3 rounded-3xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-400">Good to know</h3>
              <div className="mt-3 grid gap-2">
                {whatToExpect.map((item) => (
                  <div key={item} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold leading-5 text-slate-600">
                    {item}
                  </div>
                ))}
              </div>
            </section>
          )}

          {!liveDetails && (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {curatedFacts.map((fact) => (
                <div key={fact.label} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-slate-400">{fact.label}</p>
                  <p className="mt-1 truncate text-sm font-black text-slate-800">{fact.value}</p>
                </div>
              ))}
            </div>
          )}

          {!!liveDetails?.weekdayDescriptions.length && (
            <section className="mt-3 rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-400">Hours</h3>
              </div>
              <div className="mt-3 grid gap-1.5">
                {liveDetails.weekdayDescriptions.slice(0, 7).map((description) => (
                  <p key={description} className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-600">
                    {description}
                  </p>
                ))}
              </div>
            </section>
          )}

          {target.day && (
            <DayNoteEditor day={target.day} note={dayNote} onSetNote={onSetDayNote} />
          )}
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-2 border-t border-slate-200 bg-white/95 p-4">
          <DrawerAction icon={Heart} label={isSaved ? "Saved" : "Save"} onClick={onSave} active={isSaved} />
          <DrawerAction icon={Navigation} label="Maps" onClick={onOpenMaps} />
          <DrawerAction icon={Plus} label="Trip" onClick={onAddToTrip} primary />
        </div>
      </article>
    </div>
  );
}

type LiveVisitRowProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  href?: string;
};

function buildLiveVisitRows(details: PlaceDetails | null): LiveVisitRowProps[] {
  if (!details) return [];

  const address = details.shortAddress || details.address;
  const phone = details.phone || details.internationalPhone;

  return [
    {
      icon: MapPin,
      label: "Address",
      value: address,
      href: details.mapsUrl || undefined,
    },
    {
      icon: Phone,
      label: "Phone",
      value: phone,
      href: phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : undefined,
    },
    {
      icon: Globe2,
      label: "Website",
      value: details.websiteUrl ? readableUrl(details.websiteUrl) : "",
      href: details.websiteUrl || undefined,
    },
    {
      icon: Navigation,
      label: "Open in Maps",
      value: details.mapsUrl ? "Google Maps listing" : "",
      href: details.mapsUrl || undefined,
    },
  ].filter((row) => row.value);
}

function LiveVisitRow({ icon: Icon, label, value, href }: LiveVisitRowProps) {
  const content = (
    <>
      <Icon className="h-4 w-4 shrink-0 text-sky-600" />
      <span className="min-w-0 flex-1">
        <span className="block text-[0.62rem] font-black uppercase tracking-[0.14em] text-slate-400">{label}</span>
        <span className="mt-0.5 block truncate text-sm font-black text-slate-800">{value}</span>
      </span>
      {href && <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target={href.startsWith("tel:") ? undefined : "_blank"}
        rel={href.startsWith("tel:") ? undefined : "noreferrer"}
        className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/80 bg-white px-3 py-2 text-left shadow-sm shadow-sky-100/60 transition hover:border-sky-200"
      >
        {content}
      </a>
    );
  }

  return (
    <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/80 bg-white px-3 py-2 text-left shadow-sm shadow-sky-100/60">
      {content}
    </div>
  );
}

function readableUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function humanizePlaceType(value: string): string {
  return value
    .replace(/_/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalizedValue = value.trim();
    if (!normalizedValue) return false;
    const key = normalizedValue.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatCompactCount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function RoutePreviewCard({
  routeLeg,
  routeDetail,
  routeStatus,
  onOpenMaps,
}: {
  routeLeg: RouteLegOption | null;
  routeDetail: RouteDetail | null;
  routeStatus: RouteRenderStatus;
  onOpenMaps: () => void;
}) {
  if (!routeLeg) {
    return (
      <div className="mt-4 rounded-3xl border border-sky-200 bg-sky-50 p-4">
        <p className="text-sm font-black text-sky-900">Start day</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-sky-700">
          This is the route anchor. Pick another day tab to inspect drive time between stops.
        </p>
      </div>
    );
  }

  const hasRoadPreview = routeDetail?.source === "road";
  const distanceKm = routeDetail?.distanceKm ?? routeLeg.leg.distanceKm;
  const durationMinutes = routeDetail?.durationMinutes ?? routeLeg.leg.driveMinutes;

  return (
    <div className={classNames(
      "mt-4 rounded-3xl border p-4",
      hasRoadPreview ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-slate-500">
            {hasRoadPreview ? "Road-following preview" : "Planning estimate"}
          </p>
          <h3 className="mt-1 text-base font-black">
            {routeLeg.leg.fromName} to {routeLeg.leg.toName}
          </h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
            {hasRoadPreview
              ? "Use this to compare day flow. It is not live navigation or traffic."
              : routeDetail?.fallbackMessage ?? "Using an estimated planning line for this leg."}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenMaps}
          className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full bg-[#020617] px-3 py-2 text-xs font-black text-white"
        >
          Maps <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {routeStatus.isLoading && !routeDetail && (
        <p className="mt-3 text-xs font-semibold text-slate-600">Building the road preview...</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <DrawerFact icon={Route} label="Distance" value={formatMiles(distanceKm)} />
        <DrawerFact icon={Clock3} label="Drive time" value={formatDriveTime(durationMinutes)} />
      </div>
    </div>
  );
}

function RouteStopRow({
  stop,
  index,
  selected,
  onSelect,
}: {
  stop: RouteStop;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={classNames(
        "flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition",
        selected
          ? "border-sky-400 bg-white text-slate-950 shadow-sm"
          : "border-slate-200 bg-white text-slate-600 hover:border-sky-300"
      )}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
        style={{ backgroundColor: getRouteColor(Math.max(0, index - 1)) }}
      >
        {stop.day}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black">{stop.name}</span>
        <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">
          {stop.driveMinutesFromPrevious ? `${formatDriveTime(stop.driveMinutesFromPrevious)} · ${formatMiles(stop.distanceFromPreviousKm)}` : "Start"} · {stop.region}
        </span>
      </span>
    </button>
  );
}

function DrawerFact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-2">
      <Icon className="h-4 w-4 text-sky-600" />
      <p className="mt-2 truncate text-[0.62rem] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function DrawerAction({
  icon: Icon,
  label,
  onClick,
  active,
  primary,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-black transition",
        primary
          ? "border-sky-500 bg-sky-500 text-white shadow-lg shadow-sky-200"
          : active
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700"
      )}
    >
      <Icon className={classNames("h-4 w-4", active && label === "Saved" ? "fill-current" : "")} />
      {label}
    </button>
  );
}
