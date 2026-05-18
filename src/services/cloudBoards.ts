import type { User } from "@supabase/supabase-js";
import type { ImportedIdea } from "../types/travel";
import { hasSupabaseBackend, supabaseClient } from "./supabaseClient";

const DEFAULT_BOARD_KEY = "default";

export type CloudUser = {
  id: string;
  email: string;
};

export type CloudBoardPayload = {
  version: 1;
  savedPlaces: string[];
  savedExperiences: string[];
  importedIdeas: ImportedIdea[];
  collectionAssignments: Record<string, string>;
  updatedAt: string;
};

export type CloudBoardRecord = {
  data: CloudBoardPayload;
  updatedAt: string;
};

export const hasCloudBoardBackend = hasSupabaseBackend;

export async function getCloudUser(): Promise<CloudUser | null> {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.auth.getUser();
  if (error || !data.user) return null;
  return toCloudUser(data.user);
}

export function onCloudAuthChange(callback: (user: CloudUser | null) => void): () => void {
  if (!supabaseClient) return () => {};
  const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ? toCloudUser(session.user) : null);
  });
  return () => data.subscription.unsubscribe();
}

export async function requestCloudSignIn(email: string): Promise<void> {
  if (!supabaseClient) {
    throw new Error("Online boards are unavailable right now.");
  }

  const redirectTo = typeof window === "undefined"
    ? undefined
    : `${window.location.origin}${window.location.pathname}?tab=saved`;
  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: redirectTo ? { emailRedirectTo: redirectTo } : {},
  });

  if (error) throw error;
}

export async function signOutCloudUser(): Promise<void> {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

export async function fetchCloudBoard(): Promise<CloudBoardRecord | null> {
  if (!supabaseClient) return null;
  const user = await requireCloudUser();
  const { data, error } = await supabaseClient
    .from("user_boards")
    .select("data, updated_at")
    .eq("user_id", user.id)
    .eq("board_key", DEFAULT_BOARD_KEY)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    data: normalizeCloudBoardPayload(data.data),
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : "",
  };
}

export async function saveCloudBoard(payload: CloudBoardPayload): Promise<CloudBoardRecord> {
  if (!supabaseClient) {
    throw new Error("Online boards are unavailable right now.");
  }

  const user = await requireCloudUser();
  const dataToSave = {
    ...payload,
    updatedAt: new Date().toISOString(),
  };
  const { data, error } = await supabaseClient
    .from("user_boards")
    .upsert(
      {
        user_id: user.id,
        board_key: DEFAULT_BOARD_KEY,
        data: dataToSave,
        updated_at: dataToSave.updatedAt,
      },
      { onConflict: "user_id,board_key" }
    )
    .select("data, updated_at")
    .single();

  if (error) throw error;

  return {
    data: normalizeCloudBoardPayload(data.data),
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : dataToSave.updatedAt,
  };
}

function toCloudUser(user: User): CloudUser {
  return {
    id: user.id,
    email: user.email ?? "Signed in",
  };
}

async function requireCloudUser(): Promise<CloudUser> {
  const user = await getCloudUser();
  if (!user) throw new Error("Sign in before using online boards.");
  return user;
}

function normalizeCloudBoardPayload(value: unknown): CloudBoardPayload {
  const record = isRecord(value) ? value : {};
  return {
    version: 1,
    savedPlaces: asStringArray(record.savedPlaces),
    savedExperiences: asStringArray(record.savedExperiences),
    importedIdeas: Array.isArray(record.importedIdeas) ? record.importedIdeas as ImportedIdea[] : [],
    collectionAssignments: isStringRecord(record.collectionAssignments) ? record.collectionAssignments : {},
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
  };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
