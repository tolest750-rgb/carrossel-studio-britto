import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, ok } from "../_shared/cors.ts";
import { decryptKeyForUser } from "../_shared/google-key.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) return ok({ error: "Unauthorized" }, 401);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !user) return ok({ error: "Unauthorized" }, 401);

    const apiKey = await decryptKeyForUser(user.id);
    if (!apiKey) return ok({ models: [] });

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    );
    if (!res.ok) return ok({ models: [], error: "Falha ao listar modelos" });
    const json = await res.json();
    const all = (json.models || []) as Array<any>;
    const models = all
      .filter(
        (m) =>
          m.supportedGenerationMethods?.includes("generateContent") &&
          (m.name.includes("image") ||
            m.name.includes("flash") ||
            m.name.includes("pro") ||
            m.name.includes("nano")),
      )
      .map((m) => ({
        id: m.name.replace("models/", ""),
        name: m.displayName || m.name.replace("models/", ""),
        description: m.description || "",
      }));
    return ok({ models });
  } catch (e) {
    console.error("list-google-models error:", e);
    return ok({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
