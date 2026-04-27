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
    <div className="min-h-dvh bg-slate-950 text-slate-100 [padding-top:env(safe-area-inset-top)]">
      <div className="pb-[calc(env(safe-area-inset-bottom)+7.5rem)]">
        <Suspense fallback={<ScreenFallback />}>{screen}</Suspense>
      </div>
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </div>
  );
}

function ScreenFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 text-center">
      <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/40">
        <div className="mx-auto h-10 w-10 animate-pulse rounded-2xl bg-cyan-300/25" />
        <p className="mt-4 text-[0.65rem] uppercase tracking-[0.28em] text-cyan-300">Loading</p>
        <div className="mt-4 space-y-2">
          <div className="mx-auto h-3 w-48 animate-pulse rounded-full bg-slate-700" />
          <div className="mx-auto h-3 w-32 animate-pulse rounded-full bg-slate-800" />
        </div>
      </div>
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
