

## Plano: Rota Direta com Google API Key

### Resumo
Adicionar campo para o usuário colar sua Google API Key (do Google AI Studio). Quando presente, a Edge Function chama a API do Google Gemini diretamente, sem passar pelo Lovable AI Gateway — zero créditos Lovable consumidos.

### 1. Edge Function `supabase/functions/generate-image/index.ts`

**Adicionar função `generateWithGoogleDirect`:**
- Recebe `prompt`, `faceB64`, `googleApiKey`
- Chama `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=API_KEY`
- Modelo: `gemini-2.0-flash-exp` (gratuito no Google AI Studio)
- Request body no formato nativo Gemini (parts com `inlineData` para face)
- Extrai imagem de `response.candidates[0].content.parts[].inlineData`
- 2 retries com backoff para 429

**Modificar handler:**
- Aceitar campo `googleApiKey` no body da request
- Se `googleApiKey` presente → usar `generateWithGoogleDirect`
- Se não → fallback para `generateWithGateway` (Lovable AI, como hoje)

### 2. Frontend `src/lib/gemini.ts`

- Ler `googleApiKey` do `localStorage`
- Passar para a Edge Function no body: `{ prompt, faceB64, googleApiKey }`

### 3. Sidebar `src/components/Sidebar.tsx`

- Substituir seção "LOVABLE AI" por seção com toggle:
  - **Sem key**: mostra status "LOVABLE AI · CONECTADO" (como hoje)
  - **Com key**: mostra "GOOGLE AI · Nano Banana Pro · Grátis"
- Campo para colar a Google API Key (tipo password, com botão mostrar/ocultar)
- Link "Obter key grátis" → `https://aistudio.google.com/apikey`
- Botão "Remover" para limpar a key salva
- Manter o contador "Imagens geradas hoje"

### Arquivos impactados
- `supabase/functions/generate-image/index.ts` — adicionar rota Google direta
- `src/lib/gemini.ts` — passar googleApiKey do localStorage
- `src/components/Sidebar.tsx` — UI para configurar Google API Key

