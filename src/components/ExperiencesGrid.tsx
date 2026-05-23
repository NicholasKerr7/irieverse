import {
  CalendarDays,
  Clock,
  Landmark,
  Gauge,
  Heart,
  MapPin,
  Music2,
  Palmtree,
  PartyPopper,
  Star,
  Ticket,
  TreePalm,
  Utensils,
  WalletCards,
} from "lucide-react";
import { EmptyStatePanel } from "./LoadingStates";
import { SafeImage } from "./SafeImage";
import type { EntryRequirement, Experience } from "../types/travel";
import { classNames } from "../utils/classNames";
import { glassCard, glassControlMuted } from "../utils/glass";
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
      <EmptyStatePanel
        icon={Music2}
        eyebrow="Experiences"
        title="No experiences matched"
        body="Try another type, vibe, or search. Food runs, music nights, culture stops, and beach days can still be added to the trip."
        tone="info"
        className="mt-5"
      />
    );
  }

  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((experience) => {
        const isSaved = saved.has(experience.id);

        return (
          <article
            key={experience.id}
            className={classNames("group overflow-hidden rounded-[1.35rem] transition duration-300 hover:-translate-y-0.5 hover:border-emerald-300/35", glassCard)}
          >
            <div className="relative h-48 overflow-hidden">
              <SafeImage
                src={experience.imageUrl}
                alt={experience.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent" />
              <button
                type="button"
                onClick={() => onToggleSaved(experience.id)}
                className={classNames(
                  "absolute right-3 top-3 inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs font-semibold backdrop-blur transition",
                  isSaved
                    ? "border-rose-300/50 bg-rose-400/20 text-rose-100"
                    : "border-white/15 bg-slate-950/65 text-slate-100 hover:border-emerald-300/60"
                )}
                aria-label={isSaved ? "Remove from saved" : "Save experience"}
              >
                <Heart className={classNames("h-4 w-4", isSaved ? "fill-rose-300 text-rose-300" : "")} />
                {isSaved ? "Saved" : "Save"}
              </button>
              <div className="media-overlay absolute bottom-4 left-4 right-4">
                <p className="inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-slate-950/65 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100 backdrop-blur">
                  {iconForType(experience.type)}
                  {capitalise(experience.type)}
                </p>
                <h3 className="mt-2 text-xl font-semibold leading-tight text-white">{experience.title}</h3>
              </div>
            </div>

            <div className="flex min-h-[15rem] flex-col p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="flex min-w-0 items-center gap-1 text-xs text-slate-400">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                  <span className="truncate">{experience.region} · {experience.location}</span>
                </p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-200">
                  <Star className="h-4 w-4 fill-current" /> {experience.rating.toFixed(1)}
                </span>
              </div>

              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{experience.description}</p>

              <dl className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                <ExperienceFact icon={Gauge} label="Energy" value={experience.energy} />
                <ExperienceFact icon={Clock} label="Best time" value={experience.bestTime} />
                <ExperienceFact icon={WalletCards} label="Cost" value={experience.approxCost} />
              </dl>

              <EntryRequirementPill requirement={experience.entryRequirement} />

              <button
                type="button"
                onClick={() => onAddToTrip?.(experience.id)}
                disabled={!onAddToTrip}
                className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-emerald-300/70 bg-emerald-300/10 px-4 py-2 text-xs font-bold text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CalendarDays className="h-4 w-4" /> Add to trip
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function EntryRequirementPill({ requirement }: { requirement: EntryRequirement | undefined }) {
  if (!requirement) return null;

  return (
    <div className="mt-3 rounded-2xl border border-slate-700/80 bg-slate-950/45 px-3 py-2">
      <p className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-amber-100">
        <Ticket className="h-3.5 w-3.5" />
        {requirement.label}
      </p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{requirement.note}</p>
    </div>
  );
}

function ExperienceFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
}) {
  return (
    <div className={classNames("rounded-xl p-2", glassControlMuted)}>
      <dt className="flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.12em] text-slate-500">
        <Icon className="h-3 w-3" /> {label}
      </dt>
      <dd className="mt-1 line-clamp-2 font-semibold text-slate-200">{value}</dd>
    </div>
  );
}

function iconForType(type: string) {
  if (type === "food") return <Utensils className="h-3.5 w-3.5" />;
  if (type === "music") return <Music2 className="h-3.5 w-3.5" />;
  if (type === "festival") return <PartyPopper className="h-3.5 w-3.5" />;
  if (type === "nature") return <TreePalm className="h-3.5 w-3.5" />;
  if (type === "heritage") return <Landmark className="h-3.5 w-3.5" />;
  if (type === "beach") return <Palmtree className="h-3.5 w-3.5" />;
  return null;
}
