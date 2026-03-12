

## Diagnóstico

Os logs mostram claramente o problema. Ambos os modelos retornam respostas onde `msg.content` é um **objeto** (não array, não string), mas a função `extractImageFromGatewayResponse` só trata arrays e strings. O objeto provavelmente tem uma estrutura como `{ type: "image", data: "..." }` ou similar que não está sendo capturada.

Além disso, os logs mostram que `gemini-3.1-flash-image-preview` às vezes retorna `contentType: "string"` com `contentLength: 903` — possivelmente texto descritivo em vez de imagem.

## Plano

### 1. Edge Function `generate-image/index.ts`

**Corrigir `extractImageFromGatewayResponse`:**
- Adicionar tratamento para `msg.content` quando é um objeto simples (não array):
  - Checar `msg.content.image_url?.url`
  - Checar `msg.content.data` (base64 direto)
  - Checar `msg.content.url`
- Adicionar log do conteúdo real (primeiros 200 chars) quando falha a extração, para debug futuro

**Adicionar modelo fallback:**
- Incluir `google/gemini-2.5-flash-image` (Nano Banana básico) como terceiro modelo no pool — é o mais estável para geração de imagens

### Arquivo impactado
- `supabase/functions/generate-image/index.ts`

