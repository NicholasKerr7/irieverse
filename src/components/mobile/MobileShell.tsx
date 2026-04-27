import { useEffect, useMemo, useState } from "react";
import { useTravelOS } from "../../hooks/useTravelOS";
import { ExploreScreen } from "../../screens/ExploreScreen";
import { HomeScreen } from "../../screens/HomeScreen";
import { MapScreen } from "../../screens/MapScreen";
import { SavedScreen } from "../../screens/SavedScreen";
import { TripsScreen } from "../../screens/TripsScreen";
import { BottomNav, type MobileTabId } from "./BottomNav";

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
      <div className="pb-28">{screen}</div>
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </div>
  );
}
