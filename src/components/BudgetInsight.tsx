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
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-amber-300/80">Budget insight</p>
          <h3 className="text-base font-semibold">
            {days}-day {vibe === "mixed" ? "mixed vibe" : vibe} flow
          </h3>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Estimated total</p>
          <p className="text-xl font-semibold text-emerald-300">${tripTotal.toLocaleString()}</p>
          <p className="text-[0.65rem] text-slate-500">
            ${perDayTotal.toFixed(0)} / day + ${transportPerTrip.toFixed(0)} transport
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <BudgetLine label="Boutique stay" amount={perDay.lodging} helper="Local guesthouse or boutique hotel" />
        <BudgetLine label="Food + drink" amount={perDay.dining} helper="Jerk runs, ital plates, rum tastings" />
        <BudgetLine label="Experiences" amount={perDay.experiences} helper="River limes, music nights & tours" />
        <BudgetLine label="Ground transport" amount={transportPerTrip} helper="Shuttles + route taxis for trip" />
      </div>
    </div>
  );
}

function BudgetLine({ label, amount, helper }: { label: string; amount: number; helper: string }) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 px-3 py-2">
      <p className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-100">${amount.toFixed(0)}</p>
      <p className="text-[0.7rem] text-slate-500">{helper}</p>
    </div>
  );
}
