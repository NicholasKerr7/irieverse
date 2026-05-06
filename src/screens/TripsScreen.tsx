import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BedDouble,
  CalendarDays,
  Check,
  CheckCircle2,
  CloudOff,
  CloudSun,
  Clock3,
  Download,
  Heart,
  Link,
  Lock,
  MapPinned,
  Plane,
  Plus,
  Route,
  RotateCcw,
  Share2,
  Sparkles,
  StickyNote,
  Unlock,
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
import { PLANNING_MODE_LABELS } from "../data/plannerTemplates";
import { formatLocalTime, type TravelOS } from "../hooks/useTravelOS";
import type { Experience, ImportedIdea, PlanningMode, PlanningTemplate, RouteStop, Vibe } from "../types/travel";
import { classNames } from "../utils/classNames";
import { getExperienceOptionsForDay } from "../utils/dayExperienceOptions";
import { getDayPlanningReasons, type DayPlanningReasonTone } from "../utils/dayPlanningReasons";
import { formatDriveTime } from "../utils/format";
import { glassCard, glassControlMuted, glassPanel, glassPanelStrong } from "../utils/glass";

type TripsScreenProps = {
  app: TravelOS;
  onNavigate: (tab: MobileTabId) => void;
};

const WIZARD_STEPS = [
  { id: "base", label: "Choose start" },
  { id: "dates", label: "Set timing" },
  { id: "vibe", label: "Choose vibe" },
  { id: "budget", label: "Choose budget" },
  { id: "saved", label: "Add ideas" },
  { id: "generate", label: "Generate itinerary" },
  { id: "share", label: "Export or share" },
] as const;

type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];
type BuilderLane = "quick" | "full";
type PlanCheckTone = "ready" | "watch" | "action";
type PlanCheckAction = "saved" | "map" | "smooth-route";
type PlanCheck = {
  id: string;
  title: string;
  body: string;
  tone: PlanCheckTone;
  action?: PlanCheckAction;
  actionLabel?: string;
};

export function TripsScreen({ app, onNavigate }: TripsScreenProps) {
  const [activeStep, setActiveStep] = useState<WizardStepId>("base");
  const [builderLane, setBuilderLane] = useState<BuilderLane>(() => getDefaultBuilderLane(app.planningMode));
  const savedDestinations = useMemo(
    () => DESTINATIONS.filter((destination) => app.savedPlaces.has(destination.id)),
    [app.savedPlaces]
  );
  const savedExperiences = useMemo(
    () => EXPERIENCES.filter((experience) => app.savedExperiences.has(experience.id)),
    [app.savedExperiences]
  );
  const importedIdeas = app.importedIdeas;
  const weatherReadyDays = app.itinerary.daysPlan.filter((day) => day.weather || day.weatherNote).length;
  const estimatedTotal =
    (app.perDayBudget.lodging + app.perDayBudget.dining + app.perDayBudget.experiences) * app.plannerDays +
    app.transportBudget;

  useEffect(() => {
    setBuilderLane(getDefaultBuilderLane(app.planningMode));
  }, [app.planningMode]);

  return (
    <section className="mx-auto min-h-screen max-w-7xl px-4 py-5 sm:px-6 lg:px-10">
      <header className={classNames("overflow-hidden rounded-3xl", glassPanel)}>
        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative min-h-72">
            <img src={app.destination.heroImage} alt={app.destination.name} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5">
              <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/90">
                {PLANNING_MODE_LABELS[app.planningMode].label} plan
              </p>
              <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{getTripHeroTitle(app.planningMode)}</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                {getTripHeroBody(app.planningMode)}
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

      <PlanLaneSwitch activeLane={builderLane} onChange={setBuilderLane} planningMode={app.planningMode} />

      {builderLane === "quick" ? (
        <QuickPlanExperience
          app={app}
          onNavigate={onNavigate}
          savedDestinations={savedDestinations}
          savedExperiences={savedExperiences}
          importedIdeas={importedIdeas}
        />
      ) : (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-[22rem_1fr]">
            <aside className="min-w-0 space-y-4">
              <TemplateQuickStartPanel app={app} />

              <div className={classNames("rounded-3xl p-4", glassPanel)}>
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
                          : `${glassControlMuted} text-slate-300 hover:border-cyan-300/50`
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

            <div className="min-w-0 space-y-4">
              <section className={classNames("rounded-3xl p-4", glassPanel)}>
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
                  <MiniCard
                    icon={Route}
                    title="Road pacing"
                    body={`${formatDriveTime(app.itinerary.routeSummary.totalDriveMinutes)} across ${app.itinerary.routeSummary.regionCount} regions.`}
                  />
                  <MiniCard
                    icon={CloudSun}
                    title="Weather cues"
                    body={
                      weatherReadyDays
                        ? `${weatherReadyDays} days checked for rain, heat, and outdoor timing.`
                        : "Daily plan adapts when weather is available."
                    }
                  />
                  <MiniCard
                    icon={Users}
                    title="Local ideas"
                    body={`${savedDestinations.length + savedExperiences.length + importedIdeas.length} saved places, experiences, and imports.`}
                  />
                  <MiniCard icon={WalletCards} title="Budget" body={`$${estimatedTotal.toLocaleString()} trip estimate.`} />
                </div>
              </section>

              <BoardTripContextPanel app={app} onNavigate={onNavigate} />

              <PlanCheckPanel app={app} onNavigate={onNavigate} />

              <RoutePreviewPanel app={app} onNavigate={onNavigate} />

              <IntegrationStatusPanel app={app} />

              <section className={classNames("rounded-3xl p-4", glassPanel)}>
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
                <ItineraryView
                  itinerary={app.itinerary}
                  dayExperienceOverrides={app.dayExperienceOverrides}
                  savedPlaceIds={app.savedPlaces}
                  savedExperienceIds={app.savedExperiences}
                  importedIdeas={app.importedIdeas}
                  dayNotes={app.dayNotes}
                  lockedRouteDestinationIds={app.lockedRouteDestinationIds}
                  onSetRouteStopForDay={app.setRouteStopForDay}
                  onToggleRouteStopLock={app.toggleRouteStopLock}
                  onSetDayExperience={app.setDayExperience}
                  onClearDayExperience={app.clearDayExperience}
                  onRefreshDayExperience={app.refreshDayExperience}
                  onSetDayNote={app.setDayNote}
                  onClearDayNote={app.clearDayNote}
                />
              </section>

              <BudgetInsight
                perDay={app.perDayBudget}
                transportPerTrip={app.transportBudget}
                days={app.plannerDays}
                vibe={app.plannerVibe}
              />

              <section className="grid gap-4 xl:grid-cols-2">
                {app.planningMode === "local" ? <LocalPlanSnapshot app={app} /> : <FlightSnapshot app={app} />}
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
              sourceMeta={app.bookingSourceMeta}
            />

            <LiveEventsFeed
              events={app.liveEvents}
              isLoading={app.isLoadingEvents}
              error={app.eventsError}
              onRefresh={app.loadEvents}
              selectedRegion={app.destination.region}
            />
          </div>
        </>
      )}
    </section>
  );
}

function PlanLaneSwitch({
  activeLane,
  onChange,
  planningMode,
}: {
  activeLane: BuilderLane;
  onChange: (lane: BuilderLane) => void;
  planningMode: PlanningMode;
}) {
  return (
    <div className="mt-5 grid gap-3 lg:grid-cols-2">
      <LaneButton
        icon={Sparkles}
        active={activeLane === "quick"}
        title="Quick Plan"
        eyebrow={planningMode === "visitor" ? "Day plan" : "Recommended"}
        body="For today, this weekend, food runs, river days, date nights, and hosting plans. No flight or booking clutter."
        onClick={() => onChange("quick")}
      />
      <LaneButton
        icon={CalendarDays}
        active={activeLane === "full"}
        title="Full Trip"
        eyebrow={planningMode === "visitor" ? "Recommended" : "Multi-day"}
        body="For full visitor itineraries with flights, stays, events, budget cards, sharing, and the complete guided builder."
        onClick={() => onChange("full")}
      />
    </div>
  );
}

function LaneButton({
  icon: Icon,
  active,
  title,
  eyebrow,
  body,
  onClick,
}: {
  icon: ComponentType<LucideProps>;
  active: boolean;
  title: string;
  eyebrow: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "min-h-32 rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/60",
        active ? "border-cyan-300/55 bg-cyan-300/12 shadow-xl shadow-cyan-950/25" : glassPanel
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="text-[0.62rem] font-bold uppercase tracking-[0.22em] text-cyan-300/85">{eyebrow}</span>
          <span className="mt-1 block text-lg font-semibold text-slate-100">{title}</span>
        </span>
        <span className={classNames("flex h-10 w-10 items-center justify-center rounded-2xl", active ? "bg-cyan-300 text-slate-950" : "bg-slate-950/70 text-cyan-300")}>
          <Icon className="h-5 w-5" />
        </span>
      </span>
      <span className="mt-3 block text-sm leading-6 text-slate-400">{body}</span>
    </button>
  );
}

function QuickPlanExperience({
  app,
  onNavigate,
  savedDestinations,
  savedExperiences,
  importedIdeas,
}: {
  app: TravelOS;
  onNavigate: (tab: MobileTabId) => void;
  savedDestinations: typeof DESTINATIONS;
  savedExperiences: Experience[];
  importedIdeas: ImportedIdea[];
}) {
  const estimatedTotal =
    (app.perDayBudget.dining + app.perDayBudget.experiences) * app.plannerDays +
    app.transportBudget;
  const weatherReadyDays = app.itinerary.daysPlan.filter((day) => day.weather || day.weatherNote).length;

  return (
    <div className="mt-5 space-y-4">
      <section className={classNames("overflow-hidden rounded-3xl", glassPanel)}>
        <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/80">Quick Plan</p>
                <h2 className="mt-1 text-2xl font-semibold">Build the day around what matters.</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Start with a Jamaica template, pick timing, tune vibe and budget, then preview the route. Navigation stays a handoff.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate("saved")}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-cyan-300/45 px-4 py-2 text-xs font-bold text-cyan-100"
              >
                <Heart className="h-4 w-4" /> Add ideas
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <QuickTemplatePicker app={app} />
              <QuickPlanControls app={app} />
            </div>
          </div>

          <div className="border-t border-slate-800 bg-slate-950/45 p-4 sm:p-5 lg:border-l lg:border-t-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.26em] text-slate-500">Ready plan</p>
                <h3 className="text-xl font-semibold">{app.destination.name}</h3>
              </div>
              <span className="rounded-full border border-cyan-300/35 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-cyan-100">
                {app.plannerDays} day{app.plannerDays === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <RouteStat icon={Clock3} label="Drive time" value={formatDriveTime(app.itinerary.routeSummary.totalDriveMinutes)} />
              <RouteStat icon={Route} label="Distance" value={`${app.itinerary.routeSummary.totalDistanceKm} km`} />
              <RouteStat icon={CloudSun} label="Weather" value={weatherReadyDays ? `${weatherReadyDays} days` : "Pending"} />
              <RouteStat icon={WalletCards} label="Estimate" value={`$${estimatedTotal.toLocaleString()}`} />
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onNavigate("map")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950"
              >
                <MapPinned className="h-4 w-4" /> Preview map
              </button>
              <button
                type="button"
                onClick={app.handleExportItinerary}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-emerald-300/50 px-4 py-2 text-xs font-bold text-emerald-100"
              >
                <Download className="h-4 w-4" /> Export
              </button>
            </div>
          </div>
        </div>
      </section>

      <BoardTripContextPanel app={app} onNavigate={onNavigate} />

      <PlanCheckPanel app={app} onNavigate={onNavigate} />

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <QuickRoutePanel app={app} onNavigate={onNavigate} />
        <QuickDailyPlanPanel app={app} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <QuickSavedIdeasPanel
          savedDestinations={savedDestinations}
          savedExperiences={savedExperiences}
          importedIdeas={importedIdeas}
          onExplore={() => onNavigate("explore")}
          onSaved={() => onNavigate("saved")}
        />
        <SharePanel app={app} />
      </section>
    </div>
  );
}

function QuickTemplatePicker({ app }: { app: TravelOS }) {
  const templates = getQuickPlanTemplates(app);

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-[0.65rem] uppercase tracking-[0.24em] text-slate-500">1. Pick the shape</p>
      <div className="mt-3 grid gap-2">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => app.applyPlanningTemplate(template.id)}
            className={classNames(
              "rounded-2xl border p-3 text-left transition hover:border-cyan-300/60",
              app.planningTemplateId === template.id
                ? "border-cyan-300/45 bg-cyan-300/10"
                : "border-slate-800 bg-slate-950/70"
            )}
          >
            <span className="text-[0.62rem] uppercase tracking-[0.18em] text-cyan-300/80">{template.eyebrow}</span>
            <span className="mt-1 block text-sm font-semibold text-slate-100">{template.title}</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">{template.body}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickPlanControls({ app }: { app: TravelOS }) {
  const quickVibes: Vibe[] = ["authentic", "chill", "adventure", "culture", "nightlife", "romantic"];
  const budgetOptions = [65, 100, 150, 225];

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-[0.65rem] uppercase tracking-[0.24em] text-slate-500">2. Tune it fast</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <QuickControlButton
          label="Today"
          body="1 day"
          active={app.plannerDays === 1 && app.plannerStartDate === getTodayISODate()}
          onClick={() => {
            app.setPlannerStartDate(getTodayISODate());
            app.setPlannerDays(1);
          }}
        />
        <QuickControlButton
          label="This weekend"
          body="2 days"
          active={app.plannerDays === 2 && app.plannerStartDate === getNextWeekendISODate()}
          onClick={() => {
            app.setPlannerStartDate(getNextWeekendISODate());
            app.setPlannerDays(2);
          }}
        />
      </div>

      <p className="mt-4 text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">Vibe</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {quickVibes.map((vibe) => (
          <button
            key={vibe}
            type="button"
            onClick={() => app.setPlannerVibe(vibe)}
            className={classNames(
              "rounded-full border px-3 py-2 text-xs font-semibold transition",
              app.plannerVibe === vibe
                ? "border-cyan-300 bg-cyan-300 text-slate-950"
                : "border-slate-700 text-slate-300 hover:border-cyan-300/60"
            )}
          >
            {formatVibeLabel(vibe)}
          </button>
        ))}
      </div>

      <p className="mt-4 text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">Budget</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {budgetOptions.map((budget) => (
          <button
            key={budget}
            type="button"
            onClick={() => app.setPlannerBudget(budget)}
            className={classNames(
              "rounded-2xl border px-2 py-2 text-xs font-bold transition",
              app.plannerBudget === budget
                ? "border-emerald-300 bg-emerald-300 text-slate-950"
                : "border-slate-700 text-slate-300 hover:border-emerald-300/60"
            )}
          >
            ${budget}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickControlButton({
  label,
  body,
  active,
  onClick,
}: {
  label: string;
  body: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "rounded-2xl border p-3 text-left transition hover:border-cyan-300/60",
        active ? "border-cyan-300/45 bg-cyan-300/10" : "border-slate-800 bg-slate-950/70"
      )}
    >
      <span className="block text-sm font-semibold text-slate-100">{label}</span>
      <span className="mt-1 block text-xs text-slate-500">{body}</span>
    </button>
  );
}

function BoardTripContextPanel({ app, onNavigate }: { app: TravelOS; onNavigate: (tab: MobileTabId) => void }) {
  const context = getBoardTripContext(app);
  if (!context.totalBoardIdeas) return null;

  return (
    <section className={classNames("min-w-0 overflow-hidden rounded-3xl p-4", glassPanel)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-300 text-slate-950">
            <Heart className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-cyan-300/80">Your board is shaping this</p>
            <h2 className="mt-1 text-xl font-semibold">{context.title}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">{context.body}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate("saved")}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-cyan-300/50 px-4 py-2 text-xs font-bold text-cyan-100"
          >
            <Heart className="h-4 w-4" /> Open board
          </button>
          <button
            type="button"
            onClick={() => onNavigate("map")}
            disabled={!context.routeAnchors.length}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-xs font-bold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MapPinned className="h-4 w-4" /> Preview route
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <RouteStat icon={MapPinned} label="Route anchors" value={context.routeAnchors.length.toString()} />
        <RouteStat icon={Heart} label="Saved places" value={app.savedPlaces.size.toString()} />
        <RouteStat icon={Sparkles} label="Experiences" value={app.savedExperiences.size.toString()} />
        <RouteStat icon={Link} label="Imported links" value={app.importedIdeas.length.toString()} />
      </div>

      {context.routeAnchors.length ? (
        <div className="mt-4 flex max-w-full gap-2 overflow-x-auto pb-1">
          {context.routeAnchors.slice(0, 6).map((anchor, index) => (
            <span
              key={anchor.destinationId}
              className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-300 text-[0.65rem] font-black text-slate-950">
                {index + 1}
              </span>
              {anchor.name}
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.12em] text-slate-300">
                {anchor.sourceLabel}
              </span>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-3 py-3 text-xs leading-5 text-amber-100">
          Saved ideas are on the board. Attach map locations in Saved to turn them into route anchors.
        </p>
      )}
    </section>
  );
}

function PlanCheckPanel({ app, onNavigate }: { app: TravelOS; onNavigate: (tab: MobileTabId) => void }) {
  const checks = getPlanChecks(app);
  const attentionCount = checks.filter((check) => check.tone !== "ready").length;

  return (
    <section className={classNames("min-w-0 overflow-hidden rounded-3xl p-4", glassPanel)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={classNames(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
              attentionCount ? "bg-amber-300 text-slate-950" : "bg-emerald-300 text-slate-950"
            )}
          >
            {attentionCount ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-cyan-300/80">Plan check</p>
            <h2 className="mt-1 text-xl font-semibold">
              {attentionCount ? `${attentionCount} thing${attentionCount === 1 ? "" : "s"} to review` : "Plan is ready to review"}
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              A quick quality pass for route pacing, weather, saved ideas, and share readiness.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("map")}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-cyan-300/50 px-4 py-2 text-xs font-bold text-cyan-100"
        >
          <MapPinned className="h-4 w-4" /> Check map
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {checks.map((check) => (
          <PlanCheckCard
            key={check.id}
            check={check}
            onAction={() => {
              if (check.action === "saved") onNavigate("saved");
              if (check.action === "map") onNavigate("map");
              if (check.action === "smooth-route") app.optimizeRouteOrder();
            }}
          />
        ))}
      </div>
    </section>
  );
}

function PlanCheckCard({ check, onAction }: { check: PlanCheck; onAction: () => void }) {
  const Icon = check.tone === "ready" ? CheckCircle2 : check.tone === "watch" ? CloudSun : AlertTriangle;

  return (
    <article
      className={classNames(
        "rounded-2xl border p-3",
        check.tone === "ready"
          ? "border-emerald-300/25 bg-emerald-300/10"
          : check.tone === "watch"
            ? "border-amber-300/25 bg-amber-300/10"
            : "border-rose-300/25 bg-rose-300/10"
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={classNames(
            "mt-0.5 h-4 w-4 shrink-0",
            check.tone === "ready" ? "text-emerald-200" : check.tone === "watch" ? "text-amber-200" : "text-rose-200"
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-100">{check.title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{check.body}</p>
          {check.action && (
            <button
              type="button"
              onClick={onAction}
              className="mt-3 inline-flex min-h-9 items-center justify-center rounded-full border border-white/15 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-100 hover:border-cyan-300/50"
            >
              {check.actionLabel}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function QuickRoutePanel({ app, onNavigate }: { app: TravelOS; onNavigate: (tab: MobileTabId) => void }) {
  const routeSummary = app.itinerary.routeSummary;
  const routedDestinationIds = new Set(routeSummary.stops.map((stop) => stop.destinationId));
  const addableSavedDestinations = DESTINATIONS.filter(
    (destination) => app.savedPlaces.has(destination.id) && !routedDestinationIds.has(destination.id)
  ).slice(0, 3);
  const canEditRoute = routeSummary.stops.length > 1;
  const lockedRouteIds = new Set(app.lockedRouteDestinationIds);
  const lockedStopCount = routeSummary.stops.filter((stop) => lockedRouteIds.has(stop.destinationId)).length;
  const routeAtDayLimit = routeSummary.stops.length >= app.plannerDays;
  const hasUnlockedRouteStop = routeSummary.stops.some(
    (stop) => !stop.isBase && !lockedRouteIds.has(stop.destinationId)
  );
  const addSavedRouteDisabled = routeAtDayLimit && !hasUnlockedRouteStop;

  return (
    <section className={classNames("min-w-0 overflow-hidden rounded-3xl p-4", glassPanel)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.28em] text-cyan-300/80">Route preview</p>
          <h2 className="text-xl font-semibold">{routeSummary.routeTone}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Planning route only. Use the handoff map for the actual drive.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={app.optimizeRouteOrder}
            disabled={!canEditRoute}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-emerald-300/50 px-4 py-2 text-xs font-bold text-emerald-100 disabled:opacity-40"
          >
            <Wand2 className="h-4 w-4" /> Smooth route
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
            <MapPinned className="h-4 w-4" /> Map
          </button>
        </div>
      </div>

      {!!lockedStopCount && (
        <p className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs leading-5 text-cyan-100">
          {lockedStopCount} stop{lockedStopCount === 1 ? "" : "s"} locked. Smooth route keeps locked days in place.
        </p>
      )}

      <ol className="mt-4 space-y-2">
        {routeSummary.stops.map((stop, index) => {
          const boardStopLabel = getBoardStopLabel(app, stop.destinationId);
          const isLocked = lockedRouteIds.has(stop.destinationId);
          const previousDestinationId = routeSummary.stops[index - 1]?.destinationId;
          const nextDestinationId = routeSummary.stops[index + 1]?.destinationId;
          const previousStopIsLocked = Boolean(previousDestinationId && lockedRouteIds.has(previousDestinationId));
          const nextStopIsLocked = Boolean(nextDestinationId && lockedRouteIds.has(nextDestinationId));

          return (
            <li
              key={stop.destinationId}
              className={classNames(
                "flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border px-3 py-3",
                isLocked
                  ? "border-cyan-300/35 bg-cyan-300/10"
                  : stop.transferSeverity === "long"
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
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold text-slate-100">{stop.name}</span>
                  {boardStopLabel && <BoardStopBadge label={boardStopLabel} />}
                  {isLocked && <BoardStopBadge label="Locked" />}
                </span>
                <span className="block text-xs text-slate-500">
                  {stop.region} · {stop.driveMinutesFromPrevious ? formatDriveTime(stop.driveMinutesFromPrevious) : "Start"}
                </span>
              </span>
              {!stop.isBase && (
                <span className="ml-11 flex w-full shrink-0 items-center justify-end gap-1 sm:ml-0 sm:w-auto">
                  <IconRouteButton
                    label={isLocked ? "Unlock day" : "Keep on this day"}
                    active={isLocked}
                    onClick={() => app.toggleRouteStopLock(stop.destinationId)}
                  >
                    {isLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  </IconRouteButton>
                  <IconRouteButton
                    label="Move earlier"
                    disabled={isLocked || previousStopIsLocked || index <= 1}
                    onClick={() => app.moveRouteStop(stop.destinationId, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </IconRouteButton>
                  <IconRouteButton
                    label="Move later"
                    disabled={isLocked || nextStopIsLocked || index >= routeSummary.stops.length - 1}
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
          );
        })}
      </ol>

      {!!addableSavedDestinations.length && (
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-slate-500">Add saved stop</p>
          {addSavedRouteDisabled && (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Unlock or remove a route stop before adding another saved place.
            </p>
          )}
          <div className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-1">
            {addableSavedDestinations.map((destination) => (
              <button
                key={destination.id}
                type="button"
                disabled={addSavedRouteDisabled}
                onClick={() => app.pinDestinationToRoute(destination.id)}
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-40"
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

function QuickDailyPlanPanel({ app }: { app: TravelOS }) {
  return (
    <section className={classNames("min-w-0 overflow-hidden rounded-3xl p-4", glassPanel)}>
      <div>
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-cyan-300/80">Plan cards</p>
        <h2 className="text-xl font-semibold">What to do each day</h2>
      </div>
      <div className="mt-4 grid gap-3">
        {app.itinerary.daysPlan.map((day) => {
          const experienceOverrideId = app.dayExperienceOverrides[String(day.day)] ?? "";
          const dayNote = app.dayNotes[String(day.day)] ?? "";
          const experienceOptions = getExperienceOptionsForDay(day, 6, app.savedExperiences);
          const boardStopLabel = getBoardStopLabel(app, day.destinationId);
          const experienceIsSaved = Boolean(day.experience && app.savedExperiences.has(day.experience.id));
          const boardIdeas = getDayBoardIdeas(app, day.destinationId);
          const planningReasons = getDayPlanningReasons(day, boardIdeas.length);
          const routeStopForDay = app.itinerary.routeSummary.stops.find((stop) => stop.day === day.day);
          const dayIsLocked = app.lockedRouteDestinationIds.includes(day.destinationId);

          return (
            <article key={`${day.day}-${day.destinationId}`} className={classNames("rounded-2xl p-4", glassCard)}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-slate-500">Day {day.day}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-100">{day.destName}</h3>
                  {boardStopLabel && <BoardStopBadge label={boardStopLabel} />}
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-400">{day.highlight}</p>
              </div>
              <span className="rounded-full border border-slate-700 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-slate-300">
                {formatVibeLabel(day.vibe)}
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <QuickDayFact label="Drive" value={day.driveMinutesFromPrevious ? formatDriveTime(day.driveMinutesFromPrevious) : "Stay nearby"} />
              <QuickDayFact label="Energy" value={day.energyLevel} />
              <QuickDayFact label="Budget" value={`$${day.suggestedBudget}`} />
            </div>
            {routeStopForDay && (
              <div className="mt-3 grid gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <label className="min-w-0">
                  <span className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">
                    {day.day === 1 ? "Base area" : "Day area"}
                  </span>
                  <select
                    value={day.destinationId}
                    onChange={(event) => app.setRouteStopForDay(day.day, event.target.value)}
                    disabled={dayIsLocked}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-200 disabled:opacity-50"
                  >
                    {DESTINATIONS.map((destination) => (
                      <option key={destination.id} value={destination.id}>
                        {destination.name}
                      </option>
                    ))}
                  </select>
                </label>
                {!day.isBase && (
                  <button
                    type="button"
                    onClick={() => app.toggleRouteStopLock(day.destinationId)}
                    className={classNames(
                      "inline-flex min-h-10 items-center justify-center gap-2 self-end rounded-full border px-3 py-2 text-xs font-bold",
                      dayIsLocked
                        ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-100"
                        : "border-slate-700 text-slate-200"
                    )}
                  >
                    {dayIsLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {dayIsLocked ? "Unlock day" : "Keep day"}
                  </button>
                )}
              </div>
            )}
            {(day.weatherNote || day.experience) && (
              <div className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-xs leading-5 text-cyan-100">
                {day.weatherNote && <p>{day.weatherNote}</p>}
                {day.experience && (
                  <p className="mt-1 text-slate-300">
                    Add-on: <span className="font-semibold text-slate-100">{day.experience.title}</span>
                    <span className="ml-2 text-[0.62rem] uppercase tracking-[0.14em] text-cyan-200/80">
                      {experienceOverrideId ? "picked" : experienceIsSaved ? "saved idea" : "best match"}
                    </span>
                  </p>
                )}
              </div>
            )}
            {!!planningReasons.length && (
              <div className="mt-3 grid gap-2">
                <p className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">Why this day</p>
                {planningReasons.slice(0, 3).map((reason) => (
                  <QuickPlanningReason key={reason.id} reason={reason} />
                ))}
              </div>
            )}
            {!!boardIdeas.length && (
              <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-[0.62rem] uppercase tracking-[0.18em] text-cyan-300/80">From your board</p>
                <div className="mt-2 grid gap-2">
                  {boardIdeas.slice(0, 3).map((idea) => (
                    <div key={idea.id} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                      <p className="line-clamp-1 text-xs font-semibold text-slate-100">{idea.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-[0.68rem] text-slate-500">{idea.meta}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
              <label className="block">
                <span className="inline-flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">
                  <StickyNote className="h-3.5 w-3.5 text-cyan-300" /> Day note
                </span>
                <textarea
                  value={dayNote}
                  onChange={(event) => app.setDayNote(day.day, event.target.value)}
                  maxLength={280}
                  rows={2}
                  placeholder="Add reservation times, pickup notes, must-do stops, or reminders."
                  className="mt-2 w-full resize-none rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs leading-5 text-slate-200 placeholder:text-slate-600 focus:outline-none"
                />
              </label>
              <div className="mt-2 flex items-center justify-between gap-2 text-[0.68rem] text-slate-500">
                <span>{dayNote.length}/280</span>
                {dayNote && (
                  <button
                    type="button"
                    onClick={() => app.clearDayNote(day.day)}
                    className="font-semibold text-slate-300 hover:text-cyan-100"
                  >
                    Clear note
                  </button>
                )}
              </div>
            </div>
            {experienceOptions.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <label className="min-w-0">
                  <span className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">Swap add-on</span>
                  <select
                    value={experienceOverrideId}
                    onChange={(event) => {
                      if (event.target.value) {
                        app.setDayExperience(day.day, event.target.value);
                      } else {
                        app.clearDayExperience(day.day);
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
                <button
                  type="button"
                  onClick={() => app.refreshDayExperience(day.day)}
                  className="inline-flex min-h-10 items-center justify-center gap-1 self-end rounded-xl border border-cyan-300/40 px-3 py-2 text-xs font-semibold text-cyan-100"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Try another
                </button>
                <button
                  type="button"
                  onClick={() => app.clearDayExperience(day.day)}
                  disabled={!experienceOverrideId}
                  className="inline-flex min-h-10 items-center justify-center gap-1 self-end rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 disabled:opacity-40"
                >
                  <X className="h-3.5 w-3.5" /> Use auto
                </button>
              </div>
            )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function QuickDayFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2">
      <p className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-xs font-semibold capitalize text-slate-200">{value}</p>
    </div>
  );
}

function QuickPlanningReason({
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

function QuickSavedIdeasPanel({
  savedDestinations,
  savedExperiences,
  importedIdeas,
  onExplore,
  onSaved,
}: {
  savedDestinations: typeof DESTINATIONS;
  savedExperiences: Experience[];
  importedIdeas: ImportedIdea[];
  onExplore: () => void;
  onSaved: () => void;
}) {
  const totalSaved = savedDestinations.length + savedExperiences.length + importedIdeas.length;
  const previewItems = [
    ...savedDestinations.slice(0, 2).map((destination) => ({ id: destination.id, title: destination.name, meta: destination.region })),
    ...savedExperiences.slice(0, 2).map((experience) => ({ id: experience.id, title: experience.title, meta: experience.location })),
    ...importedIdeas.slice(0, 2).map((idea) => ({ id: idea.id, title: idea.title, meta: idea.sourceLabel ?? idea.category })),
  ].slice(0, 4);

  return (
    <section className={classNames("min-w-0 overflow-hidden rounded-3xl p-4", glassPanel)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.28em] text-cyan-300/80">Saved ideas</p>
          <h2 className="text-xl font-semibold">{totalSaved ? `${totalSaved} ideas ready` : "Start your Jamaica board"}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Quick plans get better when saved places, links, and notes are already on the board.
          </p>
        </div>
        <button
          type="button"
          onClick={totalSaved ? onSaved : onExplore}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-cyan-300/45 px-4 py-2 text-xs font-bold text-cyan-100"
        >
          <Heart className="h-4 w-4" /> {totalSaved ? "Open board" : "Explore"}
        </button>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {previewItems.length ? (
          previewItems.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="line-clamp-1 text-sm font-semibold text-slate-100">{item.title}</p>
              <p className="mt-1 line-clamp-1 text-xs text-slate-500">{item.meta}</p>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm leading-6 text-slate-400 sm:col-span-2">
            Save a few food spots, beaches, links, or notes, then come back here to make the plan feel personal.
          </div>
        )}
      </div>
    </section>
  );
}

function TemplateQuickStartPanel({ app }: { app: TravelOS }) {
  const visibleTemplates = app.planningTemplates.filter((template) => template.mode === app.planningMode);

  return (
    <div className={classNames("rounded-3xl p-4", glassPanel)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.28em] text-slate-500">Plan type</p>
          <h2 className="text-base font-semibold">{PLANNING_MODE_LABELS[app.planningMode].title}</h2>
        </div>
        <span className="rounded-full border border-cyan-300/35 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-cyan-100">
          {app.activePlanningTemplate.eyebrow}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Start from a template, then adjust the days, saved ideas, route order, and budget.
      </p>
      <div className="mt-3 grid gap-2">
        {visibleTemplates.map((template) => (
          <TemplateButton
            key={template.id}
            template={template}
            active={app.planningTemplateId === template.id}
            onClick={() => app.applyPlanningTemplate(template.id)}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateButton({
  template,
  active,
  onClick,
}: {
  template: PlanningTemplate;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "rounded-2xl border p-3 text-left transition hover:border-cyan-300/60",
        active ? "border-cyan-300/45 bg-cyan-300/10" : "border-slate-800 bg-slate-950/70"
      )}
    >
      <span className="text-[0.62rem] uppercase tracking-[0.2em] text-cyan-300/80">{template.eyebrow}</span>
      <span className="mt-1 block text-sm font-semibold text-slate-100">{template.title}</span>
      <span className="mt-1 block text-xs leading-5 text-slate-500">{template.body}</span>
      <span className="mt-2 block text-[0.68rem] text-slate-400">
        {template.days} day{template.days === 1 ? "" : "s"} · ${template.budget}/day · {template.vibe}
      </span>
    </button>
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
    <div className={classNames("rounded-3xl p-4", glassPanel)}>
      {activeStep === "base" && (
        <div className="space-y-3">
          <WizardTitle title="Choose start" body={getBaseStepBody(app.planningMode)} />
          <PlannerSelect
            label={app.planningMode === "local" ? "Home base or meetup area" : "Base destination"}
            value={app.plannerBaseId}
            onChange={app.setPlannerBaseId}
            options={DESTINATIONS.map((destination) => ({ value: destination.id, label: destination.name }))}
          />
          <PlannerSelect
            label={getOriginLabel(app.planningMode)}
            value={app.originAirportId}
            onChange={app.handleOriginAirportChange}
            options={getOriginOptions(app).map((airport) => ({ value: airport.id, label: airport.name }))}
          />
        </div>
      )}

      {activeStep === "dates" && (
        <div className="space-y-3">
          <WizardTitle title="Set timing" body={getDatesStepBody(app.planningMode)} />
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
              min={1}
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
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 backdrop-blur-xl">
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
          <WizardTitle title="Export or share" body="Export the calendar anytime. Share links are view-only unless opened in the browser that created them." />
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
            <Share2 className="h-4 w-4" /> {app.tripCanEdit ? "Update share link" : app.tripId ? "Save editable copy" : "Create share link"}
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

function LocalPlanSnapshot({ app }: { app: TravelOS }) {
  const weatherReadyDays = app.itinerary.daysPlan.filter((day) => day.weather || day.weatherNote).length;

  return (
    <div className={classNames("rounded-3xl p-4", glassPanel)}>
      <div>
        <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/80">Local plan</p>
        <h3 className="text-base font-semibold">{app.destination.name} start</h3>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Built for a local day or weekend, with route pacing, weather cues, and saved Jamaica ideas kept in view.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <RouteStat
          icon={Clock3}
          label="Drive time"
          value={formatDriveTime(app.itinerary.routeSummary.totalDriveMinutes)}
        />
        <RouteStat
          icon={CloudSun}
          label="Weather"
          value={weatherReadyDays ? `${weatherReadyDays} days` : "Pending"}
        />
        <RouteStat
          icon={Heart}
          label="Saved"
          value={`${app.savedPlaces.size + app.savedExperiences.size + app.importedIdeas.length}`}
        />
      </div>
    </div>
  );
}

function FlightSnapshot({ app }: { app: TravelOS }) {
  const sourceStatus = getFlightSourceStatus(app);

  return (
    <div className={classNames("rounded-3xl p-4", glassPanel)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/80">Flights</p>
          <h3 className="text-base font-semibold">
            {app.originAirport.code} to {app.destination.airportCode}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IntegrationBadge label={sourceStatus.status} tone={sourceStatus.tone} />
          {app.isFetchingFlights && <span className="animate-pulse text-xs text-slate-400">Syncing gate info...</span>}
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{sourceStatus.body}</p>
      {app.flightsError && <p className="mt-2 text-xs text-rose-300">{app.flightsError}</p>}
      {!app.flightsError && !app.flightOptions.length && !app.isFetchingFlights && (
        <p className="mt-2 text-xs text-slate-400">
          No flights from {app.originAirport.code} within the current snapshot window.
        </p>
      )}
      <div className="mt-3 space-y-2">
        {app.flightOptions.slice(0, 3).map((flight, index) => (
          <div
            key={`${flight.flightNumber}-${flight.departureTimeUTC}-${index}`}
            className={classNames("flex flex-col gap-1 rounded-2xl px-4 py-3", glassCard)}
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

function IntegrationStatusPanel({ app }: { app: TravelOS }) {
  const [showDetails, setShowDetails] = useState(false);
  const sharingStatus = getSharingIntegrationStatus(app);
  const bookingStatus = getBookingIntegrationStatus(app);
  const flightStatus = getFlightSourceStatus(app);
  const integrationCards = [
    {
      icon: Share2,
      title: "Share & export",
      status: sharingStatus.status,
      tone: sharingStatus.tone,
      body: sharingStatus.body,
    },
    {
      icon: BedDouble,
      title: "Stays",
      status: bookingStatus.status,
      tone: bookingStatus.tone,
      body: bookingStatus.body,
    },
    {
      icon: Plane,
      title: "Flight options",
      status: flightStatus.status,
      tone: flightStatus.tone,
      body: flightStatus.body,
    },
    {
      icon: Route,
      title: "Road planning",
      status: "Road-aware",
      tone: "live",
      body: "The route map favors road-following planning lines and keeps an estimated preview available when needed.",
    },
    {
      icon: CalendarDays,
      title: "Island events",
      status: "Jamaica calendar",
      tone: "fallback",
      body: "Regional events are shown from the built-in Jamaica calendar.",
    },
  ] satisfies Array<{
    icon: ComponentType<LucideProps>;
    title: string;
    status: string;
    tone: IntegrationTone;
    body: string;
  }>;
  const liveCount = integrationCards.filter((card) => card.tone === "live").length;
  const attentionCount = integrationCards.filter((card) => card.tone === "error").length;

  return (
    <section className={classNames("min-w-0 overflow-hidden rounded-3xl p-4", glassPanel)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-cyan-300" />
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-cyan-300/80">Travel support</p>
            <h2 className="text-lg font-semibold">Your plan has the essentials ready.</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Export, route planning, stays, flights, and events stay usable even when a live source is unavailable.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowDetails((prev) => !prev)}
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-cyan-300/45 px-4 py-2 text-xs font-bold text-cyan-100"
        >
          {showDetails ? "Hide details" : "Show details"}
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <TravelSupportPill label="Ready now" value={`${liveCount}/${integrationCards.length}`} tone="live" />
        <TravelSupportPill label="Review" value={attentionCount ? `${attentionCount}` : "0"} tone={attentionCount ? "error" : "live"} />
        <TravelSupportPill label="Always works" value="Calendar export" tone="fallback" />
      </div>

      {showDetails && (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {integrationCards.map((card) => (
            <IntegrationStatusCard key={card.title} {...card} />
          ))}
        </div>
      )}
    </section>
  );
}

type IntegrationTone = "live" | "fallback" | "error";

function getSharingIntegrationStatus(app: TravelOS): { status: string; tone: IntegrationTone; body: string } {
  if (!app.collaborationReady) {
    return {
      status: "Export ready",
      tone: "fallback",
      body: "Calendar export works now. Share links will appear when online sharing is available.",
    };
  }

  if (app.collaborationErrorCode === "schema-missing") {
    return {
      status: "Export ready",
      tone: "error",
      body: "Calendar export works now. Share links need a quick fix before they can be created.",
    };
  }

  if (app.collaborationErrorCode === "permission-denied") {
    return {
      status: "Export ready",
      tone: "error",
      body: "Calendar export works now. Share links are paused while sharing access is fixed.",
    };
  }

  if (app.collaborationErrorCode === "request-failed" || app.collaborationErrorCode === "empty-response") {
    return {
      status: "Try again",
      tone: "error",
      body: "The latest share update did not finish. Calendar export still works.",
    };
  }

  if (app.collaborationErrorCode === "not-found") {
    return {
      status: "Link missing",
      tone: "fallback",
      body: "That shared trip was not found, but you can still create a new share link.",
    };
  }

  return {
    status: app.tripId && !app.tripCanEdit ? "View-only" : "Ready",
    tone: "live",
    body: app.tripId && !app.tripCanEdit
      ? "This shared trip can be viewed here. Share again to save an editable copy."
      : "Share links can be created and reopened from this browser.",
  };
}

function TravelSupportPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: IntegrationTone;
}) {
  return (
    <div
      className={classNames(
        "rounded-2xl border px-3 py-2",
        tone === "live"
          ? "border-emerald-300/25 bg-emerald-300/10"
          : tone === "error"
            ? "border-rose-300/25 bg-rose-300/10"
            : "border-amber-300/25 bg-amber-300/10"
      )}
    >
      <p className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-xs font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function IntegrationStatusCard({
  icon: Icon,
  title,
  status,
  tone,
  body,
}: {
  icon: ComponentType<LucideProps>;
  title: string;
  status: string;
  tone: IntegrationTone;
  body: string;
}) {
  const StatusIcon = tone === "live" ? CheckCircle2 : tone === "error" ? AlertTriangle : CloudOff;

  return (
    <article
      className={classNames(
        "min-h-40 rounded-2xl border p-3",
        tone === "live"
          ? "border-emerald-300/25 bg-emerald-300/10"
          : tone === "error"
            ? "border-rose-300/25 bg-rose-300/10"
            : "border-amber-300/25 bg-amber-300/10"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Icon
          className={classNames(
            "h-5 w-5",
            tone === "live" ? "text-emerald-200" : tone === "error" ? "text-rose-200" : "text-amber-200"
          )}
        />
        <StatusIcon
          className={classNames(
            "h-4 w-4",
            tone === "live" ? "text-emerald-200" : tone === "error" ? "text-rose-200" : "text-amber-200"
          )}
        />
      </div>
      <p className="mt-3 text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{status}</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{body}</p>
    </article>
  );
}

function IntegrationBadge({ label, tone }: { label: string; tone: IntegrationTone }) {
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full border px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.18em]",
        tone === "live"
          ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
          : tone === "error"
            ? "border-rose-300/40 bg-rose-300/10 text-rose-100"
            : "border-amber-300/40 bg-amber-300/10 text-amber-100"
      )}
    >
      {label}
    </span>
  );
}

function getFlightSourceStatus(app: TravelOS): { status: string; tone: IntegrationTone; body: string } {
  const meta = app.flightSourceMeta;

  if (app.flightsError) {
    return {
      status: "Flights paused",
      tone: "error",
      body: meta.providerConfigured
        ? "The latest flight search did not finish. Saved flight options are still available."
        : "Flight snapshots are unavailable right now.",
    };
  }

  if (meta.source === "aviationstack") {
    return {
      status: "Live flights",
      tone: "live",
      body: "Flight snapshots are current for this origin and Jamaica airport.",
    };
  }

  if (meta.endpointConfigured && meta.providerConfigured) {
    return {
      status: "Saved flights",
      tone: "fallback",
      body: `${formatIntegrationReason(meta.reason)} Saved flight examples are shown for this route.`,
    };
  }

  if (meta.endpointConfigured) {
    return {
      status: "Saved flights",
      tone: "fallback",
      body: `${formatIntegrationReason(meta.reason)} Saved flight examples are shown for this route.`,
    };
  }

  return {
    status: "Saved flights",
    tone: "fallback",
    body: "Saved flight examples are shown until live schedules are available.",
  };
}

function getBookingIntegrationStatus(app: TravelOS): { status: string; tone: IntegrationTone; body: string } {
  const meta = app.bookingSourceMeta;

  if (app.bookingError) {
    return {
      status: "Stays paused",
      tone: "error",
      body: "Stay lookup failed, so the stay cards are temporarily empty.",
    };
  }

  if (meta.source === "amadeus") {
    return {
      status: "Current stays",
      tone: "live",
      body: "Current hotel options are available for this route and date window.",
    };
  }

  if (meta.source === "api") {
    return {
      status: "Current stays",
      tone: "live",
      body: "Current stay options are available for this trip.",
    };
  }

  if (meta.endpointConfigured) {
    return {
      status: "Curated stays",
      tone: "fallback",
      body: `${formatIntegrationReason(meta.reason)} Curated Jamaica stay ideas are shown for now.`,
    };
  }

  return {
    status: "Curated stays",
    tone: "fallback",
    body: "Curated Jamaica stay ideas are shown until current hotel options are available.",
  };
}

function RoutePreviewPanel({ app, onNavigate }: { app: TravelOS; onNavigate: (tab: MobileTabId) => void }) {
  const routeSummary = app.itinerary.routeSummary;
  const routedDestinationIds = new Set(routeSummary.stops.map((stop) => stop.destinationId));
  const addableSavedDestinations = DESTINATIONS.filter(
    (destination) => app.savedPlaces.has(destination.id) && !routedDestinationIds.has(destination.id)
  ).slice(0, 4);
  const canEditRoute = routeSummary.stops.length > 1;
  const lockedRouteIds = new Set(app.lockedRouteDestinationIds);
  const lockedStopCount = routeSummary.stops.filter((stop) => lockedRouteIds.has(stop.destinationId)).length;
  const routeAtDayLimit = routeSummary.stops.length >= app.plannerDays;
  const hasUnlockedRouteStop = routeSummary.stops.some(
    (stop) => !stop.isBase && !lockedRouteIds.has(stop.destinationId)
  );
  const addSavedRouteDisabled = routeAtDayLimit && !hasUnlockedRouteStop;

  return (
    <section className={classNames("min-w-0 overflow-hidden rounded-3xl p-4", glassPanel)}>
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

      {!!lockedStopCount && (
        <p className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs leading-5 text-cyan-100">
          {lockedStopCount} day{lockedStopCount === 1 ? "" : "s"} locked. Optimize will keep those stops in place and adjust the rest.
        </p>
      )}

      <ol className="mt-4 grid gap-2 md:grid-cols-2">
        {routeSummary.stops.map((stop, index) => {
          const isLocked = lockedRouteIds.has(stop.destinationId);
          const boardStopLabel = getBoardStopLabel(app, stop.destinationId);
          const previousDestinationId = routeSummary.stops[index - 1]?.destinationId;
          const nextDestinationId = routeSummary.stops[index + 1]?.destinationId;
          const previousStopIsLocked = Boolean(previousDestinationId && lockedRouteIds.has(previousDestinationId));
          const nextStopIsLocked = Boolean(nextDestinationId && lockedRouteIds.has(nextDestinationId));

          return (
            <li
              key={stop.destinationId}
              className={classNames(
                "flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border px-3 py-3",
                isLocked
                  ? "border-cyan-300/35 bg-cyan-300/10"
                  : stop.transferSeverity === "long"
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
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold text-slate-100">{stop.name}</span>
                  {boardStopLabel && <BoardStopBadge label={boardStopLabel} />}
                  {isLocked && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-cyan-300/30 px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-cyan-100">
                      <Lock className="h-2.5 w-2.5" /> Locked
                    </span>
                  )}
                </span>
                <span className="block text-xs text-slate-500">
                  {stop.region} · {stop.driveMinutesFromPrevious ? formatDriveTime(stop.driveMinutesFromPrevious) : "Start"}
                </span>
              </span>
              {!stop.isBase && (
                <span className="ml-11 flex w-full shrink-0 items-center justify-end gap-1 sm:ml-0 sm:w-auto">
                  <IconRouteButton
                    label={isLocked ? "Unlock day" : "Keep on this day"}
                    active={isLocked}
                    onClick={() => app.toggleRouteStopLock(stop.destinationId)}
                  >
                    {isLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  </IconRouteButton>
                  <IconRouteButton
                    label="Move earlier"
                    disabled={isLocked || previousStopIsLocked || index <= 1}
                    onClick={() => app.moveRouteStop(stop.destinationId, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </IconRouteButton>
                  <IconRouteButton
                    label="Move later"
                    disabled={isLocked || nextStopIsLocked || index >= routeSummary.stops.length - 1}
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
          );
        })}
      </ol>

      {!!addableSavedDestinations.length && (
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-slate-500">Add saved to route</p>
          {addSavedRouteDisabled && (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Unlock a route day before adding another saved stop.
            </p>
          )}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {addableSavedDestinations.map((destination) => (
              <button
                key={destination.id}
                type="button"
                disabled={addSavedRouteDisabled}
                onClick={() => app.pinDestinationToRoute(destination.id)}
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-40"
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
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
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
      className={classNames(
        "inline-flex h-10 w-10 scroll-mb-28 items-center justify-center rounded-full hover:border-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-35",
        active ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100" : "text-slate-300 hover:text-cyan-100",
        glassPanelStrong
      )}
    >
      {children}
    </button>
  );
}

function BoardStopBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-cyan-100">
      {label}
    </span>
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
    <div className={classNames("rounded-2xl p-3", glassCard)}>
      <Icon className="h-4 w-4 text-cyan-300" />
      <p className="mt-2 text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function SharePanel({ app }: { app: TravelOS }) {
  const setupNotice = getShareSetupNotice(app);

  return (
    <div className={classNames("rounded-3xl p-4", glassPanel)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/80">Export / Share</p>
          <h3 className="text-base font-semibold">Calendar and view-only link</h3>
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
          <Share2 className="h-4 w-4" /> {app.tripCanEdit ? "Update link" : app.tripId ? "Save copy" : "Create link"}
        </button>
      </div>

      {app.collaborationReady && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            readOnly
            value={app.tripShareUrl}
            placeholder="Create a view-only share link"
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
      {setupNotice && <ShareSetupNotice {...setupNotice} />}
      {app.tripStatusMessage && <p className="mt-2 text-xs text-slate-400">{app.tripStatusMessage}</p>}
    </div>
  );
}

function ShareSetupNotice({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "error" | "fallback";
}) {
  return (
    <div
      className={classNames(
        "mt-3 rounded-2xl border px-3 py-3 text-xs leading-5",
        tone === "error"
          ? "border-red-400/40 bg-red-400/10 text-red-100"
          : "border-slate-700 bg-slate-950/70 text-slate-300"
      )}
    >
      <p className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-3.5 w-3.5" />
        {title}
      </p>
      <p className={classNames("mt-1", tone === "error" ? "text-red-100/80" : "text-slate-400")}>{body}</p>
    </div>
  );
}

function getShareSetupNotice(app: TravelOS): { title: string; body: string; tone: "error" | "fallback" } | null {
  if (!app.collaborationReady) {
    return {
      title: "Share links unavailable",
      body: "Calendar export still works. Share links will appear once online sharing is available.",
      tone: "fallback",
    };
  }

  if (app.collaborationErrorCode === "schema-missing") {
    return {
      title: "Share links unavailable",
      body: "Calendar export still works while share links are being fixed.",
      tone: "error",
    };
  }

  if (app.collaborationErrorCode === "permission-denied") {
    return {
      title: "Share links paused",
      body: "Calendar export still works while sharing access is fixed.",
      tone: "error",
    };
  }

  return null;
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
    <article className={classNames("rounded-2xl p-4", glassCard)}>
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

function getTripHeroTitle(mode: PlanningMode): string {
  if (mode === "local") return "Plan a Jamaica day without overthinking it.";
  if (mode === "hosting") return "Show them Jamaica with a real plan.";
  return "Build your Jamaica trip.";
}

function getTripHeroBody(mode: PlanningMode): string {
  if (mode === "local") {
    return "Pick a home base, vibe, time window, and saved ideas. IrieVerse keeps the plan realistic for local driving and weather.";
  }
  if (mode === "hosting") {
    return "Choose the guest base, route, pace, and crowd-pleasers, then turn your local knowledge into a shareable plan.";
  }
  return "Shape the trip around island road time, weather signals, saved local ideas, and region-by-region pacing.";
}

function getBaseStepBody(mode: PlanningMode): string {
  if (mode === "local") return "Pick where you are starting from or where the group is meeting.";
  if (mode === "hosting") return "Pick the guest's base or the area you want to anchor the plan around.";
  return "Pick the island anchor for flights, events, stays, and route starts.";
}

function getDatesStepBody(mode: PlanningMode): string {
  if (mode === "local") return "Use one day for a quick run, two or three for a weekend, or more for a longer island loop.";
  if (mode === "hosting") return "Set how long you need to keep guests moving without making the route feel rushed.";
  return "Set the start day and how many days the generated plan should cover.";
}

function getOriginLabel(mode: PlanningMode): string {
  if (mode === "local") return "Starting area";
  if (mode === "hosting") return "Guest arrival or starting area";
  return "Origin airport";
}

function getOriginOptions(app: TravelOS) {
  if (app.planningMode !== "local") return app.originAirports;
  return app.originAirports.filter((airport) => ["MBJ", "KIN", "OCJ"].includes(airport.code));
}

function getDefaultBuilderLane(mode: PlanningMode): BuilderLane {
  return mode === "visitor" ? "full" : "quick";
}

function getQuickPlanTemplates(app: TravelOS): PlanningTemplate[] {
  const seen = new Set<string>();
  const templates: PlanningTemplate[] = [];
  const sameModeTemplates = app.planningTemplates.filter(
    (template) => template.mode === app.planningMode && (template.mode !== "visitor" || template.days <= 3)
  );
  const quickTemplates = app.planningTemplates.filter((template) => template.days <= 3);

  [...sameModeTemplates, ...quickTemplates].forEach((template) => {
    if (seen.has(template.id)) return;
    seen.add(template.id);
    templates.push(template);
  });

  return templates.slice(0, 4);
}

function getTodayISODate(): string {
  return toLocalISODate(new Date());
}

function getNextWeekendISODate(): string {
  const today = new Date();
  const day = today.getDay();
  const daysUntilSaturday = (6 - day + 7) % 7 || 7;
  const nextWeekend = new Date(today);
  nextWeekend.setDate(today.getDate() + daysUntilSaturday);
  return toLocalISODate(nextWeekend);
}

function toLocalISODate(date: Date): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function formatVibeLabel(vibe: string): string {
  const option = VIBE_OPTIONS.find((item) => item.id === vibe);
  if (option) return option.label;
  return vibe
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getBoardTripContext(app: TravelOS) {
  const totalBoardIdeas = app.savedPlaces.size + app.savedExperiences.size + app.importedIdeas.length;
  const routeAnchors = app.itinerary.routeSummary.stops.reduce<Array<RouteStop & { sourceLabel: string }>>(
    (anchors, stop) => {
      const sourceLabel = getBoardStopLabel(app, stop.destinationId);
      if (sourceLabel) {
        anchors.push({ ...stop, sourceLabel });
      }
      return anchors;
    },
    []
  );

  return {
    totalBoardIdeas,
    routeAnchors,
    title: routeAnchors.length
      ? `${routeAnchors.length} board ${routeAnchors.length === 1 ? "anchor" : "anchors"} in this route`
      : `${totalBoardIdeas} saved ${totalBoardIdeas === 1 ? "idea" : "ideas"} ready`,
    body: routeAnchors.length
      ? "Saved places, experiences, and linked imports are pinned into the plan, so the route starts from your real Jamaica board instead of a blank itinerary."
      : "Saved places, experiences, and imports are available. Add map locations to saved links when you want them to shape the route.",
  };
}

function getPlanChecks(app: TravelOS): PlanCheck[] {
  const checks: PlanCheck[] = [];
  const routeWarnings = app.itinerary.routeSummary.warnings;
  const missingLocationCount = app.importedIdeas.filter((idea) => !idea.linkedDestinationId).length;
  const routedDestinationIds = new Set(app.itinerary.routeSummary.stops.map((stop) => stop.destinationId));
  const savedPlacesOutsideRoute = Array.from(app.savedPlaces).filter((id) => !routedDestinationIds.has(id));
  const weatherRiskDays = app.itinerary.daysPlan.filter((day) =>
    day.weather && ["rain", "storm", "hot"].includes(day.weather.planningSignal)
  );

  if (routeWarnings.length) {
    const firstWarning = routeWarnings[0];
    checks.push({
      id: "route-warning",
      title: routeWarnings.length === 1 ? firstWarning.title : `${routeWarnings.length} route pacing flags`,
      body: routeWarnings.length === 1
        ? firstWarning.body
        : `${firstWarning.body} Smooth the route or lock the must-keep days before sharing.`,
      tone: "action",
      action: "smooth-route",
      actionLabel: "Smooth route",
    });
  } else {
    checks.push({
      id: "route-ready",
      title: "Route pacing looks clean",
      body: `${app.itinerary.routeSummary.stops.length} stops across ${app.itinerary.routeSummary.regionCount} region${app.itinerary.routeSummary.regionCount === 1 ? "" : "s"} with no long-transfer flags.`,
      tone: "ready",
    });
  }

  if (weatherRiskDays.length) {
    checks.push({
      id: "weather-risk",
      title: `${weatherRiskDays.length} weather-aware day${weatherRiskDays.length === 1 ? "" : "s"}`,
      body: "Daily notes already soften the pacing around rain, storms, or heat where the forecast needs it.",
      tone: "watch",
    });
  } else if (app.itinerary.daysPlan.some((day) => day.weather || day.weatherNote)) {
    checks.push({
      id: "weather-ready",
      title: "Weather cues are in place",
      body: "The daily cards have forecast context for outdoor timing and backup planning.",
      tone: "ready",
    });
  }

  if (missingLocationCount) {
    checks.push({
      id: "missing-locations",
      title: `${missingLocationCount} saved link${missingLocationCount === 1 ? "" : "s"} need a map location`,
      body: "Attach Jamaica locations in Saved so those ideas can shape the route and daily plan.",
      tone: "action",
      action: "saved",
      actionLabel: "Open saved",
    });
  } else if (app.importedIdeas.length) {
    checks.push({
      id: "imports-ready",
      title: "Imported ideas are map-ready",
      body: "Linked imports can now influence route anchors and day-level board context.",
      tone: "ready",
    });
  }

  if (savedPlacesOutsideRoute.length) {
    checks.push({
      id: "saved-outside-route",
      title: `${savedPlacesOutsideRoute.length} saved place${savedPlacesOutsideRoute.length === 1 ? "" : "s"} outside this route`,
      body: "Open the map or route editor if you want to add them before exporting.",
      tone: "watch",
      action: "map",
      actionLabel: "Check map",
    });
  } else if (app.savedPlaces.size || app.savedExperiences.size) {
    checks.push({
      id: "saved-ready",
      title: "Saved ideas are reflected",
      body: "Your saved places and experiences are already visible in route anchors or daily plan context.",
      tone: "ready",
    });
  }

  if (!checks.some((check) => check.tone !== "ready")) {
    checks.push({
      id: "share-ready",
      title: "Ready to export or share",
      body: app.collaborationReady
        ? "Calendar export and share links are available when you are ready."
        : "Calendar export is available now. Share links appear when online sharing is available.",
      tone: "ready",
    });
  }

  return checks.slice(0, 4);
}

function getBoardStopLabel(app: TravelOS, destinationId: string): string {
  const saved = app.savedPlaces.has(destinationId);
  const savedExperience = EXPERIENCES.some(
    (experience) => app.savedExperiences.has(experience.id) && experience.linkedDestinationId === destinationId
  );
  const imported = app.importedIdeas.some((idea) => idea.linkedDestinationId === destinationId);

  if ([saved, savedExperience, imported].filter(Boolean).length > 1) return "Board";
  if (saved) return "Saved";
  if (savedExperience) return "Experience";
  if (imported) return "Import";
  return "";
}

function getDayBoardIdeas(app: TravelOS, destinationId: string) {
  const destination = DESTINATIONS.find((item) => item.id === destinationId);
  const savedDestinationIdeas = destination && app.savedPlaces.has(destinationId)
    ? [{ id: `place-${destination.id}`, title: destination.name, meta: "Saved place" }]
    : [];
  const savedExperienceIdeas = EXPERIENCES
    .filter((experience) => app.savedExperiences.has(experience.id) && experience.linkedDestinationId === destinationId)
    .map((experience) => ({
      id: `experience-${experience.id}`,
      title: experience.title,
      meta: `Saved experience · ${experience.location}`,
    }));
  const importedDayIdeas = app.importedIdeas
    .filter((idea) => idea.linkedDestinationId === destinationId)
    .map((idea) => ({
      id: `import-${idea.id}`,
      title: idea.title,
      meta: idea.sourceLabel || idea.extractedPlaceName || "Imported idea",
    }));

  return [...savedDestinationIdeas, ...savedExperienceIdeas, ...importedDayIdeas];
}

function formatIntegrationReason(reason?: string): string {
  const labels: Record<string, string> = {
    "missing-amadeus-credentials": "Live hotel pricing is not connected yet.",
    "no-amadeus-offers": "No live hotel matches came back for this combination.",
    "amadeus-request-failed": "Live hotel lookup failed.",
    "request-failed": "The latest lookup failed.",
    "custom-endpoint": "Stay details are limited right now.",
    "endpoint-configured": "Stay data is connected.",
    "local-sample-data": "Curated examples are active.",
    "pending-flight-proxy": "Flight lookup is getting ready.",
    "missing-aviationstack-key": "Live flight schedules are not connected yet.",
    "aviationstack-disabled": "Live flight schedules are paused here.",
    "aviationstack-rate-limited": "Live flight schedules are busy right now.",
    "aviationstack-request-failed": "Live flight lookup failed.",
    "flight-proxy-request-failed": "Flight lookup failed.",
    "missing-flight-metadata": "Flight details are limited right now.",
    "flight-data-unavailable": "Flight data is unavailable.",
  };

  return reason ? labels[reason] ?? "Travel details are limited right now." : "Live travel data is not available yet.";
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
