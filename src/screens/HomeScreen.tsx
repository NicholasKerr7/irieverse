import {
  ArrowRight,
  CalendarDays,
  Compass,
  Heart,
  MapPin,
  Plane,
  Route,
  Utensils,
  Users,
  Waves,
} from "lucide-react";
import { HeroSection } from "../components/HeroSection";
import { PageFooter } from "../components/PageFooter";
import type { MobileTabId } from "../components/mobile/BottomNav";
import { DESTINATIONS } from "../data/content";
import { PLANNING_MODE_LABELS } from "../data/plannerTemplates";
import type { TravelOS } from "../hooks/useTravelOS";
import type { PlanningMode, PlanningTemplate, PlanningTemplateId } from "../types/travel";
import { classNames } from "../utils/classNames";
import { glassCard, glassPanel } from "../utils/glass";

type HomeScreenProps = {
  app: TravelOS;
  onNavigate: (tab: MobileTabId) => void;
};

const MODE_CARDS: Array<{ id: PlanningMode; icon: typeof Plane }> = [
  { id: "visitor", icon: Plane },
  { id: "local", icon: MapPin },
  { id: "hosting", icon: Users },
];

const STARTER_ROUTES: Array<{
  id: string;
  title: string;
  body: string;
  templateId: PlanningTemplateId;
  destinationIds: string[];
  icon: typeof Plane;
  actionLabel: string;
}> = [
  {
    id: "first-trip",
    title: "First Jamaica trip",
    body: "MoBay arrival, Negril sunset, Ochi water day, and a South Coast slower finish.",
    templateId: "first-jamaica-trip",
    destinationIds: ["mobay", "negril", "ochi", "southcoast"],
    icon: Plane,
    actionLabel: "Start visitor plan",
  },
  {
    id: "water-day",
    title: "River + beach day",
    body: "A local-friendly Ochi to Portland water plan with low-stress pacing.",
    templateId: "river-and-beach-day",
    destinationIds: ["ochi", "portland"],
    icon: Waves,
    actionLabel: "Start local plan",
  },
  {
    id: "hosting",
    title: "Hosting visitors",
    body: "Crowd-pleasing north coast route with beach time, food stops, and easy map handoff.",
    templateId: "host-visitors",
    destinationIds: ["mobay", "negril", "ochi"],
    icon: Utensils,
    actionLabel: "Start host plan",
  },
];

export function HomeScreen({ app, onNavigate }: HomeScreenProps) {
  const handleHeroNavigate = (target: string) => {
    if (target === "planner") {
      onNavigate("trips");
      return;
    }
    if (target === "experiences" || target === "explore") {
      onNavigate("explore");
      return;
    }
    if (target === "map") {
      onNavigate("map");
      return;
    }
    if (target === "saved") {
      onNavigate("saved");
    }
  };

  const handleStartRoute = (starterRoute: (typeof STARTER_ROUTES)[number]) => {
    app.buildTripFromDestinations(starterRoute.destinationIds, starterRoute.templateId);
    onNavigate("trips");
  };

  return (
    <div className="min-h-screen">
      <HeroSection
        search={app.search}
        onSearchChange={app.setSearch}
        onNavigate={handleHeroNavigate}
        theme={app.theme}
        onToggleTheme={app.toggleTheme}
        videoSrc={app.heroVideoUrl}
        quickFacts={app.heroFacts}
      />

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-10">
        <section className={classNames("rounded-3xl p-4", glassPanel)}>
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/80">
            Start here
          </p>
          <h2 className="mt-1 text-lg font-semibold">What are you planning?</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Choose the path first. IrieVerse will tune the base, days, budget, route pacing, and saved ideas around it.
          </p>
          <div className="mt-4 grid gap-2 lg:grid-cols-3">
            {MODE_CARDS.map((mode) => (
              <PlanningModeCard
                key={mode.id}
                mode={mode.id}
                icon={mode.icon}
                active={app.planningMode === mode.id}
                onClick={() => app.setPlanningMode(mode.id)}
              />
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.26em] text-cyan-200/85">
                  Ready routes
                </p>
                <h3 className="text-base font-semibold">Skip setup and start with a Jamaica plan.</h3>
              </div>
              <p className="text-xs text-slate-400">Visitor, local, and hosting paths</p>
            </div>
            <div className="mt-3 grid gap-2 lg:grid-cols-3">
              {STARTER_ROUTES.map((starterRoute) => (
                <StarterRouteCard
                  key={starterRoute.id}
                  starterRoute={starterRoute}
                  onClick={() => handleStartRoute(starterRoute)}
                />
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.26em] text-slate-500">
                  Quick starts
                </p>
                <h3 className="text-base font-semibold">
                  {PLANNING_MODE_LABELS[app.planningMode].title}
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Active: {app.activePlanningTemplate.title}
              </p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {app.planningTemplates
                .filter((template) => template.mode === app.planningMode)
                .slice(0, 2)
                .map((template) => (
                  <PlanningTemplateCard
                    key={template.id}
                    template={template}
                    active={app.planningTemplateId === template.id}
                    onClick={() => {
                      app.applyPlanningTemplate(template.id);
                      onNavigate("trips");
                    }}
                  />
                ))}
            </div>
          </div>

          <div className="mt-4 grid gap-2 lg:grid-cols-3">
            <FirstTripStep
              step="1"
              icon={CalendarDays}
              title="Open your plan"
              body={`${app.destination.name} · ${app.plannerDays} day${app.plannerDays === 1 ? "" : "s"} · ${formatModeLabel(app.planningMode)} path.`}
              cta="Trips"
              onClick={() => onNavigate("trips")}
              primary
            />
            <FirstTripStep
              step="2"
              icon={Heart}
              title="Save ideas"
              body={`${app.savedPlaces.size + app.savedExperiences.size + app.importedIdeas.length} saved so far. Add places or paste links.`}
              cta="Saved"
              onClick={() => onNavigate("saved")}
            />
            <FirstTripStep
              step="3"
              icon={Route}
              title="Preview the route"
              body={`${app.itinerary.routeSummary.regionCount} regions · ${app.itinerary.routeSummary.totalDistanceKm} km · ${getWeatherCueLabel(app)}`}
              cta="Map"
              onClick={() => onNavigate("map")}
            />
          </div>
        </section>

        <aside className={classNames("overflow-hidden rounded-3xl", glassPanel)}>
          <div className="relative h-44 overflow-hidden">
            <img
              src={app.destination.heroImage}
              alt={app.destination.name}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="p-4">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-slate-500">
              Current plan
            </p>
            <h2 className="mt-1 text-xl font-semibold">{app.activePlanningTemplate.title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">{app.destination.headline}</p>
            <button
              type="button"
              onClick={() => onNavigate("trips")}
              className="mt-4 rounded-full bg-cyan-300 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-950"
            >
              Review trip
            </button>
          </div>
        </aside>
      </main>

      <PageFooter />
    </div>
  );
}

function PlanningModeCard({
  mode,
  icon: Icon,
  active,
  onClick,
}: {
  mode: PlanningMode;
  icon: typeof Plane;
  active: boolean;
  onClick: () => void;
}) {
  const modeCopy = PLANNING_MODE_LABELS[mode];

  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "group flex min-h-36 flex-col rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/60",
        active ? "border-cyan-300/45 bg-cyan-300/12" : glassCard
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-cyan-300/40 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-cyan-100">
          {modeCopy.label}
        </span>
        <Icon className="h-5 w-5 text-cyan-300" />
      </span>
      <span className="mt-4 block text-sm font-semibold text-slate-100">{modeCopy.title}</span>
      <span className="mt-1 block flex-1 text-xs leading-5 text-slate-500">{modeCopy.body}</span>
    </button>
  );
}

function PlanningTemplateCard({
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
        active ? "border-cyan-300/45 bg-cyan-300/10" : "border-slate-800 bg-slate-950/60"
      )}
    >
      <span className="text-[0.62rem] uppercase tracking-[0.2em] text-cyan-300/80">{template.eyebrow}</span>
      <span className="mt-1 block text-sm font-semibold text-slate-100">{template.title}</span>
      <span className="mt-1 block text-xs leading-5 text-slate-500">{template.body}</span>
      <span className="mt-3 inline-flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-cyan-200">
        Use template <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

function StarterRouteCard({
  starterRoute,
  onClick,
}: {
  starterRoute: (typeof STARTER_ROUTES)[number];
  onClick: () => void;
}) {
  const Icon = starterRoute.icon;
  const destinations = starterRoute.destinationIds
    .map((destinationId) => DESTINATIONS.find((destination) => destination.id === destinationId))
    .filter((destination): destination is (typeof DESTINATIONS)[number] => Boolean(destination));
  const leadDestination = destinations[0];

  return (
    <button
      type="button"
      onClick={onClick}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-slate-950/65 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/60"
    >
      <div className="relative h-28">
        {leadDestination && (
          <img
            src={leadDestination.heroImage}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent" />
        <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-cyan-300/25 bg-slate-950/70 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-cyan-100 backdrop-blur">
          <Icon className="h-3.5 w-3.5" />
          {destinations.length} stop{destinations.length === 1 ? "" : "s"}
        </div>
      </div>
      <div className="p-3">
        <h4 className="text-sm font-semibold text-slate-100">{starterRoute.title}</h4>
        <p className="mt-1 min-h-12 text-xs leading-5 text-slate-500">{starterRoute.body}</p>
        <div className="mt-3 flex max-w-full gap-1.5 overflow-x-auto pb-1">
          {destinations.map((destination) => (
            <span
              key={destination.id}
              className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[0.64rem] font-semibold text-slate-300"
            >
              {destination.name}
            </span>
          ))}
        </div>
        <span className="mt-3 inline-flex items-center gap-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-cyan-200">
          {starterRoute.actionLabel} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

function FirstTripStep({
  icon: Icon,
  step,
  title,
  body,
  cta,
  onClick,
  primary = false,
}: {
  icon: typeof Compass;
  step: string;
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "group flex min-h-40 flex-col rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/60",
        primary ? "border-cyan-300/40 bg-cyan-300/10" : glassCard
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-300 text-xs font-bold text-slate-950">
          {step}
        </span>
        <Icon className="h-5 w-5 text-cyan-300" />
      </span>
      <span className="mt-4 block text-sm font-semibold text-slate-100">{title}</span>
      <span className="mt-1 block flex-1 text-xs leading-5 text-slate-500">{body}</span>
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
        {cta} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function getWeatherCueLabel(app: TravelOS): string {
  const weatherReadyDayCount = app.itinerary.daysPlan.filter((day) => day.weather || day.weatherNote).length;
  return weatherReadyDayCount
    ? `${weatherReadyDayCount} days with weather cues`
    : "Adapts when weather is available";
}

function formatModeLabel(mode: PlanningMode): string {
  return PLANNING_MODE_LABELS[mode].label.toLowerCase();
}
