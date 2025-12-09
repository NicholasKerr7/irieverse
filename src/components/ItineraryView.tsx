import { MapPin, Music2, PartyPopper, Utensils } from "lucide-react";
import { ItineraryPlan } from "../types/travel";
import { capitalise } from "../utils/text";

interface ItineraryViewProps {
  itinerary: ItineraryPlan;
}

export function ItineraryView({ itinerary }: ItineraryViewProps) {
  const { base, days, plannerVibe, budgetPerDay, daysPlan } = itinerary;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <MapPin className="w-3 h-3 text-cyan-300" />
          {days}-day {plannerVibe === "mixed" ? "mixed-vibe" : plannerVibe} trip based in {base.name}
        </h3>
        <p className="text-[0.7rem] text-slate-400 mt-1">
          Est. budget ~
          <span className="text-cyan-300 font-semibold"> ${budgetPerDay * days} USD</span> total for activities, food & local transport.
        </p>
        <p className="text-[0.7rem] text-slate-500 mt-1">
          Use this as a flexible sketch — swap days around, add your own finds, and adjust to real-world timings.
        </p>
      </div>

      <ol className="space-y-2">
        {daysPlan.map((day) => (
          <li
            key={day.day}
            className="rounded-xl border border-slate-700/90 bg-slate-950/80 px-3 py-2 flex flex-col gap-1"
          >
            <div className="flex items-center justify-between text-[0.7rem]">
              <div className="flex items-center gap-2">
                <span className="text-[0.65rem] tracking-[0.2em] uppercase text-slate-400">
                  Day {day.day}
                </span>
                <span className="px-2 py-0.5 rounded-full border border-slate-700/90 text-[0.62rem] uppercase tracking-[0.16em] text-slate-300">
                  {day.isBase ? "Base day" : "Side trip"}
                </span>
              </div>
              <span className="text-[0.65rem] text-slate-400">{day.destRegion}</span>
            </div>

            <p className="text-[0.8rem] font-semibold">
              {day.destName} · {capitalise(day.vibe)}
            </p>
            <p className="text-[0.72rem] text-slate-300">{day.highlight}.</p>

            {day.experience && (
              <div className="mt-1 rounded-lg bg-slate-900/90 border border-slate-700/80 px-2 py-1.5 flex gap-2 items-start">
                <div className="mt-0.5">
                  {day.experience.type === "food" && <Utensils className="w-3 h-3 text-emerald-300" />}
                  {day.experience.type === "music" && <Music2 className="w-3 h-3 text-cyan-300" />}
                  {day.experience.type === "festival" && <PartyPopper className="w-3 h-3 text-amber-300" />}
                </div>
                <div>
                  <p className="text-[0.72rem] font-medium text-slate-200">
                    {day.experience.title}
                  </p>
                  <p className="text-[0.68rem] text-slate-400 line-clamp-2">
                    {day.experience.description}
                  </p>
                </div>
              </div>
            )}

            <p className="text-[0.68rem] text-slate-400 mt-1">
              Suggested spend: ~${day.suggestedBudget} USD for this day.
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
