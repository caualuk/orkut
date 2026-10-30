# Testes

## Resumo (30/10/2026 · dados reais)

| Suíte                                            | Ferramenta                                | Testes | Resultado                       |
| ------------------------------------------------ | ----------------------------------------- | ------ | ------------------------------- |
| Backend · unitários, integração HTTP e segurança | Vitest + Supertest                        | 113    | ✅ 113 passaram                 |
| Backend · banco real (Supabase)                  | Vitest + pg                               | 19     | ✅ 19 passaram*                 |
| Frontend · unitários                             | Vitest (Angular unit-test builder, jsdom) | 97     | ✅ 97 passaram                  |
| E2E · UI com API simulada (login, cadastro, telas internas) | Playwright (desktop 1440 e mobile 390) | 124 | ✅ 121 passaram · 3 pulados** |
| E2E · full-stack real                            | Playwright                                | —      | ⏸ requer `backend/.env`*        |
| Lint                                             | ESLint / angular-eslint                   | —      | ✅ sem erros                    |
| Dependências                                     | `npm audit`                               | —      | ✅ 0 vulnerabilidades           |

\* Suítes que dependem do Supabase rodam com `backend/.env` preenchido (não versionado).
\*\* "Ordem de foco" e "aniversário na lateral" rodam só no desktop; "drawer" só no mobile.

## Como executar

```bash
# Backend
cd backend
npm test                 # unitários + integração + segurança (sem banco)
npm run test:coverage    # idem, com relatório de cobertura
npm run test:db          # integração com o PostgreSQL do .env

# Frontend
cd frontend
npm test                 # unitários
npm run e2e              # Playwright (sobe backend e frontend se não estiverem rodando)
npm run e2e:report       # relatório HTML
```

Os E2E full-stack criam um usuário próprio pelo cadastro (`/api/auth/signup`), com e-mail
único a cada execução, no PostgreSQL configurado em `backend/.env`.

## O que é coberto

### Backend

- **Configuração**: padrões seguros, cookie `__Host-` em produção, TLS obrigatório,
  erros sem expor valores.
- **Primitivas**: Argon2id com salt aleatório, verificação, hash malformado; tokens de 256
  bits e armazenamento apenas do SHA-256.
- **AuthService**: login, sessão de 12 h/30 dias, erro genérico, verificação de hash
  descartável para e-mail inexistente, bloqueio após N falhas e desbloqueio após o prazo,
  reset do contador, tokens malformados/expirados, logout.
- **Rotas**: cookie `HttpOnly`/`SameSite=Strict`/persistência, normalização de e-mail,
  `400` com detalhes, respostas idênticas para e-mail inexistente e senha errada, `/me`,
  cookie adulterado, logout com revogação, health check sem vazamento, 404.
- **Segurança**: Helmet/CSP/HSTS, `no-store`, CORS, CSRF (sem Origin, Origin/Referer
  maliciosos, `Origin: null`, `text/plain`), JSON malformado, payload > 10 kB, senha > 128,
  SQL injection, injeção de operadores, prototype pollution, mass assignment, rate limit
  de login e global, bloqueio de conta.
- **Banco real**: TLS ativo (`pg_stat_ssl`), fluxo login → sessão → logout, IP e hash do
  token persistidos, bloqueio, schema `app` inacessível a `anon`/`authenticated`, RLS ativo,
  constraint de e-mail minúsculo.

### Frontend (unitários)

- `sanitizeReturnUrl`: caminhos válidos e 14 vetores de Open Redirect.
- `toApiError`: mensagens 4xx, ocultação de 5xx, rede, 429, corpo inesperado.
- `AuthService`: login com credenciais/cookies, nada no storage, falha, `/me` (200/401/5xx),
  deduplicação de chamadas concorrentes, cache, logout que limpa o estado mesmo com erro.
- Guards: libera/redireciona com `returnUrl`, API indisponível.
- `LoginForm`: elementos do design, `autocomplete`, validação, normalização, mostrar senha
  com `aria-pressed`, loading, alerta focado, escape de HTML (XSS).
- `LoginPage`: hero, cena `aria-hidden`, navegação padrão, `returnUrl` interno/externo,
  loading e erro.

### Cadastro e telas internas

- **Backend**: `POST /api/auth/signup` — sucesso com cookie e sessão válida, hash da
  senha, dados de perfil (relacionamento, cidade, descrição) e padrões, nascimento/sexo
  opcionais, normalização, `409` sem sessão, 12 casos de validação, perfil criado no banco,
  _mass assignment_, CSRF e rate limit; serviço e banco real (constraints da migration 002).
- **Frontend (unitários)**: `SocialStore` (contadores, recados, curtidas, respostas,
  amizade, conversas, depoimentos, enquete com voto único, tópicos, fotos, nome editado,
  persistência só sob demanda), força da senha, regra de idade, navegação ativa, busca
  sem acento e sorte do dia.
- **E2E**: as 10 telas internas carregam com título e um único `h1`, **axe WCAG 2.1 AA sem
  violações** e sem rolagem horizontal (desktop e mobile); rotas exigem sessão; fluxos de
  aceitar amizade, filtrar/enviar/curtir recado, "Deixar scrap" endereçado, conversa,
  aprovar depoimento, tema escuro persistente, busca/filtros de amigos, sair/entrar e
  criar tópico em comunidade, editar perfil e drawer mobile. Cadastro: design, axe,
  validações, medidor de senha, sucesso → Home e `409`.

Além dos testes, as telas foram comparadas com os frames do design em 1440, 834 e 390.

### Rede social com dados reais

- **Backend · rotas** (`social.routes.test.ts`, repositório falso): sessão obrigatória,
  CSRF (Origin), normalização do texto (espaços e caracteres de controle), limites,
  perfil parcial e _strict_ (sem _mass assignment_), preferências mescladas, upload
  aceitando só PNG/JPEG verdadeiros (SVG disfarçado → 400), ids inválidos nunca chegam ao
  banco, slug de comunidade com sufixo em colisão, chaves do feed validadas.
- **Backend · banco real** (`pg-social.repository.test.ts`, 2 usuários temporários):
  perfil criado a partir da conta e vazio, recados/mensagens só entre amigos, pedido →
  aceite sem duplicar par, recado com resposta/curtida/leitura/exclusão, conversa e não
  lidas, depoimento pendente → aprovado, visibilidade das fotos por álbum, feed com
  curtida e comentário, comunidade (criar, entrar, tópico, enquete com voto único, dono
  não sai), busca tratando `%` como texto.
- **Frontend · unitários**: `SocialStore` sobre HTTP (mapeamento, contadores, ação
  otimista + POST + recarga, curtida sem recarga, erro da API restaura o estado,
  comentário marcado para animar, limpeza no logout), formatação de datas/iniciais/números,
  `LikeButton` (alternância, salto, partículas, contador) e `CommentThread` (recolher,
  expandir, envio aparado, entrada animada).
- **E2E** com API social simulada em memória (`e2e/support/mock-social-api.ts`): conta
  nova sem nada fictício, recados, mensagens, depoimentos, feed (status, curtida e
  comentário), aniversário pela data de nascimento, tema salvo na API, busca de pessoas e
  pedido de amizade, criar comunidade e tópico, Editar perfil sem a aba Pessoal e sem
  cursor de texto em conteúdo estático.

### Cadastro em etapas e onboarding

- **Cadastro em etapas** (unitários): etapa 1 bloqueia incompleta, avança e volta
  preservando dados, exige termos, emite dados normalizados + foto, recusa GIF, `409`
  volta à etapa 1. **Interesses**: mínimo 3, livre sem duplicar, limite 20, grava e vai
  à Home, erro da API, pular.
- **Cadastro em etapas** (E2E): axe nas duas etapas, validação, medidor, voltar, fluxo
  completo até a Home (corpo enviado, foto `image/png`, interesses), pular, falha só na
  foto, `409` e `/boas-vindas` protegida.

### E2E (Playwright)

- **Renderização** em desktop e mobile (bottom sheet, elementos ocultos no compact),
  cena decorativa fora da árvore de acessibilidade, **axe WCAG 2.1 AA sem violações**,
  sem rolagem horizontal, ordem de foco.
- **Validação e feedback**: obrigatórios sem chamar a API, formato de e-mail, mostrar
  senha, 401, 429, 500 sem detalhes internos, duplo envio bloqueado com spinner.
- **Navegação**: login → Home → logout, Enter envia, `/` sem sessão, rota protegida com
  retorno ao destino, Open Redirect, `/login` autenticado → Home, links de cadastro e
  recuperação, 404, botão voltar após logout.
- **Movimento reduzido**: animações contínuas desligadas.
- **Full-stack** (API + Supabase reais): cookie `HttpOnly`/`Strict`, `document.cookie`
  vazio, storage vazio, sessão sobrevive a reload, logout remove cookie e protege `/home`,
  _Lembrar de mim_ (≈30 dias), senha incorreta, cabeçalhos de segurança, CSRF bloqueado.
