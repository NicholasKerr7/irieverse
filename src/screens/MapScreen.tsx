import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  Compass,
  Gauge,
  Heart,
  Layers3,
  MapPin,
  Navigation,
  Plane,
  Plus,
  Radar,
  Route,
  Search,
  Sparkles,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";
import { TravelMap, type MapPinCategory, type RouteRenderStatus } from "../components/TravelMap";
import type { MobileTabId } from "../components/mobile/BottomNav";
import { DESTINATIONS, EXPERIENCES } from "../data/content";
import type { TravelOS } from "../hooks/useTravelOS";
import type { Destination, Experience, RouteLeg } from "../types/travel";
import { classNames } from "../utils/classNames";

type MapScreenProps = {
  app: TravelOS;
  onNavigate: (tab: MobileTabId) => void;
};

type MapCategoryId = "all" | "beaches" | "food" | "music" | "culture" | "nightlife";

const MAP_CATEGORIES: Array<{ id: MapCategoryId; label: string; color: string; border: string }> = [
  { id: "all", label: "All", color: "bg-slate-200", border: "border-slate-200/50" },
  { id: "beaches", label: "Beaches", color: "bg-cyan-300", border: "border-cyan-300/50" },
  { id: "food", label: "Food", color: "bg-amber-300", border: "border-amber-300/50" },
  { id: "music", label: "Music", color: "bg-violet-300", border: "border-violet-300/50" },
  { id: "culture", label: "Culture", color: "bg-emerald-300", border: "border-emerald-300/50" },
  { id: "nightlife", label: "Nightlife", color: "bg-rose-300", border: "border-rose-300/50" },
];

const ROUTE_COLORS = ["#fb5573", "#f59e0b", "#d946ef", "#22c55e", "#8b5cf6", "#38bdf8"];

export function MapScreen({ app, onNavigate }: MapScreenProps) {
  const [activeCategory, setActiveCategory] = useState<MapCategoryId>("all");
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [showRoutePreview, setShowRoutePreview] = useState(true);
  const [selectedRouteLegId, setSelectedRouteLegId] = useState<string | null>(null);
  const [routeStatus, setRouteStatus] = useState<RouteRenderStatus>({
    isLoading: false,
    totalLegs: 0,
    roadLegs: 0,
    fallbackLegs: 0,
  });

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
    if (visibleDestinations.some((destination) => destination.id === app.plannerBaseId)) return;
    app.setPlannerBaseId(visibleDestinations[0].id);
  }, [app.plannerBaseId, app.setPlannerBaseId, visibleDestinations]);

  const selectedDestination =
    DESTINATIONS.find((destination) => destination.id === app.plannerBaseId) ?? visibleDestinations[0] ?? DESTINATIONS[0];
  const selectedCategory = getDestinationPinCategory(selectedDestination);
  const isSaved = app.savedPlaces.has(selectedDestination.id);
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
  const selectedRouteLeg = selectedRouteLegId
    ? routeLegOptions.find((option) => option.id === selectedRouteLegId) ?? null
    : null;
  const selectedRouteStop = routeSummary.stops.find((stop) => stop.destinationId === selectedDestination.id);
  const nextRouteStop = selectedRouteStop
    ? routeSummary.stops.find((stop) => stop.day === selectedRouteStop.day + 1)
    : routeSummary.stops[1];
  const activeCategoryLabel = MAP_CATEGORIES.find((category) => category.id === activeCategory)?.label ?? "All";
  const nearbyExperiences = useMemo(
    () => getNearbyExperiences(selectedDestination).slice(0, 4),
    [selectedDestination]
  );
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

  useEffect(() => {
    if (!selectedRouteLegId) return;
    if (routeLegOptions.some((option) => option.id === selectedRouteLegId)) return;
    setSelectedRouteLegId(null);
  }, [routeLegOptions, selectedRouteLegId]);

  const handleSelectDestination = (destinationId: string) => {
    app.setPlannerBaseId(destinationId);
    const matchingLeg = routeLegOptions.find((option) => option.leg.toDestinationId === destinationId);
    setSelectedRouteLegId(matchingLeg?.id ?? null);
    setSheetExpanded(true);
  };

  const handleSelectRouteLeg = (routeLegId: string | null) => {
    setSelectedRouteLegId(routeLegId);
    if (!routeLegId) {
      setSheetExpanded(true);
      return;
    }
    const routeLeg = routeLegOptions.find((option) => option.id === routeLegId);
    if (routeLeg) {
      app.setPlannerBaseId(routeLeg.leg.toDestinationId);
    }
    setSheetExpanded(true);
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
        className="absolute inset-0 rounded-none border-0"
        height="100%"
        scrollZoom
        getMarkerCategory={getDestinationPinCategory}
        routeDestinations={routeDestinations}
        routeLegs={routeSummary.legs}
        selectedRouteLegId={selectedRouteLegId}
        onSelectRouteLeg={(routeLegId) => handleSelectRouteLeg(routeLegId)}
        onRouteStatusChange={setRouteStatus}
        autoFitKey={`${activeCategory}-${app.search}-${selectedDestination.id}-${sheetExpanded}-${routeSummary.stops.length}`}
        bottomInset={sheetExpanded ? "expanded" : "compact"}
        theme={app.theme}
      />

      <div className="map-screen-scrim pointer-events-none absolute inset-0 z-10" />
      <div className="map-screen-left-fade pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3" />
      <div className="map-screen-right-fade pointer-events-none absolute inset-y-0 right-0 z-10 w-1/4" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 p-3 sm:p-5">
        <div className="pointer-events-auto mx-auto grid max-w-7xl gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/78 shadow-2xl shadow-slate-950/50 backdrop-blur-2xl">
            <div className="flex flex-col gap-3 border-b border-white/10 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/12 text-cyan-200 shadow-lg shadow-cyan-950/40">
                  <Compass className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[0.62rem] uppercase tracking-[0.28em] text-cyan-200/80">IrieVerse Map</p>
                  <h1 className="truncate text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">
                    Jamaica route command
                  </h1>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs sm:w-[22rem]">
                <HudMetric icon={Radar} label="Pins" value={visibleDestinations.length.toString()} />
                <HudMetric icon={Gauge} label="Route" value={routeSummary.routeTone.replace(" route", "")} />
                <HudMetric icon={Clock3} label="Drive" value={formatDriveTime(routeSummary.totalDriveMinutes)} />
              </div>
            </div>

            <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 shadow-inner shadow-slate-950/40">
                <Search className="h-4 w-4 shrink-0 text-cyan-200" />
                <input
                  type="search"
                  value={app.search}
                  onChange={(event) => app.setSearch(event.target.value)}
                  placeholder="Search beaches, food, music, culture..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
                {!!app.search && (
                  <button
                    type="button"
                    onClick={() => app.setSearch("")}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-slate-400 hover:border-cyan-300/60 hover:text-cyan-100"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 lg:max-w-[34rem]">
                {MAP_CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setActiveCategory(category.id)}
                    className={classNames(
                      "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] transition duration-200",
                      activeCategory === category.id
                        ? `${category.border} bg-white text-slate-950 shadow-lg shadow-slate-950/40`
                        : "border-white/10 bg-slate-950/72 text-slate-300 hover:border-cyan-300/50 hover:bg-slate-900/90"
                    )}
                  >
                    <span className={classNames("h-2.5 w-2.5 rounded-full", category.color)} />
                    {category.label}
                  </button>
                ))}
              </div>
            </div>

            <RouteDayChips
              routeLegOptions={routeLegOptions}
              selectedRouteLegId={selectedRouteLegId}
              routeStatus={routeStatus}
              onSelectOverview={() => handleSelectRouteLeg(null)}
              onSelectRouteLeg={(routeLegId) => handleSelectRouteLeg(routeLegId)}
            />
          </div>

          <RouteHud
            stops={routeSummary.stops}
            legs={routeSummary.legs}
            selectedDestinationId={selectedDestination.id}
            onSelectDestination={handleSelectDestination}
            onOpenTrips={() => onNavigate("trips")}
          />
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-[9rem] left-3 z-20 hidden max-w-xs lg:block">
        <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/74 p-3 text-xs text-slate-300 shadow-2xl shadow-slate-950/50 backdrop-blur-2xl">
          <div className="flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-cyan-200" />
            <span className="font-semibold text-slate-100">{activeCategoryLabel}</span>
            <span className="text-slate-500">layer</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MiniSignal label="Selected" value={selectedDestination.name} />
            <MiniSignal label="Next" value={nextRouteStop?.name ?? "Open route"} />
          </div>
        </div>
      </div>

      {!visibleDestinations.length && (
        <div className="absolute left-1/2 top-1/2 z-40 w-[min(90vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-white/10 bg-slate-950/92 p-6 text-center shadow-2xl shadow-slate-950/70 backdrop-blur-2xl">
          <MapPin className="mx-auto h-8 w-8 text-cyan-300" />
          <h2 className="mt-3 text-lg font-semibold">No map pins match</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Clear search or switch layers to bring Jamaica pins back onto the map.
          </p>
        </div>
      )}

      <aside
        className={classNames(
          "absolute inset-x-3 bottom-3 z-40 mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/92 shadow-2xl shadow-slate-950/80 backdrop-blur-2xl transition-[max-height,transform] duration-300 sm:inset-x-5",
          sheetExpanded ? "max-h-[80vh]" : "max-h-[7.25rem]"
        )}
      >
        <button
          type="button"
          onClick={() => setSheetExpanded((prev) => !prev)}
          className="flex w-full items-center justify-center py-3 text-slate-500"
          aria-label={sheetExpanded ? "Collapse selected place" : "Expand selected place"}
        >
          <span className="h-1.5 w-14 rounded-full bg-white/20" />
        </button>

        <div className="px-3 pb-3 sm:px-4 sm:pb-4">
          <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)_19rem]">
            <div className="relative min-h-32 overflow-hidden rounded-[1.5rem] border border-white/10 lg:min-h-56">
              <img
                src={selectedDestination.heroImage}
                alt={selectedDestination.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
              <div className="media-overlay absolute bottom-3 left-3 right-3">
                <p className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-slate-950/70 px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.18em] text-cyan-100 backdrop-blur">
                  <Plane className="h-3 w-3" /> {selectedDestination.airportCode}
                </p>
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-xs uppercase tracking-[0.22em] text-cyan-300">
                    <MapPin className="h-3 w-3" /> {selectedDestination.region}
                  </p>
                  <h2 className="mt-1 truncate text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
                    {selectedDestination.name}
                  </h2>
                  <p className="mt-2 flex items-center gap-2 text-sm text-amber-200">
                    <Star className="h-4 w-4 fill-current" />
                    {selectedDestination.rating.toFixed(1)}
                    <span className="text-slate-600">/</span>
                    {"$".repeat(selectedDestination.priceLevel)}
                    <span className="text-slate-600">/</span>
                    <span className="capitalize text-slate-300">{selectedCategory}</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSheetExpanded((prev) => !prev)}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-300 hover:border-cyan-300/60 hover:text-cyan-100"
                  aria-label={sheetExpanded ? "Collapse sheet" : "Expand sheet"}
                >
                  {sheetExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
              </div>

              {sheetExpanded && (
                <div className="mt-4 max-h-[calc(80vh-13rem)] overflow-y-auto pr-1">
                  <p className="max-w-2xl text-sm leading-6 text-slate-300">{selectedDestination.description}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedDestination.vibes.slice(0, 5).map((vibe) => (
                      <span
                        key={vibe}
                        className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.14em] text-cyan-100"
                      >
                        {vibe}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <MapFact icon={Navigation} label="Stop" value={selectedRouteStop ? `Day ${selectedRouteStop.day}` : "Flex"} />
                    <MapFact icon={Clock3} label="Transfer" value={selectedRouteStop?.driveMinutesFromPrevious ? formatDriveTime(selectedRouteStop.driveMinutesFromPrevious) : "Arrival"} />
                    <MapFact icon={Sparkles} label="Nearby" value={`${nearbyExperiences.length} ideas`} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <MapAction
                      icon={Heart}
                      label={isSaved ? "Saved" : "Save"}
                      onClick={() => app.toggleSavedPlace(selectedDestination.id)}
                      active={isSaved}
                    />
                    <MapAction icon={Plus} label="Add trip" onClick={handleAddToTrip} primary />
                    <MapAction icon={Navigation} label="Drive" onClick={handleOpenDrivingGuide} />
                    <MapAction
                      icon={Route}
                      label="Route"
                      onClick={() => {
                        setShowRoutePreview((prev) => !prev);
                        setSheetExpanded(true);
                      }}
                      active={showRoutePreview}
                    />
                  </div>

                  {showRoutePreview && (
                    <div className="mt-4 rounded-[1.5rem] border border-cyan-300/20 bg-cyan-300/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[0.65rem] uppercase tracking-[0.24em] text-cyan-200">Route pulse</p>
                          <h3 className="mt-1 font-semibold text-slate-100">
                            {selectedRouteLeg
                              ? `Day ${selectedRouteLeg.day}: ${selectedRouteLeg.leg.fromName} to ${selectedRouteLeg.leg.toName}`
                              : routeSummary.routeTone}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => onNavigate("trips")}
                          className="inline-flex items-center gap-1 rounded-full bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950"
                        >
                          Trips <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <RoutePulseFact
                          label="Distance"
                          value={selectedRouteLeg ? formatMiles(selectedRouteLeg.leg.distanceKm) : `${routeSummary.totalDistanceKm} km`}
                        />
                        <RoutePulseFact
                          label="Drive"
                          value={selectedRouteLeg ? formatDriveTime(selectedRouteLeg.leg.driveMinutes) : formatDriveTime(routeSummary.totalDriveMinutes)}
                        />
                        <RoutePulseFact
                          label="Source"
                          value={getRouteStatusLabel(routeStatus)}
                        />
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {routeSummary.stops.slice(0, 4).map((stop) => (
                          <button
                            key={stop.destinationId}
                            type="button"
                            onClick={() => handleSelectDestination(stop.destinationId)}
                            className={classNames(
                              "flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition",
                              stop.destinationId === selectedDestination.id
                                ? "border-cyan-300 bg-cyan-300 text-slate-950"
                                : "border-white/10 bg-slate-950/60 text-slate-300 hover:border-cyan-300/50"
                            )}
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-cyan-200">
                              {stop.day}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{stop.name}</span>
                              <span className={classNames("block truncate text-xs", stop.destinationId === selectedDestination.id ? "text-slate-700" : "text-slate-500")}>
                                {stop.driveMinutesFromPrevious ? `${formatDriveTime(stop.driveMinutesFromPrevious)} · ${formatMiles(stop.distanceFromPreviousKm)}` : "Arrival"} · {stop.region}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>

                      {!!routeSummary.warnings.length && (
                        <div className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                          {routeSummary.warnings[0].title}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {sheetExpanded && (
              <div className="min-h-0 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-500">Nearby</p>
                  <button
                    type="button"
                    onClick={() => onNavigate("explore")}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300"
                  >
                    Explore <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid max-h-[calc(80vh-14rem)] gap-2 overflow-y-auto">
                  {nearbyExperiences.map((experience) => (
                    <button
                      key={experience.id}
                      type="button"
                      onClick={() => handleNearbyExperience(experience)}
                      className="group overflow-hidden rounded-2xl border border-white/10 bg-slate-950/72 text-left transition hover:border-cyan-300/50"
                    >
                      <div className="flex gap-3 p-2">
                        <img
                          src={experience.imageUrl}
                          alt={experience.title}
                          className="h-16 w-16 shrink-0 rounded-xl object-cover"
                        />
                        <span className="min-w-0 flex-1 py-1">
                          <span className="block truncate text-sm font-semibold text-slate-100 group-hover:text-cyan-100">
                            {experience.title}
                          </span>
                          <span className="mt-1 block text-xs capitalize text-slate-500">
                            {experience.type} · {experience.bestTime}
                          </span>
                          <span className="mt-1 inline-flex items-center gap-1 text-[0.68rem] text-emerald-300">
                            <CalendarDays className="h-3 w-3" /> {experience.approxCost}
                          </span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </section>
  );
}

function HudMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.05] px-2 py-2">
      <Icon className="mx-auto h-3.5 w-3.5 text-cyan-200" />
      <p className="mt-1 truncate text-[0.6rem] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="truncate text-xs font-bold text-slate-100">{value}</p>
    </div>
  );
}

type RouteLegOption = {
  id: string;
  day: number;
  index: number;
  leg: RouteLeg;
};

function RouteDayChips({
  routeLegOptions,
  selectedRouteLegId,
  routeStatus,
  onSelectOverview,
  onSelectRouteLeg,
}: {
  routeLegOptions: RouteLegOption[];
  selectedRouteLegId: string | null;
  routeStatus: RouteRenderStatus;
  onSelectOverview: () => void;
  onSelectRouteLeg: (routeLegId: string) => void;
}) {
  if (!routeLegOptions.length) return null;

  return (
    <div className="border-t border-white/10 px-3 pb-3">
      <div className="flex items-center gap-2 overflow-x-auto pt-3">
        <button
          type="button"
          onClick={onSelectOverview}
          className={classNames(
            "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition",
            selectedRouteLegId
              ? "border-white/10 bg-white/[0.05] text-slate-300 hover:border-cyan-300/50 hover:text-cyan-100"
              : "border-white bg-white text-slate-950 shadow-lg shadow-slate-950/30"
          )}
        >
          <Route className="h-3.5 w-3.5" />
          Overview
        </button>

        {routeLegOptions.map((option) => {
          const color = getRouteColor(option.index);
          const isSelected = option.id === selectedRouteLegId;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelectRouteLeg(option.id)}
              className={classNames(
                "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition",
                isSelected
                  ? "bg-white text-slate-950 shadow-lg shadow-slate-950/30"
                  : "bg-slate-950/68 text-slate-200 hover:bg-slate-900"
              )}
              style={{
                borderColor: isSelected ? "#ffffff" : `${color}66`,
                boxShadow: isSelected ? `0 10px 28px ${color}30` : undefined,
              }}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[0.62rem] font-black text-white"
                style={{ backgroundColor: color }}
              >
                {option.day}
              </span>
              <span className="max-w-24 truncate sm:max-w-32">{option.leg.toName}</span>
              <span className={classNames("text-[0.68rem]", isSelected ? "text-slate-600" : "text-slate-500")}>
                {formatMiles(option.leg.distanceKm)}
              </span>
            </button>
          );
        })}

        <RouteStatusPill routeStatus={routeStatus} />
      </div>
    </div>
  );
}

function RouteStatusPill({ routeStatus }: { routeStatus: RouteRenderStatus }) {
  const label = getRouteStatusLabel(routeStatus);

  return (
    <span
      className={classNames(
        "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold",
        routeStatus.isLoading
          ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
          : routeStatus.roadLegs
            ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
            : "border-amber-300/40 bg-amber-300/10 text-amber-100"
      )}
    >
      <span
        className={classNames(
          "h-2 w-2 rounded-full",
          routeStatus.isLoading ? "animate-pulse bg-cyan-300" : routeStatus.roadLegs ? "bg-emerald-300" : "bg-amber-300"
        )}
      />
      {label}
    </span>
  );
}

function RoutePulseFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/54 px-3 py-2">
      <p className="text-[0.58rem] uppercase tracking-[0.15em] text-cyan-200/70">{label}</p>
      <p className="mt-1 truncate text-xs font-bold text-slate-100">{value}</p>
    </div>
  );
}

function RouteHud({
  stops,
  legs,
  selectedDestinationId,
  onSelectDestination,
  onOpenTrips,
}: {
  stops: Array<{
    destinationId: string;
    name: string;
    region: string;
    day: number;
    distanceFromPreviousKm: number;
    driveMinutesFromPrevious: number;
  }>;
  legs: Array<{
    toDestinationId: string;
    distanceKm: number;
  }>;
  selectedDestinationId: string;
  onSelectDestination: (destinationId: string) => void;
  onOpenTrips: () => void;
}) {
  return (
    <div className="hidden overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/78 shadow-2xl shadow-slate-950/50 backdrop-blur-2xl lg:block">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-[0.62rem] uppercase tracking-[0.28em] text-cyan-200/80">Island Route</p>
          <h2 className="text-lg font-semibold text-slate-100">{stops.length} stop flow</h2>
        </div>
        <button
          type="button"
          onClick={onOpenTrips}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/40"
          aria-label="Open Trips"
        >
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto p-3">
        {stops.map((stop, index) => (
          <button
            key={stop.destinationId}
            type="button"
            onClick={() => onSelectDestination(stop.destinationId)}
            className={classNames(
              "relative flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition",
              stop.destinationId === selectedDestinationId
                ? "border-cyan-300 bg-cyan-300 text-slate-950"
                : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/50 hover:bg-white/[0.08]"
            )}
          >
            {index < stops.length - 1 && (
              <span
                className="absolute left-[1.55rem] top-[2.8rem] h-5 w-1 rounded-full"
                style={{ backgroundColor: getRouteColor(index) }}
              />
            )}
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-[color:var(--app-text)] text-xs font-black text-[color:var(--app-bg)]"
              style={{ borderColor: getRouteColor(Math.max(0, index - 1)) }}
            >
              {stop.day}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{stop.name}</span>
              <span className={classNames("block truncate text-xs", stop.destinationId === selectedDestinationId ? "text-slate-700" : "text-slate-500")}>
                {stop.driveMinutesFromPrevious ? `${formatDriveTime(stop.driveMinutesFromPrevious)} · ${formatMiles(getLegDistance(legs, stop.destinationId, stop.distanceFromPreviousKm))}` : "Start"} · {stop.region}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MiniSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2">
      <p className="text-[0.6rem] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="truncate text-xs font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function MapFact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-left">
      <Icon className="h-4 w-4 text-cyan-200" />
      <p className="mt-2 text-[0.6rem] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="truncate text-sm font-semibold capitalize text-slate-100">{value}</p>
    </div>
  );
}

function MapAction({
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
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-bold transition",
        primary
          ? "border-cyan-300 bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/40"
          : active
            ? "border-rose-300/50 bg-rose-300/10 text-rose-100"
            : "border-white/10 bg-white/[0.05] text-slate-100 hover:border-cyan-300/50 hover:text-cyan-100"
      )}
    >
      <Icon className={classNames("h-4 w-4", active && label === "Saved" ? "fill-current" : "")} />
      {label}
    </button>
  );
}

function getLinkedExperiences(destinationId: string) {
  return EXPERIENCES.filter((experience) => experience.linkedDestinationId === destinationId);
}

function destinationMatchesCategory(destination: Destination, category: MapCategoryId) {
  if (category === "all") return true;
  const linkedExperiences = getLinkedExperiences(destination.id);
  const destinationText = [
    destination.name,
    destination.region,
    destination.headline,
    destination.description,
    destination.highlights.join(" "),
    destination.vibes.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  if (category === "beaches") {
    return /beach|coast|lagoon|cove|sandbar|sea|sunset/.test(destinationText);
  }
  if (category === "food") {
    return linkedExperiences.some((experience) => experience.type === "food" || experience.vibes.includes("food"));
  }
  if (category === "music") {
    return (
      linkedExperiences.some((experience) => experience.type === "music") ||
      destinationText.includes("music") ||
      destinationText.includes("sound system")
    );
  }
  if (category === "culture") {
    return (
      destination.vibes.includes("culture") ||
      destination.vibes.includes("authentic") ||
      linkedExperiences.some((experience) => experience.type === "festival" || experience.vibes.includes("culture"))
    );
  }
  if (category === "nightlife") {
    return destination.vibes.includes("nightlife") || destinationText.includes("nightlife");
  }

  return true;
}

function getDestinationPinCategory(destination: Destination): MapPinCategory {
  const linkedExperiences = getLinkedExperiences(destination.id);
  const destinationText = [
    destination.name,
    destination.region,
    destination.headline,
    destination.description,
    destination.vibes.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  if (destination.vibes.includes("nightlife")) return "nightlife";
  if (linkedExperiences.some((experience) => experience.type === "music")) return "music";
  if (linkedExperiences.some((experience) => experience.type === "food")) return "food";
  if (
    destination.vibes.includes("culture") ||
    destination.vibes.includes("authentic") ||
    linkedExperiences.some((experience) => experience.type === "festival")
  ) {
    return "culture";
  }
  if (/beach|coast|lagoon|cove|sandbar|sea|sunset/.test(destinationText)) return "beaches";
  if (destination.vibes.includes("adventure") || destination.vibes.includes("nature")) return "adventure";
  return "default";
}

function getNearbyExperiences(destination: Destination) {
  const selectedName = destination.name.toLowerCase();
  const selectedRegion = destination.region.toLowerCase();

  return EXPERIENCES.filter((experience) => {
    const experienceRegion = experience.region.toLowerCase();
    return (
      experience.linkedDestinationId === destination.id ||
      experienceRegion === selectedRegion ||
      selectedName.includes(experienceRegion) ||
      experienceRegion.includes(selectedName.split(" ")[0])
    );
  });
}

function formatDriveTime(minutes: number): string {
  if (!minutes) return "0 min";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  if (!remainder) return `${hours} hr`;
  return `${hours} hr ${remainder} min`;
}

function formatMiles(distanceKm: number): string {
  if (!distanceKm) return "0 mi";
  return `${Math.max(1, Math.round(distanceKm * 0.621371))} mi`;
}

function getRouteLegId(leg: RouteLeg, index: number): string {
  return `${leg.fromDestinationId}-${leg.toDestinationId}-${index}`;
}

function getRouteStatusLabel(routeStatus: RouteRenderStatus): string {
  if (!routeStatus.totalLegs) return "No route";
  if (routeStatus.isLoading) return "Syncing roads";
  if (routeStatus.roadLegs === routeStatus.totalLegs) return "Road routes";
  if (routeStatus.roadLegs > 0) return "Mixed routes";
  return "Estimated";
}

function getRouteColor(index: number): string {
  return ROUTE_COLORS[index % ROUTE_COLORS.length];
}

function getLegDistance(
  legs: Array<{ toDestinationId: string; distanceKm: number }>,
  destinationId: string,
  fallbackKm: number
): number {
  return legs.find((leg) => leg.toDestinationId === destinationId)?.distanceKm ?? fallbackKm;
}

function mergeDestinations(primary: Destination[], secondary: Destination[]): Destination[] {
  const byId = new globalThis.Map<string, Destination>();
  [...primary, ...secondary].forEach((destination) => byId.set(destination.id, destination));
  return Array.from(byId.values());
}

function buildDrivingGuideUrl(routeDestinations: Destination[]): string {
  const [origin, ...rest] = routeDestinations;
  const destination = rest[rest.length - 1];
  const waypoints = rest.slice(0, -1);
  const params = new URLSearchParams({
    api: "1",
    travelmode: "driving",
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
  });

  if (waypoints.length) {
    params.set(
      "waypoints",
      waypoints
        .map((waypoint) => `${waypoint.latitude},${waypoint.longitude}`)
        .join("|")
    );
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
