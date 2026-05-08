import { AlertTriangle, CalendarDays, Clock3, CloudSun, Gauge, Lock, MapPin, Music2, PartyPopper, Route, Sparkles, StickyNote, Unlock, Utensils, WalletCards, X } from "lucide-react";
import { DESTINATIONS } from "../data/content";
import type { ImportedIdea, ImportedIdeaDayAssignments, ItineraryPlan } from "../types/travel";
import { classNames } from "../utils/classNames";
import { getBoardIdeasForDestination } from "../utils/boardIdeas";
import { getExperienceOptionsForDay } from "../utils/dayExperienceOptions";
import { getDayPlanningReasons, type DayPlanningReasonTone } from "../utils/dayPlanningReasons";
import { formatDriveTime } from "../utils/format";
import { glassCard, glassControlMuted } from "../utils/glass";
import { capitalise } from "../utils/text";

interface ItineraryViewProps {
  itinerary: ItineraryPlan;
  dayExperienceOverrides?: Record<string, string>;
  savedPlaceIds?: Set<string>;
  savedExperienceIds?: Set<string>;
  importedIdeas?: ImportedIdea[];
  importedIdeaDayAssignments?: ImportedIdeaDayAssignments;
  dayNotes?: Record<string, string>;
  lockedRouteDestinationIds?: string[];
  onSetRouteStopForDay?: (day: number, destinationId: string) => void;
  onToggleRouteStopLock?: (destinationId: string) => void;
  onSetDayExperience?: (day: number, experienceId: string) => void;
  onClearDayExperience?: (day: number) => void;
  onRefreshDayExperience?: (day: number) => void;
  onSetDayNote?: (day: number, note: string) => void;
  onClearDayNote?: (day: number) => void;
  onAssignImportedIdeaToDay?: (ideaId: string, day: number) => void;
  onClearImportedIdeaDayAssignment?: (ideaId: string) => void;
}

export function ItineraryView({
  itinerary,
  dayExperienceOverrides = {},
  savedPlaceIds = new Set(),
  savedExperienceIds = new Set(),
  importedIdeas = [],
  importedIdeaDayAssignments = {},
  dayNotes = {},
  lockedRouteDestinationIds = [],
  onSetRouteStopForDay,
  onToggleRouteStopLock,
  onSetDayExperience,
  onClearDayExperience,
  onRefreshDayExperience,
  onSetDayNote,
  onClearDayNote,
  onAssignImportedIdeaToDay,
  onClearImportedIdeaDayAssignment,
}: ItineraryViewProps) {
  const { base, days, plannerVibe, budgetPerDay, daysPlan, routeSummary } = itinerary;
  const canEditExperiences = Boolean(onSetDayExperience && onClearDayExperience);
  const canRefreshExperiences = Boolean(onRefreshDayExperience);
  const canEditNotes = Boolean(onSetDayNote && onClearDayNote);
  const lockedDestinationIds = new Set(lockedRouteDestinationIds);

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
              Region-aware route with weather-aware pacing, matched experiences, drive estimates, and suggested spend.
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
        {daysPlan.map((day) => {
          const experienceOverrideId = dayExperienceOverrides[String(day.day)] ?? "";
          const experienceOptions = getExperienceOptionsForDay(day, 8, savedExperienceIds);
          const dayNote = dayNotes[String(day.day)] ?? "";
          const experienceIsSaved = Boolean(day.experience && savedExperienceIds.has(day.experience.id));
          const boardIdeas = getBoardIdeasForDestination({
            destinationId: day.destinationId,
            savedPlaceIds,
            savedExperienceIds,
            importedIdeas,
            importedIdeaDayAssignments,
            day: day.day,
          });
          const planningReasons = getDayPlanningReasons(day, boardIdeas.length);
          const routeStopForDay = routeSummary.stops.find((stop) => stop.day === day.day);
          const canEditRouteStop = Boolean(onSetRouteStopForDay && routeStopForDay);
          const canToggleRouteStopLock = Boolean(onToggleRouteStopLock && routeStopForDay && !day.isBase);
          const isRouteStopLocked = lockedDestinationIds.has(day.destinationId);

          return (
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
              {day.weather && (
                <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-sky-300/20 bg-sky-300/10 px-2.5 py-1 text-[0.68rem] text-sky-100">
                  <CloudSun className="h-3 w-3 shrink-0" />
                  <span className="truncate">{day.weather.summary}</span>
                </span>
              )}
            </div>

            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {day.routeNote}
              {day.distanceFromPreviousKm ? ` · ${day.distanceFromPreviousKm} km from previous stop` : ""}
            </p>
            {(canEditRouteStop || canToggleRouteStopLock) && (
              <div className={classNames("mt-3 grid gap-2 rounded-2xl p-3 sm:grid-cols-[minmax(0,1fr)_auto]", glassControlMuted)}>
                {canEditRouteStop && (
                  <label className="min-w-0">
                    <span className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">
                      {day.day === 1 ? "Base area" : "Day area"}
                    </span>
                    <select
                      value={day.destinationId}
                      onChange={(event) => onSetRouteStopForDay?.(day.day, event.target.value)}
                      disabled={isRouteStopLocked}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-200 disabled:opacity-50"
                    >
                      {DESTINATIONS.map((destination) => (
                        <option key={destination.id} value={destination.id}>
                          {destination.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {canToggleRouteStopLock && (
                  <button
                    type="button"
                    onClick={() => onToggleRouteStopLock?.(day.destinationId)}
                    className={classNames(
                      "inline-flex min-h-10 items-center justify-center gap-2 self-end rounded-full border px-3 py-2 text-xs font-bold",
                      isRouteStopLocked
                        ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-100"
                        : "border-slate-700 text-slate-200"
                    )}
                  >
                    {isRouteStopLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {isRouteStopLocked ? "Unlock day" : "Keep day"}
                  </button>
                )}
              </div>
            )}
            {day.weatherNote && (
              <p className="mt-3 flex gap-2 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs leading-5 text-sky-100">
                <CloudSun className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{day.weatherNote}</span>
              </p>
            )}
            <p className="mt-4 text-sm leading-6 text-slate-300">{day.highlight}.</p>

            {(canEditNotes || dayNote) && (
              <div className={classNames("mt-3 rounded-2xl p-3", glassControlMuted)}>
                <label className="block">
                  <span className="inline-flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">
                    <StickyNote className="h-3.5 w-3.5 text-cyan-300" /> Day note
                  </span>
                  {canEditNotes ? (
                    <textarea
                      value={dayNote}
                      onChange={(event) => onSetDayNote?.(day.day, event.target.value)}
                      maxLength={280}
                      rows={2}
                      placeholder="Add reservation times, pickup notes, must-do stops, or reminders."
                      className="mt-2 w-full resize-none rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs leading-5 text-slate-200 placeholder:text-slate-600 focus:outline-none"
                    />
                  ) : (
                    <p className="mt-2 text-xs leading-5 text-slate-300">{dayNote}</p>
                  )}
                </label>
                {canEditNotes && (
                  <div className="mt-2 flex items-center justify-between gap-2 text-[0.68rem] text-slate-500">
                    <span>{dayNote.length}/280</span>
                    {dayNote && (
                      <button
                        type="button"
                        onClick={() => onClearDayNote?.(day.day)}
                        className="font-semibold text-slate-300 hover:text-cyan-100"
                      >
                        Clear note
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {!!planningReasons.length && (
              <div className="mt-3 grid gap-2">
                <p className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">Why this day</p>
                {planningReasons.slice(0, 3).map((reason) => (
                  <PlanningReasonPill key={reason.id} reason={reason} />
                ))}
              </div>
            )}

            {!!boardIdeas.length && (
              <div className={classNames("mt-3 rounded-2xl p-3", glassControlMuted)}>
                <p className="text-[0.62rem] uppercase tracking-[0.18em] text-cyan-300/80">From your board</p>
                <div className="mt-2 grid gap-2">
                  {boardIdeas.slice(0, 3).map((idea) => (
                    <div key={idea.id} className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 line-clamp-1 text-xs font-semibold text-slate-100">{idea.title}</p>
                        {idea.exactPlace && (
                          <span className="shrink-0 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.12em] text-cyan-100">
                            Exact stop
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[0.68rem] text-slate-500">{idea.meta}</p>
                      {idea.importedIdeaId && onAssignImportedIdeaToDay && onClearImportedIdeaDayAssignment && (
                        <label className="mt-2 block">
                          <span className="sr-only">Move {idea.title} to day</span>
                          <select
                            value={idea.assignedDay ? String(idea.assignedDay) : ""}
                            onChange={(event) => {
                              if (event.target.value) {
                                onAssignImportedIdeaToDay(idea.importedIdeaId!, Number(event.target.value));
                              } else {
                                onClearImportedIdeaDayAssignment(idea.importedIdeaId!);
                              }
                            }}
                            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-2 py-1.5 text-[0.68rem] font-semibold text-slate-300"
                            aria-label={`Move ${idea.title} to day`}
                          >
                            <option value="">Auto day</option>
                            {Array.from({ length: days }, (_, index) => index + 1).map((dayOption) => (
                              <option key={dayOption} value={dayOption}>
                                Day {dayOption}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {day.experience && (
              <div className={classNames("mt-4 rounded-2xl p-3", glassControlMuted)}>
                <div className="flex gap-3">
                  <div className="mt-1">
                    {day.experience.type === "food" && <Utensils className="h-4 w-4 text-emerald-300" />}
                    {day.experience.type === "music" && <Music2 className="h-4 w-4 text-cyan-300" />}
                    {day.experience.type === "festival" && <PartyPopper className="h-4 w-4 text-amber-300" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-100">{day.experience.title}</p>
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-slate-400">
                        {experienceOverrideId ? "Picked" : experienceIsSaved ? "Saved idea" : "Best match"}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                      {day.experience.description}
                    </p>
                    <p className="mt-2 flex items-center gap-1 text-[0.68rem] text-slate-500">
                      <CalendarDays className="h-3 w-3" /> {day.experience.bestTime}
                    </p>
                  </div>
                </div>
                {(canEditExperiences || canRefreshExperiences) && experienceOptions.length > 0 && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <label className="min-w-0">
                      <span className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">Swap add-on</span>
                      <select
                        value={experienceOverrideId}
                        onChange={(event) => {
                          if (event.target.value) {
                            onSetDayExperience?.(day.day, event.target.value);
                          } else {
                            onClearDayExperience?.(day.day);
                          }
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-200"
                      >
                        <option value="">Use best match</option>
                        {experienceOptions.map((experience) => (
                          <option key={experience.id} value={experience.id}>
                            {experience.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    {canRefreshExperiences && (
                      <button
                        type="button"
                        onClick={() => onRefreshDayExperience?.(day.day)}
                        className="inline-flex min-h-10 items-center justify-center gap-1 self-end rounded-xl border border-cyan-300/40 px-3 py-2 text-xs font-semibold text-cyan-100"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Try another
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onClearDayExperience?.(day.day)}
                      disabled={!experienceOverrideId}
                      className="inline-flex min-h-10 items-center justify-center gap-1 self-end rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 disabled:opacity-40"
                    >
                      <X className="h-3.5 w-3.5" /> Use auto
                    </button>
                  </div>
                )}
              </div>
            )}
            </li>
          );
        })}
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

function PlanningReasonPill({
  reason,
}: {
  reason: { label: string; body: string; tone: DayPlanningReasonTone };
}) {
  return (
    <div
      className={classNames(
        "rounded-2xl border px-3 py-2 text-xs leading-5",
        reason.tone === "board"
          ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
          : reason.tone === "weather"
            ? "border-sky-300/25 bg-sky-300/10 text-sky-100"
            : reason.tone === "experience"
              ? "border-violet-300/25 bg-violet-300/10 text-violet-100"
              : "border-slate-700 bg-slate-950/50 text-slate-300"
      )}
    >
      <span className="font-semibold text-slate-100">{reason.label}</span>
      <span className="mt-0.5 block text-slate-400">{reason.body}</span>
    </div>
  );
}

function getPacingLabel(totalDriveMinutes: number, days: number): string {
  const averageDrive = days ? totalDriveMinutes / days : 0;
  if (averageDrive > 110) return "Ambitious";
  if (averageDrive > 55) return "Balanced";
  return "Relaxed";
}
