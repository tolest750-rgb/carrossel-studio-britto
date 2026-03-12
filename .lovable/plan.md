

## Diagnóstico Confirmado

Os logs mostram o problema real: **os modelos retornam respostas 200 OK, mas o parser não consegue extrair a imagem da resposta**. A mensagem "No image extracted from [model] response" aparece repetidamente para todos os 3 modelos. Quando eventualmente funciona (ex: `Success with google/gemini-2.5-flash-image`), é porque o modelo retornou a imagem num formato que o parser reconhece.

O problema central: **cada modelo recebe apenas 1 tentativa** antes de pular para o próximo. Se os 3 modelos falharem na extração em suas tentativas únicas, o erro final aparece. Não há retry para "no image extracted", apenas para 429.

Além disso, não há logging do conteúdo da resposta quando a extração falha, impossibilitando debug.

## Plano de Correção

### 1. Edge Function `generate-image/index.ts` - 3 mudanças

**a) Logging diagnóstico** quando extração falha - logar estrutura real da resposta:
```typescript
// Antes do break "No image extracted"
console.warn(`[generate-image] Response structure from ${model}:`, 
  JSON.stringify({
    hasChoices: !!data?.choices?.length,
    messageKeys: Object.keys(data?.choices?.[0]?.message || {}),
    contentType: typeof data?.choices?.[0]?.message?.content,
    hasImages: !!data?.choices?.[0]?.message?.images?.length,
  })
);
```

**b) Retry por modelo** - cada modelo agora tenta até 3 vezes (mesmo sem 429), não apenas 1:
- Mover o `break` de "no image extracted" para `continue` quando há tentativas restantes
- O loop de retries já existe para 429; expandir para cobrir "no image extracted"

**c) Reordenar modelos** - colocar `gemini-3.1-flash-image-preview` primeiro (tem melhor taxa de sucesso nos logs):
```typescript
const IMAGE_MODELS = [
  "google/gemini-3.1-flash-image-preview",  // melhor taxa nos logs
  "google/gemini-2.5-flash-image",
  "google/gemini-3-pro-image-preview",
];
```

### 2. Frontend `src/lib/gemini.ts` - aumentar retries do cliente

Aumentar `MAX_CLIENT_RETRIES` de 2 para 3, dando mais chances ao backend.

### Arquivos impactados
- `supabase/functions/generate-image/index.ts`
- `src/lib/gemini.ts`

