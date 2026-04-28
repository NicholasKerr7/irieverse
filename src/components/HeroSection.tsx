import {
  ArrowRight,
  CalendarDays,
  CloudSun,
  Compass,
  Heart,
  MapPinned,
  Music2,
  Search,
  Sparkles,
} from "lucide-react";
import { ChangeEvent, KeyboardEvent } from "react";
import { ThemeToggleButton } from "./ThemeToggleButton";
import { QuickFact } from "../types/travel";
import type { ThemeMode } from "../hooks/useTravelOS";

interface HeroSectionProps {
  search: string;
  onSearchChange: (value: string) => void;
  onNavigate: (sectionId: string) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  videoSrc: string;
  quickFacts: QuickFact[];
}

export function HeroSection({
  search,
  onSearchChange,
  onNavigate,
  theme,
  onToggleTheme,
  videoSrc,
  quickFacts,
}: HeroSectionProps) {
  const visibleFacts = quickFacts.slice(0, 4);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(event.target.value);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      onNavigate("explore");
    }
  };

  return (
    <header className="relative min-h-[82vh] overflow-hidden border-b border-slate-800/70">
      <video
        className="absolute inset-0 h-full w-full object-cover saturate-125 contrast-110 brightness-[0.72]"
        autoPlay
        muted
        loop
        playsInline
        src={videoSrc}
      />
      <div className="hero-video-scrim absolute inset-0" />
      <div className="hero-bottom-fade absolute inset-x-0 bottom-0 h-40" />

      <nav className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-4 pt-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="h-6 w-10 overflow-hidden rounded-full ring-2 ring-slate-950 shadow shadow-cyan-400/50">
            <div className="h-full w-full bg-gradient-to-r from-green-600 via-yellow-400 to-black" />
          </div>
          <div className="flex flex-col">
            <span className="text-[0.7rem] uppercase tracking-[0.24em] text-cyan-200">IrieVerse</span>
            <span className="text-xs text-slate-300/80">Jamaica Travel OS</span>
          </div>
        </div>

        <div
          className="hidden items-center gap-1 rounded-full border border-white/15 bg-slate-950/48 p-1 shadow-2xl shadow-slate-950/25 backdrop-blur-2xl md:flex"
          data-testid="hero-desktop-nav"
        >
          <HeroNavButton icon={Compass} label="Explore" onClick={() => onNavigate("explore")} />
          <HeroNavButton icon={MapPinned} label="Map" onClick={() => onNavigate("map")} />
          <HeroNavButton icon={Heart} label="Saved" onClick={() => onNavigate("saved")} />
          <HeroNavButton icon={CalendarDays} label="Trips" onClick={() => onNavigate("planner")} />
        </div>

        <ThemeToggleButton
          theme={theme}
          onToggleTheme={onToggleTheme}
          className="h-10 w-10 px-0"
          testId="hero-theme-toggle"
        />
      </nav>

      <div className="relative z-10 mx-auto grid max-w-7xl gap-8 px-4 pb-16 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1.08fr_0.92fr] lg:px-10">
        <div className="flex min-h-[48vh] flex-col justify-center">
          <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/25 bg-slate-950/55 px-3 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-cyan-200 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Jamaica route + weather intelligence
          </p>

          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-slate-100 sm:text-5xl lg:text-6xl">
            IrieVerse Travel OS
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
            Plan around Jamaica's real regions, road times, weather shifts, food stops,
            music nights, beaches, and saved ideas from anywhere.
          </p>

          <div className="mt-5 flex max-w-2xl flex-wrap gap-2">
            <HeroSignal icon={Compass} label="1. Choose a base" />
            <HeroSignal icon={Music2} label="2. Save local ideas" />
            <HeroSignal icon={CloudSun} label="3. Route + weather" />
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate("planner")}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-xl shadow-cyan-500/25 transition hover:bg-cyan-200"
            >
              <CalendarDays className="h-4 w-4" /> Build first trip
            </button>
            <button
              type="button"
              onClick={() => onNavigate("explore")}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-500/80 bg-slate-950/65 px-5 py-3 text-sm font-semibold text-slate-100 backdrop-blur transition hover:border-cyan-300/70 hover:text-cyan-100"
            >
              <Compass className="h-4 w-4" /> Explore Jamaica
            </button>
          </div>
        </div>

        <div className="flex items-center lg:justify-end">
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-slate-950/62 p-4 shadow-2xl shadow-slate-950/60 backdrop-blur-xl sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.28em] text-cyan-200">Search Jamaica</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-100">Find the right region, route, and vibe</h2>
              </div>
              <Search className="h-5 w-5 text-cyan-200" />
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={search}
                onChange={handleChange}
                onKeyDown={handleSearchKeyDown}
                placeholder="Montego Bay, jerk, sound system, Blue Lagoon..."
                className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => onNavigate("explore")}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-slate-950"
                aria-label="Search Explore"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {visibleFacts.map((fact) => (
                <div
                  key={fact.label}
                  className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3"
                >
                  <p className="text-[0.62rem] uppercase tracking-[0.22em] text-slate-400">{fact.label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">{fact.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[0.68rem] uppercase tracking-[0.16em] text-slate-300">
              <button
                type="button"
                onClick={() => onNavigate("explore")}
                className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 hover:border-cyan-300/60"
              >
                Places
              </button>
              <button
                type="button"
                onClick={() => onNavigate("explore")}
                className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 hover:border-emerald-300/60"
              >
                Experiences
              </button>
              <button
                type="button"
                onClick={() => onNavigate("planner")}
                className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 hover:border-amber-300/60"
              >
                Budget
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
    </header>
  );
}

function HeroNavButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Compass;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-cyan-100"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function HeroSignal({
  icon: Icon,
  label,
}: {
  icon: typeof Compass;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/55 px-3 py-2 text-xs font-semibold text-slate-100 backdrop-blur">
      <Icon className="h-3.5 w-3.5 text-cyan-200" />
      {label}
    </span>
  );
}
