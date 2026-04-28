import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarDays,
  ExternalLink,
  Heart,
  Link,
  MapPinned,
  MoveRight,
  Plus,
  Share2,
  StickyNote,
  Trash2,
} from "lucide-react";
import type { MobileTabId } from "../components/mobile/BottomNav";
import { DESTINATIONS, EXPERIENCES } from "../data/content";
import type { TravelOS } from "../hooks/useTravelOS";
import type { Destination, Experience, ImportedIdea, ImportedIdeaCategory } from "../types/travel";
import { classNames } from "../utils/classNames";
import { glassCard, glassControl, glassControlMuted, glassField, glassPanel } from "../utils/glass";
import { isStringRecord, readJsonFromStorage, writeJsonToStorage } from "../utils/storage";

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
type ItemKind = "place" | "experience" | "import";
type SavedItem =
  | { kind: "place"; item: Destination; collection: CollectionId }
  | { kind: "experience"; item: Experience; collection: CollectionId }
  | { kind: "import"; item: ImportedIdea; collection: CollectionId };

const IMPORT_CATEGORIES: Array<{ id: ImportedIdeaCategory; label: string }> = [
  { id: "food", label: "Food" },
  { id: "beach", label: "Beach" },
  { id: "music", label: "Music" },
  { id: "culture", label: "Culture" },
  { id: "hotel", label: "Hotel" },
  { id: "hidden-gem", label: "Hidden Gem" },
  { id: "nightlife", label: "Nightlife" },
];

const DEFAULT_IMPORT_FORM = {
  title: "",
  url: "",
  note: "",
  category: "food" as ImportedIdeaCategory,
  collectionId: "food" as CollectionId,
  linkedDestinationId: "",
};

export function SavedScreen({ app, onNavigate }: SavedScreenProps) {
  const [activeCollection, setActiveCollection] = useState<CollectionId>("all");
  const [collectionAssignments, setCollectionAssignments] = useState<Record<string, CollectionId>>(() =>
    sanitizeCollectionAssignments(readJsonFromStorage(STORAGE_KEY_COLLECTIONS, {}, isStringRecord))
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [importForm, setImportForm] = useState(DEFAULT_IMPORT_FORM);

  useEffect(() => {
    writeJsonToStorage(STORAGE_KEY_COLLECTIONS, collectionAssignments);
  }, [collectionAssignments]);

  useEffect(() => {
    const sharedIdea = getSharedIdeaFromUrl();
    if (!sharedIdea) return;

    const category = inferImportedCategory(sharedIdea);
    setImportForm((prev) => ({
      ...prev,
      title: sharedIdea.title || prev.title,
      url: sharedIdea.url || prev.url,
      note: sharedIdea.note || prev.note,
      category,
      collectionId: categoryToCollection(category),
    }));
    setActiveCollection(categoryToCollection(category));
    setStatusMessage("Shared idea ready to save");
    removeShareTargetParams();
  }, []);

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
      ...app.importedIdeas.map((idea) => ({
        kind: "import" as const,
        item: idea,
        collection: getImportCollection(idea),
      })),
    ],
    [app.importedIdeas, collectionAssignments, savedDestinations, savedExperiences]
  );

  const visibleItems =
    activeCollection === "all"
      ? savedItems
      : savedItems.filter((savedItem) => savedItem.collection === activeCollection);
  const hasSavedItems = savedItems.length > 0;

  const handleMoveCollection = (kind: ItemKind, id: string, collection: CollectionId) => {
    if (kind === "import") {
      app.updateImportedIdea(id, { collectionId: collection });
      setStatusMessage(`Moved to ${COLLECTIONS.find((item) => item.id === collection)?.label ?? "collection"}`);
      return;
    }
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
    if (savedItem.kind === "import" && !savedItem.item.linkedDestinationId) {
      setStatusMessage("Imported idea is ready in the trip builder. Attach a map location when you have one.");
    }
    onNavigate("trips");
  };

  const handleViewMap = (savedItem: SavedItem) => {
    if (savedItem.kind === "place") {
      app.setPlannerBaseId(savedItem.item.id);
    } else if (savedItem.item.linkedDestinationId) {
      app.setPlannerBaseId(savedItem.item.linkedDestinationId);
    } else if (savedItem.kind === "import") {
      setStatusMessage("Attach a Jamaica map location to view this import on the map.");
      return;
    }
    onNavigate("map");
  };

  const handleRemove = (savedItem: SavedItem) => {
    if (savedItem.kind === "place") {
      app.toggleSavedPlace(savedItem.item.id);
    } else if (savedItem.kind === "experience") {
      app.toggleSavedExperience(savedItem.item.id);
    } else {
      app.removeImportedIdea(savedItem.item.id);
    }
    setStatusMessage("Removed from saved");
  };

  const handleShareLater = async (savedItem: SavedItem) => {
    const title = getSavedItemTitle(savedItem);
    const url = savedItem.kind === "import" ? savedItem.item.url : "";
    const text = `IrieVerse Jamaica idea: ${title}${url ? ` ${url}` : ""}`;
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

  const handleImportSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = importForm.title.trim();
    const url = importForm.url.trim();
    const note = importForm.note.trim();
    const fallbackTitle = inferTitleFromUrl(url) || note.slice(0, 56);

    if (!title && !url && !note) {
      setStatusMessage("Add a link, title, or note before saving.");
      return;
    }

    app.addImportedIdea({
      title: title || fallbackTitle || "Imported Jamaica idea",
      url,
      note,
      category: importForm.category,
      collectionId: importForm.collectionId,
      linkedDestinationId: importForm.linkedDestinationId || undefined,
    });
    setImportForm({
      ...DEFAULT_IMPORT_FORM,
      category: importForm.category,
      collectionId: categoryToCollection(importForm.category),
    });
    setStatusMessage("Imported idea saved");
  };

  const handleCategoryChange = (category: ImportedIdeaCategory) => {
    setImportForm((prev) => ({
      ...prev,
      category,
      collectionId: categoryToCollection(category),
    }));
  };

  return (
    <section className="mx-auto min-h-screen max-w-7xl px-4 py-5 sm:px-6 lg:px-10">
      <header className={classNames("overflow-hidden rounded-3xl", glassPanel)}>
        <div className="grid gap-0 lg:grid-cols-[1fr_0.75fr]">
          <div className="p-5 sm:p-6">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/80">Saved</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your Jamaica boards.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Organize saved places, experiences, pasted links, and notes into trip-ready boards.
            </p>
            {statusMessage && <p className="mt-3 text-xs text-cyan-200">{statusMessage}</p>}
          </div>

          <div className="grid grid-cols-3 border-t border-slate-800 bg-slate-950/50 lg:border-l lg:border-t-0">
            <SavedMetric label="Saved" value={savedItems.length.toString()} />
            <SavedMetric label="Places" value={savedDestinations.length.toString()} />
            <SavedMetric label="Imports" value={app.importedIdeas.length.toString()} />
          </div>
        </div>
      </header>

      <form
        onSubmit={handleImportSubmit}
        className={classNames("mt-5 rounded-3xl p-4", glassPanel)}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-cyan-300/80">Save a Jamaica idea</p>
            <h2 className="mt-1 text-xl font-semibold">Paste a travel link or add a note.</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
              Capture TikTok, Instagram, Google Maps, YouTube, article links, or manual ideas now; attach exact map data later.
            </p>
          </div>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950"
          >
            <Plus className="h-4 w-4" /> Save to Irieverse
          </button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.75fr]">
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">Paste link</span>
            <span className={classNames("flex items-center gap-2 rounded-2xl px-3 py-2", glassControl)}>
              <Link className="h-4 w-4 text-cyan-300" />
              <input
                type="url"
                value={importForm.url}
                onChange={(event) => setImportForm((prev) => ({ ...prev, url: event.target.value }))}
                placeholder="https://maps.google.com/... or social link"
                className="min-w-0 flex-1 bg-transparent text-slate-100 placeholder:text-slate-600 focus:outline-none"
              />
            </span>
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">Title</span>
            <input
              type="text"
              value={importForm.title}
              onChange={(event) => setImportForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Jerk stop in Port Antonio"
              className={classNames("rounded-2xl px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none", glassField)}
            />
          </label>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_0.8fr_0.8fr]">
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">Note</span>
            <textarea
              value={importForm.note}
              onChange={(event) => setImportForm((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="Why this belongs in the trip"
              rows={3}
              className={classNames("resize-none rounded-2xl px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none", glassField)}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">Collection</span>
            <select
              value={importForm.collectionId}
              onChange={(event) => setImportForm((prev) => ({ ...prev, collectionId: event.target.value as CollectionId }))}
              className={classNames("rounded-2xl px-3 py-2 text-slate-100 focus:outline-none", glassField)}
            >
              {COLLECTIONS.filter((collection) => collection.id !== "all").map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">Map location</span>
            <select
              value={importForm.linkedDestinationId}
              onChange={(event) => setImportForm((prev) => ({ ...prev, linkedDestinationId: event.target.value }))}
              className={classNames("rounded-2xl px-3 py-2 text-slate-100 focus:outline-none", glassField)}
            >
              <option value="">Attach later</option>
              {DESTINATIONS.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {IMPORT_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => handleCategoryChange(category.id)}
              className={classNames(
                "rounded-full border px-3 py-2 text-xs font-semibold transition",
                importForm.category === category.id
                  ? "border-cyan-300 bg-cyan-300 text-slate-950"
                  : "border-slate-700/80 bg-slate-950/70 text-slate-300 hover:border-cyan-300/60"
              )}
            >
              {category.label}
            </button>
          ))}
        </div>
      </form>

      <div className="mt-5 grid gap-4 lg:grid-cols-[18rem_1fr]">
        <aside className={classNames("rounded-3xl p-3", glassPanel)}>
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
                      : `${glassControlMuted} text-slate-300 hover:border-cyan-300/50`
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
            <div className={classNames("rounded-3xl border-dashed p-8 text-center", glassControlMuted)}>
              <Heart className="mx-auto h-8 w-8 text-cyan-300" />
              <h2 className="mt-3 text-lg font-semibold">No saved Jamaica ideas yet</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                Save from Explore, the Map, or the import form above, then build your trip from this board.
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
                    key={itemKey(savedItem.kind, getSavedItemId(savedItem))}
                    savedItem={savedItem}
                    onAddToTrip={() => handleAddToTrip(savedItem)}
                    onViewMap={() => handleViewMap(savedItem)}
                    onRemove={() => handleRemove(savedItem)}
                    onShareLater={() => handleShareLater(savedItem)}
                    onMoveCollection={(collection) =>
                      handleMoveCollection(savedItem.kind, getSavedItemId(savedItem), collection)
                    }
                    onUpdateImportLocation={(destinationId) => {
                      if (savedItem.kind === "import") {
                        app.updateImportedIdea(savedItem.item.id, { linkedDestinationId: destinationId || undefined });
                        setStatusMessage(destinationId ? "Map location attached" : "Map location cleared");
                      }
                    }}
                  />
                ))
              ) : (
                <div className={classNames("rounded-3xl border-dashed p-8 text-center text-sm text-slate-400 md:col-span-2", glassControlMuted)}>
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
  onUpdateImportLocation,
}: {
  savedItem: SavedItem;
  onAddToTrip: () => void;
  onViewMap: () => void;
  onRemove: () => void;
  onShareLater: () => void;
  onMoveCollection: (collection: CollectionId) => void;
  onUpdateImportLocation: (destinationId: string) => void;
}) {
  const title = getSavedItemTitle(savedItem);
  const linkedDestination =
    savedItem.kind === "import" && savedItem.item.linkedDestinationId
      ? DESTINATIONS.find((destination) => destination.id === savedItem.item.linkedDestinationId)
      : null;
  const region =
    savedItem.kind === "place"
      ? savedItem.item.region
      : savedItem.kind === "experience"
        ? `${savedItem.item.region} · ${savedItem.item.location}`
        : `${formatImportedCategory(savedItem.item.category)} · ${linkedDestination?.name ?? "Attach map later"}`;
  const image =
    savedItem.kind === "place"
      ? savedItem.item.heroImage
      : savedItem.kind === "experience"
        ? savedItem.item.imageUrl
        : linkedDestination?.heroImage;
  const body =
    savedItem.kind === "place"
      ? savedItem.item.headline
      : savedItem.kind === "experience"
        ? savedItem.item.description
        : savedItem.item.note || savedItem.item.url || "Manual Jamaica idea";

  return (
    <article className={classNames("overflow-hidden rounded-3xl", glassCard)}>
      <div className="relative h-40">
        {image ? (
          <img src={image} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-950">
            <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-4">
              <StickyNote className="h-7 w-7 text-cyan-200" />
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-200">{region}</p>
          <h2 className="mt-1 text-lg font-semibold">{title}</h2>
        </div>
      </div>
      <div className="p-4">
        <p className="line-clamp-2 text-sm leading-6 text-slate-400">{body}</p>
        {savedItem.kind === "import" && savedItem.item.url && (
          <a
            href={savedItem.item.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-200 hover:text-cyan-100"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open source
          </a>
        )}

        <label className={classNames("mt-4 flex items-center gap-2 rounded-2xl px-3 py-2 text-xs text-slate-400", glassControlMuted)}>
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

        {savedItem.kind === "import" && (
          <label className={classNames("mt-2 flex items-center gap-2 rounded-2xl px-3 py-2 text-xs text-slate-400", glassControlMuted)}>
            <MapPinned className="h-3.5 w-3.5 text-cyan-300" />
            <span className="shrink-0 uppercase tracking-[0.16em]">Map</span>
            <select
              value={savedItem.item.linkedDestinationId ?? ""}
              onChange={(event) => onUpdateImportLocation(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-slate-200 focus:outline-none"
            >
              <option value="">Attach later</option>
              {DESTINATIONS.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.name}
                </option>
              ))}
            </select>
          </label>
        )}

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

function getSavedItemId(savedItem: SavedItem) {
  return savedItem.item.id;
}

function getSavedItemTitle(savedItem: SavedItem) {
  return savedItem.kind === "place" ? savedItem.item.name : savedItem.item.title;
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

function getImportCollection(idea: ImportedIdea): CollectionId {
  return normalizeCollectionId(idea.collectionId) ?? categoryToCollection(idea.category);
}

function normalizeCollectionId(collectionId: string): CollectionId | null {
  const match = COLLECTIONS.find((collection) => collection.id === collectionId && collection.id !== "all");
  return match?.id ?? null;
}

function sanitizeCollectionAssignments(assignments: Record<string, string>): Record<string, CollectionId> {
  const sanitized: Record<string, CollectionId> = {};
  Object.entries(assignments).forEach(([key, value]) => {
    const collection = normalizeCollectionId(value);
    if (collection) {
      sanitized[key] = collection;
    }
  });
  return sanitized;
}

function categoryToCollection(category: ImportedIdeaCategory): CollectionId {
  if (category === "food") return "food";
  if (category === "beach") return "beach";
  if (category === "music" || category === "nightlife") return "nightlife";
  if (category === "culture") return "culture";
  return "wishlist";
}

function formatImportedCategory(category: ImportedIdeaCategory): string {
  return IMPORT_CATEGORIES.find((item) => item.id === category)?.label ?? "Idea";
}

function inferTitleFromUrl(url: string): string {
  if (!url) return "";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return `${host} Jamaica idea`;
  } catch {
    return "";
  }
}

function getSharedIdeaFromUrl(): { title: string; url: string; note: string } | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const title = firstParam(params, ["shared_title", "title"]);
  const text = firstParam(params, ["shared_text", "text"]);
  const explicitUrl = firstParam(params, ["shared_url", "url"]);
  const inferredUrl = explicitUrl || findFirstUrl(text);

  if (!title && !text && !inferredUrl) return null;

  return {
    title: normalizeSharedText(title) || inferTitleFromUrl(inferredUrl),
    url: inferredUrl,
    note: normalizeSharedText(removeUrlFromText(text, inferredUrl)),
  };
}

function firstParam(params: URLSearchParams, keys: string[]): string {
  for (const key of keys) {
    const value = normalizeSharedText(params.get(key) ?? "");
    if (value) return value;
  }
  return "";
}

function normalizeSharedText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function findFirstUrl(text: string): string {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match?.[0]?.replace(/[),.;]+$/, "") ?? "";
}

function removeUrlFromText(text: string, url: string): string {
  return url ? text.replace(url, "") : text;
}

function inferImportedCategory(sharedIdea: { title: string; url: string; note: string }): ImportedIdeaCategory {
  const text = `${sharedIdea.title} ${sharedIdea.url} ${sharedIdea.note}`.toLowerCase();
  if (/restaurant|jerk|food|cookshop|coffee|bar|cafe|dining|eat/.test(text)) return "food";
  if (/beach|cove|sand|sea|snorkel|swim|waterfall|lagoon/.test(text)) return "beach";
  if (/hotel|resort|villa|stay|airbnb|booking|expedia/.test(text)) return "hotel";
  if (/music|dancehall|reggae|sound|festival|party|club|nightlife/.test(text)) return "music";
  if (/museum|culture|history|heritage|gallery|art|maroon/.test(text)) return "culture";
  if (/hidden|secret|local|gem|maps\.google|google\.com\/maps/.test(text)) return "hidden-gem";
  return "hidden-gem";
}

function removeShareTargetParams() {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  [
    "shared_title",
    "shared_text",
    "shared_url",
    "title",
    "text",
    "url",
    "source",
  ].forEach((key) => url.searchParams.delete(key));
  url.searchParams.set("tab", "saved");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
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
