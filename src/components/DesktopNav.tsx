import { Plane, Sparkles } from "lucide-react";
import type { MobileTabId } from "./mobile/BottomNav";
import { NAV_TABS } from "./mobile/BottomNav";
import { ThemeToggleButton } from "./ThemeToggleButton";
import type { ThemeMode } from "../hooks/useTravelOS";
import { classNames } from "../utils/classNames";

type DesktopNavProps = {
  activeTab: MobileTabId;
  onChange: (tab: MobileTabId) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
};

export function DesktopNav({ activeTab, onChange, theme, onToggleTheme }: DesktopNavProps) {
  return (
    <header
      className="app-desktop-nav sticky top-0 z-50 hidden border-b px-6 py-3 backdrop-blur-2xl md:block"
      data-testid="desktop-header-nav"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
        <button
          type="button"
          onClick={() => onChange("home")}
          className="group flex items-center gap-3 text-left"
          aria-label="IrieVerse home"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/12 text-cyan-100 shadow-lg shadow-cyan-500/10 transition group-hover:border-cyan-300/60">
            <Sparkles className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-[0.22em] text-cyan-100">IRIEVERSE</span>
            <span className="block text-xs text-slate-400">Jamaica trip planner</span>
          </span>
        </button>

        <nav
          className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.045] p-1 backdrop-blur-xl"
          aria-label="Primary navigation"
        >
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                className={classNames(
                  "inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition",
                  isActive
                    ? "bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-500/20"
                    : "text-slate-300 hover:bg-white/7 hover:text-cyan-100"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggleButton
            theme={theme}
            onToggleTheme={onToggleTheme}
            showLabel
            testId="desktop-theme-toggle"
          />
          <button
            type="button"
            onClick={() => onChange("trips")}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-300/35 bg-emerald-300/10 px-4 text-sm font-bold text-emerald-100 transition hover:border-emerald-300/70 hover:bg-emerald-300/15"
          >
            <Plane className="h-4 w-4" />
            Build Trip
          </button>
        </div>
      </div>
    </header>
  );
}
