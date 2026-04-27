import { CalendarDays, Heart, MapPin, Plus, Route, Search } from "lucide-react";
import { TravelMap } from "../components/TravelMap";
import type { MobileTabId } from "../components/mobile/BottomNav";
import { DESTINATIONS, VIBE_OPTIONS } from "../data/content";
import type { TravelOS } from "../hooks/useTravelOS";
import type { Vibe } from "../types/travel";
import { classNames } from "../utils/classNames";

type MapScreenProps = {
  app: TravelOS;
  onNavigate: (tab: MobileTabId) => void;
};

export function MapScreen({ app, onNavigate }: MapScreenProps) {
  const selectedDestination =
    DESTINATIONS.find((destination) => destination.id === app.plannerBaseId) ?? DESTINATIONS[0];
  const isSaved = app.savedPlaces.has(selectedDestination.id);
  const nearbyExperiences = app.filteredExperiences
    .filter(
      (experience) =>
        experience.linkedDestinationId === selectedDestination.id ||
        experience.region === selectedDestination.region ||
        selectedDestination.name.includes(experience.region)
    )
    .slice(0, 3);

  const handleAddToTrip = () => {
    app.savePlace(selectedDestination.id);
    onNavigate("trips");
  };

  return (
    <section className="min-h-screen bg-slate-950">
      <div className="sticky top-0 z-30 border-b border-slate-800/90 bg-slate-950/95 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/80">
            Map
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Interactive Jamaica map</h1>

          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              type="search"
              value={app.search}
              onChange={(event) => app.setSearch(event.target.value)}
              placeholder="Find beaches, food, music, culture..."
              className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {VIBE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => app.setVibe(option.id as Vibe)}
                className={classNames(
                  "whitespace-nowrap rounded-full border px-3 py-2 text-[0.68rem] uppercase tracking-[0.16em] transition",
                  app.vibe === option.id
                    ? "border-cyan-300 bg-cyan-300 text-slate-950"
                    : "border-slate-700/80 bg-slate-900/80 text-slate-300"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-0 sm:px-6 lg:px-10">
        <div className="relative">
          <TravelMap
            destinations={app.filteredDestinations}
            selectedDestinationId={app.plannerBaseId}
            onSelectDestination={app.setPlannerBaseId}
            viewState={app.mapViewState}
            onMove={app.handleMapMove}
            className="h-[calc(100vh-20rem)] min-h-[430px] rounded-none border-x-0 border-t-0 sm:mt-4 sm:rounded-3xl sm:border"
            height="100%"
            scrollZoom
          />

          <aside className="relative z-20 mx-4 -mt-16 rounded-3xl border border-slate-800 bg-slate-950/95 p-4 shadow-2xl shadow-slate-950/70 backdrop-blur-xl sm:mx-auto sm:max-w-2xl sm:p-5">
            <div className="flex gap-4">
              <img
                src={selectedDestination.heroImage}
                alt={selectedDestination.name}
                className="h-24 w-24 rounded-2xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-xs uppercase tracking-[0.22em] text-cyan-300">
                  <MapPin className="h-3 w-3" /> {selectedDestination.region}
                </p>
                <h2 className="mt-1 text-xl font-semibold">{selectedDestination.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-400">
                  {selectedDestination.description}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <MapFact label="Rating" value={selectedDestination.rating.toFixed(1)} />
              <MapFact label="Airport" value={selectedDestination.airportCode} />
              <MapFact label="Price" value={"$".repeat(selectedDestination.priceLevel)} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => app.toggleSavedPlace(selectedDestination.id)}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-700/80 px-4 py-3 text-sm text-slate-100"
              >
                <Heart className={classNames("h-4 w-4", isSaved ? "fill-rose-400 text-rose-400" : "")} />
                {isSaved ? "Saved" : "Save"}
              </button>
              <button
                type="button"
                onClick={handleAddToTrip}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950"
              >
                <Plus className="h-4 w-4" /> Add to trip
              </button>
              <button
                type="button"
                onClick={() => onNavigate("trips")}
                className="flex items-center justify-center rounded-full border border-slate-700/80 px-4 py-3 text-slate-100"
                aria-label="Plan route"
              >
                <Route className="h-4 w-4" />
              </button>
            </div>

            {!!nearbyExperiences.length && (
              <div className="mt-4 border-t border-slate-800 pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-500">
                    Nearby experiences
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate("explore")}
                    className="text-xs text-cyan-300"
                  >
                    Explore
                  </button>
                </div>
                <div className="space-y-2">
                  {nearbyExperiences.map((experience) => (
                    <button
                      key={experience.id}
                      type="button"
                      onClick={() => {
                        app.saveExperience(experience.id);
                        onNavigate("trips");
                      }}
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-left"
                    >
                      <span>
                        <span className="block text-sm font-medium text-slate-100">{experience.title}</span>
                        <span className="text-xs text-slate-500">
                          {experience.type} · {experience.bestTime}
                        </span>
                      </span>
                      <CalendarDays className="h-4 w-4 text-emerald-300" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}

function MapFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-900/80 p-3">
      <p className="text-slate-500">{label}</p>
      <p className="font-semibold text-slate-100">{value}</p>
    </div>
  );
}
