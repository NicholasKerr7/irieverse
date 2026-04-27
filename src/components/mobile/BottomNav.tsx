import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { CalendarDays, Compass, Heart, Home, MapPinned } from "lucide-react";

export type MobileTabId = "home" | "explore" | "map" | "saved" | "trips";

type MobileTab = {
  id: MobileTabId;
  label: string;
  icon: ComponentType<LucideProps>;
};

const TABS: MobileTab[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "explore", label: "Explore", icon: Compass },
  { id: "map", label: "Map", icon: MapPinned },
  { id: "saved", label: "Saved", icon: Heart },
  { id: "trips", label: "Trips", icon: CalendarDays },
];

type BottomNavProps = {
  activeTab: MobileTabId;
  onChange: (tab: MobileTabId) => void;
};

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 select-none border-t border-slate-800/90 bg-slate-950/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 backdrop-blur-xl"
      aria-label="Primary navigation"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 rounded-2xl border border-slate-800 bg-slate-900/95 p-1 shadow-2xl shadow-slate-950/70">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex min-h-14 touch-manipulation flex-col items-center justify-center gap-1 rounded-xl text-[0.68rem] font-medium transition ${
                isActive
                  ? "bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-500/25"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              }`}
              aria-current={isActive ? "page" : undefined}
              aria-label={tab.label}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
