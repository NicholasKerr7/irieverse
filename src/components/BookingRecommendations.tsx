import { ExternalLink } from "lucide-react";
import type { BookingSourceMeta } from "../services/bookings";
import type { BookingOption } from "../types/travel";

interface BookingRecommendationsProps {
  bookings: BookingOption[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  destinationName: string;
  sourceMeta: BookingSourceMeta;
}

export function BookingRecommendations({
  bookings,
  isLoading,
  error,
  onRefresh,
  destinationName,
  sourceMeta,
}: BookingRecommendationsProps) {
  const sourceStatus = getBookingSourceStatus(sourceMeta);

  return (
    <section className="max-w-6xl mx-auto bg-slate-950/80 border border-slate-800 rounded-3xl shadow-[0_24px_80px_rgba(15,23,42,0.9)] backdrop-blur-xl p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-emerald-300/80">Book the vibe</p>
          <h2 className="text-lg sm:text-xl font-semibold">Curated stays for {destinationName}</h2>
          <p className="text-xs sm:text-[0.8rem] text-slate-400">
            {sourceStatus.body}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <BookingSourcePill label={sourceStatus.label} tone={sourceStatus.tone} />
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.2em] text-slate-200 hover:bg-slate-900/60 disabled:opacity-40"
            disabled={isLoading}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {!error && !bookings.length && (
        <p className="text-xs text-slate-400">
          {isLoading ? "Checking our booking partners…" : "No tailored stays available for this combo yet."}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {bookings.map((option) => (
          <article
            key={option.id}
            className="rounded-2xl border border-slate-800/80 bg-slate-950/70 px-4 py-3 flex flex-col gap-2 shadow shadow-slate-950/40"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{option.title}</p>
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
                  {option.provider} · {option.type}
                </p>
              </div>
              <p className="text-base font-semibold text-emerald-300">
                ${option.price.toLocaleString()} {option.currency}
              </p>
            </div>
            <p className="text-xs text-slate-400">{option.description}</p>
            {option.perks && (
              <div className="flex flex-wrap gap-2 text-[0.65rem] uppercase tracking-[0.15em] text-slate-500">
                {option.perks.map((perk) => (
                  <span key={perk} className="px-2 py-0.5 rounded-full border border-slate-800">
                    {perk}
                  </span>
                ))}
              </div>
            )}
            <a
              href={option.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-100"
            >
              View this {option.type} <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function BookingSourcePill({
  label,
  tone,
}: {
  label: string;
  tone: "live" | "fallback" | "error";
}) {
  return (
    <span
      className={
        tone === "live"
          ? "inline-flex items-center rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-emerald-100"
          : tone === "error"
            ? "inline-flex items-center rounded-full border border-rose-300/40 bg-rose-300/10 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-rose-100"
            : "inline-flex items-center rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-amber-100"
      }
    >
      {label}
    </span>
  );
}

function getBookingSourceStatus(meta: BookingSourceMeta): {
  label: string;
  tone: "live" | "fallback" | "error";
  body: string;
} {
  if (meta.source === "amadeus") {
    return {
      label: "Live Amadeus",
      tone: "live",
      body: "Pulled from the Amadeus hotel feed through the server booking proxy.",
    };
  }

  if (meta.source === "api") {
    return {
      label: "Live endpoint",
      tone: "live",
      body: "Pulled from the configured booking endpoint.",
    };
  }

  if (meta.endpointConfigured) {
    return {
      label: "API fallback",
      tone: meta.reason === "request-failed" ? "error" : "fallback",
      body: `${formatBookingReason(meta.reason)} Showing curated local options until live offers return.`,
    };
  }

  return {
    label: "Local fallback",
    tone: meta.reason === "request-failed" ? "error" : "fallback",
    body: "Using bundled Jamaica stays because no booking endpoint is configured.",
  };
}

function formatBookingReason(reason?: string): string {
  const labels: Record<string, string> = {
    "missing-amadeus-credentials": "Amadeus credentials are not set.",
    "no-amadeus-offers": "Amadeus returned no matching offers.",
    "amadeus-request-failed": "The Amadeus request failed.",
    "request-failed": "The booking request failed.",
    "custom-endpoint": "The booking endpoint did not include source metadata.",
    "endpoint-configured": "The booking endpoint is configured.",
    "local-sample-data": "Local sample data is active.",
  };

  return reason ? labels[reason] ?? `${reason.replace(/-/g, " ")}.` : "Live booking data is not available yet.";
}
