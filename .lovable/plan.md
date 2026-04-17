
Objetivo: eliminar a tela preta em `/account` e deixar a rota resiliente tanto no preview quanto no site publicado.

Diagnóstico mais provável:
- O ponto mais suspeito está em `src/pages/Account.tsx`:
  - `loadStripe(clientToken)` roda no topo do módulo, antes do componente renderizar.
  - O repositório tem `.env.development` com `VITE_PAYMENTS_CLIENT_TOKEN`, mas não há `.env.production` visível.
  - Em build publicado/custom domain, se esse token vier vazio ou inválido, a página pode quebrar antes de montar qualquer UI, gerando exatamente a “tela preta”.
- Há fragilidades secundárias no `/account`:
  - `subLoading` e `accountDataLoaded` praticamente não protegem a renderização.
  - `reload()` consulta `subscriptions` com `maybeSingle()`, o que pode falhar se existirem múltiplas linhas por usuário em ambientes diferentes.
  - A página depende de vários estados assíncronos, mas sem um fallback explícito por bloco.
- O warning do `SiteFooter` existe, mas não parece ser a causa principal da tela preta.

Plano de correção:
1. Blindar a inicialização do checkout
- Tirar `loadStripe(...)` do topo do arquivo.
- Criar uma inicialização lazy e segura dentro de um util ou `useMemo`.
- Se o token não existir, não tentar montar o checkout.
- Exibir um card de erro controlado na aba de pagamento, sem derrubar a página inteira.

2. Tornar `/account` seguro para falhas parciais
- Separar claramente:
  - autenticação pronta
  - carregamento de assinatura
  - carregamento de perfil/dados da conta
- Renderizar o shell da página mesmo se a consulta falhar.
- Mostrar estados de erro/carregamento localizados em vez de deixar a rota inteira depender de um único fluxo.

3. Corrigir a leitura da assinatura
- Ajustar a consulta da assinatura para não depender de um `maybeSingle()` frágil se houver mais de um registro por ambiente.
- Preferir filtrar explicitamente pelo ambiente atual ou selecionar a assinatura mais relevante.
- Sincronizar `useSubscription()` e `Account.tsx` para usarem a mesma lógica de “assinatura ativa”.

4. Limpar redirecionamentos e estados mortos
- Remover/imports e estados não usados no `/account` (ex.: `Link`, `subLoading`, ou loading morto se confirmado).
- Garantir que redirecionamento para `/auth` só aconteça após `ready`.
- Evitar qualquer transição que esconda o conteúdo enquanto dados secundários ainda carregam.

5. Corrigir o warning secundário do rodapé
- Revisar como `SiteFooter` está sendo usado na `Auth`.
- Ajustar a composição para eliminar o warning de `ref`, reduzindo ruído de depuração.

Arquivos a ajustar:
- `src/pages/Account.tsx`
- `src/hooks/use-subscription.ts`
- possivelmente `src/lib/stripe.ts` (novo util compartilhado, se eu extrair a lógica)
- `src/pages/Auth.tsx` e/ou `src/components/SiteFooter.tsx` para o warning secundário

Validação após a correção:
- Usuário logado sem assinatura:
  - `/` redireciona para `/account`
  - `/account` abre normalmente, sem tela preta
- Usuário logado com assinatura ativa:
  - `/account` abre
  - aba de pagamento funciona sem crash
- Build publicado/custom domain:
  - `/account` não quebra mesmo se o token de pagamento estiver ausente
- Conferir também reload direto em `/account`.

Detalhes técnicos:
- A principal mudança será transformar a integração de pagamento em “fail-safe”.
- A página não deve depender de configuração de pagamento para renderizar dados da conta.
- Se faltar configuração, somente o bloco de checkout fica indisponível — não a rota inteira.
