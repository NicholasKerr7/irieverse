import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Heart,
  MapPinned,
  MoveRight,
  Share2,
  Trash2,
} from "lucide-react";
import type { MobileTabId } from "../components/mobile/BottomNav";
import { DESTINATIONS, EXPERIENCES } from "../data/content";
import type { TravelOS } from "../hooks/useTravelOS";
import type { Destination, Experience } from "../types/travel";
import { classNames } from "../utils/classNames";

type SavedScreenProps = {
  app: TravelOS;
  onNavigate: (tab: MobileTabId) => void;
};

const STORAGE_KEY_COLLECTIONS = "irieverse_saved_collections";

const COLLECTIONS = [
  { id: "all", label: "All Saved", helper: "Everything you saved" },
  { id: "food", label: "Food Runs", helper: "Jerk, cookshops, tastings" },
  { id: "beach", label: "Beach Days", helper: "Coasts, coves, sunset plans" },
  { id: "nightlife", label: "Nightlife", helper: "Dancehall, bars, late nights" },
  { id: "culture", label: "Culture", helper: "History, art, music roots" },
  { id: "romantic", label: "Romantic Escape", helper: "Soft landings and views" },
  { id: "wishlist", label: "My Jamaica Wishlist", helper: "Manual catch-all board" },
] as const;

type CollectionId = (typeof COLLECTIONS)[number]["id"];
type ItemKind = "place" | "experience";
type SavedItem =
  | { kind: "place"; item: Destination; collection: CollectionId }
  | { kind: "experience"; item: Experience; collection: CollectionId };

export function SavedScreen({ app, onNavigate }: SavedScreenProps) {
  const [activeCollection, setActiveCollection] = useState<CollectionId>("all");
  const [collectionAssignments, setCollectionAssignments] = useState<Record<string, CollectionId>>({});
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_COLLECTIONS);
    if (!stored) return;
    try {
      setCollectionAssignments(JSON.parse(stored));
    } catch {
      setCollectionAssignments({});
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_COLLECTIONS, JSON.stringify(collectionAssignments));
  }, [collectionAssignments]);

  const savedDestinations = useMemo(
    () => DESTINATIONS.filter((destination) => app.savedPlaces.has(destination.id)),
    [app.savedPlaces]
  );
  const savedExperiences = useMemo(
    () => EXPERIENCES.filter((experience) => app.savedExperiences.has(experience.id)),
    [app.savedExperiences]
  );

  const savedItems: SavedItem[] = useMemo(
    () => [
      ...savedDestinations.map((destination) => ({
        kind: "place" as const,
        item: destination,
        collection: getDestinationCollection(destination, collectionAssignments),
      })),
      ...savedExperiences.map((experience) => ({
        kind: "experience" as const,
        item: experience,
        collection: getExperienceCollection(experience, collectionAssignments),
      })),
    ],
    [collectionAssignments, savedDestinations, savedExperiences]
  );

  const visibleItems =
    activeCollection === "all"
      ? savedItems
      : savedItems.filter((savedItem) => savedItem.collection === activeCollection);
  const hasSavedItems = savedItems.length > 0;

  const handleMoveCollection = (kind: ItemKind, id: string, collection: CollectionId) => {
    setCollectionAssignments((prev) => ({
      ...prev,
      [itemKey(kind, id)]: collection,
    }));
    setStatusMessage(`Moved to ${COLLECTIONS.find((item) => item.id === collection)?.label ?? "collection"}`);
  };

  const handleAddToTrip = (savedItem: SavedItem) => {
    if (savedItem.kind === "place") {
      app.setPlannerBaseId(savedItem.item.id);
    } else if (savedItem.item.linkedDestinationId) {
      app.setPlannerBaseId(savedItem.item.linkedDestinationId);
    }
    onNavigate("trips");
  };

  const handleViewMap = (savedItem: SavedItem) => {
    if (savedItem.kind === "place") {
      app.setPlannerBaseId(savedItem.item.id);
    } else if (savedItem.item.linkedDestinationId) {
      app.setPlannerBaseId(savedItem.item.linkedDestinationId);
    }
    onNavigate("map");
  };

  const handleRemove = (savedItem: SavedItem) => {
    if (savedItem.kind === "place") {
      app.toggleSavedPlace(savedItem.item.id);
    } else {
      app.toggleSavedExperience(savedItem.item.id);
    }
    setStatusMessage("Removed from saved");
  };

  const handleShareLater = async (savedItem: SavedItem) => {
    const title = savedItem.kind === "place" ? savedItem.item.name : savedItem.item.title;
    const text = `IrieVerse Jamaica idea: ${title}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
      } else {
        await navigator.clipboard.writeText(text);
      }
      setStatusMessage("Share text ready");
    } catch {
      setStatusMessage("Share cancelled");
    }
  };

  return (
    <section className="mx-auto min-h-screen max-w-7xl px-4 py-5 sm:px-6 lg:px-10">
      <header className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-slate-950/40">
        <div className="grid gap-0 lg:grid-cols-[1fr_0.75fr]">
          <div className="p-5 sm:p-6">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/80">Saved</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your Jamaica boards.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Organize saved places and experiences into trip-ready boards, then map them or send them into the builder.
            </p>
            {statusMessage && <p className="mt-3 text-xs text-cyan-200">{statusMessage}</p>}
          </div>

          <div className="grid grid-cols-3 border-t border-slate-800 bg-slate-950/50 lg:border-l lg:border-t-0">
            <SavedMetric label="Saved" value={savedItems.length.toString()} />
            <SavedMetric label="Places" value={savedDestinations.length.toString()} />
            <SavedMetric label="Ideas" value={savedExperiences.length.toString()} />
          </div>
        </div>
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-[18rem_1fr]">
        <aside className="rounded-3xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="space-y-2">
            {COLLECTIONS.map((collection) => {
              const count = getCollectionCount(savedItems, collection.id);
              return (
                <button
                  key={collection.id}
                  type="button"
                  onClick={() => setActiveCollection(collection.id)}
                  className={classNames(
                    "w-full rounded-2xl border px-4 py-3 text-left transition",
                    activeCollection === collection.id
                      ? "border-cyan-300 bg-cyan-300 text-slate-950"
                      : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-cyan-300/50"
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{collection.label}</span>
                    <span className="rounded-full bg-slate-950/20 px-2 py-0.5 text-xs">{count}</span>
                  </span>
                  <span className={classNames("mt-1 block text-xs", activeCollection === collection.id ? "text-slate-800" : "text-slate-500")}>
                    {collection.helper}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div>
          {!hasSavedItems && (
            <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
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
            <div className="grid gap-3 md:grid-cols-2">
              {visibleItems.length ? (
                visibleItems.map((savedItem) => (
                  <SavedCard
                    key={itemKey(savedItem.kind, savedItem.kind === "place" ? savedItem.item.id : savedItem.item.id)}
                    savedItem={savedItem}
                    onAddToTrip={() => handleAddToTrip(savedItem)}
                    onViewMap={() => handleViewMap(savedItem)}
                    onRemove={() => handleRemove(savedItem)}
                    onShareLater={() => handleShareLater(savedItem)}
                    onMoveCollection={(collection) =>
                      handleMoveCollection(savedItem.kind, savedItem.kind === "place" ? savedItem.item.id : savedItem.item.id, collection)
                    }
                  />
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center text-sm text-slate-400 md:col-span-2">
                  No saved items in this board yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SavedCard({
  savedItem,
  onAddToTrip,
  onViewMap,
  onRemove,
  onShareLater,
  onMoveCollection,
}: {
  savedItem: SavedItem;
  onAddToTrip: () => void;
  onViewMap: () => void;
  onRemove: () => void;
  onShareLater: () => void;
  onMoveCollection: (collection: CollectionId) => void;
}) {
  const title = savedItem.kind === "place" ? savedItem.item.name : savedItem.item.title;
  const region = savedItem.kind === "place" ? savedItem.item.region : `${savedItem.item.region} · ${savedItem.item.location}`;
  const image = savedItem.kind === "place" ? savedItem.item.heroImage : savedItem.item.imageUrl;
  const body = savedItem.kind === "place" ? savedItem.item.headline : savedItem.item.description;

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-slate-950/30">
      <div className="relative h-40">
        <img src={image} alt={title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-200">{region}</p>
          <h2 className="mt-1 text-lg font-semibold">{title}</h2>
        </div>
      </div>
      <div className="p-4">
        <p className="line-clamp-2 text-sm leading-6 text-slate-400">{body}</p>

        <label className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-400">
          <MoveRight className="h-3.5 w-3.5 text-cyan-300" />
          <span className="shrink-0 uppercase tracking-[0.16em]">Move</span>
          <select
            value={savedItem.collection}
            onChange={(event) => onMoveCollection(event.target.value as CollectionId)}
            className="min-w-0 flex-1 bg-transparent text-slate-200 focus:outline-none"
          >
            {COLLECTIONS.filter((collection) => collection.id !== "all").map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.label}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <IconAction label="Trip" icon={CalendarDays} onClick={onAddToTrip} />
          <IconAction label="Map" icon={MapPinned} onClick={onViewMap} />
          <IconAction label="Share" icon={Share2} onClick={onShareLater} />
          <IconAction label="Remove" icon={Trash2} onClick={onRemove} />
        </div>
      </div>
    </article>
  );
}

function SavedMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 text-center">
      <p className="text-2xl font-semibold text-cyan-200">{value}</p>
      <p className="mt-1 text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">{label}</p>
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
      className="inline-flex min-h-10 items-center justify-center gap-1 rounded-full border border-slate-700/80 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-cyan-300/60 hover:text-cyan-200"
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function itemKey(kind: ItemKind, id: string) {
  return `${kind}:${id}`;
}

function getCollectionCount(savedItems: SavedItem[], collection: CollectionId) {
  if (collection === "all") return savedItems.length;
  return savedItems.filter((savedItem) => savedItem.collection === collection).length;
}

function getDestinationCollection(destination: Destination, assignments: Record<string, CollectionId>): CollectionId {
  return assignments[itemKey("place", destination.id)] ?? inferDestinationCollection(destination);
}

function getExperienceCollection(experience: Experience, assignments: Record<string, CollectionId>): CollectionId {
  return assignments[itemKey("experience", experience.id)] ?? inferExperienceCollection(experience);
}

function inferDestinationCollection(destination: Destination): CollectionId {
  const text = `${destination.name} ${destination.region} ${destination.description} ${destination.headline}`.toLowerCase();
  if (destination.vibes.includes("nightlife")) return "nightlife";
  if (destination.vibes.includes("romantic")) return "romantic";
  if (destination.vibes.includes("culture") || destination.vibes.includes("authentic")) return "culture";
  if (/beach|coast|cove|lagoon|sandbar|sunset/.test(text)) return "beach";
  return "wishlist";
}

function inferExperienceCollection(experience: Experience): CollectionId {
  const text = `${experience.title} ${experience.description} ${experience.location}`.toLowerCase();
  if (experience.type === "food" || experience.vibes.includes("food")) return "food";
  if (experience.vibes.includes("nightlife") || experience.type === "music") return "nightlife";
  if (experience.vibes.includes("culture") || experience.type === "festival") return "culture";
  if (experience.vibes.includes("romantic")) return "romantic";
  if (/beach|coast|cove|sunset|sand/.test(text)) return "beach";
  return "wishlist";
}
