import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, ok } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Simple base64 obfuscation with project secret as salt.
// Real key never exposed to client after save.
async function encrypt(plain: string): Promise<{ enc: string; nonce: string }> {
  const salt = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(0, 32);
  const nonce = crypto.randomUUID();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(salt + nonce),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new TextEncoder().encode(nonce), iterations: 1000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const iv = new TextEncoder().encode(nonce.slice(0, 12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return { enc: btoa(String.fromCharCode(...new Uint8Array(ct))), nonce };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) return ok({ error: "Unauthorized" }, 401);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !user) return ok({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const apiKey = (body.apiKey || "").trim();

    if (!apiKey) {
      // Clear key
      await supabase
        .from("profiles")
        .update({ google_api_key_encrypted: null, google_api_key_nonce: null })
        .eq("user_id", user.id);
      return ok({ ok: true, cleared: true });
    }

    if (!apiKey.startsWith("AIza") || apiKey.length < 30) {
      return ok({ error: "Chave Google API inválida (deve começar com AIza)" }, 400);
    }

    // Validate by listing models
    const testRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    );
    if (!testRes.ok) {
      const txt = await testRes.text();
      console.error("Key validation failed:", txt.slice(0, 200));
      return ok({ error: "Chave inválida ou sem acesso à API Gemini" }, 400);
    }
    const modelsJson = await testRes.json();
    const allModels = (modelsJson.models || []) as Array<{
      name: string;
      displayName?: string;
      supportedGenerationMethods?: string[];
    }>;
    const imageModels = allModels
      .filter(
        (m) =>
          m.supportedGenerationMethods?.includes("generateContent") &&
          (m.name.includes("image") || m.name.includes("flash") || m.name.includes("pro")),
      )
      .map((m) => ({
        id: m.name.replace("models/", ""),
        name: m.displayName || m.name.replace("models/", ""),
      }));

    const { enc, nonce } = await encrypt(apiKey);

    await supabase
      .from("profiles")
      .update({
        google_api_key_encrypted: enc,
        google_api_key_nonce: nonce,
      })
      .eq("user_id", user.id);

    return ok({ ok: true, models: imageModels });
  } catch (e) {
    console.error("save-google-key error:", e);
    return ok({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
