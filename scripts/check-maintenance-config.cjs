const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const read = (relativePath) => {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }

  return fs.readFileSync(fullPath, "utf8");
};

const assertIncludes = (content, needle, label) => {
  if (!content.includes(needle)) {
    throw new Error(`${label} must include "${needle}"`);
  }
};

const packageJson = JSON.parse(read("package.json"));
const packageLock = JSON.parse(read("package-lock.json"));
const scripts = packageJson.scripts || {};
const nodeVersion = read(".nvmrc").trim();

if (!nodeVersion.startsWith("20")) {
  throw new Error(".nvmrc must keep the repo on the Node 20 maintenance line");
}

if (!packageJson.packageManager?.startsWith("npm@")) {
  throw new Error("package.json must declare the npm packageManager version");
}

if (packageJson.engines?.node !== "20.x") {
  throw new Error('package.json engines.node must be "20.x"');
}

if (packageJson.engines?.npm !== ">=10") {
  throw new Error('package.json engines.npm must be ">=10"');
}

const lockedRoot = packageLock.packages?.[""];

if (lockedRoot?.engines?.node !== packageJson.engines.node) {
  throw new Error("package-lock.json root node engine must match package.json");
}

if (lockedRoot?.engines?.npm !== packageJson.engines.npm) {
  throw new Error("package-lock.json root npm engine must match package.json");
}

[
  "typecheck",
  "test:api",
  "qa:local",
  "check:maintenance",
  "verify",
  "verify:full",
  "audit:prod",
  "audit:all",
  "audit:fix:dry",
  "deps:outdated",
  "maintenance",
].forEach((scriptName) => {
  if (!scripts[scriptName]) {
    throw new Error(`package.json is missing the "${scriptName}" script`);
  }
});

assertIncludes(scripts.verify, "npm run typecheck", "verify script");
assertIncludes(scripts.verify, "npm run test:api", "verify script");
assertIncludes(scripts.verify, "npm run check:maintenance", "verify script");
assertIncludes(scripts.verify, "npm run audit:prod", "verify script");
assertIncludes(scripts.verify, "npm run build", "verify script");
assertIncludes(scripts["check:maintenance"], "scripts/check-maintenance-config.cjs", "check:maintenance script");
assertIncludes(scripts["verify:full"], "npm run verify", "verify:full script");
assertIncludes(scripts["verify:full"], "npm run qa:local", "verify:full script");

const dependabot = read(".github/dependabot.yml");
assertIncludes(dependabot, "package-ecosystem: npm", "Dependabot config");
assertIncludes(dependabot, "package-ecosystem: github-actions", "Dependabot config");
assertIncludes(dependabot, "target-branch: main", "Dependabot config");
assertIncludes(dependabot, "version-update:semver-major", "Dependabot config");

const ci = read(".github/workflows/ci.yml");
assertIncludes(ci, "node-version-file: .nvmrc", "CI workflow");
assertIncludes(ci, "npm run verify", "CI workflow");
assertIncludes(ci, "npx playwright install --with-deps chromium", "CI workflow");
assertIncludes(ci, "npm run qa:local", "CI workflow");

const dependencyReview = read(".github/workflows/dependency-review.yml");
assertIncludes(dependencyReview, "actions/dependency-review-action@v4", "Dependency Review workflow");
assertIncludes(dependencyReview, "fail-on-severity: high", "Dependency Review workflow");

const maintenance = read(".github/workflows/maintenance.yml");
assertIncludes(maintenance, "workflow_dispatch:", "Dependency Maintenance workflow");
assertIncludes(maintenance, "schedule:", "Dependency Maintenance workflow");
assertIncludes(maintenance, "node-version-file: .nvmrc", "Dependency Maintenance workflow");
assertIncludes(maintenance, "npm run maintenance", "Dependency Maintenance workflow");

const prTemplate = read(".github/pull_request_template.md");
assertIncludes(prTemplate, "Dependency Update Review", "Pull request template");
assertIncludes(prTemplate, "Dependency Review passed", "Pull request template");

console.log("Maintenance config checks passed.");
