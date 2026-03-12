

## Diagnóstico Final dos Logs

Os logs confirmam 3 problemas concretos:

**1. Modelo selecionado não existe na API**
`IMAGE_MODEL_PRIORITY[0]` = `gemini-2.5-flash-preview-image-generation` -- esse modelo NÃO aparece na resposta de list-models. O sistema cai para `gemini-2.5-flash` que dá erro 400 "This model only supports text output".

**2. Todas as chaves do usuário em quota exhausted (429)**
Após o 400, tenta `gemini-2.5-flash` repetidamente → 429 com "limit: 20, model: gemini-2.5-flash". Todas as 5 chaves do usuário estão esgotadas no mesmo modelo.

**3. Fallback para Lovable AI gateway retorna "No image generated"**
O gateway usa `google/gemini-3-pro-image-preview` mas retorna `{"error":"No image generated"}` — parser pode estar falhando na extração.

## Plano de Correção (Pool Central + 1 imagem por vez)

### 1. Edge Function `generate-image` — Pool central com retry inteligente

- **Remover caminho de chave do usuário** — toda geração passa pelo Lovable AI gateway (pool central)
- **Retry com delay** no próprio edge function: se 429, extrair `retryDelay` da resposta e aguardar antes de retentar (até 3 tentativas)
- **Fallback de modelos no gateway**: tentar `google/gemini-2.5-flash-image` → `google/gemini-3-pro-image-preview` → `google/gemini-3.1-flash-image-preview`
- **Remover ação `list-models`** (não necessária com pool central)
- **Resposta com fila**: retornar `{ status: "queued" | "completed" | "failed", imageUrl?, retryAfter?, position? }`

### 2. Frontend `gemini.ts` — Simplificar para pool central

- Remover toda lógica de rotação de chaves do usuário
- Chamar edge function sem `geminiApiKey`/`geminiModel`
- Se receber `retryAfter`, aguardar e retentar automaticamente
- Simplificar para chamada única sem fallback client-side

### 3. Frontend `api-keys.ts` — Remover sistema de chaves

- Remover `IMAGE_MODEL_PRIORITY`, `getKeys`, `addKey`, rotação, etc.
- Manter apenas configurações simples se necessário no futuro

### 4. `carousel-store.tsx` — 1 imagem por solicitação

- Mudar de 4 variações automáticas para **1 única geração** por slide
- Adicionar botão "Gerar mais variações" que gera +1 por clique
- Manter composição (layout + overlay) após cada geração individual

### 5. UI — Remover gerenciador de chaves

- **`ApiKeyManager.tsx`**: Remover ou simplificar (sem necessidade de chaves do usuário)
- **`Navbar.tsx`**: Remover botão KEYS e indicador de chave ativa; mostrar status simples "Gerando..." / "Pronto"
- **`SlideCard.tsx`**: Mostrar 1 variação por padrão com botão "+1 VARIAÇÃO" para gerar mais sob demanda

### Arquivos impactados
- `supabase/functions/generate-image/index.ts` — reescrever para pool central com retry
- `src/lib/gemini.ts` — simplificar drasticamente
- `src/lib/api-keys.ts` — remover ou reduzir
- `src/lib/carousel-store.tsx` — 1 variação padrão
- `src/components/ApiKeyManager.tsx` — remover
- `src/components/Navbar.tsx` — simplificar
- `src/components/SlideCard.tsx` — adaptar para 1 variação + botão "gerar mais"

