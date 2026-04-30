import type { PlannerDay } from "../types/travel";
import { formatDriveTime } from "./format";

export type DayPlanningReasonTone = "board" | "route" | "weather" | "experience";

export type DayPlanningReason = {
  id: string;
  label: string;
  body: string;
  tone: DayPlanningReasonTone;
};

export function getDayPlanningReasons(day: PlannerDay, boardIdeaCount = 0): DayPlanningReason[] {
  const reasons: DayPlanningReason[] = [];

  if (boardIdeaCount > 0) {
    reasons.push({
      id: "board",
      label: `${boardIdeaCount} board idea${boardIdeaCount === 1 ? "" : "s"}`,
      body: "Saved places, experiences, or imports are attached to this stop.",
      tone: "board",
    });
  }

  if (day.weatherNote) {
    reasons.push({
      id: "weather",
      label: getWeatherLabel(day),
      body: day.weatherNote,
      tone: "weather",
    });
  }

  reasons.push({
    id: "route",
    label: day.driveMinutesFromPrevious ? getRouteLabel(day) : "Start near base",
    body: day.driveMinutesFromPrevious
      ? `${formatDriveTime(day.driveMinutesFromPrevious)} from the previous stop, so this day is paced ${day.energyLevel}.`
      : "The first day stays close to the starting point before the route opens up.",
    tone: "route",
  });

  if (day.experience) {
    reasons.push({
      id: "experience",
      label: "Add-on match",
      body: `${day.experience.title} fits this ${day.vibe} day and the planned energy level.`,
      tone: "experience",
    });
  }

  return reasons.slice(0, 4);
}

function getWeatherLabel(day: PlannerDay): string {
  if (!day.weather) return "Weather-aware";
  if (day.weather.planningSignal === "storm") return "Storm backup";
  if (day.weather.planningSignal === "rain") return "Rain-aware";
  if (day.weather.planningSignal === "hot") return "Heat-aware";
  if (day.weather.planningSignal === "clear") return "Outdoor-friendly";
  return "Weather-aware";
}

function getRouteLabel(day: PlannerDay): string {
  if (day.transferSeverity === "long") return "Long transfer";
  if (day.transferSeverity === "moderate") return "Busy transfer";
  return "Easy hop";
}
