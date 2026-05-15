import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseDisabled = /^(1|true|yes|on)$/i.test(import.meta.env.VITE_SUPABASE_DISABLED ?? "");

export const supabaseClient: SupabaseClient | null =
  !supabaseDisabled && supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export const hasSupabaseBackend = () => Boolean(supabaseClient);
