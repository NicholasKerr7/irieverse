import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryOutDir = path.join(root, ".tmp-service-worker-check");
const expectedWorkerPath = path.join(root, "public", "sw.js");
const generatedWorkerPath = path.join(temporaryOutDir, "sw.js");
const tscBin = path.join(root, "node_modules", "typescript", "bin", "tsc");

fs.rmSync(temporaryOutDir, { recursive: true, force: true });

try {
  execFileSync(
    process.execPath,
    [
      tscBin,
      "-p",
      path.join(root, "tsconfig.service-worker.json"),
      "--outDir",
      temporaryOutDir,
      "--pretty",
      "false",
    ],
    {
      cwd: root,
      stdio: "inherit",
    }
  );

  const expectedWorker = fs.readFileSync(expectedWorkerPath, "utf8");
  const generatedWorker = fs.readFileSync(generatedWorkerPath, "utf8");

  if (generatedWorker !== expectedWorker) {
    throw new Error("public/sw.js is stale. Run `npm run build:sw` and commit the generated file.");
  }

  console.log("Service worker output is current.");
} finally {
  fs.rmSync(temporaryOutDir, { recursive: true, force: true });
}
