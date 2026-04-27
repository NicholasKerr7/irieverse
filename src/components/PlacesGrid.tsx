import { CalendarDays, Heart, MapPin, Route, Star } from "lucide-react";
import { Destination } from "../types/travel";
import { classNames } from "../utils/classNames";
import { glassCard, glassControlMuted, glassPanelStrong } from "../utils/glass";

interface PlacesGridProps {
  items: Destination[];
  saved: Set<string>;
  onToggleSaved: (id: string) => void;
  onPlanFrom: (destinationId: string) => void;
  onViewMap?: (destinationId: string) => void;
  planLabel?: string;
}

export function PlacesGrid({
  items,
  saved,
  onToggleSaved,
  onPlanFrom,
  onViewMap,
  planLabel = "Add to trip",
}: PlacesGridProps) {
  if (!items.length) {
    return (
      <div className={classNames("mt-5 rounded-2xl border-dashed p-6 text-sm text-slate-400", glassControlMuted)}>
        No destinations match those filters yet. Try a different vibe or search.
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((destination) => {
        const isSaved = saved.has(destination.id);
        const priceLabel = "$".repeat(destination.priceLevel);

        return (
          <article
            key={destination.id}
            className={classNames("group overflow-hidden rounded-[1.35rem] transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/35", glassCard)}
          >
            <div className="relative h-56 overflow-hidden">
              <img
                src={destination.heroImage}
                alt={destination.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent" />
              <button
                type="button"
                onClick={() => onToggleSaved(destination.id)}
                className={classNames(
                  "absolute right-3 top-3 inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs font-semibold backdrop-blur transition",
                  isSaved
                    ? "border-rose-300/50 bg-rose-400/20 text-rose-100"
                    : "border-white/15 bg-slate-950/65 text-slate-100 hover:border-cyan-300/60"
                )}
                aria-label={isSaved ? "Remove from saved" : "Save destination"}
              >
                <Heart className={classNames("h-4 w-4", isSaved ? "fill-rose-300 text-rose-300" : "")} />
                {isSaved ? "Saved" : "Save"}
              </button>
              <div className="absolute bottom-4 left-4 right-4">
                <p className="flex items-center gap-1 text-xs font-medium text-cyan-100">
                  <MapPin className="h-3.5 w-3.5" /> {destination.region}
                </p>
                <h3 className="mt-1 text-2xl font-semibold leading-tight text-white">{destination.name}</h3>
              </div>
            </div>

            <div className="flex min-h-[15rem] flex-col p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="inline-flex items-center gap-1 font-semibold text-amber-200">
                  <Star className="h-4 w-4 fill-current" /> {destination.rating.toFixed(1)}
                </span>
                <span className={classNames("rounded-full px-3 py-1 text-xs font-semibold text-slate-300", glassPanelStrong)}>
                  {priceLabel}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {destination.vibes.slice(0, 3).map((vibe) => (
                  <span
                    key={vibe}
                    className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.14em] text-cyan-100"
                  >
                    {vibe}
                  </span>
                ))}
              </div>

              <p className="mt-3 text-sm font-medium leading-6 text-slate-200">{destination.headline}</p>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">{destination.description}</p>

              <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => onPlanFrom(destination.id)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-200"
                >
                  <CalendarDays className="h-4 w-4" /> {planLabel}
                </button>
                {onViewMap && (
                  <button
                    type="button"
                    onClick={() => onViewMap(destination.id)}
                    className={classNames("inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-cyan-300/60", glassPanelStrong)}
                  >
                    <Route className="h-4 w-4" /> View map
                  </button>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
