

## Plan: Multi-Key Gemini Rotation with Auto-Retry

### Overview
Implement a system where users can register multiple Gemini API keys stored in localStorage. When image generation fails with any error, the system automatically rotates to the next available key and retries. Only when ALL keys have been tried and failed, the error is shown to the user with an option to add a new key.

### Architecture

```text
Client (localStorage)          Edge Function
┌─────────────────┐           ┌──────────────────┐
│ geminiKeys[]    │──key──>   │ generate-image   │
│ [key1,key2,key3]│           │ Uses provided key│
│                 │<──error── │ or LOVABLE_API_KEY│
│ Try next key... │──key2──>  │                  │
│                 │<──image── │                  │
└─────────────────┘           └──────────────────┘
```

### 1. Create `src/lib/api-keys.ts` — Key management utility
- `GeminiKeyEntry` type: `{ id, name, key, addedAt, failCount }`
- `getKeys()` / `saveKeys()` from localStorage
- `getNextKey(excludeIds)` — returns next available key, skipping already-tried ones
- `markKeyFailed(keyId)` — increments fail count
- `resetAllKeys()` — resets fail counts after successful generation

### 2. Update `supabase/functions/generate-image/index.ts`
- Accept optional `geminiApiKey` in request body
- If provided, call Google Gemini API directly (`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`) instead of Lovable AI Gateway
- If NOT provided, fall back to existing LOVABLE_API_KEY flow
- Return `{ isRetryable: true }` on 429/402/5xx errors so client knows to rotate

### 3. Update `src/lib/gemini.ts` — Retry logic with key rotation
- Load keys from localStorage
- If keys exist, send first key to edge function
- On error with `isRetryable`, try next key
- Loop through all keys before giving up
- If no user keys, fall back to LOVABLE_API_KEY (current behavior)
- When all keys exhausted, throw special `AllKeysExhaustedError`

### 4. Update `src/lib/carousel-store.tsx` — Error handling
- Detect `AllKeysExhaustedError` in catch blocks
- Set a state flag `showApiKeyModal` when this happens

### 5. Create `src/components/ApiKeyManager.tsx` — UI for managing keys
- Modal/dialog to add, list, and delete Gemini API keys
- Shows when all keys exhausted during generation
- Also accessible from Navbar (gear icon or similar)
- Each key entry: name, masked key, delete button
- Add form: name + API key input + save button
- Link to Google AI Studio to get a key

### 6. Update `src/components/Navbar.tsx`
- Add a button/icon to open ApiKeyManager
- Show key count badge

### 7. Update `src/components/SlideCard.tsx` error display
- When error is "all keys exhausted", show a button to open the API key manager instead of just the error text

### Technical Details

**Edge function Gemini direct call:**
```typescript
// When user provides their own key
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`;
const response = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [{ parts: contentParts }],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
  })
});
```

**Client retry loop in gemini.ts:**
```typescript
const keys = getKeys();
const triedIds: string[] = [];
while (true) {
  const key = getNextKey(triedIds);
  if (!key) break; // all exhausted
  triedIds.push(key.id);
  try {
    const result = await callEdgeFunction(prompt, faceB64, key.key);
    if (result.imageUrl) return result.imageUrl;
    if (result.isRetryable) continue; // try next key
  } catch { continue; }
}
// Fall back to LOVABLE_API_KEY
// If that also fails, throw AllKeysExhaustedError
```

### Files to create/modify
- **Create:** `src/lib/api-keys.ts`, `src/components/ApiKeyManager.tsx`
- **Modify:** `supabase/functions/generate-image/index.ts`, `src/lib/gemini.ts`, `src/lib/carousel-store.tsx`, `src/components/Navbar.tsx`, `src/components/SlideCard.tsx`, `src/pages/Index.tsx`

