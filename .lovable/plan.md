

## Plano: Conectar Google API Key do Usuário (Nano Banana Pro grátis)

### Problema
O sistema usa apenas o Lovable AI Gateway, que tem custos e rate limits. O usuário tem acesso gratuito ao `gemini-3-pro-image-preview` (Nano Banana Pro) via Google AI Studio com 0 créditos.

### Solução
Permitir que o usuário cole sua Google API Key. Quando presente, a Edge Function chama a **API do Google diretamente** (não o gateway Lovable), eliminando custos e rate limits do gateway.

### Mudanças

**1. Edge Function `generate-image/index.ts`** — Dual path

- Receber campo opcional `googleApiKey` no body
- Se presente: chamar `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent` diretamente com a chave do usuário
- Se ausente: manter fallback pelo Lovable AI Gateway (comportamento atual)
- Parser para resposta do Google (formato diferente do gateway):
```text
response.candidates[0].content.parts[] → buscar part com inlineData.mimeType startsWith "image/"
→ converter para data:image/png;base64,{inlineData.data}
```
- Request body do Google:
```json
{
  "contents": [{"parts": [{"text": "prompt"}, {"inlineData": {"mimeType": "image/jpeg", "data": "base64..."}}]}],
  "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]}
}
```

**2. Frontend `src/lib/gemini.ts`** — Passar a key

- Ler `googleApiKey` do localStorage
- Passar para a edge function no body

**3. UI `src/components/Sidebar.tsx`** — Campo de API Key

- Adicionar seção "🔑 GOOGLE API KEY" no topo da config
- Input para colar a key (salva em localStorage, mascarada com `••••`)
- Indicador visual: "🍌 Nano Banana Pro · Grátis" quando key presente
- Link para `https://aistudio.google.com/apikey` para obter a key

**4. Otimização de velocidade**

- Com Google API direta: elimina overhead do gateway intermediário
- Reduzir `MAX_RETRIES` para 2 na rota Google (menos rate limit)
- Manter retry com delay para 429

### Arquivos impactados
- `supabase/functions/generate-image/index.ts` — adicionar rota Google direta
- `src/lib/gemini.ts` — passar googleApiKey
- `src/components/Sidebar.tsx` — campo de API key

