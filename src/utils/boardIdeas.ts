import { DESTINATIONS, EXPERIENCES } from "../data/content";
import type { ImportedIdea, ImportedIdeaDayAssignments } from "../types/travel";

export type BoardIdea = {
  id: string;
  title: string;
  meta: string;
  exactPlace: boolean;
  importedIdeaId?: string;
  assignedDay?: number;
};

export function getBoardIdeasForDestination({
  destinationId,
  savedPlaceIds,
  savedExperienceIds,
  importedIdeas,
  importedIdeaDayAssignments = {},
  day,
}: {
  destinationId: string;
  savedPlaceIds: Set<string>;
  savedExperienceIds: Set<string>;
  importedIdeas: ImportedIdea[];
  importedIdeaDayAssignments?: ImportedIdeaDayAssignments;
  day?: number;
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
    .filter((idea) => importedIdeaBelongsToBoardDay(idea, destinationId, importedIdeaDayAssignments, day))
    .map((idea) => ({
      id: `import-${idea.id}`,
      title: idea.title,
      meta: getImportedIdeaBoardMeta(idea),
      exactPlace: hasExactPlaceCoordinates(idea),
      importedIdeaId: idea.id,
      assignedDay: getAssignedDay(idea.id, importedIdeaDayAssignments),
    }));

  return [...savedDestinationIdeas, ...savedExperienceIdeas, ...importedDayIdeas];
}

function importedIdeaBelongsToBoardDay(
  idea: ImportedIdea,
  destinationId: string,
  assignments: ImportedIdeaDayAssignments,
  day?: number
): boolean {
  if (isUnplannedAssignment(idea.id, assignments)) return false;
  const assignedDay = getAssignedDay(idea.id, assignments);
  if (day && assignedDay) return assignedDay === day;
  if (day && !assignedDay) return idea.linkedDestinationId === destinationId;
  return idea.linkedDestinationId === destinationId;
}

function isUnplannedAssignment(ideaId: string, assignments: ImportedIdeaDayAssignments): boolean {
  return assignments[ideaId] === "unplanned";
}

function getAssignedDay(ideaId: string, assignments: ImportedIdeaDayAssignments): number | undefined {
  const day = Number(assignments[ideaId]);
  return Number.isInteger(day) && day > 0 ? day : undefined;
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
