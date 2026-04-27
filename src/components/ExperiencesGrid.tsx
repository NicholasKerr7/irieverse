import { CalendarDays, Heart, Music2, PartyPopper, Utensils } from "lucide-react";
import { Experience } from "../types/travel";
import { classNames } from "../utils/classNames";
import { capitalise } from "../utils/text";

interface ExperiencesGridProps {
  items: Experience[];
  saved: Set<string>;
  onToggleSaved: (id: string) => void;
  onAddToTrip?: (id: string) => void;
}

export function ExperiencesGrid({ items, saved, onToggleSaved, onAddToTrip }: ExperiencesGridProps) {
  if (!items.length) {
    return (
      <p className="mt-5 text-xs text-slate-400">
        No experiences match those filters yet. Try a different type, vibe or search.
      </p>
    );
  }

  const iconForType = (type: string) => {
    if (type === "food") return <Utensils className="w-3 h-3" />;
    if (type === "music") return <Music2 className="w-3 h-3" />;
    if (type === "festival") return <PartyPopper className="w-3 h-3" />;
    return null;
  };

  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((experience) => {
        const isSaved = saved.has(experience.id);
        return (
          <article
            key={experience.id}
            className="group rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900/95 via-slate-950 to-slate-950/95 overflow-hidden flex flex-col shadow-lg shadow-slate-950/60"
          >
            <div className="relative h-32 overflow-hidden">
              <img
                src={experience.imageUrl}
                alt={experience.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <button
                type="button"
                onClick={() => onToggleSaved(experience.id)}
                className="absolute top-2 right-2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-950/80 border border-slate-700/80 text-slate-200 hover:bg-slate-900/90"
                aria-label={isSaved ? "Remove from saved" : "Save experience"}
              >
                <Heart
                  className={classNames(
                    "w-4 h-4",
                    isSaved ? "fill-rose-400 text-rose-400" : "text-slate-200"
                  )}
                />
              </button>
              <span className="absolute left-2 bottom-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-950/80 border border-slate-700/80 text-[0.65rem] text-slate-200">
                {iconForType(experience.type)}
                {capitalise(experience.type)}
              </span>
            </div>
            <div className="flex-1 p-3 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold line-clamp-2">{experience.title}</h3>
                <span className="text-[0.7rem] text-amber-300 flex items-center gap-1">
                  ★ {experience.rating.toFixed(1)}
                </span>
              </div>
              <p className="text-[0.72rem] text-slate-300 line-clamp-3">{experience.description}</p>
              <p className="text-[0.68rem] text-slate-400 mt-1">
                {experience.region} · {experience.location}
              </p>
              <div className="mt-1 flex items-center justify-between text-[0.68rem] text-slate-400">
                <span>{experience.bestTime}</span>
                <span className="text-slate-300">{experience.approxCost}</span>
              </div>
              {onAddToTrip && (
                <button
                  type="button"
                  onClick={() => onAddToTrip(experience.id)}
                  className="mt-2 inline-flex items-center justify-center gap-1 rounded-full border border-emerald-400/70 bg-emerald-400/10 px-3 py-1.5 text-[0.7rem] text-emerald-200 hover:bg-emerald-400/20"
                >
                  <CalendarDays className="w-3 h-3" /> Add to trip
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
