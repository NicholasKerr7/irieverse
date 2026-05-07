import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Compass,
  Heart,
  Layers3,
  MapPin,
  Navigation,
  Plus,
  Route,
  Search,
  Sparkles,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";
import { TravelMap, type RouteDetail, type RouteRenderStatus } from "../components/TravelMap";
import type { MobileTabId } from "../components/mobile/BottomNav";
import { DESTINATIONS } from "../data/content";
import type { TravelOS } from "../hooks/useTravelOS";
import type { Destination, Experience, RouteLeg } from "../types/travel";
import { classNames } from "../utils/classNames";
import { formatDriveTime, formatMiles } from "../utils/format";
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
} from "../utils/mapRoutes";

type MapScreenProps = {
  app: TravelOS;
  onNavigate: (tab: MobileTabId) => void;
};

type MapDrawerTab = "overview" | "unplanned" | `day-${number}`;

export function MapScreen({ app, onNavigate }: MapScreenProps) {
  const [activeCategory, setActiveCategory] = useState<MapCategoryId>("all");
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<MapDrawerTab>("overview");
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

  useEffect(() => {
    if (!visibleDestinations.length) return;
    if (visibleDestinations.some((destination) => destination.id === focusedDestinationId)) return;
    setFocusedDestinationId(visibleDestinations[0].id);
  }, [focusedDestinationId, visibleDestinations]);

  useEffect(() => {
    if (DESTINATIONS.some((destination) => destination.id === app.plannerBaseId)) {
      setFocusedDestinationId(app.plannerBaseId);
    }
  }, [app.plannerBaseId]);

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
  const tripTitle = `${app.plannerDays}-day ${app.destination.region}`;

  useEffect(() => {
    if (!selectedRouteLegId) return;
    if (routeLegOptions.some((option) => option.id === selectedRouteLegId)) return;
    setSelectedRouteLegId(null);
  }, [routeLegOptions, selectedRouteLegId]);

  const handleSelectDestination = (destinationId: string) => {
    setFocusedDestinationId(destinationId);
    const matchingLeg = routeLegOptions.find((option) => option.leg.toDestinationId === destinationId);
    const matchingStop = routeSummary.stops.find((stop) => stop.destinationId === destinationId);
    setSelectedRouteLegId(matchingLeg?.id ?? null);
    setActiveDrawerTab(matchingStop ? `day-${matchingStop.day}` : "overview");
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

  return (
    <section className="relative isolate h-[calc(100svh-5.5rem)] min-h-[560px] overflow-hidden bg-slate-950 sm:h-[calc(100vh-7rem)] sm:min-h-[700px]">
      <TravelMap
        destinations={mapDestinations}
        selectedDestinationId={selectedDestination.id}
        onSelectDestination={handleSelectDestination}
        viewState={app.mapViewState}
        onMove={app.handleMapMove}
        className="rounded-none border-0"
        height="100%"
        scrollZoom
        getMarkerCategory={getDestinationPinCategory}
        routeDestinations={routeDestinations}
        routeLegs={routeSummary.legs}
        selectedRouteLegId={selectedRouteLegId}
        onSelectRouteLeg={(routeLegId) => handleSelectRouteLeg(routeLegId)}
        onRouteStatusChange={setRouteStatus}
        onRouteDetailsChange={setRouteDetails}
        autoFitKey={`${activeCategory}-${app.search}-${selectedDestination.id}-${sheetExpanded}-${routeSummary.stops.length}`}
        bottomInset={sheetExpanded ? "expanded" : "compact"}
        theme={app.theme}
      />

      <div className="map-screen-scrim pointer-events-none absolute inset-0 z-10" />
      <div className="map-screen-left-fade pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3" />
      <div className="map-screen-right-fade pointer-events-none absolute inset-y-0 right-0 z-10 w-1/4" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 p-3 sm:p-5">
        <div className="pointer-events-auto mx-auto flex max-w-7xl items-start justify-between gap-3">
          <div className="min-w-0 rounded-full border border-white/20 bg-white/90 px-4 py-3 text-slate-950 shadow-2xl shadow-sky-950/20 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-cyan-200">
                <Compass className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">IrieVerse Map</span>
                <span className="block truncate text-xs text-slate-500">
                  {activeCategoryLabel} layer · {visibleDestinations.length} pins
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

      {!visibleDestinations.length && (
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
          "absolute inset-x-2 bottom-3 z-40 mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/95 text-slate-950 shadow-2xl shadow-sky-950/30 backdrop-blur-2xl transition-[max-height,transform] duration-300 sm:inset-x-5",
          sheetExpanded ? "max-h-[82vh]" : "max-h-[18.5rem]"
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
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-lg shadow-slate-200 transition hover:text-sky-600"
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
                  visiblePins={visibleDestinations.length}
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
                  onSelectDestination={handleSelectDestination}
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
                  isSaved={app.savedPlaces.has(activeDrawerDestination.id)}
                  nearbyExperiences={getNearbyExperiences(activeDrawerDestination).slice(0, 3)}
                  onToggleSaved={() => app.toggleSavedPlace(activeDrawerDestination.id)}
                  onAddToTrip={() => {
                    app.savePlace(activeDrawerDestination.id);
                    onNavigate("trips");
                  }}
                  onOpenMaps={handleOpenDrivingGuide}
                  onNearbyExperience={handleNearbyExperience}
                />
              )}
            </div>
          )}
        </div>
      </aside>
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
      className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/35 bg-white/90 text-slate-700 shadow-2xl shadow-sky-950/20 backdrop-blur-xl transition hover:text-sky-600"
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
                ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-300"
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
          ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-300"
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
                  ? "border-slate-950 bg-slate-950 text-white"
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
  onSelectDestination,
  onOpenExplore,
}: {
  destinations: Destination[];
  onSelectDestination: (destinationId: string) => void;
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
          className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white"
        >
          Explore <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

      {!destinations.length && (
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
  isSaved,
  nearbyExperiences,
  onToggleSaved,
  onAddToTrip,
  onOpenMaps,
  onNearbyExperience,
}: {
  day: number;
  destination: Destination;
  stop: RouteStop;
  routeLeg: RouteLegOption | null;
  routeDetail: RouteDetail | null;
  routeStatus: RouteRenderStatus;
  isSaved: boolean;
  nearbyExperiences: Experience[];
  onToggleSaved: () => void;
  onAddToTrip: () => void;
  onOpenMaps: () => void;
  onNearbyExperience: (experience: Experience) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
          <div className="relative h-40">
            <img src={destination.heroImage} alt={destination.name} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/72 to-transparent" />
            <span className="absolute bottom-3 left-3 rounded-full bg-white px-3 py-1 text-xs font-black text-slate-950">
              Day {day}
            </span>
          </div>
          <div className="p-4">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-sky-600">{destination.region}</p>
            <h2 className="mt-1 text-2xl font-black">{destination.name}</h2>
            <p className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-500">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              {destination.rating.toFixed(1)} · {"$".repeat(destination.priceLevel)} · {destination.airportCode}
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{destination.description}</p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <DrawerFact icon={Clock3} label="Transfer" value={stop.driveMinutesFromPrevious ? formatDriveTime(stop.driveMinutesFromPrevious) : "Start"} />
              <DrawerFact icon={Route} label="Distance" value={stop.distanceFromPreviousKm ? formatMiles(stop.distanceFromPreviousKm) : "Base"} />
              <DrawerFact icon={Sparkles} label="Nearby" value={`${nearbyExperiences.length} ideas`} />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <DrawerAction icon={Heart} label={isSaved ? "Saved" : "Save"} onClick={onToggleSaved} active={isSaved} />
              <DrawerAction icon={Plus} label="Trip" onClick={onAddToTrip} primary />
              <DrawerAction icon={Navigation} label="Maps" onClick={onOpenMaps} />
            </div>
          </div>
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
            <button
              key={experience.id}
              type="button"
              onClick={() => onNearbyExperience(experience)}
              className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-2 text-left transition hover:border-sky-300"
            >
              <img src={experience.imageUrl} alt={experience.title} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              <span className="min-w-0 flex-1 py-1">
                <span className="block truncate text-sm font-black">{experience.title}</span>
                <span className="mt-1 block text-xs font-semibold capitalize text-slate-500">
                  {experience.type} · {experience.bestTime}
                </span>
                <span className="mt-1 block text-xs font-bold text-emerald-600">{experience.approxCost}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
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
          className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white"
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
