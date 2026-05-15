export function PageFooter() {
  return (
    <footer className="border-t border-slate-800/80 px-6 pb-6 pt-3 text-center text-[0.7rem] text-slate-500 lg:px-10">
      <p>
        IrieVerse helps shape the plan. Always confirm prices, schedules, roads, and safety details with official sources before booking.
      </p>
      <nav className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1" aria-label="Legal">
        <a className="transition hover:text-cyan-200" href="/?page=privacy">Privacy</a>
        <a className="transition hover:text-cyan-200" href="/?page=terms">Terms</a>
      </nav>
    </footer>
  );
}
