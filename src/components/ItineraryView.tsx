import { AlertTriangle, CalendarDays, Clock3, Gauge, MapPin, Music2, PartyPopper, Route, Utensils, WalletCards } from "lucide-react";
import { ItineraryPlan } from "../types/travel";
import { classNames } from "../utils/classNames";
import { glassCard, glassControlMuted } from "../utils/glass";
import { capitalise } from "../utils/text";

interface ItineraryViewProps {
  itinerary: ItineraryPlan;
}

export function ItineraryView({ itinerary }: ItineraryViewProps) {
  const { base, days, plannerVibe, budgetPerDay, daysPlan, routeSummary } = itinerary;

  return (
    <div className="space-y-4">
      <div className={classNames("rounded-2xl p-4", glassCard)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <MapPin className="h-4 w-4 text-cyan-300" />
              {days}-day {plannerVibe === "mixed" ? "mixed-vibe" : plannerVibe} trip based in {base.name}
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Region-aware route with daily highlights, matched experiences, drive estimates, and suggested spend.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-right">
            <p className="text-[0.65rem] uppercase tracking-[0.2em] text-cyan-200">Activity budget</p>
            <p className="text-xl font-semibold text-slate-100">${(budgetPerDay * days).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <RouteMetric
          icon={Route}
          label="Route"
          value={routeSummary.routeTone}
          helper={`${routeSummary.stops.length} stops · ${routeSummary.regionCount} regions`}
        />
        <RouteMetric
          icon={Clock3}
          label="Driving"
          value={formatDriveTime(routeSummary.totalDriveMinutes)}
          helper={`${routeSummary.totalDistanceKm} km estimated`}
        />
        <RouteMetric
          icon={Gauge}
          label="Pacing"
          value={getPacingLabel(routeSummary.totalDriveMinutes, days)}
          helper={routeSummary.warnings.length ? `${routeSummary.warnings.length} transfer flags` : "High-energy days get recovery space"}
        />
      </div>

      {!!routeSummary.warnings.length && (
        <div className="grid gap-2">
          {routeSummary.warnings.slice(0, 2).map((warning) => (
            <div
              key={warning.id}
              className="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100"
            >
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">{warning.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{warning.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ol className="grid gap-3 md:grid-cols-2">
        {daysPlan.map((day) => (
          <li
            key={day.day}
            className={[
              "rounded-2xl border p-4 shadow shadow-slate-950/30",
              day.transferSeverity === "long"
                ? "border-rose-300/30 bg-rose-300/10"
                : day.transferSeverity === "moderate"
                  ? "border-amber-300/30 bg-amber-300/10"
                  : "border-white/10 bg-white/[0.045] backdrop-blur-xl",
            ].join(" ")}
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
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.14em] text-slate-300">
                <Clock3 className="h-3 w-3" />
                {day.driveMinutesFromPrevious ? formatDriveTime(day.driveMinutesFromPrevious) : "Arrival"}
              </span>
              {day.transferSeverity !== "easy" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.14em] text-amber-100">
                  <AlertTriangle className="h-3 w-3" /> {day.transferSeverity} transfer
                </span>
              )}
              <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.14em] text-violet-100">
                {day.energyLevel}
              </span>
            </div>

            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {day.routeNote}
              {day.distanceFromPreviousKm ? ` · ${day.distanceFromPreviousKm} km from previous stop` : ""}
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-300">{day.highlight}.</p>

            {day.experience && (
              <div className={classNames("mt-4 rounded-2xl p-3", glassControlMuted)}>
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

function RouteMetric({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof Route;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className={classNames("rounded-2xl p-4", glassCard)}>
      <Icon className="h-4 w-4 text-cyan-300" />
      <p className="mt-3 text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <h3 className="mt-1 text-sm font-semibold text-slate-100">{value}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
    </article>
  );
}

function formatDriveTime(minutes: number): string {
  if (!minutes) return "0 min";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  if (!remainder) return `${hours} hr`;
  return `${hours} hr ${remainder} min`;
}

function getPacingLabel(totalDriveMinutes: number, days: number): string {
  const averageDrive = days ? totalDriveMinutes / days : 0;
  if (averageDrive > 110) return "Ambitious";
  if (averageDrive > 55) return "Balanced";
  return "Relaxed";
}
