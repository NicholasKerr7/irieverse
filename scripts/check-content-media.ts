import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DESTINATIONS, EXPERIENCES } from "../src/data/content";

const HERO_VIDEO_PATH = path.join(process.cwd(), "public", "media", "hero.mp4");
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

console.log(`Content media check passed for ${mediaReferences.length} images and hero video.`);
