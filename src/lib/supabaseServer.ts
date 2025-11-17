import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase server environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.",
    );
  }

  // Validate URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error(
      `Invalid Supabase URL format: ${supabaseUrl}. It should be a valid URL (e.g., https://your-project.supabase.co).`,
    );
  }

  // Log the URL (without sensitive parts) for debugging
  console.log(`[Supabase] Connecting to: ${parsedUrl.origin}`);
  console.log(`[Supabase] Service role key present: ${serviceRoleKey ? 'Yes' : 'No'}`);
  
  // Warn if URL doesn't look like a standard Supabase URL
  if (!parsedUrl.hostname.endsWith('.supabase.co')) {
    console.warn(`[Supabase] Warning: URL hostname "${parsedUrl.hostname}" doesn't end with .supabase.co`);
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: "public",
    },
  });
}
