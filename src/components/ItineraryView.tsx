import { CalendarDays, MapPin, Music2, PartyPopper, Utensils, WalletCards } from "lucide-react";
import { ItineraryPlan } from "../types/travel";
import { capitalise } from "../utils/text";

interface ItineraryViewProps {
  itinerary: ItineraryPlan;
}

export function ItineraryView({ itinerary }: ItineraryViewProps) {
  const { base, days, plannerVibe, budgetPerDay, daysPlan } = itinerary;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <MapPin className="h-4 w-4 text-cyan-300" />
              {days}-day {plannerVibe === "mixed" ? "mixed-vibe" : plannerVibe} trip based in {base.name}
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Flexible sketch with daily regions, highlights, matched experiences, and suggested spend.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-right">
            <p className="text-[0.65rem] uppercase tracking-[0.2em] text-cyan-200">Activity budget</p>
            <p className="text-xl font-semibold text-slate-100">${(budgetPerDay * days).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <ol className="grid gap-3 md:grid-cols-2">
        {daysPlan.map((day) => (
          <li
            key={day.day}
            className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4 shadow shadow-slate-950/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-cyan-300">Day {day.day}</p>
                <h4 className="mt-1 text-lg font-semibold">{day.destName}</h4>
                <p className="text-xs text-slate-500">{day.destRegion}</p>
              </div>
              <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.14em] text-slate-300">
                {day.isBase ? "Base" : "Side trip"}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.14em] text-cyan-100">
                {capitalise(day.vibe)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.14em] text-emerald-100">
                <WalletCards className="h-3 w-3" /> ${day.suggestedBudget}
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-300">{day.highlight}.</p>

            {day.experience && (
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="flex gap-3">
                  <div className="mt-1">
                    {day.experience.type === "food" && <Utensils className="h-4 w-4 text-emerald-300" />}
                    {day.experience.type === "music" && <Music2 className="h-4 w-4 text-cyan-300" />}
                    {day.experience.type === "festival" && <PartyPopper className="h-4 w-4 text-amber-300" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{day.experience.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                      {day.experience.description}
                    </p>
                    <p className="mt-2 flex items-center gap-1 text-[0.68rem] text-slate-500">
                      <CalendarDays className="h-3 w-3" /> {day.experience.bestTime}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
