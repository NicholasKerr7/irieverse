import type { ImageCredit as ImageCreditType } from "../types/travel";
import { classNames } from "../utils/classNames";

type ImageCreditProps = {
  credit?: ImageCreditType | undefined;
  className?: string;
};

export function ImageCredit({ credit, className }: ImageCreditProps) {
  if (!credit) return null;

  return (
    <a
      href={credit.sourceUrl}
      target="_blank"
      rel="noreferrer"
      className={classNames(
        "inline-flex max-w-full items-center rounded-full border border-white/15 bg-slate-950/70 px-2.5 py-1 text-[0.62rem] font-semibold text-slate-200 shadow-lg shadow-slate-950/20 backdrop-blur transition hover:border-cyan-300/55 hover:text-white",
        className
      )}
    >
      <span className="truncate">
        Photo: {credit.author ? `${credit.author} / ` : ""}
        {credit.provider}
      </span>
    </a>
  );
}
