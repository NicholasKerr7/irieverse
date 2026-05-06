import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Home, RefreshCcw } from "lucide-react";
import { AppIcon } from "./AppIcon";
import { classNames } from "../utils/classNames";
import { glassPanelStrong } from "../utils/glass";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("IrieVerse app error", error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  private handleHome = () => {
    window.location.assign("/");
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="app-shell min-h-dvh px-4 py-8 text-slate-100 sm:px-6 lg:px-10">
        <section className={classNames("mx-auto max-w-xl rounded-3xl p-5 sm:p-6", glassPanelStrong)}>
          <div className="flex items-start gap-3">
            <AppIcon className="h-14 w-14 rounded-[1.1rem]" />
            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.24em] text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5" /> Recovery mode
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">IrieVerse needs a quick refresh.</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Your saved Jamaica ideas and trip edits are kept on this device. Try reopening the app view, or return home if the same screen keeps failing.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950"
            >
              <RefreshCcw className="h-4 w-4" /> Try again
            </button>
            <button
              type="button"
              onClick={this.handleHome}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-cyan-300/50 px-4 py-2 text-xs font-bold text-cyan-100"
            >
              <Home className="h-4 w-4" /> Go home
            </button>
          </div>

          {import.meta.env.DEV && this.state.error.message && (
            <pre className="mt-5 max-h-44 overflow-auto rounded-2xl border border-slate-800 bg-slate-950/80 p-3 text-xs leading-5 text-slate-400">
              {this.state.error.message}
            </pre>
          )}
        </section>
      </div>
    );
  }
}
