import { useMemo, useState, type ReactNode } from "react";
import { CalendarDays, Heart, MapPinned, Trash2 } from "lucide-react";
import type { MobileTabId } from "../components/mobile/BottomNav";
import { DESTINATIONS, EXPERIENCES } from "../data/content";
import type { TravelOS } from "../hooks/useTravelOS";
import type { Destination, Experience } from "../types/travel";
import { classNames } from "../utils/classNames";

type SavedScreenProps = {
  app: TravelOS;
  onNavigate: (tab: MobileTabId) => void;
};

const COLLECTIONS = [
  { id: "all", label: "All Saved" },
  { id: "food", label: "Food Runs" },
  { id: "beach", label: "Beach Days" },
  { id: "nightlife", label: "Nightlife" },
  { id: "culture", label: "Culture" },
  { id: "romantic", label: "Romantic Escape" },
  { id: "wishlist", label: "My Jamaica Wishlist" },
] as const;

type CollectionId = (typeof COLLECTIONS)[number]["id"];

export function SavedScreen({ app, onNavigate }: SavedScreenProps) {
  const [activeCollection, setActiveCollection] = useState<CollectionId>("all");
  const savedDestinations = useMemo(
    () => DESTINATIONS.filter((destination) => app.savedPlaces.has(destination.id)),
    [app.savedPlaces]
  );
  const savedExperiences = useMemo(
    () => EXPERIENCES.filter((experience) => app.savedExperiences.has(experience.id)),
    [app.savedExperiences]
  );

  const visibleDestinations = savedDestinations.filter((destination) =>
    matchesDestinationCollection(destination, activeCollection)
  );
  const visibleExperiences = savedExperiences.filter((experience) =>
    matchesExperienceCollection(experience, activeCollection)
  );
  const hasSavedItems = savedDestinations.length > 0 || savedExperiences.length > 0;

  const handleDestinationTrip = (destinationId: string) => {
    app.setPlannerBaseId(destinationId);
    onNavigate("trips");
  };

  const handleDestinationMap = (destinationId: string) => {
    app.setPlannerBaseId(destinationId);
    onNavigate("map");
  };

  const handleExperienceTrip = (experience: Experience) => {
    if (experience.linkedDestinationId) {
      app.setPlannerBaseId(experience.linkedDestinationId);
    }
    onNavigate("trips");
  };

  return (
    <section className="mx-auto min-h-screen max-w-6xl px-4 py-5 sm:px-6 lg:px-10">
      <header className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl shadow-slate-950/40 sm:p-6">
        <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/80">Saved</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your Jamaica collections.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Saved places and experiences now have their own workspace, with actions to map them or move them into the trip builder.
        </p>
      </header>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        {COLLECTIONS.map((collection) => (
          <button
            key={collection.id}
            type="button"
            onClick={() => setActiveCollection(collection.id)}
            className={classNames(
              "whitespace-nowrap rounded-full border px-4 py-2 text-xs font-medium transition",
              activeCollection === collection.id
                ? "border-cyan-300 bg-cyan-300 text-slate-950"
                : "border-slate-700/80 bg-slate-900/60 text-slate-300"
            )}
          >
            {collection.label}
          </button>
        ))}
      </div>

      {!hasSavedItems && (
        <div className="mt-5 rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
          <Heart className="mx-auto h-8 w-8 text-cyan-300" />
          <h2 className="mt-3 text-lg font-semibold">No saved Jamaica ideas yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
            Save a place or experience from Explore or the Map, then build your trip from this board.
          </p>
          <button
            type="button"
            onClick={() => onNavigate("explore")}
            className="mt-5 rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950"
          >
            Browse Explore
          </button>
        </div>
      )}

      {hasSavedItems && (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <SavedPanel title="Saved places" count={visibleDestinations.length}>
            {visibleDestinations.length ? (
              visibleDestinations.map((place) => (
                <article key={place.id} className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <img src={place.heroImage} alt={place.name} className="h-20 w-20 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{place.name}</h3>
                    <p className="text-xs text-slate-500">{place.region}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-400">{place.headline}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <IconAction label="Trip" icon={CalendarDays} onClick={() => handleDestinationTrip(place.id)} />
                      <IconAction label="Map" icon={MapPinned} onClick={() => handleDestinationMap(place.id)} />
                      <IconAction label="Remove" icon={Trash2} onClick={() => app.toggleSavedPlace(place.id)} />
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <EmptyCollection label="No places match this collection." />
            )}
          </SavedPanel>

          <SavedPanel title="Saved experiences" count={visibleExperiences.length}>
            {visibleExperiences.length ? (
              visibleExperiences.map((experience) => (
                <article key={experience.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-[0.65rem] uppercase tracking-[0.2em] text-emerald-300">
                    {experience.type} · {experience.location}
                  </p>
                  <h3 className="mt-1 font-semibold">{experience.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                    {experience.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <IconAction label="Trip" icon={CalendarDays} onClick={() => handleExperienceTrip(experience)} />
                    {experience.linkedDestinationId && (
                      <IconAction
                        label="Map"
                        icon={MapPinned}
                        onClick={() => handleDestinationMap(experience.linkedDestinationId ?? app.plannerBaseId)}
                      />
                    )}
                    <IconAction label="Remove" icon={Trash2} onClick={() => app.toggleSavedExperience(experience.id)} />
                  </div>
                </article>
              ))
            ) : (
              <EmptyCollection label="No experiences match this collection." />
            )}
          </SavedPanel>
        </div>
      )}
    </section>
  );
}

function SavedPanel({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-400">
          {count}
        </span>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function IconAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof CalendarDays;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-slate-700/80 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-300/60 hover:text-cyan-200"
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function EmptyCollection({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 p-5 text-sm text-slate-500">
      {label}
    </div>
  );
}

function matchesDestinationCollection(destination: Destination, collection: CollectionId) {
  if (collection === "all" || collection === "wishlist") return true;
  if (collection === "food") return false;
  if (collection === "beach") {
    return destination.description.toLowerCase().includes("beach") || destination.vibes.includes("chill");
  }
  return destination.vibes.includes(collection);
}

function matchesExperienceCollection(experience: Experience, collection: CollectionId) {
  if (collection === "all" || collection === "wishlist") return true;
  if (collection === "food") return experience.type === "food";
  if (collection === "beach") return experience.description.toLowerCase().includes("beach");
  return experience.vibes.includes(collection) || experience.type === collection;
}
