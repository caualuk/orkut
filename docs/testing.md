# Testes

## Resumo (28/10/2026)

| Suíte                                            | Ferramenta                                | Testes | Resultado                       |
| ------------------------------------------------ | ----------------------------------------- | ------ | ------------------------------- |
| Backend · unitários, integração HTTP e segurança | Vitest + Supertest                        | 58     | ✅ 58 passaram · cobertura ~90% |
| Backend · banco real (Supabase)                  | Vitest + pg                               | 5      | ✅ 5 passaram                   |
| Frontend · unitários                             | Vitest (Angular unit-test builder, jsdom) | 53     | ✅ 53 passaram                  |
| E2E · UI com API simulada + full-stack real      | Playwright (desktop 1440 e mobile 390)    | 54     | ✅ 53 passaram · 1 pulado*      |
| Lint                                             | ESLint / angular-eslint                   | —      | ✅ sem erros                    |
| Dependências                                     | `npm audit`                               | —      | ✅ 0 vulnerabilidades           |

\* "Ordem de foco" roda só no desktop (navegação por teclado não se aplica ao perfil mobile).

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

Os E2E full-stack usam o usuário do seed (`SEED_USER_EMAIL`/`SEED_USER_PASSWORD`, lidos de
`backend/.env`). Sem essas variáveis, a suíte full-stack é pulada.

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
