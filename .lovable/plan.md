

## Como está a integração do Nano Banana hoje

Vou explicar o estado atual da integração, baseado no código.

### 1. Frontend (`src/lib/gemini.ts`)
- Lê `google_api_key` do `localStorage` do navegador.
- Envia esse valor (se existir) no body da request para a Edge Function `generate-image`, junto com o prompt e a face em base64.
- Se não houver key salva, simplesmente não envia o campo — a Edge Function decide o caminho.

### 2. Sidebar (`src/components/Sidebar.tsx`)
- Mostra um campo de input (tipo password) onde o usuário cola manualmente a Google API Key.
- Tem botão de mostrar/ocultar, botão "Remover" e link para o Google AI Studio.
- Indicador de status alterna entre "LOVABLE AI · CONECTADO" e "GOOGLE AI · NANO BANANA PRO · GRÁTIS" conforme a presença da key.

### 3. Edge Function (`supabase/functions/generate-image/index.ts`)
Possui dois caminhos:

**Caminho A — Google Direto (quando `googleApiKey` vem do frontend):**
- Função `generateWithGoogleDirect`.
- Chama `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`.
- Modelo usado: **`gemini-2.0-flash-exp`** ⚠️ (esse modelo foi descontinuado pelo Google — é a causa do erro recente de geração).
- Sem créditos Lovable consumidos.

**Caminho B — Lovable AI Gateway (fallback, sem key):**
- Pool de modelos: `google/gemini-3.1-flash-image-preview` (Nano Banana 2/Pro), `google/gemini-3-pro-image-preview`, `google/gemini-2.5-flash-image`.
- Consome créditos Lovable.

### 4. Geração paralela
- O `carousel-store.tsx` dispara 4 variações simultâneas por slide via `Promise.allSettled`.

### Problemas atuais
1. **Modelo quebrado no caminho direto**: `gemini-2.0-flash-exp` não existe mais para geração de imagens — gera erro toda vez que a key do usuário está presente.
2. **Key na interface**: Você pediu na mensagem anterior para mover a key (`AIzaSyA4kChl_LaKz_l2CM4LyT4fJaM8FiZS8os`) para o backend como secret, removendo a UI — isso ainda **não foi implementado** (o plano foi apresentado mas não aprovado).
3. **Memória do projeto** indica que a estratégia desejada é: key no backend como secret + UI removida + Lovable AI apenas como fallback. A implementação atual não corresponde a isso.

### Resumo visual

```text
[Frontend]                [Edge Function]                [Provedor]
gemini.ts ──key?──▶ generate-image ──┬─ tem key ─▶ Google Direct API
                                     │             (gemini-2.0-flash-exp ❌)
                                     │
                                     └─ sem key ─▶ Lovable AI Gateway
                                                   (gemini-3.1-flash-image-preview ✅)
```

Se você quiser, posso apresentar um plano para corrigir: mover a key para o backend como secret, trocar o modelo do caminho direto para um válido (ex: `gemini-2.5-flash-image-preview` ou `gemini-3.0-pro-image-preview`) e remover a UI da Sidebar.

