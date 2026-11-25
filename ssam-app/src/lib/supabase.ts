import { createClient } from "@supabase/supabase-js";
import { DEMO } from "@/lib/demo/demoState";
import { fakeSupabase } from "@/lib/demo/fakeSupabase";

// Valores reales del proyecto Supabase (Settings -> API).
// Son públicos; la seguridad la da Row Level Security (RLS) en la base.
// El fallback a env vars existe por si se configuran en el entorno.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://orjhzxgprkizjwuxwcjn.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yamh6eGdwcmtpemp3dXh3Y2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTI0MTksImV4cCI6MjA5NDk4ODQxOX0.pXJobX3yNLeN4IMBm_oUttK86RRw6l0-qWW6Kn56fS4";

// En modo demo (solo pruebas) la app usa la base ficticia del navegador y
// nunca se conecta a la base real.
export const supabase: ReturnType<typeof createClient> = DEMO
  ? fakeSupabase
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
