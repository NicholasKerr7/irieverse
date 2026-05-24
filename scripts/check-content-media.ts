import { existsSync } from "node:fs";
import path from "node:path";
import { DESTINATIONS, EXPERIENCES } from "../src/data/content";

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

if (failures.length) {
  throw new Error(`Content media check failed:\n${failures.join("\n")}`);
}

console.log(`Content media check passed for ${mediaReferences.length} images.`);
