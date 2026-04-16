import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function decrypt(enc: string, nonce: string): Promise<string> {
  const salt = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(0, 32);
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
    ["decrypt"],
  );
  const iv = new TextEncoder().encode(nonce.slice(0, 12));
  const ct = Uint8Array.from(atob(enc), (c) => c.charCodeAt(0));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

export async function decryptKeyForUser(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("google_api_key_encrypted, google_api_key_nonce")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data?.google_api_key_encrypted || !data?.google_api_key_nonce) return null;
  try {
    return await decrypt(data.google_api_key_encrypted, data.google_api_key_nonce);
  } catch (e) {
    console.error("decrypt failed:", e);
    return null;
  }
}

export async function getSelectedModelForUser(userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("selected_model")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.selected_model || "gemini-2.5-flash-image-preview";
}

export async function userHasActiveSubscription(userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_active_subscription", { _user_id: userId });
  return !!data;
}
