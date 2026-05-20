import type { DayExperienceOverrides, DayNotes, ImportedIdea, ImportedIdeaDayAssignments, PlanningMode, PlanningTemplateId } from "../types/travel";
import { hasSupabaseBackend, supabaseClient } from "./supabaseClient";

const EDIT_TOKEN_STORAGE_KEY = "irieverse_trip_edit_tokens";
const EDIT_TOKEN_BYTE_LENGTH = 32;

export type CollaborationErrorCode =
  | "not-configured"
  | "schema-missing"
  | "permission-denied"
  | "not-found"
  | "empty-response"
  | "request-failed";

class CollaborationError extends Error {
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
  planningMode?: PlanningMode;
  planningTemplateId?: PlanningTemplateId;
  plannerBaseId: string;
  plannerDays: number;
  plannerVibe: string;
  plannerBudget: number;
  plannerStartDate: string;
  originAirportId: string;
  manualRouteDestinationIds?: string[];
  lockedRouteDestinationIds?: string[];
  dayExperienceOverrides?: DayExperienceOverrides;
  dayNotes?: DayNotes;
  importedIdeaDayAssignments?: ImportedIdeaDayAssignments;
  savedPlaces: string[];
  savedExperiences: string[];
  importedIdeas: ImportedIdea[];
  updatedAt: string;
};

export type SaveTripStateResult = {
  id: string;
  editToken: string;
  mode: "created" | "updated";
};

export const hasCollaborationBackend = hasSupabaseBackend;

export function getCollaborationErrorCode(error: unknown): CollaborationErrorCode {
  return error instanceof CollaborationError ? error.code : "request-failed";
}

export function getCollaborationErrorMessage(error: unknown): string {
  if (error instanceof CollaborationError) return error.message;
  return "Share links are unavailable right now. Calendar export still works.";
}

export async function saveTripState(
  tripId: string | null,
  payload: TripPayload,
  editToken?: string | null
): Promise<SaveTripStateResult> {
  if (!supabaseClient) {
    throw new CollaborationError(
      "not-configured",
      "Share links are not connected yet. Calendar export still works."
    );
  }

  const activeEditToken = tripId && editToken ? editToken : createEditToken();
  const editTokenHash = await hashEditToken(activeEditToken);

  if (tripId && editToken) {
    const { data, error } = await supabaseClient.rpc("update_trip_share", {
      p_trip_id: tripId,
      p_trip_data: payload,
      p_edit_token_hash: editTokenHash,
    });

    if (error || !data) {
      throw toCollaborationError(
        error,
        "empty-response",
        "The share link was not updated. Try again in a moment."
      );
    }

    return { id: tripId, editToken: activeEditToken, mode: "updated" };
  }

  const { data, error } = await supabaseClient.rpc("create_trip_share", {
    p_trip_data: payload,
    p_edit_token_hash: editTokenHash,
  });

  if (error || !data || typeof data !== "string") {
    throw toCollaborationError(
      error,
      "empty-response",
      "The share link was not created. Try again in a moment."
    );
  }

  return { id: data, editToken: activeEditToken, mode: "created" };
}

export async function fetchTripState(tripId: string): Promise<TripPayload> {
  if (!supabaseClient) {
    throw new CollaborationError(
      "not-configured",
      "Shared trips are not connected yet."
    );
  }
  const { data, error } = await supabaseClient.rpc("read_trip_share", {
    p_trip_id: tripId,
  });

  if (error || !data) {
    throw toCollaborationError(error, "not-found", "Shared trip was not found.");
  }
  return data as TripPayload;
}

export function getStoredTripEditToken(tripId: string): string | null {
  const tokens = readStoredEditTokens();
  return tokens[tripId] ?? null;
}

export function rememberTripEditToken(tripId: string, editToken: string): void {
  if (typeof window === "undefined") return;
  const tokens = readStoredEditTokens();
  tokens[tripId] = editToken;
  try {
    window.localStorage.setItem(EDIT_TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // Local storage can be unavailable in private browsing or restricted embeds.
  }
}

export function serializeTripState(args: {
  planningMode?: PlanningMode;
  planningTemplateId?: PlanningTemplateId;
  plannerBaseId: string;
  plannerDays: number;
  plannerVibe: string;
  plannerBudget: number;
  plannerStartDate: string;
  originAirportId: string;
  manualRouteDestinationIds: string[];
  lockedRouteDestinationIds: string[];
  dayExperienceOverrides: DayExperienceOverrides;
  dayNotes: DayNotes;
  importedIdeaDayAssignments: ImportedIdeaDayAssignments;
  savedPlaces: Set<string>;
  savedExperiences: Set<string>;
  importedIdeas: ImportedIdea[];
}): TripPayload {
  const now = new Date().toISOString();
  const payload: TripPayload = {
    plannerBaseId: args.plannerBaseId,
    plannerDays: args.plannerDays,
    plannerVibe: args.plannerVibe,
    plannerBudget: args.plannerBudget,
    plannerStartDate: args.plannerStartDate,
    originAirportId: args.originAirportId,
    manualRouteDestinationIds: args.manualRouteDestinationIds,
    lockedRouteDestinationIds: args.lockedRouteDestinationIds,
    dayExperienceOverrides: args.dayExperienceOverrides,
    dayNotes: args.dayNotes,
    importedIdeaDayAssignments: args.importedIdeaDayAssignments,
    savedPlaces: Array.from(args.savedPlaces),
    savedExperiences: Array.from(args.savedExperiences),
    importedIdeas: args.importedIdeas,
    updatedAt: now,
  };
  if (args.planningMode) payload.planningMode = args.planningMode;
  if (args.planningTemplateId) payload.planningTemplateId = args.planningTemplateId;
  return payload;
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

  if (
    supabaseError.code === "42P01" ||
    supabaseError.code === "PGRST205" ||
    searchableMessage.includes("relation \"public.trips\" does not exist") ||
    supabaseError.code === "PGRST202" ||
    (searchableMessage.includes("function") && searchableMessage.includes("trip_share")) ||
    searchableMessage.includes("could not find the function") ||
    (searchableMessage.includes("public.trips") && searchableMessage.includes("schema cache")) ||
    (searchableMessage.includes("could not find the table") && searchableMessage.includes("trips"))
  ) {
    return new CollaborationError(
      "schema-missing",
      "Share links need one more setup step. Calendar export still works.",
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
      "Share links are blocked right now. Calendar export still works.",
      error
    );
  }

  if (supabaseError.code === "PGRST116" || searchableMessage.includes("0 rows")) {
    return new CollaborationError("not-found", "Shared trip was not found.", error);
  }

  return new CollaborationError(fallbackCode, fallbackMessage, error);
}

function createEditToken(): string {
  if (!globalThis.crypto?.getRandomValues) {
    throw new CollaborationError(
      "request-failed",
      "Share links are unavailable in this browser. Calendar export still works."
    );
  }
  const bytes = new Uint8Array(EDIT_TOKEN_BYTE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashEditToken(editToken: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new CollaborationError(
      "request-failed",
      "Share links are unavailable in this browser. Calendar export still works."
    );
  }
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(editToken));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readStoredEditTokens(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(EDIT_TOKEN_STORAGE_KEY);
    if (!stored) return {};
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => (
        typeof entry[0] === "string" && typeof entry[1] === "string"
      ))
    );
  } catch {
    return {};
  }
}

function readSupabaseFailure(error: unknown): SupabaseFailure {
  if (typeof error !== "object" || error === null) return {};
  const record = error as Record<string, unknown>;
  const failure: SupabaseFailure = {};
  if (typeof record.code === "string") failure.code = record.code;
  if (typeof record.message === "string") failure.message = record.message;
  if (typeof record.details === "string") failure.details = record.details;
  if (typeof record.hint === "string") failure.hint = record.hint;
  return failure;
}
