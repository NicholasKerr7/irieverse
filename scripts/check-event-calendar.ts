import { readFileSync } from "node:fs";
import path from "node:path";
import type { LiveEvent } from "../src/types/travel";

const EVENT_FILE = path.join(process.cwd(), "public", "data", "events.json");
const STALE_EVENT_GRACE_DAYS = 7;

const requiredStringFields = [
  "id",
  "title",
  "city",
  "region",
  "venue",
  "startDate",
  "dateLabel",
  "price",
  "ticketRequirement",
  "description",
] satisfies Array<keyof LiveEvent>;

const parsed: unknown = JSON.parse(readFileSync(EVENT_FILE, "utf8"));
const failures: string[] = [];

if (!Array.isArray(parsed)) {
  throw new Error("Event calendar check failed: public/data/events.json must contain an array.");
}

const ids = new Set<string>();
const staleCutoff = getStaleCutoff();

for (const [index, event] of parsed.entries()) {
  if (!isRecord(event)) {
    failures.push(`event[${index}] must be an object.`);
    continue;
  }

  const id = asString(event.id) ?? `event[${index}]`;
  if (ids.has(id)) failures.push(`${id} is duplicated.`);
  ids.add(id);

  for (const field of requiredStringFields) {
    if (!asString(event[field])) {
      failures.push(`${id} is missing ${field}.`);
    }
  }

  const startDate = asString(event.startDate);
  const parsedStartDate = startDate ? new Date(startDate) : null;
  if (!parsedStartDate || Number.isNaN(parsedStartDate.getTime())) {
    failures.push(`${id} has an invalid startDate: ${startDate ?? "(missing)"}.`);
    continue;
  }

  if (parsedStartDate.getTime() < staleCutoff.getTime()) {
    failures.push(`${id} starts on ${startDate}, which is older than the ${STALE_EVENT_GRACE_DAYS}-day freshness window.`);
  }

  const ticketRequirement = asString(event.ticketRequirement);
  if (ticketRequirement && !/(ticket|pass|registration|confirm|access|cover|charge|pay|parking|reservation|entry|admission)/i.test(ticketRequirement)) {
    failures.push(`${id} ticketRequirement should clearly state whether ticket, pass, access, confirmation, or payment is needed.`);
  }
}

if (failures.length) {
  throw new Error(`Event calendar check failed:\n${failures.join("\n")}`);
}

console.log(`Event calendar check passed for ${ids.size} events.`);

function getStaleCutoff(): Date {
  const now = process.env.IRIEVERSE_EVENT_CHECK_NOW
    ? new Date(process.env.IRIEVERSE_EVENT_CHECK_NOW)
    : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error("IRIEVERSE_EVENT_CHECK_NOW must be a valid date if provided.");
  }

  const cutoff = new Date(now);
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCDate(cutoff.getUTCDate() - STALE_EVENT_GRACE_DAYS);
  return cutoff;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
