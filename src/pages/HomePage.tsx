import { AppErrorBoundary } from "../components/AppErrorBoundary";
import { MobileShell } from "../components/mobile/MobileShell";

export function HomePage() {
  return (
    <AppErrorBoundary>
      <MobileShell />
    </AppErrorBoundary>
  );
}
