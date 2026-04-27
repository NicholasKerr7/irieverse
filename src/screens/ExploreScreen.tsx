import { MapPin, Music2, PartyPopper, Search, SlidersHorizontal, Utensils } from "lucide-react";
import { ExperiencesGrid } from "../components/ExperiencesGrid";
import { ExperiencesHighlight } from "../components/ExperiencesHighlight";
import { PlacesGrid } from "../components/PlacesGrid";
import type { MobileTabId } from "../components/mobile/BottomNav";
import { EXPERIENCE_TYPES, VIBE_OPTIONS } from "../data/content";
import type { TravelOS } from "../hooks/useTravelOS";
import type { ExperienceType, Vibe } from "../types/travel";
import { classNames } from "../utils/classNames";

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
    onNavigate("trips");
  };

  return (
    <section className="mx-auto min-h-screen max-w-6xl px-4 py-5 sm:px-6 lg:px-10">
      <header className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl shadow-slate-950/40 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/80">
              Explore Jamaica
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Places and experiences, built for browsing.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Swipe through destination cards, food runs, music nights, festivals, and culture picks.
            </p>
          </div>

          <div className="inline-flex rounded-full border border-slate-700/80 bg-slate-950/80 p-1 text-xs">
            <button
              type="button"
              onClick={() => app.setViewMode("places")}
              className={classNames(
                "flex items-center gap-2 rounded-full px-4 py-2 transition",
                app.viewMode === "places" ? "bg-cyan-300 text-slate-950" : "text-slate-300"
              )}
            >
              <MapPin className="h-3.5 w-3.5" /> Places
            </button>
            <button
              type="button"
              onClick={() => app.setViewMode("experiences")}
              className={classNames(
                "flex items-center gap-2 rounded-full px-4 py-2 transition",
                app.viewMode === "experiences" ? "bg-emerald-300 text-slate-950" : "text-slate-300"
              )}
            >
              <Music2 className="h-3.5 w-3.5" /> Experiences
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/75 px-4 py-3">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            type="search"
            value={app.search}
            onChange={(event) => app.setSearch(event.target.value)}
            placeholder="Search Mobay, Negril, jerk, music..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {VIBE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => app.setVibe(option.id as Vibe)}
                className={classNames(
                  "whitespace-nowrap rounded-full border px-3 py-2 text-[0.68rem] uppercase tracking-[0.16em] transition",
                  app.vibe === option.id
                    ? "border-cyan-300 bg-cyan-300/15 text-cyan-200"
                    : "border-slate-700/80 bg-slate-950/60 text-slate-300"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {app.viewMode === "experiences" &&
              EXPERIENCE_TYPES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => app.setExperienceType(option.id as ExperienceType)}
                  className={classNames(
                    "rounded-full border px-3 py-2 text-[0.68rem] uppercase tracking-[0.16em]",
                    app.experienceType === option.id
                      ? "border-emerald-300 bg-emerald-300/15 text-emerald-200"
                      : "border-slate-700/80 bg-slate-950/60 text-slate-300"
                  )}
                >
                  {option.id === "food" && <Utensils className="mr-1 inline h-3 w-3" />}
                  {option.id === "music" && <Music2 className="mr-1 inline h-3 w-3" />}
                  {option.id === "festival" && <PartyPopper className="mr-1 inline h-3 w-3" />}
                  {option.label}
                </button>
              ))}

            {app.viewMode === "places" && (
              <label className="flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-[0.68rem] uppercase tracking-[0.16em] text-slate-300">
                <SlidersHorizontal className="h-3 w-3 text-slate-500" />
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
      </header>

      <div className="mt-5">
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
      </div>

      <div className="mt-6">
        <ExperiencesHighlight items={app.filteredExperiences.slice(0, 3)} />
      </div>
    </section>
  );
}
