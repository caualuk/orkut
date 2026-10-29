# orkut

Releitura moderna do orkut — "Seus amigos, scraps e comunidades. De volta."

Monorepo com frontend **Angular 22 + Angular Material 3 + Tailwind CSS 4** e backend
**Node.js + Express 5 + TypeScript**, persistindo em **PostgreSQL (Supabase)**.

> Etapa atual (**0.2.0**): todas as telas do design `orkut-redesign` — Login, Criar conta,
> Home, Editar perfil, Recados, Álbum, Feeds, Mensagens, Depoimentos, Configurações,
> Amigos e Comunidade — em desktop, tablet e mobile. Login e cadastro usam a API real;
> as telas sociais usam dados em memória até a API social existir
> (ver [limitações](docs/architecture.md#limitações-conhecidas)).

## Estrutura

```
.
├── backend/     API REST (Express) · autenticação, sessões, migrations
├── frontend/    SPA Angular · telas, design system, testes E2E
└── docs/        Arquitetura, segurança, testes e versionamento
```

## Pré-requisitos

- Node.js ≥ 22 (desenvolvido com Node 24) e npm ≥ 10
- Acesso a um projeto Supabase (ou PostgreSQL ≥ 15)

## Como rodar

```bash
# 1. Dependências
npm run install:all

# 2. Variáveis de ambiente do backend (NUNCA versionar o .env)
cp backend/.env.example backend/.env   # preencha DATABASE_URL, SEED_USER_*, etc.

# 3. Banco de dados
npm run db:migrate     # cria o schema app (users, sessions)
npm run db:seed        # cria o usuário de desenvolvimento definido no .env

# 4. Em dois terminais
npm run dev:backend    # http://localhost:3000
npm run dev:frontend   # http://localhost:4200
```

Acesse `http://localhost:4200/login` e entre com `SEED_USER_EMAIL` / `SEED_USER_PASSWORD`,
ou crie uma conta em `http://localhost:4200/cadastro`.

## Qualidade

| Comando           | O que faz                                                  |
| ----------------- | ---------------------------------------------------------- |
| `npm run lint`    | ESLint no backend e no frontend                            |
| `npm test`        | Testes unitários/integração/segurança (backend + frontend) |
| `npm run test:db` | Testes de integração contra o PostgreSQL real              |
| `npm run e2e`     | Playwright (desktop 1440 + mobile 390), inclui full-stack  |

## Documentação

- [Arquitetura](docs/architecture.md)
- [Segurança](docs/security.md)
- [Testes](docs/testing.md)
- [Fluxo de versionamento](docs/contributing.md)
- [Changelog](CHANGELOG.md)
