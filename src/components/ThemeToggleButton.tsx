import { MoonStar, SunMedium } from "lucide-react";
import type { ThemeMode } from "../hooks/useTravelOS";
import { classNames } from "../utils/classNames";

type ThemeToggleButtonProps = {
  theme: ThemeMode;
  onToggleTheme: () => void;
  className?: string;
  showLabel?: boolean;
  testId?: string;
};

export function ThemeToggleButton({
  theme,
  onToggleTheme,
  className,
  showLabel = false,
  testId,
}: ThemeToggleButtonProps) {
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={onToggleTheme}
      className={classNames(
        "theme-toggle-button inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition",
        className
      )}
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={theme === "dark"}
      title={`Switch to ${nextTheme} mode`}
      data-testid={testId}
    >
      {theme === "dark" ? (
        <SunMedium className="h-4 w-4 text-amber-300" />
      ) : (
        <MoonStar className="h-4 w-4 text-cyan-600" />
      )}
      {showLabel && <span>{theme === "dark" ? "Light" : "Dark"}</span>}
    </button>
  );
}
