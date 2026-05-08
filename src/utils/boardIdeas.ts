import { DESTINATIONS, EXPERIENCES } from "../data/content";
import type { ImportedIdea } from "../types/travel";

export type BoardIdea = {
  id: string;
  title: string;
  meta: string;
  exactPlace: boolean;
};

export function getBoardIdeasForDestination({
  destinationId,
  savedPlaceIds,
  savedExperienceIds,
  importedIdeas,
}: {
  destinationId: string;
  savedPlaceIds: Set<string>;
  savedExperienceIds: Set<string>;
  importedIdeas: ImportedIdea[];
}): BoardIdea[] {
  const destination = DESTINATIONS.find((item) => item.id === destinationId);
  const savedDestinationIdeas = destination && savedPlaceIds.has(destinationId)
    ? [{ id: `place-${destination.id}`, title: destination.name, meta: "Saved place", exactPlace: false }]
    : [];
  const savedExperienceIdeas = EXPERIENCES
    .filter((experience) => savedExperienceIds.has(experience.id) && experience.linkedDestinationId === destinationId)
    .map((experience) => ({
      id: `experience-${experience.id}`,
      title: experience.title,
      meta: `Saved experience - ${experience.location}`,
      exactPlace: false,
    }));
  const importedDayIdeas = importedIdeas
    .filter((idea) => idea.linkedDestinationId === destinationId)
    .map((idea) => ({
      id: `import-${idea.id}`,
      title: idea.title,
      meta: getImportedIdeaBoardMeta(idea),
      exactPlace: hasExactPlaceCoordinates(idea),
    }));

  return [...savedDestinationIdeas, ...savedExperienceIdeas, ...importedDayIdeas];
}

function getImportedIdeaBoardMeta(idea: ImportedIdea): string {
  const place = idea.place;
  if (!place) return idea.sourceLabel || idea.extractedPlaceName || "Imported idea";

  const rating = typeof place.rating === "number"
    ? `Rating ${formatRating(place.rating, place.userRatingCount)}`
    : "";

  return [
    place.shortAddress || place.address,
    place.primaryType,
    rating,
    idea.sourceLabel,
  ].filter(Boolean).join(" - ") || idea.sourceLabel || "Imported idea";
}

function formatRating(rating: number, count?: number): string {
  const ratingLabel = rating.toFixed(1);
  return typeof count === "number" && Number.isFinite(count)
    ? `${ratingLabel} (${formatCompactCount(count)})`
    : ratingLabel;
}

function formatCompactCount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function hasExactPlaceCoordinates(idea: ImportedIdea): boolean {
  return Number.isFinite(idea.place?.latitude) && Number.isFinite(idea.place?.longitude);
}
