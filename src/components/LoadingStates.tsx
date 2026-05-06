import { Compass, MapPinned } from "lucide-react";
import { classNames } from "../utils/classNames";
import { glassPanelStrong } from "../utils/glass";

type ScreenSkeletonProps = {
  label?: string;
};

type CardGridSkeletonProps = {
  count?: number;
};

export function ScreenSkeleton({ label = "Preparing Jamaica" }: ScreenSkeletonProps) {
  return (
    <div className="mx-auto min-h-[calc(100dvh-6rem)] max-w-7xl px-4 py-5 sm:px-6 lg:px-10">
      <div className={classNames("overflow-hidden rounded-3xl", glassPanelStrong)}>
        <div className="grid gap-0 lg:grid-cols-[1fr_0.72fr]">
          <div className="p-5 sm:p-6">
            <div className="inline-flex min-h-10 items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-cyan-100">
              <Compass className="h-3.5 w-3.5" /> {label}
            </div>
            <div className="mt-6 space-y-3">
              <SkeletonBlock className="h-9 w-3/4 max-w-xl" />
              <SkeletonBlock className="h-4 w-full max-w-2xl" />
              <SkeletonBlock className="h-4 w-2/3 max-w-lg" />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <SkeletonBlock className="h-10 w-28 rounded-full" />
              <SkeletonBlock className="h-10 w-24 rounded-full" />
              <SkeletonBlock className="h-10 w-32 rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-0 border-t border-slate-800 bg-slate-950/45 lg:border-l lg:border-t-0">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="border-b border-r border-slate-800 p-4">
                <SkeletonBlock className="h-3 w-16" />
                <SkeletonBlock className="mt-3 h-6 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="rounded-3xl border border-slate-800 bg-slate-950/55 p-4">
            <SkeletonBlock className="h-36 w-full rounded-2xl" />
            <SkeletonBlock className="mt-4 h-4 w-2/3" />
            <SkeletonBlock className="mt-3 h-3 w-full" />
            <SkeletonBlock className="mt-2 h-3 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MapCanvasSkeleton() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden bg-slate-950">
      <div className="absolute inset-0 opacity-70">
        <div className="absolute left-[8%] top-[18%] h-24 w-24 rounded-full border border-cyan-300/20" />
        <div className="absolute right-[12%] top-[22%] h-32 w-32 rounded-full border border-emerald-300/15" />
        <div className="absolute bottom-[18%] left-[18%] h-40 w-40 rounded-full border border-cyan-300/10" />
      </div>
      <div className="absolute inset-x-8 top-8 flex items-center justify-between gap-3">
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-cyan-100">
          Building map
        </div>
        <MapPinned className="h-5 w-5 animate-pulse text-cyan-200" />
      </div>
      <div className="absolute left-[16%] top-[45%] h-2 w-[68%] -rotate-12 rounded-full bg-cyan-300/25" />
      <div className="absolute left-[22%] top-[56%] h-2 w-[54%] rotate-6 rounded-full bg-emerald-300/20" />
      <div className="absolute bottom-8 left-8 right-8 rounded-3xl border border-slate-800 bg-slate-950/75 p-4">
        <SkeletonBlock className="h-4 w-1/2" />
        <SkeletonBlock className="mt-3 h-3 w-full" />
        <SkeletonBlock className="mt-2 h-3 w-3/4" />
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 2 }: CardGridSkeletonProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SkeletonBlock className="h-4 w-3/4" />
              <SkeletonBlock className="mt-3 h-3 w-1/2" />
            </div>
            <SkeletonBlock className="h-7 w-16 rounded-full" />
          </div>
          <SkeletonBlock className="mt-4 h-3 w-full" />
          <SkeletonBlock className="mt-2 h-3 w-5/6" />
        </div>
      ))}
    </div>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={classNames(
        "animate-pulse rounded-full bg-slate-800/80 shadow-inner shadow-slate-950/30",
        className
      )}
    />
  );
}
