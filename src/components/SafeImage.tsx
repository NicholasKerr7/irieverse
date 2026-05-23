import { useState, type ImgHTMLAttributes } from "react";
import { ImageOff } from "lucide-react";
import { classNames } from "../utils/classNames";

type SafeImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string;
  fallbackLabel?: string;
};

export function SafeImage({ src, alt, className, fallbackLabel, onError, ...props }: SafeImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageSrc = src?.trim();

  if (imageSrc && imageSrc !== failedSrc) {
    return (
      <img
        {...props}
        src={imageSrc}
        alt={alt}
        className={className}
        onError={(event) => {
          setFailedSrc(imageSrc);
          onError?.(event);
        }}
      />
    );
  }

  return (
    <div
      role={alt ? "img" : undefined}
      aria-label={alt || fallbackLabel}
      className={classNames(
        "flex items-center justify-center bg-[radial-gradient(circle_at_25%_20%,rgba(103,232,249,0.26),transparent_28%),linear-gradient(135deg,#06121f,#0f2a2a_52%,#10212f)]",
        className
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-cyan-100 shadow-lg shadow-slate-950/20 backdrop-blur">
        <ImageOff className="h-5 w-5" aria-hidden="true" />
      </span>
    </div>
  );
}
