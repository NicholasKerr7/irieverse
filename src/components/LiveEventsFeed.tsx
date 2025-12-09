import { memo } from "react";
import { LiveEvent } from "../types/travel";
import { CalendarDays, RefreshCcw } from "lucide-react";

interface LiveEventsFeedProps {
  events: LiveEvent[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  selectedRegion: string;
}

export const LiveEventsFeed = memo(function LiveEventsFeed({
  events,
  isLoading,
  error,
  onRefresh,
  selectedRegion,
}: LiveEventsFeedProps) {
  return (
    <section className="max-w-6xl mx-auto bg-slate-950/80 border border-slate-800 rounded-3xl shadow-[0_24px_80px_rgba(15,23,42,0.9)] backdrop-blur-xl p-4 sm:p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/80">Live events</p>
          <h2 className="text-lg sm:text-xl font-semibold">What&apos;s on near {selectedRegion}</h2>
          <p className="text-xs sm:text-[0.8rem] text-slate-400">
            Pulling markets, music sessions, and pop-ups that match your vibe.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.2em] text-slate-200 hover:bg-slate-900/60 disabled:opacity-40"
          disabled={isLoading}
        >
          <RefreshCcw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {!error && !events.length && (
        <p className="text-xs text-slate-400">
          {isLoading ? "Syncing fresh events…" : "No live events for this region right now."}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {events.map((event) => (
          <article
            key={event.id}
            className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 flex flex-col gap-2 shadow shadow-slate-950/30"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{event.title}</h3>
              <span className="text-[0.65rem] uppercase tracking-[0.2em] text-cyan-300">
                {event.vibes?.join(" · ") ?? "event"}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {event.city} · {event.venue}
            </p>
            <div className="flex items-center gap-2 text-[0.75rem] text-slate-200">
              <CalendarDays className="w-3.5 h-3.5 text-emerald-300" />
              <span>{formatEventTime(event.startDate)}</span>
            </div>
            <p className="text-xs text-slate-300">{event.description}</p>
            <p className="text-[0.7rem] text-slate-400">{event.price}</p>
          </article>
        ))}
      </div>
    </section>
  );
});

function formatEventTime(isoString: string): string {
  if (!isoString) return "TBA";
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "TBA";
  }
}
