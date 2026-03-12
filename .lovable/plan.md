

## Diagnóstico Final

### Problema 1: Todos os modelos na lista estão obsoletos
Os logs confirmam 404 e 400 para **todos** os modelos no `IMAGE_MODEL_PRIORITY`:
- `gemini-2.0-flash-preview-image-generation` → 404
- `gemini-2.0-flash-exp` → 404
- `gemini-1.5-flash` → 404
- `gemini-2.5-flash-preview-05-20` → 404
- `gemini-2.5-pro-preview-06-05` → 404
- Modelos que existem mas não suportam imagem → 400 "Model does not support response modalities: text,image"

**Modelos válidos atuais para geração de imagem (confirmados na documentação oficial):**
- `gemini-2.5-flash-image` — rápido, bom custo-benefício
- `gemini-3-pro-image-preview` — melhor qualidade
- `gemini-3.1-flash-image-preview` — mais novo, rápido com qualidade pro

### Problema 2: 4 gerações simultâneas causam rate limit
O código em `carousel-store.tsx` linha 331 dispara 4 `Promise.all` simultâneas. Com chave gratuita do Gemini, isso quase certamente causa `429 RESOURCE_EXHAUSTED` em 3 das 4 requisições.

### Plano de Correção

**1. Atualizar `src/lib/api-keys.ts`**
- Substituir `IMAGE_MODEL_PRIORITY` pelos 3 modelos válidos atuais
- Migrar qualquer modelo salvo no localStorage para o novo default

**2. Atualizar `supabase/functions/generate-image/index.ts`**
- Garantir que o default do edge function também use modelo válido (`gemini-2.0-flash-preview-image-generation` → `gemini-2.5-flash-image`)

**3. Tornar geração sequencial em `src/lib/carousel-store.tsx`**
- Trocar `Promise.all([0,1,2,3].map(...))` por loop `for` sequencial
- Gerar 1 variação por vez, aguardar conclusão antes de iniciar a próxima
- Manter atualização de status em tempo real para cada variação

**4. Atualizar `src/components/ApiKeyManager.tsx`**
- Atualizar lista de modelos exibidos no UI para os 3 válidos

### Arquivos impactados
- `src/lib/api-keys.ts` — modelos válidos
- `src/lib/carousel-store.tsx` — geração sequencial
- `supabase/functions/generate-image/index.ts` — default model
- `src/components/ApiKeyManager.tsx` — UI de modelos

