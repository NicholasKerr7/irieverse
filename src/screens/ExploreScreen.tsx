import {
  Compass,
  MapPin,
  Music2,
  PartyPopper,
  Search,
  SlidersHorizontal,
  Utensils,
  X,
} from "lucide-react";
import { ExperiencesGrid } from "../components/ExperiencesGrid";
import { PlacesGrid } from "../components/PlacesGrid";
import type { MobileTabId } from "../components/mobile/BottomNav";
import { DESTINATIONS, EXPERIENCE_TYPES, EXPERIENCES, VIBE_OPTIONS } from "../data/content";
import type { TravelOS } from "../hooks/useTravelOS";
import type { ExperienceType, Vibe } from "../types/travel";
import { classNames } from "../utils/classNames";
import { glassControl, glassPanel } from "../utils/glass";

type ExploreScreenProps = {
  app: TravelOS;
  onNavigate: (tab: MobileTabId) => void;
};

export function ExploreScreen({ app, onNavigate }: ExploreScreenProps) {
  const handlePlanFromPlace = (destinationId: string) => {
    app.setPlannerBaseId(destinationId);
    app.savePlace(destinationId);
    onNavigate("trips");
  };

  const handleViewMap = (destinationId: string) => {
    app.setPlannerBaseId(destinationId);
    onNavigate("map");
  };

  const handleAddExperienceToTrip = (experienceId: string) => {
    app.saveExperience(experienceId);
    const linkedDestination = EXPERIENCES.find((experience) => experience.id === experienceId)?.linkedDestinationId;
    if (linkedDestination) {
      app.setPlannerBaseId(linkedDestination);
    }
    onNavigate("trips");
  };

  const visibleCount =
    app.viewMode === "places" ? app.filteredDestinations.length : app.filteredExperiences.length;
  const totalCount = app.viewMode === "places" ? DESTINATIONS.length : EXPERIENCES.length;

  return (
    <section className="mx-auto min-h-screen max-w-7xl px-4 py-5 sm:px-6 lg:px-10">
      <header className={classNames("overflow-hidden rounded-[1.75rem]", glassPanel)}>
        <div className="grid min-w-0 grid-cols-1 gap-0 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative min-h-64 min-w-0 overflow-hidden">
            <img
              src={app.destination.heroImage}
              alt={app.destination.name}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />
            <div className="media-overlay absolute bottom-5 left-5 right-5 min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-slate-950/65 px-3 py-2 text-[0.65rem] uppercase tracking-[0.24em] text-cyan-100 backdrop-blur">
                <Compass className="h-3.5 w-3.5" />
                Explore Jamaica
              </p>
              <h1 className="mt-3 max-w-full text-balance text-2xl font-semibold tracking-tight text-white sm:text-4xl">
                Places and experiences by vibe.
              </h1>
            </div>
          </div>

          <div className="min-w-0 p-4 sm:p-6">
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm leading-6 text-slate-400">
                  Browse premium destination cards and real island experiences, then save, map, or add them to a trip.
                </p>
                <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500">
                  Showing {visibleCount} of {totalCount}
                </p>
              </div>

              <div className={classNames("grid w-full min-w-0 grid-cols-2 rounded-2xl p-1 text-xs sm:w-auto sm:min-w-80", glassControl)}>
                <button
                  type="button"
                  onClick={() => app.setViewMode("places")}
                  className={classNames(
                    "flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl px-3 font-semibold transition",
                    app.viewMode === "places" ? "bg-cyan-300 text-slate-950" : "text-slate-300"
                  )}
                >
                  <MapPin className="h-3.5 w-3.5" /> Places
                </button>
                <button
                  type="button"
                  onClick={() => app.setViewMode("experiences")}
                  className={classNames(
                    "flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl px-3 font-semibold transition",
                    app.viewMode === "experiences" ? "bg-emerald-300 text-slate-950" : "text-slate-300"
                  )}
                >
                  <Music2 className="h-3.5 w-3.5" /> Experiences
                </button>
              </div>
            </div>

            <div className={classNames("mt-5 flex min-w-0 items-center gap-3 rounded-2xl px-4 py-3", glassControl)}>
              <Search className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                type="search"
                value={app.search}
                onChange={(event) => app.setSearch(event.target.value)}
                placeholder="Search Mobay, Negril, jerk, music..."
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
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

            <div className="mt-4 space-y-3">
              <div className="flex max-w-full flex-wrap gap-2 pb-1">
                {VIBE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => app.setVibe(option.id as Vibe)}
                    className={classNames(
                      "min-h-10 shrink-0 whitespace-nowrap rounded-full border px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] transition",
                      app.vibe === option.id
                        ? "border-cyan-300 bg-cyan-300/15 text-cyan-100"
                        : "border-slate-700/80 bg-slate-950/60 text-slate-300"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="flex max-w-full flex-wrap gap-2 pb-1">
                {app.viewMode === "experiences" &&
                  EXPERIENCE_TYPES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => app.setExperienceType(option.id as ExperienceType)}
                      className={classNames(
                        "min-h-10 shrink-0 rounded-full border px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em]",
                        app.experienceType === option.id
                          ? "border-emerald-300 bg-emerald-300/15 text-emerald-100"
                          : "border-slate-700/80 bg-slate-950/60 text-slate-300"
                      )}
                    >
                      {option.id === "food" && <Utensils className="mr-1 inline h-3.5 w-3.5" />}
                      {option.id === "music" && <Music2 className="mr-1 inline h-3.5 w-3.5" />}
                      {option.id === "festival" && <PartyPopper className="mr-1 inline h-3.5 w-3.5" />}
                      {option.label}
                    </button>
                  ))}

                {app.viewMode === "places" && (
                  <label className={classNames("flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-300", glassControl)}>
                    <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                    <select
                      value={app.sort}
                      onChange={(event) => app.setSort(event.target.value)}
                      className="bg-transparent focus:outline-none"
                    >
                      <option value="trending">Trending</option>
                      <option value="rating">Top rated</option>
                      <option value="priceLow">Budget friendly</option>
                    </select>
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {app.viewMode === "places" ? (
        <PlacesGrid
          items={app.filteredDestinations}
          saved={app.savedPlaces}
          onToggleSaved={app.toggleSavedPlace}
          onPlanFrom={handlePlanFromPlace}
          onViewMap={handleViewMap}
          planLabel="Add to trip"
        />
      ) : (
        <ExperiencesGrid
          items={app.filteredExperiences}
          saved={app.savedExperiences}
          onToggleSaved={app.toggleSavedExperience}
          onAddToTrip={handleAddExperienceToTrip}
        />
      )}
    </section>
  );
}
