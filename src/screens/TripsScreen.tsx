import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import {
  CalendarDays,
  Download,
  ExternalLink,
  Plane,
  Share2,
  Users,
  WalletCards,
} from "lucide-react";
import { BookingRecommendations } from "../components/BookingRecommendations";
import { BudgetInsight } from "../components/BudgetInsight";
import { ItineraryView } from "../components/ItineraryView";
import { LiveEventsFeed } from "../components/LiveEventsFeed";
import type { MobileTabId } from "../components/mobile/BottomNav";
import { DESTINATIONS, VIBE_OPTIONS } from "../data/content";
import { formatLocalTime, type TravelOS } from "../hooks/useTravelOS";
import type { Vibe } from "../types/travel";

type TripsScreenProps = {
  app: TravelOS;
  onNavigate: (tab: MobileTabId) => void;
};

const STEPS = [
  "Choose base city",
  "Choose dates",
  "Choose vibe",
  "Choose budget",
  "Add saved spots",
  "Generate itinerary",
  "Export or share",
];

export function TripsScreen({ app, onNavigate }: TripsScreenProps) {
  return (
    <section className="mx-auto min-h-screen max-w-6xl px-4 py-5 sm:px-6 lg:px-10">
      <header className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 shadow-xl shadow-slate-950/40">
        <div className="relative h-64">
          <img src={app.destination.heroImage} alt={app.destination.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
          <div className="absolute bottom-5 left-5 right-5">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/90">Trips</p>
            <h1 className="mt-2 text-3xl font-semibold">Build your Jamaica plan.</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              Guided planning, budget, flights, events, booking recommendations, export, and sharing in one workspace.
            </p>
          </div>
        </div>
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-slate-500">Planner flow</p>
            <div className="mt-4 space-y-2">
              {STEPS.map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-2xl bg-slate-950/70 p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-300 text-xs font-bold text-slate-950">
                    {index + 1}
                  </span>
                  <span className="text-sm text-slate-200">{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-slate-500">Trip controls</p>
            <div className="mt-4 grid gap-3">
              <PlannerSelect
                label="Origin airport"
                value={app.originAirportId}
                onChange={app.handleOriginAirportChange}
                options={app.originAirports.map((airport) => ({ value: airport.id, label: airport.name }))}
              />
              <PlannerSelect
                label="Base destination"
                value={app.plannerBaseId}
                onChange={app.setPlannerBaseId}
                options={DESTINATIONS.map((destination) => ({ value: destination.id, label: destination.name }))}
              />
              <label className="flex flex-col gap-1 text-sm text-slate-300">
                <span className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">Days</span>
                <input
                  type="number"
                  min={3}
                  max={14}
                  value={app.plannerDays}
                  onChange={(event) => app.setPlannerDays(Number(event.target.value))}
                  className="rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-300">
                <span className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">Start date</span>
                <input
                  type="date"
                  value={app.plannerStartDate}
                  onChange={(event) => app.setPlannerStartDate(event.target.value)}
                  className="rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2"
                />
              </label>
              <PlannerSelect
                label="Daily vibe"
                value={app.plannerVibe}
                onChange={(value) => app.setPlannerVibe(value as Vibe)}
                options={[
                  { value: "mixed", label: "Mixed" },
                  ...VIBE_OPTIONS.filter((option) => option.id !== "all").map((option) => ({
                    value: option.id,
                    label: option.label,
                  })),
                ]}
              />
              <label className="flex flex-col gap-1 text-sm text-slate-300">
                <span className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
                  Budget per day (USD)
                </span>
                <input
                  type="number"
                  min={75}
                  max={400}
                  step={25}
                  value={app.plannerBudget}
                  onChange={(event) => app.setPlannerBudget(Number(event.target.value))}
                  className="rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2"
                />
              </label>
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          <article className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-cyan-300" />
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-500">Upcoming trip</p>
                  <h2 className="text-xl font-semibold">{app.destination.name} base plan</h2>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {app.collaborationReady && (
                  <button
                    type="button"
                    onClick={app.handleShareTrip}
                    disabled={app.isSyncingTrip}
                    className="inline-flex items-center gap-2 rounded-full border border-cyan-400/60 bg-cyan-400/10 px-4 py-2 text-[0.7rem] uppercase tracking-[0.18em] text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-50"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    {app.tripId ? "Update share" : "Share trip"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={app.handleExportItinerary}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-400/10 px-4 py-2 text-[0.7rem] uppercase tracking-[0.18em] text-emerald-200 hover:bg-emerald-400/20"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export ICS
                </button>
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              Add saved places from Explore or Map, then tune the base, dates, vibe, and budget here.
            </p>
            <button
              type="button"
              onClick={() => onNavigate("explore")}
              className="mt-4 rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950"
            >
              Add places from Explore
            </button>
          </article>

          <div className="grid gap-3 sm:grid-cols-2">
            <MiniCard icon={WalletCards} title="Budget" body={`$${app.plannerBudget}/day working target.`} />
            <MiniCard icon={Plane} title="Flights" body={`${app.originAirport.code} to ${app.destination.airportCode}.`} />
            <MiniCard icon={Users} title="Saved" body={`${app.savedPlaces.size + app.savedExperiences.size} ideas ready.`} />
            <MiniCard icon={ExternalLink} title="Share" body={app.collaborationReady ? "Supabase sharing enabled." : "Configure Supabase to share."} />
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
            <ItineraryView itinerary={app.itinerary} />
          </div>

          <FlightSnapshot app={app} />

          <BudgetInsight
            perDay={app.perDayBudget}
            transportPerTrip={app.transportBudget}
            days={app.plannerDays}
            vibe={app.plannerVibe}
          />

          <SharePanel app={app} />
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <BookingRecommendations
          bookings={app.bookingOptions}
          isLoading={app.isLoadingBookings}
          error={app.bookingError}
          onRefresh={app.refreshBookings}
          destinationName={app.destination.name}
        />

        <LiveEventsFeed
          events={app.liveEvents}
          isLoading={app.isLoadingEvents}
          error={app.eventsError}
          onRefresh={app.loadEvents}
          selectedRegion={app.destination.region}
        />
      </div>
    </section>
  );
}

function PlannerSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-300">
      <span className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MiniCard({
  icon: Icon,
  title,
  body,
}: {
  icon: ComponentType<LucideProps>;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <Icon className="h-5 w-5 text-cyan-300" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-400">{body}</p>
    </article>
  );
}

function FlightSnapshot({ app }: { app: TravelOS }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/80">Flight snapshot</p>
          <h3 className="text-base font-semibold">
            {app.originAirport.code} to {app.destination.airportCode}
          </h3>
        </div>
        {app.isFetchingFlights && (
          <span className="animate-pulse text-xs text-slate-400">Syncing gate info...</span>
        )}
      </div>
      {app.flightsError && <p className="mt-2 text-xs text-rose-300">{app.flightsError}</p>}
      {!app.flightsError && !app.flightOptions.length && !app.isFetchingFlights && (
        <p className="mt-2 text-xs text-slate-400">
          No live flights from {app.originAirport.code} within the snapshot window.
        </p>
      )}
      <div className="mt-3 space-y-2">
        {app.flightOptions.slice(0, 3).map((flight) => (
          <div
            key={`${flight.flightNumber}-${flight.departureTimeUTC}`}
            className="flex flex-col gap-1 rounded-2xl border border-slate-800/80 bg-slate-950/70 px-4 py-3 shadow shadow-slate-950/40"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{flight.flightNumber}</p>
              <span className="text-[0.65rem] uppercase tracking-[0.2em] text-emerald-300">
                {flight.status ?? "Scheduled"}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {flight.airline} · {flight.origin} to {flight.destination}
            </p>
            <div className="flex items-center justify-between gap-3 text-[0.7rem] text-slate-300">
              <span>{formatLocalTime(flight.departureTimeUTC, app.originAirport.code)} dep</span>
              <span className="text-slate-500">to</span>
              <span>{formatLocalTime(flight.arrivalTimeUTC, app.destination.airportCode)} arr</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SharePanel({ app }: { app: TravelOS }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/80">Collaboration</p>
          <h3 className="text-base font-semibold">Share with your crew</h3>
        </div>
        {app.isSyncingTrip && <span className="animate-pulse text-xs text-slate-400">Syncing trip...</span>}
      </div>
      {!app.collaborationReady && (
        <p className="mt-2 text-xs text-slate-400">
          Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable live sharing.
        </p>
      )}
      {app.collaborationReady && (
        <div className="mt-3 space-y-2">
          <label className="text-[0.7rem] uppercase tracking-[0.2em] text-slate-500">
            Shareable link
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              readOnly
              value={app.tripShareUrl}
              placeholder="Create a share link to collaborate"
              className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-300"
            />
            <button
              type="button"
              onClick={app.handleCopyShareLink}
              disabled={!app.tripShareUrl}
              className="rounded-2xl border border-slate-600 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-200 disabled:opacity-40"
            >
              Copy
            </button>
          </div>
        </div>
      )}
      {app.tripStatusMessage && <p className="mt-2 text-xs text-slate-400">{app.tripStatusMessage}</p>}
    </div>
  );
}
