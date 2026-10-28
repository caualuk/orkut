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
│   ├── auth.service.ts      # Regras de negócio (login, sessão, bloqueio)
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
| POST   | `/api/auth/login`  | `{ email, password, remember? }` → sessão | 200, 400, 401, 403, 429 |
| POST   | `/api/auth/logout` | Revoga a sessão e limpa o cookie          | 204                     |
| GET    | `/api/auth/me`     | Usuário da sessão atual                   | 200, 401                |

Formato de erro: `{ "error": { "code": "INVALID_CREDENTIALS", "message": "...", "details"?: [...] } }`.

### Banco de dados

Schema `app` (fora do `public`, portanto **não exposto** pela API REST automática do Supabase):

- `app.users` — `id`, `email` (minúsculo, único), `display_name`, `password_hash`,
  `failed_login_attempts`, `locked_until`, `last_login_at`, timestamps.
- `app.sessions` — `id`, `user_id` → users, `token_hash` (32 bytes, único), `user_agent`,
  `ip_address`, `created_at`, `expires_at`, `revoked_at`.
- `app.schema_migrations` — controle de migrations.

RLS habilitado em todas as tabelas e privilégios revogados das roles `anon`/`authenticated`.

## Frontend (`frontend/`)

```
src/app/
├── core/        # Singletons (AuthService, guards, HTTP)
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
- **Estilo**: Tailwind para layout/tokens (`@theme`), Material 3 para componentes
  (text field, checkbox, spinner, ripple, ícones) com overrides de tokens; CSS de
  componente apenas para efeitos 3D.

### Rotas

| Rota               | Guard        | Tela                              |
| ------------------ | ------------ | --------------------------------- |
| `/`                | —            | redireciona para `/home`          |
| `/login`           | `guestGuard` | Login                             |
| `/cadastro`        | `guestGuard` | Placeholder (próxima etapa)       |
| `/recuperar-senha` | `guestGuard` | Placeholder (próxima etapa)       |
| `/home`            | `authGuard`  | Home provisória (saudação + Sair) |
| `**`               | —            | 404                               |

## Fidelidade ao design

Referência: `orkut-redesign.figcraft` (frames _Login · Desktop 1440_, _M · Login_ e
_Spec · Design System & Motion_).

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
| Compact < 600: login em bottom sheet                                 | Layout mobile do `LoginForm`                    |
