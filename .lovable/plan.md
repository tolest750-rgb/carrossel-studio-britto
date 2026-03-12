

## Problem Analysis

The edge function logs show `SyntaxError: Unexpected end of JSON input` errors in `generate-image`. This happens in two scenarios:
1. The request body arrives empty/malformed (e.g. when multiple variants fire simultaneously)
2. The AI gateway response body is empty/truncated

The catch block returns **status 500**, which the Supabase client surfaces as "Edge Function returned a non-2xx status code" — the error you see in the screenshot.

## Plan

### 1. Fix `generate-image` edge function
- Add defensive parsing for `req.json()` with a try/catch that returns a 200 + error JSON instead of letting it bubble to the 500 catch
- Change the outer catch to also return **status 200** with error JSON (matching the pattern already used for 429/402 errors), so the client always gets parseable data instead of a generic non-2xx error
- Add a safety check for empty/truncated AI gateway response before calling `.json()`

### 2. Improve client-side error handling in `gemini.ts`
- Better error message extraction when the edge function returns an error, so users see a meaningful message instead of the raw "non-2xx" text

### Technical detail

The key change in the edge function catch block:
```typescript
// Before: status 500 → triggers "non-2xx" error
{ status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }

// After: status 200 with error payload → client handles gracefully  
{ status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
```

And wrapping `req.json()`:
```typescript
let prompt, faceB64;
try {
  ({ prompt, faceB64 } = await req.json());
} catch {
  return new Response(
    JSON.stringify({ error: "Invalid request body" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

