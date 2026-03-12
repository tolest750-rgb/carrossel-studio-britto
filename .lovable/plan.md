
Diagnóstico (com base na imagem + logs):
- O erro principal não é “rotação de chave”, é seleção de modelo inválido/obsoleto.
- Hoje o app ainda usa `gemini-2.0-flash-exp` como default (`src/lib/api-keys.ts`), e os logs confirmam 404 contínuo para esse modelo.
- Também há chaves expiradas (`API_KEY_INVALID`), que entram na rotação e só geram mais falhas.
- A lista de modelos no UI está fixa (hardcoded), então não representa o que cada chave realmente suporta.

Melhor abordagem para garantir geração de imagem:
1) Trocar de “lista fixa de modelos” para “modelos descobertos por chave”
- No backend (`supabase/functions/generate-image/index.ts`), adicionar caminho para consultar modelos disponíveis da chave (`/v1beta/models`) e filtrar os que suportam geração de imagem.
- Salvar no front (`src/lib/api-keys.ts`) os modelos disponíveis por chave + status da chave (válida, expirada, sem suporte de imagem).

2) Corrigir fallback de modelo (evitar 404)
- Remover default legado `gemini-2.0-flash-exp`.
- Migrar valor antigo em localStorage para um modelo válido.
- Na geração (`src/lib/gemini.ts`), usar ordem:
  1. modelo escolhido pelo usuário (se suportado pela chave ativa),
  2. melhor modelo de imagem disponível nessa chave,
  3. próximo modelo de imagem disponível,
  4. só então trocar de chave.

3) Rotação inteligente de chave + modelo
- Em qualquer erro: tenta próximo candidato, mas com classificação:
  - `API_KEY_INVALID`/expirada: marca chave como inválida e pula ela nas próximas tentativas.
  - `NOT_FOUND`/modelo não suportado: troca modelo na mesma chave antes de trocar de chave.
  - `RESOURCE_EXHAUSTED`/limite/crédito: troca de chave imediatamente.
- Se todas as chaves falharem, retornar erro estruturado com motivo agregado (expirada, sem modelo de imagem, limite).

4) UI alinhada ao comportamento real
- `ApiKeyManager.tsx`: substituir `GEMINI_MODELS` fixo por lista dinâmica da chave selecionada.
- Mostrar health por chave: “válida”, “expirada”, “sem modelo de imagem”.
- `Navbar.tsx`: indicador ativo deve mostrar `chave + modelo` em tempo real durante geração.
- `SlideCard.tsx`: quando não houver modelo de imagem em nenhuma chave, mensagem clara com CTA para cadastrar nova chave.

5) Garantia de funcionamento (validação)
- Cenário A: chave expirada + chave válida => deve pular expirada e gerar.
- Cenário B: modelo escolhido indisponível => fallback automático para modelo compatível.
- Cenário C: todas sem crédito/limite => erro final claro com CTA de nova chave.
- Cenário D: modelo legado no localStorage => migração automática sem 404.

Arquivos impactados:
- `supabase/functions/generate-image/index.ts`
- `src/lib/api-keys.ts`
- `src/lib/gemini.ts`
- `src/components/ApiKeyManager.tsx`
- `src/components/Navbar.tsx`
- `src/components/SlideCard.tsx`

Resultado esperado:
- Eliminar o loop de 404 por modelo errado.
- Parar de tentar chave expirada repetidamente.
- Garantir que a geração use apenas modelos realmente disponíveis para cada chave e, quando possível, conclua com sucesso automaticamente.
