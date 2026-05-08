import { Compass } from "lucide-react";
import { classNames } from "../utils/classNames";

type AppIconProps = {
  className?: string;
  imageClassName?: string;
};

export function AppIcon({ className, imageClassName }: AppIconProps) {
  return (
    <span
      className={classNames(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/25 bg-slate-950 shadow-lg shadow-cyan-500/15",
        className
      )}
      aria-hidden="true"
    >
      <span className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_35%_25%,rgba(34,211,238,0.28),transparent_32%),linear-gradient(145deg,#020617,#062033_52%,#020617)] text-cyan-200">
        <Compass className="h-1/2 w-1/2" strokeWidth={2.2} />
      </span>
      <img
        src="/icon-192.png"
        alt=""
        loading="eager"
        decoding="async"
        className={classNames("relative z-10 h-full w-full object-cover", imageClassName)}
      />
    </span>
  );
}
