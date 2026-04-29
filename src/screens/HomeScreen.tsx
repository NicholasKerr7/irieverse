import { ArrowRight, Compass, Heart, Route } from "lucide-react";
import { HeroSection } from "../components/HeroSection";
import { PageFooter } from "../components/PageFooter";
import type { MobileTabId } from "../components/mobile/BottomNav";
import type { TravelOS } from "../hooks/useTravelOS";
import { classNames } from "../utils/classNames";
import { glassCard, glassPanel } from "../utils/glass";

type HomeScreenProps = {
  app: TravelOS;
  onNavigate: (tab: MobileTabId) => void;
};

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
          <h2 className="mt-1 text-lg font-semibold">Build a first Jamaica trip in 3 steps.</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Pick the basics, save a few local ideas, then let road pacing and weather cues shape the days.
          </p>
          <div className="mt-4 grid gap-2 lg:grid-cols-3">
            <FirstTripStep
              step="1"
              icon={Compass}
              title="Choose base + dates"
              body={`${app.destination.name} is selected. Tune days, vibe, and budget when ready.`}
              cta="Start trip"
              onClick={() => onNavigate("trips")}
              primary
            />
            <FirstTripStep
              step="2"
              icon={Heart}
              title="Save local ideas"
              body={`${app.savedPlaces.size + app.savedExperiences.size + app.importedIdeas.length} saved so far. Add places or paste links.`}
              cta="Open Saved"
              onClick={() => onNavigate("saved")}
            />
            <FirstTripStep
              step="3"
              icon={Route}
              title="Preview route + weather"
              body={`${app.itinerary.routeSummary.regionCount} regions · ${app.itinerary.routeSummary.totalDistanceKm} km · ${getWeatherCueLabel(app)}`}
              cta="Open map"
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
              Current base
            </p>
            <h2 className="mt-1 text-xl font-semibold">{app.destination.name}</h2>
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
