import { CalendarDays, Compass, Heart, MapPinned } from "lucide-react";
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
            Continue
          </p>
          <h2 className="mt-1 text-lg font-semibold">Plan Jamaica from {app.destination.name}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Search the island, save ideas, preview the route, and turn everything into a practical trip plan.
            Your base, budget, saved places, flights, and events stay connected as you move.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <HomeAction
              icon={Compass}
              label="Explore places"
              body={`${app.filteredDestinations.length} matching places`}
              onClick={() => onNavigate("explore")}
            />
            <HomeAction
              icon={MapPinned}
              label="Open map"
              body="Pins, regions, and route starts"
              onClick={() => onNavigate("map")}
            />
            <HomeAction
              icon={Heart}
              label="Saved"
              body={`${app.savedPlaces.size + app.savedExperiences.size + app.importedIdeas.length} saved ideas`}
              onClick={() => onNavigate("saved")}
            />
            <HomeAction
              icon={CalendarDays}
              label="Trip builder"
              body={`${app.plannerDays} days · $${app.plannerBudget}/day`}
              onClick={() => onNavigate("trips")}
            />
          </div>
        </section>

        <aside className={classNames("overflow-hidden rounded-3xl", glassPanel)}>
          <img
            src={app.destination.heroImage}
            alt={app.destination.name}
            className="h-44 w-full object-cover"
          />
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

function HomeAction({
  icon: Icon,
  label,
  body,
  onClick,
}: {
  icon: typeof Compass;
  label: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames("rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/60", glassCard)}
    >
      <Icon className="h-5 w-5 text-cyan-300" />
      <p className="mt-3 text-sm font-semibold text-slate-100">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{body}</p>
    </button>
  );
}
