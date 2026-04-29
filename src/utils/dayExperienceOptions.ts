import { EXPERIENCES } from "../data/content";
import type { Experience, PlannerDay } from "../types/travel";

type DayExperienceContext = Pick<
  PlannerDay,
  "destinationId" | "destName" | "destRegion" | "vibe" | "energyLevel" | "experience"
>;

export function getExperienceOptionsForDay(day: DayExperienceContext, limit = 8): Experience[] {
  return EXPERIENCES
    .map((experience) => ({
      experience,
      score: getExperienceDayScore(experience, day),
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.experience)
    .slice(0, limit);
}

function getExperienceDayScore(experience: Experience, day: DayExperienceContext): number {
  const destinationText = `${day.destName} ${day.destRegion}`.toLowerCase();
  const experienceRegion = experience.region.toLowerCase();
  const sameDestination = experience.linkedDestinationId === day.destinationId;
  const sameRegion =
    destinationText.includes(experienceRegion) ||
    experienceRegion.includes(day.destRegion.toLowerCase()) ||
    experience.location.toLowerCase().includes(day.destRegion.toLowerCase());
  const vibeMatch = experience.vibes.includes(day.vibe);
  const energyMatch =
    (day.energyLevel === "high" && experience.energy === "high") ||
    (day.energyLevel === "soft" && experience.energy !== "high") ||
    day.energyLevel === "balanced";
  const currentBoost = day.experience?.id === experience.id ? 12 : 0;

  return (
    (sameDestination ? 100 : 0) +
    (sameRegion ? 42 : 0) +
    (vibeMatch ? 24 : 0) +
    (energyMatch ? 10 : 0) +
    currentBoost +
    experience.rating
  );
}
