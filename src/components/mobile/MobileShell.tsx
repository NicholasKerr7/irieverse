import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { DesktopNav } from "../DesktopNav";
import { ScreenSkeleton } from "../LoadingStates";
import { ThemeToggleButton } from "../ThemeToggleButton";
import { useTravelOS } from "../../hooks/useTravelOS";
import { ExploreScreen } from "../../screens/ExploreScreen";
import { HomeScreen } from "../../screens/HomeScreen";
import { SavedScreen } from "../../screens/SavedScreen";
import { TripsScreen } from "../../screens/TripsScreen";
import { BottomNav, type MobileTabId } from "./BottomNav";

const MapScreen = lazy(() =>
  import("../../screens/MapScreen").then((module) => ({ default: module.MapScreen }))
);

const VALID_TABS: MobileTabId[] = ["home", "explore", "map", "saved", "trips"];

export function MobileShell() {
  const [activeTab, setActiveTab] = useState<MobileTabId>(() => getInitialTab());
  const travelOS = useTravelOS();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);

  useEffect(() => {
    const nextUrl = buildTabUrl(activeTab);
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, "", nextUrl);
    }
  }, [activeTab]);

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getInitialTab());
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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
    <div className="app-shell min-h-dvh [padding-top:env(safe-area-inset-top)]">
      {activeTab !== "home" && (
        <DesktopNav
          activeTab={activeTab}
          onChange={setActiveTab}
          theme={travelOS.theme}
          onToggleTheme={travelOS.toggleTheme}
        />
      )}
      {activeTab !== "home" && (
        <div className="fixed right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 md:hidden">
          <ThemeToggleButton
            theme={travelOS.theme}
            onToggleTheme={travelOS.toggleTheme}
            className="h-11 w-11 px-0"
            testId="mobile-theme-toggle"
          />
        </div>
      )}
      <div className="pb-[calc(env(safe-area-inset-bottom)+6.1rem)] md:pb-0">
        <Suspense fallback={<ScreenSkeleton label={getLoadingLabel(activeTab)} />}>{screen}</Suspense>
      </div>
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </div>
  );
}

function getInitialTab(): MobileTabId {
  if (typeof window === "undefined") return "home";
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  if (isMobileTabId(tab)) return tab;
  return params.has("trip") ? "trips" : "home";
}

function getLoadingLabel(tab: MobileTabId): string {
  if (tab === "map") return "Building Jamaica map";
  if (tab === "saved") return "Opening saved board";
  if (tab === "trips") return "Preparing trip plan";
  if (tab === "explore") return "Loading Jamaica ideas";
  return "Preparing IrieVerse";
}

function isMobileTabId(value: string | null): value is MobileTabId {
  return Boolean(value && VALID_TABS.includes(value as MobileTabId));
}

function buildTabUrl(activeTab: MobileTabId): string {
  const url = new URL(window.location.href);
  if (activeTab === "home") {
    url.searchParams.delete("tab");
  } else {
    url.searchParams.set("tab", activeTab);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
