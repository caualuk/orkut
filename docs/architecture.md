# Arquitetura

## Visão geral

```
Navegador ──► Angular (4200) ──proxy /api──► Express API (3000) ──TLS──► PostgreSQL (Supabase)
               cookie HttpOnly ◄──────────────┘
```

Em produção o frontend (estático) e a API devem ser servidos **na mesma origem**
(ex.: `https://orkut.app` e `https://orkut.app/api`) por um proxy reverso com HTTPS. Assim o
cookie de sessão continua first-party, `SameSite=Strict` e com prefixo `__Host-`.

## Backend (`backend/`)

```
src/
├── config/env.ts            # Variáveis de ambiente validadas com Zod (fail-fast)
├── db/
│   ├── pool.ts              # Pool pg com TLS validado pela CA do Supabase
│   ├── migrate.ts           # Runner de migrations (transação + advisory lock)
│   ├── seed.ts              # Usuário de desenvolvimento (bloqueado em produção)
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
└── server.ts                # Composition root: instancia dependências reais e sobe o HTTP
```

**Decisões**

- **Camadas** rotas → serviço → repositório. O serviço depende da _interface_
  `AuthRepository`, o que permite testar regras sem banco (repositório em memória).
- **Injeção de dependências manual** em `server.ts`; `createApp` recebe tudo por parâmetro.
- **Sessões opacas no banco** em vez de JWT: permitem revogação imediata (logout,
  comprometimento) e não expõem dados no token. O banco guarda apenas o SHA-256 do token.
- **Argon2id** para senhas (parâmetros OWASP: 19 MiB, t=2, p=1).
- **Erros de domínio** (`AppError`) com `code` estável para o frontend e mensagens seguras.
- **Migrations SQL puras**, idempotentes e registradas em `app.schema_migrations`.

### API

| Método | Rota               | Descrição                                 | Respostas               |
| ------ | ------------------ | ----------------------------------------- | ----------------------- |
| GET    | `/api/health`      | Verifica API e banco                      | 200, 503                |
| POST   | `/api/auth/signup` | Cria a conta e já inicia a sessão         | 201, 400, 403, 409, 429 |
| POST   | `/api/auth/login`  | `{ email, password, remember? }` → sessão | 200, 400, 401, 403, 429 |
| POST   | `/api/auth/logout` | Revoga a sessão e limpa o cookie          | 204                     |
| GET    | `/api/auth/me`     | Usuário da sessão atual                   | 200, 401                |

Corpo do cadastro: `{ firstName, lastName, email, password, birthDate?, gender?, acceptTerms: true }`.
Senha com 8+ caracteres, letras e números; nascimento opcional (13+ anos); `gender` em
`feminino | masculino | outro | nao-informar`. E-mail já cadastrado → `409 EMAIL_TAKEN`.
O cadastro tem rate limit próprio (5 tentativas por janela, todas contam).

Formato de erro: `{ "error": { "code": "INVALID_CREDENTIALS", "message": "...", "details"?: [...] } }`.

### Banco de dados

Schema `app` (fora do `public`, portanto **não exposto** pela API REST automática do Supabase):

- `app.users` — `id`, `email` (minúsculo, único), `display_name`, `password_hash`,
  `failed_login_attempts`, `locked_until`, `last_login_at`, `birth_date`, `gender`,
  `terms_accepted_at` (migration 002), timestamps.
- `app.sessions` — `id`, `user_id` → users, `token_hash` (32 bytes, único), `user_agent`,
  `ip_address`, `created_at`, `expires_at`, `revoked_at`.
- `app.schema_migrations` — controle de migrations.

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
- **Estado social em `SocialStore`** (signals). Toda mutação passa pelos métodos do
  store; enquanto a API social não existe, o estado nasce de `social.seed.ts` (dados do
  design) e vive na sessão do navegador. Trocar por HTTP não muda as telas.
- **Estilo**: Tailwind para layout/tokens (`@theme`), Material 3 para componentes
  (text field, checkbox, spinner, ripple, ícones) com overrides de tokens; CSS de
  componente apenas para efeitos 3D.

### Rotas

| Rota               | Guard        | Tela                              |
| ------------------ | ------------ | --------------------------------- |
| `/`                | —            | redireciona para `/home`          |
| `/login`           | `guestGuard` | Login                             |
| `/cadastro`        | `guestGuard` | Criar conta                       |
| `/recuperar-senha` | `guestGuard` | Placeholder (próxima etapa)       |
| `/home`            | `authGuard`  | Home                              |
| `/perfil`          | `authGuard`  | redireciona para `/home`          |
| `/perfil/editar`   | `authGuard`  | Editar perfil                     |
| `/recados`         | `authGuard`  | Recados (`?para=<amigo>`)         |
| `/album`           | `authGuard`  | Álbum                             |
| `/feeds`           | `authGuard`  | Feeds                             |
| `/mensagens[/:id]` | `authGuard`  | Mensagens (lista / conversa)      |
| `/depoimentos`     | `authGuard`  | Depoimentos                       |
| `/configuracoes`   | `authGuard`  | Configurações                     |
| `/amigos`          | `authGuard`  | Amigos (`?busca=`)                |
| `/comunidades/:id` | `authGuard`  | Comunidade (`/comunidades` abre a principal) |
| `**`               | —            | 404                               |

## Fidelidade ao design

Referência: `orkut-redesign.figcraft` — páginas _Desktop · 1440_, _Tablet · 834_ e
_Mobile · 390_, além de _Spec · Design System & Motion_ e _Responsividade · Breakpoints_.

| Frame(s) do design                                         | Implementação            |
| ---------------------------------------------------------- | ------------------------ |
| Login · Desktop 1440 / M · Login                           | `features/auth/login`    |
| Criar conta · Desktop 1440 / M · Criar conta               | `features/auth/signup`   |
| \_Template · Interna / \_Template · Mobile / M · Menu (drawer) | `layout/`                |
| Home · Desktop 1440 / T · Home / M · Home                  | `features/home`          |
| Editar perfil · Desktop 1440 / M · Editar perfil           | `features/profile`       |
| Recados · Desktop 1440 / M · Recados                       | `features/scraps`        |
| Álbum · Desktop 1440 / M · Álbum                           | `features/album`         |
| Feeds · Desktop 1440 / M · Feeds                           | `features/feeds`         |
| Mensagens · Desktop 1440 / T · Mensagens / M · Mensagens / M · Conversa | `features/messages` |
| Depoimentos · Desktop 1440 / M · Depoimentos               | `features/testimonials`  |
| Configurações · Desktop 1440 / M · Configurações           | `features/settings`      |
| Amigos · Desktop 1440 / M · Amigos                         | `features/friends`       |
| Comunidade · Desktop 1440 / M · Comunidade                 | `features/community`     |

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

- **API social pendente**: recados, amigos, mensagens, depoimentos, álbuns, feeds,
  comunidades e perfil usam o `SocialStore` em memória (dados do design). As ações
  funcionam durante a sessão, mas não são salvas no servidor; ao recarregar, voltam ao
  estado inicial. Só as preferências de Configurações (tema, privacidade) ficam no
  `localStorage`, e apenas depois que o usuário muda algo.
- **Fotos** (perfil, álbum, cadastro) são prévias locais (`URL.createObjectURL`) até
  existir upload na API.
- **Desativar conta** pede confirmação e encerra a sessão; ocultar o perfil de fato
  depende da API.
