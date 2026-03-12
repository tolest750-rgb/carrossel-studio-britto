

## Análise

O Lovable AI Gateway **não expõe um endpoint para consultar saldo de créditos**. A única informação disponível é o erro 402 (créditos esgotados) e 429 (rate limit). Não é possível mostrar "X créditos restantes" em tempo real.

### O que é viável:
1. **Remover a rota Google Direct** e usar exclusivamente o Lovable AI Gateway
2. **Contador local de uso na sessão** — quantas imagens geradas hoje/na sessão
3. **Feedback claro de 402/429** — quando créditos acabam ou rate limit é atingido, mostrar mensagem clara na UI com link para adicionar créditos

## Plano

### 1. Edge Function `generate-image/index.ts`
- Remover toda a lógica `generateWithGoogle()` e `extractFromGoogleResponse()`
- Remover o parâmetro `googleApiKey` do handler
- Manter apenas `generateWithGateway()` com os modelos atuais
- Retornar campos extras na resposta: `{ creditsExhausted: true }` para 402 e `{ rateLimited: true }` para 429

### 2. Frontend `src/lib/gemini.ts`
- Remover leitura de `googleApiKey` do localStorage
- Detectar `creditsExhausted` e `rateLimited` na resposta para mostrar toasts específicos

### 3. Sidebar `src/components/Sidebar.tsx`
- Remover toda a seção "GOOGLE API KEY" (input, estado, localStorage)
- Adicionar seção "⚡ LOVABLE AI" mostrando:
  - Status: "CONECTADO" com indicador verde
  - Contador local: "Imagens geradas hoje: X" (salvo em localStorage com data)
  - Quando 402 ocorrer: banner "Créditos esgotados" com instrução

### 4. Navbar `src/components/Navbar.tsx`
- O badge "CLOUD AI" já existe — manter como está

### Arquivos impactados
- `supabase/functions/generate-image/index.ts` — simplificar para gateway only
- `src/lib/gemini.ts` — remover googleApiKey, adicionar detecção 402/429
- `src/components/Sidebar.tsx` — trocar seção API key por status Lovable AI + contador

