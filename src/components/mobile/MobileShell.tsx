import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useTravelOS } from "../../hooks/useTravelOS";
import { ExploreScreen } from "../../screens/ExploreScreen";
import { HomeScreen } from "../../screens/HomeScreen";
import { SavedScreen } from "../../screens/SavedScreen";
import { TripsScreen } from "../../screens/TripsScreen";
import { BottomNav, type MobileTabId } from "./BottomNav";

const MapScreen = lazy(() =>
  import("../../screens/MapScreen").then((module) => ({ default: module.MapScreen }))
);

export function MobileShell() {
  const [activeTab, setActiveTab] = useState<MobileTabId>("home");
  const travelOS = useTravelOS();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);

  const screen = useMemo(() => {
    switch (activeTab) {
      case "explore":
        return <ExploreScreen app={travelOS} onNavigate={setActiveTab} />;
      case "map":
        return <MapScreen app={travelOS} onNavigate={setActiveTab} />;
      case "saved":
        return <SavedScreen app={travelOS} onNavigate={setActiveTab} />;
      case "trips":
        return <TripsScreen app={travelOS} onNavigate={setActiveTab} />;
      case "home":
      default:
        return <HomeScreen app={travelOS} onNavigate={setActiveTab} />;
    }
  }, [activeTab, travelOS]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pb-28">
        <Suspense fallback={<ScreenFallback />}>{screen}</Suspense>
      </div>
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </div>
  );
}

function ScreenFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-6 py-5 shadow-xl shadow-slate-950/40">
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-cyan-300">Loading</p>
        <p className="mt-2 text-sm text-slate-400">Preparing the map workspace...</p>
      </div>
    </div>
  );
}
