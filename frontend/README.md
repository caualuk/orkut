# orkut · frontend

SPA em **Angular 22** (standalone, zoneless, signals) com **Angular Material 3** e **Tailwind CSS 4**.

## Scripts

| Comando              | Descrição                                                         |
| -------------------- | ----------------------------------------------------------------- |
| `npm start`          | Dev server em `http://localhost:4200` (proxy de `/api` → `:3000`) |
| `npm run build`      | Build de produção em `dist/orkut` (com CSP automática por hash)   |
| `npm test`           | Testes unitários (Vitest + jsdom)                                 |
| `npm run lint`       | ESLint (angular-eslint)                                           |
| `npm run e2e`        | Testes E2E (Playwright, desktop 1440 + mobile 390)                |
| `npm run e2e:report` | Abre o relatório HTML do último E2E                               |

## Estrutura

```
src/app/
├── core/                 # Singletons: autenticação, HTTP, guards, estado social, tema
│   ├── auth/             # AuthService (login, cadastro), guards, sanitização de returnUrl
│   ├── http/             # API_BASE_URL e normalização de erros da API
│   ├── social/           # SocialStore (signals) + dados iniciais do design
│   └── theme/            # ThemeService (claro / escuro / sistema)
├── layout/               # AppShell: Top App Bar, menu do perfil, rail, bottom bar, drawer
├── shared/               # Reutilizáveis sem regra de negócio
│   ├── motion/           # Diretivas de tilt 3D e parallax (Motion spec)
│   └── ui/               # BrandLogo, Avatar 3D, foto de perfil, diálogos, page header, 404
└── features/             # Telas (lazy loading)
    ├── auth/login/       # LoginPage (container) + LoginForm + LoginScene
    ├── auth/signup/      # SignupPage (container) + SignupForm + SignupScene
    ├── home/             # Home
    ├── profile/          # Editar perfil
    ├── scraps/           # Recados
    ├── album/            # Álbum
    ├── feeds/            # Feeds
    ├── messages/         # Mensagens (lista + conversa)
    ├── testimonials/     # Depoimentos
    ├── settings/         # Configurações
    ├── friends/          # Amigos
    └── community/        # Comunidade
```

Documentação completa em [`../docs`](../docs).
