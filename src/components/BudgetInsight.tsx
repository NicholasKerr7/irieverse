import { BedDouble, Car, Utensils, Waves } from "lucide-react";

interface BudgetInsightProps {
  perDay: {
    lodging: number;
    dining: number;
    experiences: number;
  };
  transportPerTrip: number;
  days: number;
  vibe: string;
}

export function BudgetInsight({ perDay, transportPerTrip, days, vibe }: BudgetInsightProps) {
  const perDayTotal = perDay.lodging + perDay.dining + perDay.experiences;
  const tripTotal = perDayTotal * days + transportPerTrip;
  const lines = [
    {
      icon: BedDouble,
      label: "Stay",
      amount: perDay.lodging * days,
      helper: "Boutique stay or guesthouse",
      percent: (perDay.lodging * days) / tripTotal,
    },
    {
      icon: Utensils,
      label: "Food + drink",
      amount: perDay.dining * days,
      helper: "Jerk runs, ital plates, rum tastings",
      percent: (perDay.dining * days) / tripTotal,
    },
    {
      icon: Waves,
      label: "Experiences",
      amount: perDay.experiences * days,
      helper: "Music nights, river days, tours",
      percent: (perDay.experiences * days) / tripTotal,
    },
    {
      icon: Car,
      label: "Ground transport",
      amount: transportPerTrip,
      helper: "Shuttles and route taxis",
      percent: transportPerTrip / tripTotal,
    },
  ];

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-amber-300/80">Budget breakdown</p>
          <h3 className="text-lg font-semibold">
            {days}-day {vibe === "mixed" ? "mixed vibe" : vibe} plan
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Based on lodging, food, experiences, and ground transport.
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-5 py-4 text-right">
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-emerald-200">Estimated total</p>
          <p className="text-3xl font-semibold text-emerald-200">${tripTotal.toLocaleString()}</p>
          <p className="text-xs text-slate-400">${perDayTotal.toFixed(0)} per day + transport</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {lines.map((line) => {
          const Icon = line.icon;
          return (
            <article key={line.label} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-slate-100">{line.label}</p>
                    <p className="text-xs text-slate-500">{line.helper}</p>
                  </div>
                </div>
                <p className="text-lg font-semibold text-slate-100">${line.amount.toFixed(0)}</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-cyan-300"
                  style={{ width: `${Math.max(8, Math.round(line.percent * 100))}%` }}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
