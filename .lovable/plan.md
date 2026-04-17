
Objetivo: corrigir o fluxo em que o acesso à plataforma acaba em `/account` e fica numa tela preta.

Diagnóstico do que encontrei:
- O redirecionamento para `/account` acontece hoje por dois caminhos válidos no código:
  1. `/` usa `RequireSubscription` e manda para `/account` quando a assinatura não está ativa.
  2. `/auth` manda usuários logados para `/welcome`, e `/welcome` manda para `/account` quando nome + telefone já existem.
- O ponto frágil é o estado de autenticação e assinatura estar espalhado em vários hooks independentes:
  - `ProtectedRoute` chama `useAuth()`
  - `Account` chama `useAuth()`
  - `useSubscription()` chama outro `useAuth()`
  - `Navbar` chama `useSubscription()` de novo
- Isso cria risco de corrida na restauração da sessão e loaders em tela cheia que podem ficar travados no `/account`.
- Há também um warning no `/auth` envolvendo `SiteFooter`, que não parece ser a causa principal da tela preta, mas vale limpar depois.

Plano de implementação:
1. Centralizar a autenticação
- Transformar o estado de auth em uma fonte única e estável (provider/context ou um hook compartilhado com “auth ready”).
- Garantir a ordem correta: restaurar sessão primeiro, depois reagir às mudanças.
- Evitar múltiplos listeners independentes competindo entre páginas e componentes.

2. Blindar os redirecionamentos
- Atualizar `ProtectedRoute`, `RequireSubscription`, `Auth`, `Welcome` e `Account` para só redirecionarem depois que a autenticação estiver realmente pronta.
- Remover qualquer navegação prematura enquanto o estado ainda estiver “indefinido”.
- Manter o comportamento esperado:
  - usuário sem login → `/auth`
  - usuário logado sem onboarding completo → `/welcome`
  - usuário logado sem assinatura ativa → `/account`
  - usuário logado com assinatura ativa → `/`

3. Tornar o `/account` resiliente
- Separar “carregando sessão” de “carregando dados da conta”.
- Fazer `reload()` de perfil/assinatura com `try/catch/finally` e fallback visual, para não deixar a tela inteira dependente de uma requisição silenciosamente falha.
- Evitar bloquear a página inteira quando apenas um bloco interno estiver carregando.

4. Reduzir consultas duplicadas
- Fazer `useSubscription` depender do auth centralizado em vez de abrir outro `useAuth()`.
- Ajustar `Navbar` e demais consumidores para reutilizar o mesmo estado já resolvido.

5. Corrigir o warning secundário
- Revisar o uso de `SiteFooter` no `/auth` e a composição ao redor dele para remover o warning de `ref`.
- Isso não é o foco principal do bug, mas ajuda a eliminar ruído de depuração.

Validação depois da correção:
- Entrar com usuário sem assinatura e confirmar:
  - `/` redireciona para `/account`
  - `/account` abre normalmente, sem tela preta
- Entrar com usuário com perfil incompleto e confirmar:
  - `/auth` → `/welcome`
  - salvar dados → `/account`
- Entrar com usuário com assinatura ativa e confirmar:
  - `/` abre o estúdio direto
- Testar desktop e mobile, especialmente no fluxo atual do usuário.

Detalhes técnicos:
- Arquivos mais prováveis de ajuste:
  - `src/hooks/use-auth.ts`
  - `src/hooks/use-subscription.ts`
  - `src/components/ProtectedRoute.tsx`
  - `src/pages/Auth.tsx`
  - `src/pages/Welcome.tsx`
  - `src/pages/Account.tsx`
  - possivelmente `src/components/Navbar.tsx`
- Não deve exigir mudança de banco; o problema parece ser de sincronização de sessão/roteamento no cliente.
