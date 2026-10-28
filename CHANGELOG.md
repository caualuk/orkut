# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e
[SemVer](https://semver.org/lang/pt-BR/).

## [0.1.0] — 2026-10-28

### Adicionado

- **Monorepo** com `backend/`, `frontend/` e `docs/`; scripts na raiz.
- **Backend** Node.js + Express 5 + TypeScript:
  - `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/health`;
  - sessões opacas no PostgreSQL com cookie `HttpOnly`/`SameSite=Strict`;
  - Argon2id, rate limit, bloqueio temporário de conta, verificação de Origin (CSRF),
    Helmet, CORS restrito, validação com Zod;
  - migrations SQL (`001_auth_schema`) e seed do usuário de desenvolvimento.
- **Banco** Supabase: schema `app` com `users`, `sessions`, `schema_migrations`, RLS ativo,
  conexão TLS validada pela CA do Supabase.
- **Frontend** Angular 22 + Material 3 + Tailwind 4:
  - tela de **Login** fiel ao design (desktop, tablet e mobile em bottom sheet);
  - cena 3D animada, tilt 3D no card, botão com efeito tecla, motion spec completo e
    suporte a `prefers-reduced-motion`;
  - `AuthService` com signals, `authGuard`/`guestGuard`, proteção contra Open Redirect;
  - rotas `/login`, `/home` (provisória), `/cadastro` e `/recuperar-senha` (placeholders), 404.
- **Testes**: 58 backend + 5 banco real + 53 unitários frontend + 54 E2E (Playwright, axe).
- **Documentação**: arquitetura, segurança, testes e fluxo de versionamento.
- **CI**: GitHub Actions com lint, testes e build.
