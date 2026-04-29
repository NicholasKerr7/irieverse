import { classNames } from "../utils/classNames";

type AppIconProps = {
  className?: string;
  imageClassName?: string;
};

export function AppIcon({ className, imageClassName }: AppIconProps) {
  return (
    <span
      className={classNames(
        "shrink-0 overflow-hidden rounded-2xl border border-cyan-300/25 bg-slate-950 shadow-lg shadow-cyan-500/15",
        className
      )}
      aria-hidden="true"
    >
      <img
        src="/icon-192.png"
        alt=""
        className={classNames("h-full w-full object-cover", imageClassName)}
      />
    </span>
  );
}
