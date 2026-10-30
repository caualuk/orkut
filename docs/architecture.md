# Arquitetura

## Visão geral

```
Navegador ──► Angular (4200) ──proxy /api──► Express API (3000) ──TLS──► PostgreSQL (Supabase)
               cookie HttpOnly ◄──────────────┘
```

Em produção o frontend (estático) e a API devem ser servidos **na mesma origem**
(ex.: `https://orkut.app` e `https://orkut.app/api`) com HTTPS. Assim o cookie de sessão
continua first-party, `SameSite=Strict` e com prefixo `__Host-`. Na Vercel isso é feito por
um único projeto: o Angular como site estático e o Express como Serverless Function
(`api/index.mjs`) — ver [Deploy](deploy.md).

## Backend (`backend/`)

```
src/
├── config/env.ts            # Variáveis de ambiente validadas com Zod (fail-fast)
├── db/
│   ├── pool.ts              # Pool pg com TLS validado pela CA do Supabase
│   ├── migrate.ts           # Runner de migrations (transação + advisory lock)
│   └── migrations/*.sql     # Migrations versionadas (NNN_nome.sql)
├── modules/auth/            # Módulo de autenticação
│   ├── auth.routes.ts       # Camada HTTP (rotas → serviço)
│   ├── auth.service.ts      # Regras de negócio (cadastro, login, sessão, bloqueio)
│   ├── auth.repository.ts   # Porta de persistência + implementação PostgreSQL
│   ├── auth.schemas.ts      # Contratos de entrada (Zod)
│   ├── auth.middleware.ts   # requireAuth
│   └── session-cookie.ts    # Política do cookie de sessão
├── shared/                  # Erros, logger, middlewares HTTP, primitivas de segurança
├── app.ts                   # createApp(deps): monta a app a partir das dependências
├── bootstrap.ts             # Composition root: instancia as dependências reais
└── server.ts                # Sobe o HTTP (local); na Vercel, api/index.mjs usa o bootstrap
```

**Decisões**

- **Camadas** rotas → serviço → repositório. O serviço depende da _interface_
  `AuthRepository`, o que permite testar regras sem banco (repositório em memória).
- **Injeção de dependências manual** em `bootstrap.ts`; `createApp` recebe tudo por parâmetro.
- **Sessões opacas no banco** em vez de JWT: permitem revogação imediata (logout,
  comprometimento) e não expõem dados no token. O banco guarda apenas o SHA-256 do token.
- **Argon2id** para senhas (parâmetros OWASP: 19 MiB, t=2, p=1).
- **Erros de domínio** (`AppError`) com `code` estável para o frontend e mensagens seguras.
- **Migrations SQL puras**, idempotentes e registradas em `app.schema_migrations`.

### API

| Método | Rota                | Descrição                                                  | Respostas               |
| ------ | ------------------- | ---------------------------------------------------------- | ----------------------- |
| GET    | `/api/health`       | Verifica API e banco                                       | 200, 503                |
| POST   | `/api/auth/signup`  | Cria a conta e já inicia a sessão                          | 201, 400, 403, 409, 429 |
| POST   | `/api/auth/login`   | `{ email, password, remember? }` → sessão                  | 200, 400, 401, 403, 429 |
| POST   | `/api/auth/logout`  | Revoga a sessão e limpa o cookie                           | 204                     |
| GET    | `/api/auth/me`      | Usuário da sessão atual                                    | 200, 401                |
| DELETE | `/api/auth/account` | `{ password }` → exclui a conta e todos os dados (cascata) | 204, 400, 401, 403, 429 |

Corpo do cadastro: `{ firstName, lastName, email, password, birthDate?, gender?,
relationship?, city?, about?, acceptTerms: true }`. Senha com 8+ caracteres, letras e
números; nascimento 13+ anos; `gender` em `feminino | masculino | outro | nao-informar`;
`relationship` como em `app.profiles`; `city` ≤ 80; `about` ≤ 500. O usuário e a linha de
`app.profiles` são criados no **mesmo comando SQL** (não existe conta sem perfil).
E-mail já cadastrado → `409 EMAIL_TAKEN`.
O cadastro tem rate limit próprio (5 tentativas por janela, todas contam).

Formato de erro: `{ "error": { "code": "INVALID_CREDENTIALS", "message": "...", "details"?: [...] } }`.

#### API social (`/api/social`, sessão obrigatória)

Tudo o que as telas internas mostram vem daqui — **pessoas e conteúdos reais** do banco,
nada de dados de exemplo. Leitura em um único `GET /state`; ações em `POST` (respostas
`204`, o frontend recarrega o estado). Regras de permissão ficam no próprio SQL.

| Área         | Rotas                                                                                                                                                                      | Regras                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Estado       | `GET /state`                                                                                                                                                               | perfil, preferências, amigos, recados, conversas, feed…        |
| Perfil       | `POST /profile` (parcial), `POST /profile/photo` (JPG/PNG cru ≤ 5 MB), `…/photo/remove`, `GET /users/:id/photo`                                                            | campos desconhecidos → 400; imagem conferida por _magic bytes_ |
| Perfil público | `GET /users/:id/profile`                                                                                                                                                 | lista fechada de campos públicos; registra a visita            |
| Preferências | `POST /settings` (parcial, mesclado)                                                                                                                                       | tema, privacidade, notificações                                |
| Pessoas      | `POST /people/search`, `POST /friends/{request,cancel,accept,reject,remove,best,fan}`                                                                                      | pedido invertido vira aceite; sem pares duplicados             |
| Recados      | `POST /scraps`, `/scraps/:id/{reply,like,read,delete}`                                                                                                                     | só entre amigos (ou no próprio mural)                          |
| Mensagens    | `POST /conversations/:id/{messages,read}`                                                                                                                                  | só entre amigos                                                |
| Depoimentos  | `POST /testimonials`, `/testimonials/:id/{approve,delete,like}`                                                                                                            | só para amigos que aceitam; ficam pendentes até aprovar        |
| Álbum        | `POST /albums`, `/albums/:id/{photos,delete}`, `GET /photos/:id`, `/photos/:id/delete`                                                                                     | foto só aparece para quem a visibilidade do álbum permite      |
| Feed         | `POST /status`, `/feed/like`, `/feed/comment`                                                                                                                              | status, fotos novas, comunidades e amizades dos amigos         |
| Comunidades  | `POST /communities` (criar), `/communities/search`, `GET /communities/:slug`, `/communities/:id/{join,leave,topics,polls,events}`, `/polls/:id/vote`, `/events/:id/attend` | só membros publicam/votam; voto único; dono não sai            |
| Foto da comunidade | `POST /communities/:id/photo` (JPG/PNG cru ≤ 5 MB), `…/photo/remove`, `GET /communities/:id/photo`                                                                         | só o dono altera; imagem conferida por _magic bytes_           |
| Excluir comunidade | `POST /communities/:id/delete`                                                                                                                                          | só o dono; apaga em cascata e limpa os itens do feed           |

### Banco de dados

Schema `app` (fora do `public`, portanto **não exposto** pela API REST automática do Supabase):

- `app.users` — `id`, `email` (minúsculo, único), `display_name`, `password_hash`,
  `failed_login_attempts`, `locked_until`, `last_login_at`, `birth_date`, `gender`,
  `terms_accepted_at` (migration 002), timestamps.
- `app.sessions` — `id`, `user_id` → users, `token_hash` (32 bytes, único), `user_agent`,
  `ip_address`, `created_at`, `expires_at`, `revoked_at`.
- `app.schema_migrations` — controle de migrations.
- **Rede social (migration 003)**: `profiles` (dados do perfil, preferências em `jsonb`,
  `last_seen_at` para "online"), `profile_photos`, `profile_visits`, `fans`, `friendships`
  (pedido/aceite, um par por amizade), `best_friends`, `scraps` (+ `scrap_likes`, respostas
  via `reply_to_id`), `messages`, `testimonials` (+ `testimonial_likes`), `albums`, `photos`
  (`bytea` ≤ 5 MB), `statuses`, `communities`, `community_members`, `community_topics`,
  `topic_posts`, `community_polls`, `poll_votes`, `community_events`, `event_attendees`,
  `feed_likes`, `feed_comments`. Funções `app.friend_ids`, `app.are_friends`,
  `app.is_online` e `app.mutual_friends` (com `search_path` vazio). Tudo com
  `on delete cascade` a partir de `app.users`.

- **Foto da comunidade (migration 004)**: `community_photos` (`bytea` ≤ 5 MB, uma por
  comunidade, `on delete cascade`). A música do perfil não tem tabela: fica em
  `profiles.personal` (`musicId`, `musicTitle`).

RLS habilitado em todas as tabelas e privilégios revogados das roles `anon`/`authenticated`.

## Frontend (`frontend/`)

```
src/app/
├── core/
│   ├── auth/    # AuthService (signals), guards, modelos
│   ├── http/    # Base da API e tradução de erros
│   ├── social/  # SocialStore: estado das telas sociais (signals) + dados iniciais
│   └── theme/   # ThemeService: aplica claro/escuro/sistema (data-theme)
├── layout/      # Casca autenticada: Top App Bar, menu do perfil, rail, bottom bar, drawer
├── shared/      # UI e diretivas reutilizáveis, sem regra de negócio
└── features/    # Telas, carregadas sob demanda
```

**Decisões**

- **Standalone + zoneless + signals**; todos os componentes com `OnPush`.
- **Container/apresentação**: `LoginPage` orquestra (serviço, navegação, erros);
  `LoginForm` só valida e emite; `LoginScene` é puramente visual (`aria-hidden`).
- **Reactive Forms tipados** (`NonNullableFormBuilder`).
- **Guards funcionais**: `authGuard` (preserva `returnUrl`) e `guestGuard`.
- **Lazy loading** de todas as rotas; títulos de página por rota.
- **Casca responsiva única** (`AppShell`) nas 3 window size classes do Material 3:
  compact < 600 (Top App Bar 56 + Navigation Bar + drawer modal), medium 600–1023
  (Navigation Rail 88 + título na Top App Bar) e expanded ≥ 1024 (pílulas + coluna de
  perfil + rodapé). Breakpoint `tab:` (600px) definido no `@theme`.
- **Estado social em `SocialStore`** (signals) sincronizado com `/api/social`: carrega o
  `GET /state` ao entrar e a cada 20 s (aba visível), aplica as ações na tela na hora
  (otimista), envia o `POST` e recarrega; se a API recusar, volta ao estado do servidor e
  mostra a mensagem num snackbar. `social.api.ts` mapeia os DTOs para os modelos das
  telas e `social.format.ts` formata datas ("há 2 h", "ontem"), iniciais e cores estáveis
  por pessoa. Ao sair da conta, o store é limpo.
- **Curtidas e comentários animados**: `LikeButton` (coração em mola, partículas e
  contador que rola) e `CommentThread` (comentário novo cresce, desliza e brilha; envio
  com o ícone "decolando"), ambos respeitando `prefers-reduced-motion`.
- **Estilo**: Tailwind para layout/tokens (`@theme`), Material 3 para componentes
  (text field, checkbox, spinner, ripple, ícones) com overrides de tokens; CSS de
  componente apenas para efeitos 3D.

### Cadastro e onboarding

1. **Etapa 1** (mesmo card): nome, sobrenome, sexo, relacionamento, aniversário, cidade,
   e-mail e senha — todos obrigatórios.
2. **Etapa 2**: foto de perfil (opcional, JPG/PNG até 5 MB), descrição breve (vira o
   "Quem sou eu") e aceite dos termos. "Voltar" preserva o que foi preenchido.
3. `POST /api/auth/signup` cria a conta + perfil e já inicia a sessão; em seguida a foto
   vai para `POST /api/social/profile/photo`. Se só a foto falhar, a conta continua criada
   e a tela seguinte avisa. `409` (e-mail em uso) devolve o usuário à etapa 1.
4. **`/boas-vindas`**: interesses sugeridos + campo livre (sem duplicar, até 20). "Continuar"
   exige 3+ e grava via `POST /api/social/profile { interests }`; "Pular por agora" vai
   direto para a Home.

### Rotas

| Rota               | Guard        | Tela                                           |
| ------------------ | ------------ | ---------------------------------------------- |
| `/`                | —            | redireciona para `/home`                       |
| `/login`           | `guestGuard` | Login                                          |
| `/cadastro`        | `guestGuard` | Criar conta (2 etapas)                         |
| `/boas-vindas`     | `authGuard`  | Onboarding: escolha de interesses              |
| `/recuperar-senha` | `guestGuard` | Placeholder (próxima etapa)                    |
| `/home`            | `authGuard`  | Home                                           |
| `/perfil`          | `authGuard`  | redireciona para `/home`                       |
| `/perfil/editar`   | `authGuard`  | Editar perfil                                  |
| `/recados`         | `authGuard`  | Recados (`?para=<amigo>`)                      |
| `/album`           | `authGuard`  | Álbum                                          |
| `/feeds`           | `authGuard`  | Feeds                                          |
| `/mensagens[/:id]` | `authGuard`  | Mensagens (lista / conversa)                   |
| `/depoimentos`     | `authGuard`  | Depoimentos                                    |
| `/configuracoes`   | `authGuard`  | Configurações                                  |
| `/amigos`          | `authGuard`  | Amigos (`?busca=`)                             |
| `/comunidades`     | `authGuard`  | Comunidades (minhas, descobrir, busca, criar)  |
| `/comunidades/:id` | `authGuard`  | Comunidade (fórum, enquetes, eventos, membros) |
| `**`               | —            | 404                                            |

## Fidelidade ao design

Referência: `orkut-redesign.figcraft` — páginas _Desktop · 1440_, _Tablet · 834_ e
_Mobile · 390_, além de _Spec · Design System & Motion_ e _Responsividade · Breakpoints_.

| Frame(s) do design                                                      | Implementação           |
| ----------------------------------------------------------------------- | ----------------------- |
| Login · Desktop 1440 / M · Login                                        | `features/auth/login`   |
| Criar conta · Desktop 1440 / M · Criar conta                            | `features/auth/signup`  |
| \_Template · Interna / \_Template · Mobile / M · Menu (drawer)          | `layout/`               |
| Home · Desktop 1440 / T · Home / M · Home                               | `features/home`         |
| Editar perfil · Desktop 1440 / M · Editar perfil                        | `features/profile`      |
| Recados · Desktop 1440 / M · Recados                                    | `features/scraps`       |
| Álbum · Desktop 1440 / M · Álbum                                        | `features/album`        |
| Feeds · Desktop 1440 / M · Feeds                                        | `features/feeds`        |
| Mensagens · Desktop 1440 / T · Mensagens / M · Mensagens / M · Conversa | `features/messages`     |
| Depoimentos · Desktop 1440 / M · Depoimentos                            | `features/testimonials` |
| Configurações · Desktop 1440 / M · Configurações                        | `features/settings`     |
| Amigos · Desktop 1440 / M · Amigos                                      | `features/friends`      |
| Comunidade · Desktop 1440 / M · Comunidade                              | `features/community`    |

Itens do spec de movimento e componentes:

| Item do spec                                                         | Implementação                                   |
| -------------------------------------------------------------------- | ----------------------------------------------- |
| Paleta 60-30-10, Poppins, raios 10–32                                | `styles.css` (`@theme`) + `material-theme.scss` |
| Outlined text field com label flutuante, foco 4px rosa (05)          | `.ok-text-field`                                |
| Botão com base de 6px, hover +2px, press −4px, ripple, spinner (06)  | `login-form.css` + `matRipple`                  |
| Card com camada traseira −4° e tilt 3D + brilho especular (04)       | `.card-stack::before` + `TiltDirective`         |
| Entrada: textos sobem 24px com stagger 80ms; card scale/rotateX (01) | `login-page.css`                                |
| Esferas flutuando ±12px/6s, parallax pelo cursor (02)                | `login-scene.css` + `ParallaxDirective`         |
| Anel e estrela girando 20s; cartões balançando ±2° (03)              | `login-scene.css`                               |
| Login → Home com transição do logo (07)                              | `withViewTransitions` + `view-transition-name`  |
| `prefers-reduced-motion` (09)                                        | Media queries + diretivas desativadas           |
| Compact < 600: login e cadastro em bottom sheet                      | Layout mobile do `LoginForm`/`SignupForm`       |
| Cards das telas internas entram em cascata de 60ms (07)              | utility `ok-enter` (`--i` por card)             |
| Cards e tiles elevam/inclinam no hover (08)                          | `.tile`, `.card`, `.stack`                      |
| Botão filled com base (tecla) e FAB extended no mobile               | `.ok-btn-primary`, `.ok-fab` (`styles.css`)     |
| Tema claro/escuro/sistema (Configurações → Aparência)                | `ThemeService` + tokens em `:root[data-theme]`  |

### Limitações conhecidas

- **Sem dados de demonstração**: uma conta nova vê as telas vazias (com convites para
  adicionar amigos, publicar status ou criar comunidade) até haver atividade real.
- **Visitas ao perfil** contam uma por pessoa (`profile_visits` guarda a última visita de
  cada visitante): o total é de visitantes, não de aberturas.
- **Música do perfil** vem do YouTube em player visível e começa ao entrar no perfil. Quem
  abre o link direto, sem ter clicado no site, pode precisar apertar ▶: os navegadores
  bloqueiam som antes do primeiro clique. Alguns vídeos não permitem incorporação e, nesse
  caso, o próprio player avisa.
- **Sincronização** por polling (20 s), sem WebSocket: mensagens novas aparecem em até
  20 s.
- **Desativar conta** pede confirmação e encerra a sessão; ocultar o perfil de fato
  depende da API.
