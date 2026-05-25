import { memo } from "react";
import { LiveEvent } from "../types/travel";
import type { EventsApiMeta } from "../types/api";
import { AlertTriangle, CalendarDays, CheckCircle2, Database, ExternalLink, PartyPopper, RadioTower, RefreshCcw, Ticket } from "lucide-react";
import { CardGridSkeleton, EmptyStatePanel } from "./LoadingStates";
import { classNames } from "../utils/classNames";
import { glassCard, glassPanel } from "../utils/glass";

interface LiveEventsFeedProps {
  events: LiveEvent[];
  isLoading: boolean;
  error: string | null;
  sourceMeta: EventsApiMeta;
  onRefresh: () => void;
  selectedRegion: string;
}

export const LiveEventsFeed = memo(function LiveEventsFeed({
  events,
  isLoading,
  error,
  sourceMeta,
  onRefresh,
  selectedRegion,
}: LiveEventsFeedProps) {
  const sourceStatus = getEventSourceStatus(sourceMeta, isLoading);
  const SourceIcon = sourceStatus.tone === "live" ? RadioTower : Database;

  return (
    <section className={classNames("max-w-6xl mx-auto rounded-3xl p-4 sm:p-6 space-y-4", glassPanel)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/80">Island calendar</p>
          <h2 className="text-lg sm:text-xl font-semibold">What&apos;s on near {selectedRegion}</h2>
          <p className="text-xs sm:text-[0.8rem] text-slate-400">
            Markets, music sessions, and pop-ups that match the region you are planning around.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div
            className={classNames(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.16em]",
              sourceStatus.tone === "live"
                ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
                : sourceStatus.tone === "error"
                  ? "border-rose-300/35 bg-rose-300/10 text-rose-100"
                  : "border-amber-300/35 bg-amber-300/10 text-amber-100"
            )}
          >
            <SourceIcon className="h-3.5 w-3.5" />
            {sourceStatus.label}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-700/80 px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.2em] text-slate-200 hover:bg-slate-900/60 disabled:opacity-40"
            disabled={isLoading}
          >
            <RefreshCcw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <p className="rounded-2xl border border-slate-700/70 bg-slate-950/35 px-3 py-2 text-xs leading-5 text-slate-300">
        {sourceStatus.body}
      </p>

      {error && (
        <EmptyStatePanel
          icon={AlertTriangle}
          eyebrow="Events"
          title="Island calendar needs a refresh"
          body={error}
          actionLabel="Refresh events"
          onAction={onRefresh}
          tone="error"
        />
      )}

      {!error && isLoading && !events.length && <CardGridSkeleton count={2} />}

      {!error && !isLoading && !events.length && (
        <EmptyStatePanel
          icon={PartyPopper}
          eyebrow="Events"
          title="No events matched this region yet"
          body="Try refreshing, or switch the trip base to a nearby area with more music, food, and culture options."
          actionLabel="Refresh events"
          onAction={onRefresh}
          tone="info"
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {events.map((event) => {
          const eventSource = getEventSourceBadge(event);

          return (
            <article
              key={event.id}
              className={classNames("rounded-2xl p-4 flex flex-col gap-2", glassCard)}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold">{event.title}</h3>
                <span className="text-right text-[0.65rem] uppercase tracking-[0.2em] text-cyan-300">
                  {event.vibes?.join(" · ") ?? "event"}
                </span>
              </div>
              <div
                className={classNames(
                  "inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em]",
                  eventSource.tone === "verified"
                    ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
                    : eventSource.tone === "live"
                      ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100"
                      : "border-amber-300/35 bg-amber-300/10 text-amber-100"
                )}
              >
                {eventSource.tone === "curated" ? <Database className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {eventSource.label}
              </div>
              <p className="text-xs text-slate-400">
                {event.city} · {event.venue}
              </p>
              <div className="flex items-center gap-2 text-[0.75rem] text-slate-200">
                <CalendarDays className="w-3.5 h-3.5 text-emerald-300" />
                <span>{event.dateLabel ?? formatEventTime(event.startDate)}</span>
              </div>
              <p className="text-xs text-slate-300">{event.description}</p>
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950/45 px-3 py-2">
                <p className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-amber-100">
                  <Ticket className="h-3.5 w-3.5" />
                  {event.price ?? "Confirm access"}
                </p>
                {event.ticketRequirement && (
                  <p className="mt-1 text-xs leading-5 text-slate-400">{event.ticketRequirement}</p>
                )}
              </div>
              {event.officialUrl && (
                <a
                  href={event.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-200 hover:text-cyan-100"
                >
                  Check details <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
});

type EventSourceTone = "live" | "fallback" | "error";
type EventBadgeTone = "verified" | "live" | "curated";

function getEventSourceBadge(event: LiveEvent): { label: string; tone: EventBadgeTone } {
  if (event.sourceKind === "verified" || event.id.startsWith("verified-")) {
    return { label: event.sourceLabel ?? "Verified island calendar", tone: "verified" };
  }

  if (event.sourceKind === "eventbrite" || event.id.startsWith("eventbrite-")) {
    return { label: event.sourceLabel ?? "Eventbrite", tone: "live" };
  }

  if (event.sourceKind === "ticketmaster" || event.id.startsWith("ticketmaster-")) {
    return { label: event.sourceLabel ?? "Ticketmaster", tone: "live" };
  }

  return { label: event.sourceLabel ?? "Curated Jamaica calendar", tone: "curated" };
}

function getEventSourceStatus(
  meta: EventsApiMeta,
  isLoading: boolean
): { label: string; tone: EventSourceTone; body: string } {
  if (isLoading) {
    return {
      label: "Checking events",
      tone: "fallback",
      body: "Refreshing the verified island calendar, Eventbrite, Ticketmaster, and curated Jamaica picks for this area.",
    };
  }

  if (meta.source === "live") {
    return {
      label: "Live events",
      tone: "live",
      body: `Showing current listings from ${formatEventProviders(meta)}.`,
    };
  }

  if (meta.source === "mixed") {
    return {
      label: "Live + curated",
      tone: "live",
      body: `Showing current listings from ${formatEventProviders(meta)} plus curated Jamaica calendar picks.`,
    };
  }

  if (meta.reason === "event-provider-rate-limited") {
    return {
      label: "Live source limit",
      tone: "fallback",
      body: "The live event source is cooling down, so curated Jamaica calendar picks are shown for now.",
    };
  }

  if (meta.reason === "event-provider-request-failed") {
    return {
      label: "Curated picks",
      tone: "error",
      body: "Live event lookup did not complete, so curated Jamaica calendar picks are shown.",
    };
  }

  if (meta.reason === "partial-event-provider-request-failed") {
    return {
      label: "Partial live check",
      tone: "fallback",
      body: "One live event source did not respond. Curated Jamaica calendar picks are shown with any available live matches.",
    };
  }

  if (meta.reason === "no-live-provider-events") {
    return {
      label: "Curated picks",
      tone: "fallback",
      body: `${formatEventProviders(meta)} are connected, but no verified live Jamaica listings matched this area. Curated picks are shown so the calendar still stays useful.`,
    };
  }

  if (!meta.providerConfigured) {
    return {
      label: "Curated calendar",
      tone: "fallback",
      body: "Live event updates are not connected here yet, so the built-in Jamaica calendar is shown.",
    };
  }

  return {
    label: "Curated calendar",
    tone: "fallback",
    body: "Curated Jamaica calendar picks are shown for this area.",
  };
}

function formatEventProviders(meta: EventsApiMeta): string {
  const providers = [
    meta.providers.verifiedCalendar ? "verified island calendar" : null,
    meta.providers.eventbrite ? "Eventbrite" : null,
    meta.providers.ticketmaster ? "Ticketmaster" : null,
  ].filter(Boolean);
  return providers.length ? providers.join(" and ") : "live event sources";
}

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
