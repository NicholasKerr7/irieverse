import {
  ArrowRight,
  CalendarDays,
  MapPinned,
  MoonStar,
  Search,
  Sparkles,
  SunMedium,
} from "lucide-react";
import { ChangeEvent, KeyboardEvent } from "react";
import { QuickFact } from "../types/travel";

type ThemeMode = "dark" | "light";

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
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,13,22,0.35)_0%,rgba(8,13,22,0.74)_48%,#020617_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950 to-transparent" />

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

        <div className="hidden items-center gap-6 text-xs uppercase tracking-[0.2em] md:flex">
          <button type="button" onClick={() => onNavigate("explore")} className="text-slate-200/80 hover:text-white">
            Explore
          </button>
          <button type="button" onClick={() => onNavigate("map")} className="text-slate-200/80 hover:text-white">
            Map
          </button>
          <button type="button" onClick={() => onNavigate("planner")} className="text-slate-200/80 hover:text-white">
            Trips
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700/80 bg-slate-950/70 text-cyan-200 shadow-lg shadow-slate-950/60 backdrop-blur"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <SunMedium className="h-4 w-4 text-amber-300" />
          ) : (
            <MoonStar className="h-4 w-4 text-cyan-300" />
          )}
        </button>
      </nav>

      <div className="relative z-10 mx-auto grid max-w-7xl gap-8 px-4 pb-16 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1.08fr_0.92fr] lg:px-10">
        <div className="flex min-h-[48vh] flex-col justify-center">
          <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/25 bg-slate-950/55 px-3 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-cyan-200 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Jamaica first travel planning
          </p>

          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl lg:text-6xl">
            IrieVerse Travel OS
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
            Plan Jamaica by vibe, route, budget, flights, and real island experiences.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate("planner")}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-xl shadow-cyan-500/25 transition hover:bg-cyan-200"
            >
              <CalendarDays className="h-4 w-4" /> Start planning
            </button>
            <button
              type="button"
              onClick={() => onNavigate("map")}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-500/80 bg-slate-950/65 px-5 py-3 text-sm font-semibold text-slate-100 backdrop-blur transition hover:border-cyan-300/70 hover:text-cyan-100"
            >
              <MapPinned className="h-4 w-4" /> Open map
            </button>
          </div>
        </div>

        <div className="flex items-center lg:justify-end">
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-slate-950/62 p-4 shadow-2xl shadow-slate-950/60 backdrop-blur-xl sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.28em] text-cyan-200">Search Jamaica</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Find the right island flow</h2>
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
