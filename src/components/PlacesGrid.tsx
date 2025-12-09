import { CalendarDays, Heart, MapPin } from "lucide-react";
import { Destination } from "../types/travel";
import { classNames } from "../utils/classNames";

interface PlacesGridProps {
  items: Destination[];
  saved: Set<string>;
  onToggleSaved: (id: string) => void;
  onPlanFrom: (destinationId: string) => void;
}

export function PlacesGrid({ items, saved, onToggleSaved, onPlanFrom }: PlacesGridProps) {
  if (!items.length) {
    return (
      <p className="mt-5 text-xs text-slate-400">
        No destinations match those filters yet. Try a different vibe or search.
      </p>
    );
  }

  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((destination) => {
        const isSaved = saved.has(destination.id);
        return (
          <article
            key={destination.id}
            className="group rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900/95 via-slate-950 to-slate-950/95 overflow-hidden flex flex-col shadow-lg shadow-slate-950/60"
          >
            <div className="relative h-36 overflow-hidden">
              <img
                src={destination.heroImage}
                alt={destination.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <button
                type="button"
                onClick={() => onToggleSaved(destination.id)}
                className="absolute top-2 right-2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-950/80 border border-slate-700/80 text-slate-200 hover:bg-slate-900/90"
                aria-label={isSaved ? "Remove from saved" : "Save destination"}
              >
                <Heart
                  className={classNames(
                    "w-4 h-4",
                    isSaved ? "fill-rose-400 text-rose-400" : "text-slate-200"
                  )}
                />
              </button>
              <span className="absolute left-2 bottom-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-950/80 border border-slate-700/80 text-[0.65rem] text-slate-200">
                <MapPin className="w-3 h-3" /> {destination.region}
              </span>
            </div>
            <div className="flex-1 p-3 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold truncate">{destination.name}</h3>
                <span className="text-[0.7rem] text-amber-300 flex items-center gap-1">
                  ★ {destination.rating.toFixed(1)}
                </span>
              </div>
              <p className="text-[0.75rem] text-slate-300 line-clamp-2">{destination.headline}</p>
              <p className="text-[0.7rem] text-slate-400 line-clamp-2 mt-1">
                {destination.description}
              </p>

              <div className="mt-2 flex items-center justify-between text-[0.7rem] text-slate-400">
                <div className="flex gap-1 flex-wrap">
                  {destination.vibes.slice(0, 3).map((vibe) => (
                    <span
                      key={vibe}
                      className="px-2 py-0.5 rounded-full border border-slate-700/80 bg-slate-950/70 text-[0.65rem] uppercase tracking-[0.16em]"
                    >
                      {vibe}
                    </span>
                  ))}
                </div>
                <span>{"💸".repeat(destination.priceLevel)}</span>
              </div>

              <button
                type="button"
                onClick={() => onPlanFrom(destination.id)}
                className="mt-2 inline-flex items-center gap-1 text-[0.7rem] px-3 py-1.5 rounded-full border border-cyan-400/80 text-cyan-200 bg-cyan-400/10 hover:bg-cyan-400/20"
              >
                <CalendarDays className="w-3 h-3" /> Plan from here
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
