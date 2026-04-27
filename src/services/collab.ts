import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { ImportedIdea } from "../types/travel";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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

export async function saveTripState(
  tripId: string | null,
  payload: TripPayload
): Promise<string> {
  if (!supabase) {
    throw new Error("Collaboration backend not configured.");
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
    throw error ?? new Error("No data returned");
  }

  return (data as TripRecord).id;
}

export async function fetchTripState(tripId: string): Promise<TripPayload> {
  if (!supabase) {
    throw new Error("Collaboration backend not configured.");
  }
  const { data, error } = await supabase
    .from("trips")
    .select("data, updated_at")
    .eq("id", tripId)
    .single();

  if (error || !data) {
    throw error ?? new Error("Trip not found");
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
