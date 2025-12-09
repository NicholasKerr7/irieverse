import { CalendarDays, MapPin, MoonStar, SunMedium } from "lucide-react";
import { ChangeEvent } from "react";
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
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(event.target.value);
  };

  return (
    <header className="relative min-h-[70vh] overflow-hidden border-b border-slate-800/70">
      <video
        className="absolute inset-0 w-full h-full object-cover saturate-125 contrast-110 brightness-[0.75]"
        autoPlay
        muted
        loop
        playsInline
        src={videoSrc}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/30 via-slate-950/80 to-slate-950/95" />

      {/* Mobile Nav */}
      <div className="md:hidden relative z-20 px-4 pt-4">
        <div className="flex items-center justify-between rounded-2xl border border-cyan-400/30 bg-slate-950/80 px-4 py-3 shadow-xl shadow-cyan-500/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-6 rounded-full bg-gradient-to-r from-yellow-400 via-green-500 to-black animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[0.6rem] tracking-[0.25em] uppercase text-cyan-200">
                IrieVerse
              </span>
              <span className="text-[0.65rem] text-slate-200/80 tracking-[0.12em]">
                Jamaica OS
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-slate-700/70 bg-slate-900/80 text-cyan-200"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <SunMedium className="w-4 h-4 text-amber-300" />
            ) : (
              <MoonStar className="w-4 h-4 text-cyan-300" />
            )}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[0.6rem] uppercase tracking-[0.2em] text-slate-200/80">
          {["explore", "planner", "experiences"].map((link) => (
            <button
              key={link}
              type="button"
              className="rounded-full border border-slate-700/70 bg-slate-950/70 py-2 shadow shadow-slate-950/40"
              onClick={() => onNavigate(link)}
            >
              {link}
            </button>
          ))}
        </div>
      </div>

      <nav className="relative z-10 hidden md:flex items-center justify-between px-6 lg:px-12 pt-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-5 rounded-full shadow shadow-cyan-400/70 overflow-hidden ring-2 ring-slate-950">
            <div className="w-full h-full bg-gradient-to-r from-green-600 via-yellow-400 to-black" />
          </div>
          <div className="flex flex-col">
            <span className="text-[0.75rem] tracking-[0.2em] uppercase text-cyan-300">IrieVerse</span>
            <span className="text-xs text-slate-300/80">Jamaica · Travel OS</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6 text-xs tracking-[0.2em] uppercase">
          <button type="button" onClick={() => onNavigate("explore")} className="text-slate-200/80 hover:text-white">
            Explore
          </button>
          <button type="button" onClick={() => onNavigate("planner")} className="text-slate-200/80 hover:text-white">
            Trip planner
          </button>
          <button type="button" onClick={() => onNavigate("experiences")} className="text-slate-200/80 hover:text-white">
            Experiences
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-700/80 bg-slate-950/70 backdrop-blur shadow-lg shadow-slate-950/60"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <SunMedium className="w-4 h-4 text-amber-300" />
          ) : (
            <MoonStar className="w-4 h-4 text-cyan-300" />
          )}
        </button>
      </nav>

      <div className="relative z-10 px-5 sm:px-6 lg:px-12 pb-16 pt-12 md:pt-10 max-w-5xl text-center md:text-left">
        <p className="text-[0.7rem] tracking-[0.3em] uppercase text-cyan-300/80 mb-4">
          876 · beaches · blue holes · basslines
        </p>
        <h1 className="hero-title text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[0.16em] uppercase">
          Jamaica, remixed into a travel OS.
        </h1>
        <p className="mt-3 text-sm sm:text-base text-slate-200/90 max-w-xl">
          IrieVerse blends destinations, food runs, sound system nights and festivals into one sleek planner. Build your trip by vibe — not just by pins on a map.
        </p>

        <div className="mt-5 flex flex-wrap gap-3 items-center">
          <button
            type="button"
            onClick={() => onNavigate("explore")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 text-xs sm:text-[0.8rem] font-semibold tracking-[0.18em] uppercase shadow-xl shadow-cyan-500/40"
          >
            <MapPin className="w-4 h-4" /> Start exploring
          </button>
          <button
            type="button"
            onClick={() => onNavigate("planner")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-500/80 bg-slate-950/60 text-[0.7rem] sm:text-xs tracking-[0.18em] uppercase text-slate-200/90"
          >
            <CalendarDays className="w-4 h-4" /> Build itinerary
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3 max-w-3xl text-left">
          {quickFacts.map((fact) => (
            <div
              key={fact.label}
              className="rounded-2xl border border-slate-700/70 bg-slate-950/70 backdrop-blur px-4 py-3 shadow-lg shadow-slate-950/50"
            >
              <p className="text-[0.6rem] uppercase tracking-[0.25em] text-slate-400">{fact.label}</p>
              <p className="text-sm font-semibold text-slate-100">{fact.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 max-w-md mx-auto md:mx-0">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-950/70 border border-slate-600/70 backdrop-blur shadow-lg shadow-slate-950/60">
            <span className="text-xs text-slate-400">Search spots or experiences</span>
          </div>
          <input
            value={search}
            onChange={handleChange}
            placeholder="Montego Bay, jerk, sound system, Blue Lagoon…"
            className="mt-2 w-full px-4 py-2 rounded-full bg-slate-950/80 border border-slate-700/80 text-xs sm:text-sm outline-none focus:border-cyan-400/80"
          />
        </div>
      </div>
    </header>
  );
}
