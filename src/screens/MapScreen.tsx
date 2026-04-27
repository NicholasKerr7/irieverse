import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Heart,
  MapPin,
  Plus,
  Route,
  Search,
  Star,
  X,
} from "lucide-react";
import { TravelMap, type MapPinCategory } from "../components/TravelMap";
import type { MobileTabId } from "../components/mobile/BottomNav";
import { DESTINATIONS, EXPERIENCES } from "../data/content";
import type { TravelOS } from "../hooks/useTravelOS";
import type { Destination, Experience } from "../types/travel";
import { classNames } from "../utils/classNames";

type MapScreenProps = {
  app: TravelOS;
  onNavigate: (tab: MobileTabId) => void;
};

type MapCategoryId = "all" | "beaches" | "food" | "music" | "culture" | "nightlife";

const MAP_CATEGORIES: Array<{ id: MapCategoryId; label: string; color: string }> = [
  { id: "all", label: "All", color: "bg-slate-300" },
  { id: "beaches", label: "Beaches", color: "bg-cyan-300" },
  { id: "food", label: "Food", color: "bg-amber-400" },
  { id: "music", label: "Music", color: "bg-violet-300" },
  { id: "culture", label: "Culture", color: "bg-emerald-300" },
  { id: "nightlife", label: "Nightlife", color: "bg-rose-300" },
];

export function MapScreen({ app, onNavigate }: MapScreenProps) {
  const [activeCategory, setActiveCategory] = useState<MapCategoryId>("all");
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const [showRoutePreview, setShowRoutePreview] = useState(false);

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
  const isSaved = app.savedPlaces.has(selectedDestination.id);
  const nearbyExperiences = useMemo(
    () => getNearbyExperiences(selectedDestination).slice(0, 4),
    [selectedDestination]
  );

  const handleSelectDestination = (destinationId: string) => {
    app.setPlannerBaseId(destinationId);
    setSheetExpanded(true);
    setShowRoutePreview(false);
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

  return (
    <section className="relative h-[calc(100vh-7rem)] min-h-[640px] overflow-hidden bg-slate-950">
      <TravelMap
        destinations={visibleDestinations}
        selectedDestinationId={selectedDestination.id}
        onSelectDestination={handleSelectDestination}
        viewState={app.mapViewState}
        onMove={app.handleMapMove}
        className="absolute inset-0 rounded-none border-0"
        height="100%"
        scrollZoom
        getMarkerCategory={getDestinationPinCategory}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-4 sm:p-5">
        <div className="pointer-events-auto mx-auto max-w-5xl space-y-3">
          <div className="rounded-3xl border border-white/15 bg-slate-950/82 p-3 shadow-2xl shadow-slate-950/50 backdrop-blur-xl">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                type="search"
                value={app.search}
                onChange={(event) => app.setSearch(event.target.value)}
                placeholder="Search places, food, music, beaches..."
                className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
              {!!app.search && (
                <button
                  type="button"
                  onClick={() => app.setSearch("")}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-700 text-slate-400 hover:text-slate-100"
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
                  onClick={() => setActiveCategory(category.id)}
                  className={classNames(
                    "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] transition",
                    activeCategory === category.id
                      ? "border-cyan-300 bg-cyan-300 text-slate-950"
                      : "border-white/10 bg-slate-950/80 text-slate-300 hover:border-cyan-300/50"
                  )}
                >
                  <span className={classNames("h-2.5 w-2.5 rounded-full", category.color)} />
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between gap-3 text-xs text-slate-300">
            <span className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-2 backdrop-blur">
              {visibleDestinations.length} visible pins
            </span>
            <button
              type="button"
              onClick={() => {
                setShowRoutePreview(true);
                setSheetExpanded(true);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-slate-950/75 px-3 py-2 font-semibold text-cyan-100 backdrop-blur"
            >
              <Route className="h-3.5 w-3.5" /> Route preview
            </button>
          </div>
        </div>
      </div>

      {!visibleDestinations.length && (
        <div className="absolute left-1/2 top-1/2 z-20 w-[min(90vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-slate-800 bg-slate-950/90 p-5 text-center shadow-2xl shadow-slate-950/60 backdrop-blur-xl">
          <MapPin className="mx-auto h-7 w-7 text-cyan-300" />
          <h2 className="mt-3 text-lg font-semibold">No map pins match</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Clear search or switch categories to bring Jamaica pins back onto the map.
          </p>
        </div>
      )}

      <aside
        className={classNames(
          "absolute inset-x-0 bottom-0 z-30 mx-auto max-w-3xl overflow-hidden rounded-t-3xl border border-slate-800 bg-slate-950/96 shadow-2xl shadow-slate-950/80 backdrop-blur-xl transition-[max-height] duration-300",
          sheetExpanded ? "max-h-[78vh]" : "max-h-24"
        )}
      >
        <button
          type="button"
          onClick={() => setSheetExpanded((prev) => !prev)}
          className="flex w-full items-center justify-center py-3 text-slate-500"
          aria-label={sheetExpanded ? "Collapse selected place" : "Expand selected place"}
        >
          <span className="h-1.5 w-12 rounded-full bg-slate-700" />
        </button>

        <div className="px-4 pb-4 sm:px-5">
          <div className="flex items-center gap-4">
            <img
              src={selectedDestination.heroImage}
              alt={selectedDestination.name}
              className="h-20 w-20 rounded-2xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-xs uppercase tracking-[0.22em] text-cyan-300">
                <MapPin className="h-3 w-3" /> {selectedDestination.region}
              </p>
              <h2 className="mt-1 truncate text-xl font-semibold">{selectedDestination.name}</h2>
              <p className="mt-1 flex items-center gap-1 text-sm text-amber-200">
                <Star className="h-4 w-4 fill-current" />
                {selectedDestination.rating.toFixed(1)} · {"$".repeat(selectedDestination.priceLevel)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSheetExpanded((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 text-slate-300"
              aria-label={sheetExpanded ? "Collapse sheet" : "Expand sheet"}
            >
              {sheetExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </div>

          {sheetExpanded && (
            <div className="mt-4 max-h-[calc(78vh-8rem)] overflow-y-auto pb-3">
              <p className="text-sm leading-6 text-slate-400">{selectedDestination.description}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {selectedDestination.vibes.slice(0, 4).map((vibe) => (
                  <span
                    key={vibe}
                    className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.14em] text-cyan-100"
                  >
                    {vibe}
                  </span>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <MapFact label="Airport" value={selectedDestination.airportCode} />
                <MapFact label="Pins" value={getDestinationPinCategory(selectedDestination)} />
                <MapFact label="Nearby" value={`${nearbyExperiences.length} ideas`} />
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => app.toggleSavedPlace(selectedDestination.id)}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-700/80 px-4 py-3 text-sm text-slate-100"
                >
                  <Heart className={classNames("h-4 w-4", isSaved ? "fill-rose-400 text-rose-400" : "")} />
                  {isSaved ? "Saved" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={handleAddToTrip}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950"
                >
                  <Plus className="h-4 w-4" /> Add to trip
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRoutePreview(true);
                    setSheetExpanded(true);
                  }}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-700/80 px-4 py-3 text-sm font-semibold text-slate-100"
                >
                  <Route className="h-4 w-4" /> Plan route
                </button>
              </div>

              {showRoutePreview && (
                <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[0.65rem] uppercase tracking-[0.24em] text-cyan-200">Route preview</p>
                      <h3 className="mt-1 font-semibold text-slate-100">
                        Start from {selectedDestination.name}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate("trips")}
                      className="rounded-full bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950"
                    >
                      Open Trips
                    </button>
                  </div>
                  <ol className="mt-3 space-y-2 text-sm text-slate-300">
                    {[selectedDestination.name, ...app.itinerary.daysPlan.map((day) => day.destName)]
                      .filter((value, index, items) => items.indexOf(value) === index)
                      .slice(0, 4)
                      .map((name, index) => (
                        <li key={`${name}-${index}`} className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 text-xs text-cyan-200">
                            {index + 1}
                          </span>
                          {name}
                        </li>
                      ))}
                  </ol>
                </div>
              )}

              {!!nearbyExperiences.length && (
                <div className="mt-4 border-t border-slate-800 pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-500">
                      Nearby experiences
                    </p>
                    <button
                      type="button"
                      onClick={() => onNavigate("explore")}
                      className="text-xs font-semibold text-cyan-300"
                    >
                      Explore
                    </button>
                  </div>
                  <div className="space-y-2">
                    {nearbyExperiences.map((experience) => (
                      <button
                        key={experience.id}
                        type="button"
                        onClick={() => handleNearbyExperience(experience)}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-3 text-left"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-100">{experience.title}</span>
                          <span className="text-xs text-slate-500">
                            {experience.type} · {experience.bestTime} · {experience.approxCost}
                          </span>
                        </span>
                        <CalendarDays className="h-4 w-4 shrink-0 text-emerald-300" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </section>
  );
}

function MapFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-900/80 p-3">
      <p className="text-slate-500">{label}</p>
      <p className="font-semibold capitalize text-slate-100">{value}</p>
    </div>
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
