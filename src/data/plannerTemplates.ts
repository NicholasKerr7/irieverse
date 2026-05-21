import type { PlanningMode, PlanningTemplate, PlanningTemplateId } from "../types/travel";

export const PLANNING_MODE_LABELS: Record<
  PlanningMode,
  {
    label: string;
    title: string;
    body: string;
  }
> = {
  visitor: {
    label: "Visiting",
    title: "Visiting Jamaica",
    body: "Build a multi-day trip around a base, dates, saved ideas, budget, weather, and realistic island pacing.",
  },
  local: {
    label: "Local",
    title: "I live here",
    body: "Plan food runs, beach days, river trips, date nights, and weekends without treating every plan like a vacation.",
  },
  hosting: {
    label: "Hosting",
    title: "Hosting someone",
    body: "Turn local knowledge into a clean plan for friends, family, guests, or clients visiting Jamaica.",
  },
};

export const PLANNING_TEMPLATES: [PlanningTemplate, ...PlanningTemplate[]] = [
  {
    id: "first-jamaica-trip",
    mode: "visitor",
    title: "First Jamaica trip",
    eyebrow: "Visitor classic",
    body: "A balanced north-coast start with beach time, one adventure day, a west-coast sunset run, and a Kingston culture finish.",
    baseId: "mobay",
    days: 5,
    vibe: "mixed",
    budget: 175,
    originAirportId: "jfk",
    routeDestinationIds: ["negril", "ochi", "southcoast", "kingston"],
  },
  {
    id: "west-coast-reset",
    mode: "visitor",
    title: "West Coast reset",
    eyebrow: "Slow trip",
    body: "A slower Negril-led plan for sunsets, beach days, cliff bars, and an easy South Coast day.",
    baseId: "negril",
    days: 4,
    vibe: "romantic",
    budget: 220,
    originAirportId: "mia",
    routeDestinationIds: ["southcoast", "mobay"],
  },
  {
    id: "local-food-run",
    mode: "local",
    title: "Local food run",
    eyebrow: "Same-day",
    body: "A simple one-day plan for jerk, patties, seafood, or a parish-to-parish eating mission.",
    baseId: "kingston",
    days: 1,
    vibe: "authentic",
    budget: 65,
    originAirportId: "kin",
  },
  {
    id: "river-and-beach-day",
    mode: "local",
    title: "River + beach day",
    eyebrow: "Weekend",
    body: "A two-day local escape built around water, low-stress drive pacing, and weather-friendly timing.",
    baseId: "ochi",
    days: 2,
    vibe: "adventure",
    budget: 120,
    originAirportId: "kin",
    routeDestinationIds: ["portland"],
  },
  {
    id: "host-visitors",
    mode: "hosting",
    title: "Host visitors",
    eyebrow: "Show them Jamaica",
    body: "A compact plan that mixes crowd-pleasers, local flavor, and enough structure to keep guests moving.",
    baseId: "mobay",
    days: 3,
    vibe: "mixed",
    budget: 150,
    originAirportId: "mbj",
    routeDestinationIds: ["negril", "ochi"],
  },
  {
    id: "culture-night",
    mode: "hosting",
    title: "Culture night",
    eyebrow: "Kingston-led",
    body: "A Kingston-first plan for music, food, art, Devon House, and a late-night culture stop.",
    baseId: "kingston",
    days: 2,
    vibe: "culture",
    budget: 110,
    originAirportId: "kin",
    routeDestinationIds: ["ochi"],
  },
];

export const DEFAULT_PLANNING_MODE: PlanningMode = "visitor";
export const DEFAULT_PLANNING_TEMPLATE_ID: PlanningTemplateId = "first-jamaica-trip";

export function getDefaultTemplateForMode(mode: PlanningMode): PlanningTemplate {
  return PLANNING_TEMPLATES.find((template) => template.mode === mode) ?? PLANNING_TEMPLATES[0];
}

export function getPlanningTemplate(templateId: PlanningTemplateId | string | null | undefined): PlanningTemplate {
  return PLANNING_TEMPLATES.find((template) => template.id === templateId) ?? PLANNING_TEMPLATES[0];
}

export function isPlanningMode(value: string | null): value is PlanningMode {
  return value === "visitor" || value === "local" || value === "hosting";
}

export function isPlanningTemplateId(value: string | null): value is PlanningTemplateId {
  return PLANNING_TEMPLATES.some((template) => template.id === value);
}
