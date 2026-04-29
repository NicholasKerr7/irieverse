import { ImageCreditBadge } from "./ImageCreditBadge";
import { Experience } from "../types/travel";
import { capitalise } from "../utils/text";

interface ExperiencesHighlightProps {
  items: Experience[];
}

export function ExperiencesHighlight({ items }: ExperiencesHighlightProps) {
  return (
    <section
      id="experiences"
      className="max-w-6xl mx-auto bg-slate-950/80 border border-slate-800 rounded-3xl shadow-[0_24px_80px_rgba(15,23,42,0.9)] backdrop-blur-xl p-4 sm:p-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <p className="text-[0.65rem] tracking-[0.3em] uppercase text-cyan-300/90 mb-1">Snapshot</p>
          <h2 className="text-lg sm:text-xl font-semibold">Signature experiences</h2>
          <p className="text-xs sm:text-[0.8rem] text-slate-400 max-w-xl">
            A quick carousel of food, music and festival moments pulled from the experiences layer.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((experience) => (
          <article
            key={experience.id}
            className="rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900/90 via-slate-950 to-slate-950/95 overflow-hidden flex flex-col"
          >
            <div className="relative h-28 overflow-hidden">
              <img src={experience.imageUrl} alt={experience.title} className="w-full h-full object-cover scale-[1.03]" />
              <ImageCreditBadge credit={experience.imageCredit} className="absolute left-2 top-2" />
            </div>
            <div className="p-3 flex-1 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[0.78rem] font-semibold line-clamp-2">{experience.title}</p>
                <span className="text-[0.6rem] px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700/80 uppercase tracking-[0.18em] text-slate-300">
                  {capitalise(experience.type)}
                </span>
              </div>
              <p className="text-[0.7rem] text-slate-400 line-clamp-3">{experience.description}</p>
              <p className="text-[0.65rem] text-slate-500 mt-1">
                {experience.region} · {experience.location}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
