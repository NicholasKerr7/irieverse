import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const read = (relativePath: string): string => {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  return fs.readFileSync(fullPath, "utf8");
};

const assertIncludes = (content: string, needle: string, label: string) => {
  if (!content.includes(needle)) {
    throw new Error(`${label} must include "${needle}"`);
  }
};

const schema = read("supabase/schema.sql");
const migrationsDir = path.join(root, "supabase", "migrations");
const migrations = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

const latestGrantMigration = migrations.find((file) => file.includes("harden_data_api_grants"));

if (!latestGrantMigration) {
  throw new Error("Missing Supabase data API grant hardening migration.");
}

const grantMigration = read(path.join("supabase", "migrations", latestGrantMigration));
const verifiedEventsMigration = migrations.find((file) => file.includes("create_verified_events"));

if (!verifiedEventsMigration) {
  throw new Error("Missing Supabase verified events migration.");
}

const verifiedEventsMigrationContent = read(path.join("supabase", "migrations", verifiedEventsMigration));

[
  "alter table public.trips enable row level security;",
  "alter table public.user_boards enable row level security;",
  "alter table public.verified_events enable row level security;",
  "revoke all on public.trips from anon, authenticated;",
  "revoke all on public.user_boards from anon;",
  "revoke all on public.verified_events from anon, authenticated;",
  "grant select on public.verified_events to anon, authenticated;",
  "grant select, insert, update, delete on public.user_boards to authenticated;",
  "grant execute on function public.create_trip_share(jsonb, text) to anon, authenticated;",
  "grant execute on function public.read_trip_share(uuid) to anon, authenticated;",
  "grant execute on function public.update_trip_share(uuid, jsonb, text) to anon, authenticated;",
  "grant execute on function public.delete_trip_share(uuid, text) to anon, authenticated;",
  "set search_path = ''",
].forEach((needle) => assertIncludes(schema, needle, "supabase/schema.sql"));

[
  "grant usage on schema public to anon, authenticated;",
  "revoke all on public.trips from anon, authenticated;",
  "revoke all on public.user_boards from anon;",
  "grant select, insert, update, delete on public.user_boards to authenticated;",
  "grant execute on function public.create_trip_share(jsonb, text) to anon, authenticated;",
  "grant execute on function public.read_trip_share(uuid) to anon, authenticated;",
  "grant execute on function public.update_trip_share(uuid, jsonb, text) to anon, authenticated;",
  "grant execute on function public.delete_trip_share(uuid, text) to anon, authenticated;",
].forEach((needle) => assertIncludes(grantMigration, needle, latestGrantMigration));

[
  "create table if not exists public.verified_events",
  "alter table public.verified_events enable row level security;",
  "create policy \"Published verified events are readable\"",
  "using (is_published = true);",
  "revoke all on public.verified_events from anon, authenticated;",
  "grant select on public.verified_events to anon, authenticated;",
  "grant select, insert, update, delete on public.verified_events to service_role;",
].forEach((needle) => assertIncludes(verifiedEventsMigrationContent, needle, verifiedEventsMigration));

const productionEnv = read("docs/production-env.md");
[
  "Data API",
  "RLS",
  "URL Configuration",
  "http://localhost:5173/**",
  "https://irieverse.vercel.app/**",
  "supabase db push",
].forEach((needle) => assertIncludes(productionEnv, needle, "docs/production-env.md"));

console.log("Supabase readiness checks passed.");
