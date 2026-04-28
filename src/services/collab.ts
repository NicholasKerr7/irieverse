import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { ImportedIdea } from "../types/travel";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export type CollaborationErrorCode =
  | "not-configured"
  | "schema-missing"
  | "permission-denied"
  | "not-found"
  | "empty-response"
  | "request-failed";

export class CollaborationError extends Error {
  code: CollaborationErrorCode;
  cause?: unknown;

  constructor(code: CollaborationErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "CollaborationError";
    this.code = code;
    this.cause = cause;
  }
}

export type TripPayload = {
  plannerBaseId: string;
  plannerDays: number;
  plannerVibe: string;
  plannerBudget: number;
  plannerStartDate: string;
  originAirportId: string;
  manualRouteDestinationIds?: string[];
  savedPlaces: string[];
  savedExperiences: string[];
  importedIdeas: ImportedIdea[];
  updatedAt: string;
};

type TripRecord = {
  id: string;
  data: TripPayload;
  updated_at: string;
};

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
}

export const hasCollaborationBackend = () => Boolean(supabase);

export function getCollaborationErrorCode(error: unknown): CollaborationErrorCode {
  return error instanceof CollaborationError ? error.code : "request-failed";
}

export function getCollaborationErrorMessage(error: unknown): string {
  if (error instanceof CollaborationError) return error.message;
  return "Supabase sharing is unavailable right now.";
}

export async function saveTripState(
  tripId: string | null,
  payload: TripPayload
): Promise<string> {
  if (!supabase) {
    throw new CollaborationError(
      "not-configured",
      "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable live sharing."
    );
  }

  const baseInsert = { data: payload };
  const mutation =
    tripId != null
      ? { ...baseInsert, id: tripId }
      : baseInsert;

  const { data, error } = await supabase
    .from("trips")
    .upsert(mutation, { onConflict: "id", ignoreDuplicates: false })
    .select()
    .single();

  if (error || !data) {
    throw toCollaborationError(
      error,
      "empty-response",
      "Supabase accepted the share request but did not return a trip id."
    );
  }

  return (data as TripRecord).id;
}

export async function fetchTripState(tripId: string): Promise<TripPayload> {
  if (!supabase) {
    throw new CollaborationError(
      "not-configured",
      "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load shared trips."
    );
  }
  const { data, error } = await supabase
    .from("trips")
    .select("data, updated_at")
    .eq("id", tripId)
    .single();

  if (error || !data) {
    throw toCollaborationError(error, "not-found", "Shared trip was not found.");
  }
  return (data as TripRecord).data;
}

export function serializeTripState(args: {
  plannerBaseId: string;
  plannerDays: number;
  plannerVibe: string;
  plannerBudget: number;
  plannerStartDate: string;
  originAirportId: string;
  manualRouteDestinationIds: string[];
  savedPlaces: Set<string>;
  savedExperiences: Set<string>;
  importedIdeas: ImportedIdea[];
}): TripPayload {
  const now = new Date().toISOString();
  return {
    plannerBaseId: args.plannerBaseId,
    plannerDays: args.plannerDays,
    plannerVibe: args.plannerVibe,
    plannerBudget: args.plannerBudget,
    plannerStartDate: args.plannerStartDate,
    originAirportId: args.originAirportId,
    manualRouteDestinationIds: args.manualRouteDestinationIds,
    savedPlaces: Array.from(args.savedPlaces),
    savedExperiences: Array.from(args.savedExperiences),
    importedIdeas: args.importedIdeas,
    updatedAt: now,
  };
}

type SupabaseFailure = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function toCollaborationError(
  error: unknown,
  fallbackCode: CollaborationErrorCode,
  fallbackMessage: string
): CollaborationError {
  if (error instanceof CollaborationError) return error;
  if (!error) return new CollaborationError(fallbackCode, fallbackMessage);

  const supabaseError = readSupabaseFailure(error);
  const searchableMessage = [
    supabaseError.code,
    supabaseError.message,
    supabaseError.details,
    supabaseError.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (supabaseError.code === "42P01" || searchableMessage.includes("relation \"public.trips\" does not exist")) {
    return new CollaborationError(
      "schema-missing",
      "Supabase trips table is missing. Apply supabase/schema.sql or run supabase db push.",
      error
    );
  }

  if (
    supabaseError.code === "42501" ||
    searchableMessage.includes("row-level security") ||
    searchableMessage.includes("permission denied")
  ) {
    return new CollaborationError(
      "permission-denied",
      "Supabase trips table exists, but RLS policies are blocking sharing. Re-run the trip sharing migrations.",
      error
    );
  }

  if (supabaseError.code === "PGRST116" || searchableMessage.includes("0 rows")) {
    return new CollaborationError("not-found", "Shared trip was not found.", error);
  }

  return new CollaborationError(fallbackCode, fallbackMessage, error);
}

function readSupabaseFailure(error: unknown): SupabaseFailure {
  if (typeof error !== "object" || error === null) return {};
  const record = error as Record<string, unknown>;
  return {
    code: typeof record.code === "string" ? record.code : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
    details: typeof record.details === "string" ? record.details : undefined,
    hint: typeof record.hint === "string" ? record.hint : undefined,
  };
}
