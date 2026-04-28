import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { CalendarDays, Compass, Heart, Home, MapPinned } from "lucide-react";
import { classNames } from "../../utils/classNames";
import { glassPanelStrong } from "../../utils/glass";

export type MobileTabId = "home" | "explore" | "map" | "saved" | "trips";

type MobileTab = {
  id: MobileTabId;
  label: string;
  icon: ComponentType<LucideProps>;
};

export const NAV_TABS: MobileTab[] = [
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
      className="app-bottom-nav fixed inset-x-0 bottom-0 z-50 select-none border-t px-2 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-1.5 backdrop-blur-2xl md:hidden"
      aria-label="Primary navigation"
      data-testid="mobile-bottom-nav"
    >
      <div className={classNames("mx-auto grid max-w-md grid-cols-5 gap-1 rounded-[1.15rem] p-1", glassPanelStrong)}>
        {NAV_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex min-h-12 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-xl text-[0.62rem] font-medium transition ${
                isActive
                  ? "bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-500/25"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              }`}
              aria-current={isActive ? "page" : undefined}
              aria-label={tab.label}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
