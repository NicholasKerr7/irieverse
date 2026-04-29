import type { ImageCredit } from "../types/travel";
import { classNames } from "../utils/classNames";

type ImageCreditBadgeProps = {
  credit?: ImageCredit;
  className?: string;
};

export function ImageCreditBadge({ credit, className }: ImageCreditBadgeProps) {
  if (!credit) return null;

  return (
    <a
      href={credit.href}
      target="_blank"
      rel="noreferrer"
      className={classNames(
        "z-10 inline-flex max-w-[calc(100%-1.5rem)] rounded-full border border-white/10 bg-slate-950/80 px-2 py-1 text-[0.62rem] font-semibold text-slate-50 shadow-[0_8px_22px_rgba(15,23,42,0.28)] backdrop-blur transition hover:border-cyan-300/45 hover:text-cyan-100",
        className
      )}
      aria-label={`Photo credit: ${credit.label}`}
    >
      Photo: {credit.label}
    </a>
  );
}
