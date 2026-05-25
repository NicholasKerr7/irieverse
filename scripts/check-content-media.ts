import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DESTINATIONS, EXPERIENCES } from "../src/data/content";

const HERO_VIDEO_PATH = path.join(process.cwd(), "public", "media", "hero.mp4");
const JAMAICA_PARISHES = [
  "Clarendon",
  "Hanover",
  "Kingston",
  "Manchester",
  "Portland",
  "St. Andrew",
  "St. Ann",
  "St. Catherine",
  "St. Elizabeth",
  "St. James",
  "St. Mary",
  "St. Thomas",
  "Trelawny",
  "Westmoreland",
];

const mediaReferences = [
  ...DESTINATIONS.map((destination) => ({
    label: `destination:${destination.id}`,
    image: destination.heroImage,
  })),
  ...EXPERIENCES.map((experience) => ({
    label: `experience:${experience.id}`,
    image: experience.imageUrl,
  })),
];

const failures: string[] = [];

assertParishCoverage("destination", DESTINATIONS);
assertParishCoverage("experience", EXPERIENCES);

for (const destination of DESTINATIONS) {
  if (!destination.heroAttraction?.trim()) {
    failures.push(`destination:${destination.id} must name the hero attraction shown by its image.`);
  }

  if (!destination.entryRequirement?.label || !destination.entryRequirement.note) {
    failures.push(`destination:${destination.id} must explain ticket, pass, or access requirements.`);
  }

  if (!destination.localTips?.length || !destination.visitorTips?.length) {
    failures.push(`destination:${destination.id} must include local and visitor tips.`);
  }

  if (!destination.placeLookup?.query || !destination.placeLookup.requiredTerms?.length) {
    failures.push(`destination:${destination.id} must include guarded place lookup terms.`);
  }
}

for (const experience of EXPERIENCES) {
  if (!experience.entryRequirement?.label || !experience.entryRequirement.note) {
    failures.push(`experience:${experience.id} must explain ticket, pass, or access requirements.`);
  }

  if (!experience.linkedDestinationId) {
    failures.push(`experience:${experience.id} must link back to a parish destination.`);
  }
}

for (const reference of mediaReferences) {
  if (!reference.image.startsWith("/media/")) {
    failures.push(`${reference.label} must use a local /media image, got ${reference.image}`);
    continue;
  }

  const filePath = path.join(process.cwd(), "public", reference.image);
  if (!existsSync(filePath)) {
    failures.push(`${reference.label} points to a missing image: ${filePath}`);
  }
}

if (!existsSync(HERO_VIDEO_PATH)) {
  failures.push(`hero video is missing: ${HERO_VIDEO_PATH}`);
} else {
  const header = readFileSync(HERO_VIDEO_PATH).subarray(0, 1024 * 1024);
  const headerText = header.toString("latin1");
  const brand = header.subarray(8, 12).toString("latin1");
  const moovIndex = headerText.indexOf("moov");
  const mdatIndex = headerText.indexOf("mdat");

  if (!["isom", "iso2", "mp41", "mp42"].includes(brand)) {
    failures.push(`hero video must use a standard MP4 brand, got ${brand || "(missing)"}`);
  }

  if (moovIndex < 0) {
    failures.push("hero video must include the moov atom near the beginning for fast web playback.");
  } else if (mdatIndex >= 0 && moovIndex > mdatIndex) {
    failures.push("hero video must be faststart encoded with moov before mdat.");
  }
}

if (failures.length) {
  throw new Error(`Content media check failed:\n${failures.join("\n")}`);
}

console.log(`Content media check passed for ${mediaReferences.length} images, parish coverage, entry notes, and hero video.`);

function assertParishCoverage(label: string, items: Array<{ id: string; parish?: string }>): void {
  const covered = new Set(items.map((item) => item.parish).filter(Boolean));
  for (const parish of JAMAICA_PARISHES) {
    if (!covered.has(parish)) {
      failures.push(`${label} content must include ${parish}.`);
    }
  }
}
