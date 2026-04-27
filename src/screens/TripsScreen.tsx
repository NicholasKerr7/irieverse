import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  Clock3,
  Download,
  Heart,
  MapPinned,
  Plane,
  Plus,
  Route,
  RotateCcw,
  Share2,
  Sparkles,
  Users,
  Wand2,
  WalletCards,
  X,
} from "lucide-react";
import { BookingRecommendations } from "../components/BookingRecommendations";
import { BudgetInsight } from "../components/BudgetInsight";
import { ItineraryView } from "../components/ItineraryView";
import { LiveEventsFeed } from "../components/LiveEventsFeed";
import type { MobileTabId } from "../components/mobile/BottomNav";
import { DESTINATIONS, EXPERIENCES, VIBE_OPTIONS } from "../data/content";
import { formatLocalTime, type TravelOS } from "../hooks/useTravelOS";
import type { Experience, ImportedIdea, Vibe } from "../types/travel";
import { classNames } from "../utils/classNames";

type TripsScreenProps = {
  app: TravelOS;
  onNavigate: (tab: MobileTabId) => void;
};

const WIZARD_STEPS = [
  { id: "base", label: "Choose base city" },
  { id: "dates", label: "Choose dates" },
  { id: "vibe", label: "Choose vibe" },
  { id: "budget", label: "Choose budget" },
  { id: "saved", label: "Add saved spots" },
  { id: "generate", label: "Generate itinerary" },
  { id: "share", label: "Export or share" },
] as const;

type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

export function TripsScreen({ app, onNavigate }: TripsScreenProps) {
  const [activeStep, setActiveStep] = useState<WizardStepId>("base");
  const savedDestinations = useMemo(
    () => DESTINATIONS.filter((destination) => app.savedPlaces.has(destination.id)),
    [app.savedPlaces]
  );
  const savedExperiences = useMemo(
    () => EXPERIENCES.filter((experience) => app.savedExperiences.has(experience.id)),
    [app.savedExperiences]
  );
  const importedIdeas = app.importedIdeas;
  const estimatedTotal =
    (app.perDayBudget.lodging + app.perDayBudget.dining + app.perDayBudget.experiences) * app.plannerDays +
    app.transportBudget;

  return (
    <section className="mx-auto min-h-screen max-w-7xl px-4 py-5 sm:px-6 lg:px-10">
      <header className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-slate-950/40">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative min-h-72">
            <img src={app.destination.heroImage} alt={app.destination.name} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5">
              <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/90">Trips</p>
              <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Build your Jamaica plan.</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                Step through the essentials, then review itinerary, budget, flights, events, bookings, export, and sharing.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 bg-slate-950/50 sm:grid-cols-4 lg:grid-cols-2">
            <TripMetric label="Base" value={app.destination.name} />
            <TripMetric label="Days" value={app.plannerDays.toString()} />
            <TripMetric label="Budget" value={`$${app.plannerBudget}/day`} />
            <TripMetric label="Estimate" value={`$${estimatedTotal.toLocaleString()}`} />
          </div>
        </div>
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-[22rem_1fr]">
        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-slate-500">Guided builder</p>
            <div className="mt-4 space-y-2">
              {WIZARD_STEPS.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  className={classNames(
                    "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
                    activeStep === step.id
                      ? "border-cyan-300 bg-cyan-300 text-slate-950"
                      : "border-slate-800 bg-slate-950/70 text-slate-300 hover:border-cyan-300/50"
                  )}
                >
                  <span className={classNames(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                    activeStep === step.id ? "bg-slate-950 text-cyan-200" : "bg-cyan-300 text-slate-950"
                  )}>
                    {index + 1}
                  </span>
                  <span className="flex-1 text-sm font-semibold">{step.label}</span>
                  {index < getCompletedStepIndex(app) && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>

          <WizardPanel
            app={app}
            activeStep={activeStep}
            setActiveStep={setActiveStep}
            savedDestinations={savedDestinations}
            savedExperiences={savedExperiences}
            importedIdeas={importedIdeas}
            onNavigate={onNavigate}
          />
        </aside>

        <div className="space-y-4">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-cyan-300" />
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-500">Upcoming trip</p>
                  <h2 className="text-xl font-semibold">{app.destination.name} base plan</h2>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate("saved")}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-300/60"
                >
                  <Heart className="h-3.5 w-3.5" /> Saved
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate("map")}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-300/60"
                >
                  <Route className="h-3.5 w-3.5" /> Map route
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniCard icon={WalletCards} title="Budget" body={`$${estimatedTotal.toLocaleString()} trip estimate.`} />
              <MiniCard icon={Plane} title="Flights" body={`${app.originAirport.code} to ${app.destination.airportCode}.`} />
              <MiniCard icon={Users} title="Saved" body={`${savedDestinations.length + savedExperiences.length + importedIdeas.length} ideas ready.`} />
              <MiniCard icon={Sparkles} title="Vibe" body={app.plannerVibe === "mixed" ? "Mixed island flow." : `${app.plannerVibe} focused.`} />
            </div>
          </section>

          <RoutePreviewPanel app={app} onNavigate={onNavigate} />

          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.28em] text-cyan-300/80">Daily plan</p>
                <h2 className="text-lg font-semibold">{app.plannerDays} day itinerary</h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveStep("generate")}
                className="rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300"
              >
                Tune
              </button>
            </div>
            <ItineraryView itinerary={app.itinerary} />
          </section>

          <BudgetInsight
            perDay={app.perDayBudget}
            transportPerTrip={app.transportBudget}
            days={app.plannerDays}
            vibe={app.plannerVibe}
          />

          <section className="grid gap-4 xl:grid-cols-2">
            <FlightSnapshot app={app} />
            <SharePanel app={app} />
          </section>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <BookingRecommendations
          bookings={app.bookingOptions}
          isLoading={app.isLoadingBookings}
          error={app.bookingError}
          onRefresh={app.refreshBookings}
          destinationName={app.destination.name}
        />

        <LiveEventsFeed
          events={app.liveEvents}
          isLoading={app.isLoadingEvents}
          error={app.eventsError}
          onRefresh={app.loadEvents}
          selectedRegion={app.destination.region}
        />
      </div>
    </section>
  );
}

function WizardPanel({
  app,
  activeStep,
  setActiveStep,
  savedDestinations,
  savedExperiences,
  importedIdeas,
  onNavigate,
}: {
  app: TravelOS;
  activeStep: WizardStepId;
  setActiveStep: (step: WizardStepId) => void;
  savedDestinations: typeof DESTINATIONS;
  savedExperiences: Experience[];
  importedIdeas: ImportedIdea[];
  onNavigate: (tab: MobileTabId) => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
      {activeStep === "base" && (
        <div className="space-y-3">
          <WizardTitle title="Choose base city" body="Pick the island anchor for flights, events, bookings, and route starts." />
          <PlannerSelect
            label="Base destination"
            value={app.plannerBaseId}
            onChange={app.setPlannerBaseId}
            options={DESTINATIONS.map((destination) => ({ value: destination.id, label: destination.name }))}
          />
          <PlannerSelect
            label="Origin airport"
            value={app.originAirportId}
            onChange={app.handleOriginAirportChange}
            options={app.originAirports.map((airport) => ({ value: airport.id, label: airport.name }))}
          />
        </div>
      )}

      {activeStep === "dates" && (
        <div className="space-y-3">
          <WizardTitle title="Choose dates" body="Set the start day and how many days the generated plan should cover." />
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            <span className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">Start date</span>
            <input
              type="date"
              value={app.plannerStartDate}
              onChange={(event) => app.setPlannerStartDate(event.target.value)}
              className="rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            <span className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">Days</span>
            <input
              type="number"
              min={3}
              max={14}
              value={app.plannerDays}
              onChange={(event) => app.setPlannerDays(Number(event.target.value))}
              className="rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2"
            />
          </label>
        </div>
      )}

      {activeStep === "vibe" && (
        <div className="space-y-3">
          <WizardTitle title="Choose vibe" body="Drive the daily plan toward the trip style you want." />
          <div className="grid grid-cols-2 gap-2">
            <VibeButton active={app.plannerVibe === "mixed"} label="Mixed" onClick={() => app.setPlannerVibe("mixed")} />
            {VIBE_OPTIONS.filter((option) => option.id !== "all").map((option) => (
              <VibeButton
                key={option.id}
                active={app.plannerVibe === option.id}
                label={option.label}
                onClick={() => app.setPlannerVibe(option.id as Vibe)}
              />
            ))}
          </div>
        </div>
      )}

      {activeStep === "budget" && (
        <div className="space-y-3">
          <WizardTitle title="Choose budget" body="Tune the daily target used by the budget and itinerary cards." />
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">Budget per day</span>
            <input
              type="range"
              min={75}
              max={400}
              step={25}
              value={app.plannerBudget}
              onChange={(event) => app.setPlannerBudget(Number(event.target.value))}
              className="accent-cyan-300"
            />
            <span className="text-2xl font-semibold text-cyan-200">${app.plannerBudget}</span>
          </label>
        </div>
      )}

      {activeStep === "saved" && (
        <div className="space-y-3">
          <WizardTitle title="Add saved spots" body="Saved places can become the trip base; imported ideas stay attached to this trip board." />
          <div className="space-y-2">
            {savedDestinations.slice(0, 4).map((destination) => (
              <button
                key={destination.id}
                type="button"
                onClick={() => app.setPlannerBaseId(destination.id)}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-left text-sm text-slate-200"
              >
                {destination.name}
                {app.plannerBaseId === destination.id && <Check className="h-4 w-4 text-cyan-300" />}
              </button>
            ))}
            {!savedDestinations.length && (
              <button
                type="button"
                onClick={() => onNavigate("explore")}
                className="w-full rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-400"
              >
                Browse Explore to save places
              </button>
            )}
          </div>
          {!!importedIdeas.length && (
            <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">Imported ideas</p>
              {importedIdeas.slice(0, 3).map((idea) => (
                <button
                  key={idea.id}
                  type="button"
                  onClick={() => {
                    if (idea.linkedDestinationId) {
                      app.setPlannerBaseId(idea.linkedDestinationId);
                    }
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-left"
                >
                  <span>
                    <span className="block text-sm font-semibold text-slate-200">{idea.title}</span>
                    <span className="block text-xs text-slate-500">
                      {idea.linkedDestinationId ? "Map location attached" : "Map location pending"}
                    </span>
                  </span>
                  {idea.linkedDestinationId === app.plannerBaseId && <Check className="h-4 w-4 text-cyan-300" />}
                </button>
              ))}
            </div>
          )}
          {!!savedExperiences.length && (
            <p className="text-xs text-slate-500">
              {savedExperiences.length} saved experiences and {importedIdeas.length} imported ideas will stay available for planning.
            </p>
          )}
        </div>
      )}

      {activeStep === "generate" && (
        <div className="space-y-3">
          <WizardTitle title="Generate itinerary" body="The daily plan updates live as base, dates, vibe, and budget change." />
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
            <p className="text-sm font-semibold text-slate-100">
              {app.plannerDays} days based in {app.destination.name}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {app.itinerary.daysPlan.length} daily cards generated across {app.itinerary.routeSummary.regionCount} regions,
              with {formatDriveTime(app.itinerary.routeSummary.totalDriveMinutes)} of estimated driving.
            </p>
          </div>
        </div>
      )}

      {activeStep === "share" && (
        <div className="space-y-3">
          <WizardTitle title="Export or share" body="Keep calendar export available and enable Supabase sharing when configured." />
          <button
            type="button"
            onClick={app.handleExportItinerary}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-300 px-4 py-3 text-sm font-bold text-slate-950"
          >
            <Download className="h-4 w-4" /> Export ICS
          </button>
          <button
            type="button"
            onClick={app.handleShareTrip}
            disabled={!app.collaborationReady || app.isSyncingTrip}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-cyan-300/60 px-4 py-3 text-sm font-bold text-cyan-100 disabled:opacity-50"
          >
            <Share2 className="h-4 w-4" /> {app.tripId ? "Update share link" : "Share trip"}
          </button>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setActiveStep(previousStep(activeStep))}
          className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => setActiveStep(nextStep(activeStep))}
          className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function PlannerSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-300">
      <span className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FlightSnapshot({ app }: { app: TravelOS }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/80">Flights</p>
          <h3 className="text-base font-semibold">
            {app.originAirport.code} to {app.destination.airportCode}
          </h3>
        </div>
        {app.isFetchingFlights && <span className="animate-pulse text-xs text-slate-400">Syncing gate info...</span>}
      </div>
      {app.flightsError && <p className="mt-2 text-xs text-rose-300">{app.flightsError}</p>}
      {!app.flightsError && !app.flightOptions.length && !app.isFetchingFlights && (
        <p className="mt-2 text-xs text-slate-400">
          No live flights from {app.originAirport.code} within the snapshot window.
        </p>
      )}
      <div className="mt-3 space-y-2">
        {app.flightOptions.slice(0, 3).map((flight) => (
          <div
            key={`${flight.flightNumber}-${flight.departureTimeUTC}`}
            className="flex flex-col gap-1 rounded-2xl border border-slate-800/80 bg-slate-950/70 px-4 py-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{flight.flightNumber}</p>
              <span className="text-[0.65rem] uppercase tracking-[0.2em] text-emerald-300">
                {flight.status ?? "Scheduled"}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {flight.airline} · {flight.origin} to {flight.destination}
            </p>
            <div className="flex items-center justify-between gap-3 text-[0.7rem] text-slate-300">
              <span>{formatLocalTime(flight.departureTimeUTC, app.originAirport.code)} dep</span>
              <span className="text-slate-500">to</span>
              <span>{formatLocalTime(flight.arrivalTimeUTC, app.destination.airportCode)} arr</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoutePreviewPanel({ app, onNavigate }: { app: TravelOS; onNavigate: (tab: MobileTabId) => void }) {
  const routeSummary = app.itinerary.routeSummary;
  const routedDestinationIds = new Set(routeSummary.stops.map((stop) => stop.destinationId));
  const addableSavedDestinations = DESTINATIONS.filter(
    (destination) => app.savedPlaces.has(destination.id) && !routedDestinationIds.has(destination.id)
  ).slice(0, 4);
  const canEditRoute = routeSummary.stops.length > 1;

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Route className="h-5 w-5 text-cyan-300" />
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-cyan-300/80">Route intelligence</p>
            <h2 className="text-lg font-semibold">{routeSummary.routeTone}</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={app.optimizeRouteOrder}
            disabled={!canEditRoute}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-emerald-300/50 px-4 py-2 text-xs font-bold text-emerald-100 disabled:opacity-40"
          >
            <Wand2 className="h-4 w-4" /> Optimize
          </button>
          {app.routeIsManual && (
            <button
              type="button"
              onClick={app.resetRouteOrder}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-xs font-bold text-slate-200"
            >
              <RotateCcw className="h-4 w-4" /> Auto
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate("map")}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-cyan-300/50 px-4 py-2 text-xs font-bold text-cyan-100"
          >
            <MapPinned className="h-4 w-4" /> Preview map
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <RouteStat icon={Clock3} label="Drive time" value={formatDriveTime(routeSummary.totalDriveMinutes)} />
        <RouteStat icon={Route} label="Distance" value={`${routeSummary.totalDistanceKm} km`} />
        <RouteStat
          icon={MapPinned}
          label={routeSummary.routeMode === "manual" ? "Edited route" : "Auto route"}
          value={`${routeSummary.regionCount} regions`}
        />
      </div>

      {!!routeSummary.warnings.length && (
        <div className="mt-4 grid gap-2">
          {routeSummary.warnings.slice(0, 2).map((warning) => (
            <div
              key={warning.id}
              className={classNames(
                "rounded-2xl border px-3 py-3 text-sm",
                warning.severity === "long"
                  ? "border-rose-300/30 bg-rose-300/10 text-rose-100"
                  : "border-amber-300/30 bg-amber-300/10 text-amber-100"
              )}
            >
              <div className="flex items-start gap-2">
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

      <ol className="mt-4 grid gap-2 md:grid-cols-2">
        {routeSummary.stops.map((stop, index) => (
          <li
            key={stop.destinationId}
            className={classNames(
              "flex items-center gap-3 rounded-2xl border px-3 py-3",
              stop.transferSeverity === "long"
                ? "border-rose-300/30 bg-rose-300/10"
                : stop.transferSeverity === "moderate"
                  ? "border-amber-300/30 bg-amber-300/10"
                  : "border-slate-800 bg-slate-950/70"
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-xs font-bold text-slate-950">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-100">{stop.name}</span>
              <span className="block text-xs text-slate-500">
                {stop.region} · {stop.driveMinutesFromPrevious ? formatDriveTime(stop.driveMinutesFromPrevious) : "Start"}
              </span>
            </span>
            {!stop.isBase && (
              <span className="flex shrink-0 items-center gap-1">
                <IconRouteButton
                  label="Move earlier"
                  disabled={index <= 1}
                  onClick={() => app.moveRouteStop(stop.destinationId, -1)}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </IconRouteButton>
                <IconRouteButton
                  label="Move later"
                  disabled={index >= routeSummary.stops.length - 1}
                  onClick={() => app.moveRouteStop(stop.destinationId, 1)}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </IconRouteButton>
                <IconRouteButton
                  label="Remove from route"
                  onClick={() => app.removeDestinationFromRoute(stop.destinationId)}
                >
                  <X className="h-3.5 w-3.5" />
                </IconRouteButton>
              </span>
            )}
          </li>
        ))}
      </ol>

      {!!addableSavedDestinations.length && (
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-slate-500">Add saved to route</p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {addableSavedDestinations.map((destination) => (
              <button
                key={destination.id}
                type="button"
                onClick={() => app.pinDestinationToRoute(destination.id)}
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-300/60"
              >
                <Plus className="h-3.5 w-3.5 text-cyan-300" /> {destination.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function IconRouteButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 text-slate-300 hover:border-cyan-300/60 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function RouteStat({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<LucideProps>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
      <Icon className="h-4 w-4 text-cyan-300" />
      <p className="mt-2 text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function SharePanel({ app }: { app: TravelOS }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/80">Export / Share</p>
          <h3 className="text-base font-semibold">Calendar and crew link</h3>
        </div>
        {app.isSyncingTrip && <span className="animate-pulse text-xs text-slate-400">Syncing trip...</span>}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={app.handleExportItinerary}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-400/10 px-4 py-2 text-xs font-bold text-emerald-100"
        >
          <Download className="h-4 w-4" /> Export ICS
        </button>
        <button
          type="button"
          onClick={app.handleShareTrip}
          disabled={!app.collaborationReady || app.isSyncingTrip}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-cyan-400/60 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-100 disabled:opacity-50"
        >
          <Share2 className="h-4 w-4" /> Share
        </button>
      </div>

      {!app.collaborationReady && (
        <p className="mt-3 text-xs text-slate-400">
          Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable live sharing.
        </p>
      )}
      {app.collaborationReady && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            readOnly
            value={app.tripShareUrl}
            placeholder="Create a share link to collaborate"
            className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-300"
          />
          <button
            type="button"
            onClick={app.handleCopyShareLink}
            disabled={!app.tripShareUrl}
            className="rounded-2xl border border-slate-600 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-200 disabled:opacity-40"
          >
            Copy
          </button>
        </div>
      )}
      {app.tripStatusMessage && <p className="mt-2 text-xs text-slate-400">{app.tripStatusMessage}</p>}
    </div>
  );
}

function TripMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-r border-slate-800 p-4">
      <p className="line-clamp-1 text-lg font-semibold text-cyan-200">{value}</p>
      <p className="mt-1 text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">{label}</p>
    </div>
  );
}

function MiniCard({
  icon: Icon,
  title,
  body,
}: {
  icon: ComponentType<LucideProps>;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <Icon className="h-5 w-5 text-cyan-300" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-400">{body}</p>
    </article>
  );
}

function WizardTitle({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-400">{body}</p>
    </div>
  );
}

function VibeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "rounded-2xl border px-3 py-3 text-sm font-semibold transition",
        active ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-slate-800 bg-slate-950/70 text-slate-300"
      )}
    >
      {label}
    </button>
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

function getCompletedStepIndex(app: TravelOS) {
  if (app.tripShareUrl) return 7;
  if (app.itinerary.daysPlan.length) return 6;
  if (app.savedPlaces.size || app.savedExperiences.size || app.importedIdeas.length) return 5;
  if (app.plannerBudget) return 4;
  if (app.plannerVibe) return 3;
  if (app.plannerStartDate && app.plannerDays) return 2;
  if (app.plannerBaseId) return 1;
  return 0;
}

function nextStep(step: WizardStepId): WizardStepId {
  const index = WIZARD_STEPS.findIndex((item) => item.id === step);
  return WIZARD_STEPS[Math.min(index + 1, WIZARD_STEPS.length - 1)].id;
}

function previousStep(step: WizardStepId): WizardStepId {
  const index = WIZARD_STEPS.findIndex((item) => item.id === step);
  return WIZARD_STEPS[Math.max(index - 1, 0)].id;
}
