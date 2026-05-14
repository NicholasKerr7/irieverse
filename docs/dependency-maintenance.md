# Dependency Maintenance

This repo uses Dependabot, GitHub Actions, and npm audit scripts to keep dependency updates visible and reviewable.

## Automation

- Dependabot opens weekly npm update PRs for minor and patch updates.
- Dependabot opens weekly GitHub Actions update PRs for minor and patch updates.
- Major version updates are ignored by Dependabot and should be planned manually.
- CI runs typecheck, API regression tests, production dependency audit, build, and local QA.
- Dependency Review runs on dependency-changing PRs and blocks high-severity vulnerable additions.
- The Dependency Maintenance workflow runs weekly and can also be started manually from GitHub Actions.

## Local Commands

Run the fast pre-merge verification pass:

```sh
npm run verify
```

Run the fast pass plus local browser QA:

```sh
npm run verify:full
```

Run the normal maintenance pass:

```sh
npm run maintenance
```

Run only the production security gate:

```sh
npm run audit:prod
```

Run a deeper audit, including dev dependencies and moderate advisories:

```sh
npm run audit:all
```

Preview npm audit changes before editing the lockfile:

```sh
npm run audit:fix:dry
```

Check outdated packages without failing the command:

```sh
npm run deps:outdated
```

## Reviewing Dependabot PRs

For routine minor and patch updates:

1. Confirm CI is green.
2. Confirm Dependency Review is green.
3. Read release notes for packages that affect runtime behavior.
4. Run the app locally when the update touches React, Vite, MapLibre, Supabase, Playwright, or browser-facing libraries.
5. Merge only after the lockfile and generated dependency tree look intentional.

For major updates:

1. Create a manual branch.
2. Update one major package family at a time.
3. Read migration notes before changing code.
4. Run `npm run verify:full`.
5. Smoke test the affected feature in the browser before merging.

## Current Known Advisory

`npm audit` may report a moderate advisory from the MapLibre dependency chain through `pbf` and `protocol-buffers-schema`.

Current policy:

- `npm run audit:prod` blocks high-severity production issues.
- Moderate advisories are reviewed with `npm run audit:all`.
- Do not run `npm audit fix` blindly.
- Use `npm run audit:fix:dry` first, then decide if the lockfile change is safe.

## When To Escalate

Escalate a dependency update before merging when:

- It introduces a high or critical vulnerability.
- It changes map rendering, routing, Supabase data access, auth behavior, or build output.
- It requires a major React, Vite, MapLibre, Tailwind, or TypeScript migration.
- It changes browser support or generated assets.
- It causes any production QA screenshot or flow to change unexpectedly.
