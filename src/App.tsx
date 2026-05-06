import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { MobileShell } from "./components/mobile/MobileShell";

export default function App() {
  return (
    <AppErrorBoundary>
      <MobileShell />
    </AppErrorBoundary>
  );
}
