# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e
[SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado

- **API social com dados reais** (`/api/social`) e migration `003_social`: perfil, foto,
  amizades, recados, mensagens, depoimentos, álbuns e fotos, status, feed com curtidas e
  comentários, comunidades (criação, tópicos, enquetes, eventos) e preferências — tudo
  persistido no PostgreSQL e restrito por regras de amizade/visibilidade no SQL.
- **Comunidades**: página `/comunidades` (minhas, descobrir, busca) e botão **Criar
  comunidade**; criar enquete e evento dentro da comunidade.
- **Amigos**: busca de qualquer membro pelo nome com **+ Adicionar**; a busca global
  sempre oferece procurar o termo entre todas as pessoas.
- **Feeds**: publicar status; **curtidas e comentários animados** (coração em mola com
  partículas e contador que rola; comentário novo que cresce e brilha).
- **Favicon** com a letra "o" do logotipo (Poppins Bold vetorizada, gradiente da marca),
  além de `apple-touch-icon` e ícones 192/512.

### Alterado

- O frontend deixou de usar dados de demonstração: `social.seed.ts` foi removido e o
  `SocialStore` passou a carregar e salvar tudo na API (sincroniza a cada 20 s).
- Aniversários vêm da data de nascimento dos amigos (antes: "melhores amigos").
- Recados escritos no próprio mural aparecem em "Enviados".
- Cena do login sem pessoas fictícias ("Novo scrap", "seus fãs").
- Editar perfil sem a aba **Pessoal** (por enquanto); a foto é enviada na hora.

### Corrigido

- Cursor de texto piscando ao clicar em conteúdo estático.

## [0.2.0] — 2026-10-29

### Adicionado

- **Cadastro** (`/cadastro`) fiel ao design (desktop e bottom sheet no mobile): nome,
  sobrenome, e-mail, senha com medidor de força, nascimento, sexo, aceite dos termos e
  foto opcional; entra direto na Home.
- **API** `POST /api/auth/signup` com validação Zod, Argon2id, `409 EMAIL_TAKEN`, rate
  limit próprio e sessão iniciada; migration `002_user_signup` (nascimento, sexo e
  aceite dos termos).
- **Casca autenticada** responsiva (Material 3 window size classes): Top App Bar com
  pílulas e busca global, coluna de perfil e menu, Navigation Rail (tablet), Navigation
  Bar + Navigation Drawer (mobile), rodapé, menu da conta com Sair.
- **Telas internas**: Home, Editar perfil, Recados, Álbum, Feeds, Mensagens (lista e
  conversa), Depoimentos, Configurações, Amigos e Comunidade (fórum, enquetes, eventos,
  membros), com interações funcionais sobre o `SocialStore` (signals).
- **Tema escuro** e "Sistema" em Configurações → Aparência.
- **Testes**: +19 backend, +25 unitários e +48 E2E (com axe em todas as telas).

### Alterado

- Token `ink-muted` escurecido para `#6C6775` e novo `primary-bold` (`#D81B60`) para
  texto pequeno e badges, garantindo contraste WCAG 2.1 AA.
- Logout passou para o menu da conta (avatar) e para o drawer no mobile.
- Fluxo de versionamento: tudo direto na `main`; branches por tela removidas.

### Limitações

- Recados, amigos, mensagens, depoimentos, álbuns, feeds, comunidades e perfil ainda
  não persistem no servidor (dados do design em memória). Ver
  [limitações](docs/architecture.md#limitações-conhecidas).

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

### Integração

- Em 2026-10-29 a branch `caualuk-orkut-login` foi integrada à `main` por
  *fast-forward* (`git merge --ff-only`), sem Pull Request, porque a `main` só tinha
  o commit inicial e não havia divergência. O CI roda no push para a `main`.
