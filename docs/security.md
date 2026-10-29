# Segurança

Controles implementados na etapa de Login, mapeados para o OWASP Top 10 (2021) e o
OWASP ASVS. Cada item tem teste automatizado correspondente (ver [testing.md](testing.md)).

## Credenciais e segredos

- Segredos ficam **somente** em `backend/.env`, ignorado pelo Git (`.env`, `.env.*`).
  O repositório contém apenas `backend/.env.example` com placeholders.
- O histórico do Git é verificado antes de cada push procurando a senha do banco e a
  service role key (ver _Checklist de push_).
- A `SUPABASE_SERVICE_ROLE_KEY` é de uso **exclusivo do backend** e ainda não é utilizada
  pelo código (reservada para Storage/Auth admin em telas futuras). Nunca deve ir para o
  frontend.
- Logs passam por `redact` (cookies, headers de autorização, senhas, tokens).
- Mensagens de erro de configuração citam apenas o **nome** da variável inválida.

## Banco de dados (A02, A05)

- Conexão com **TLS validado** (`rejectUnauthorized: true`) contra a CA raiz do Supabase
  versionada em `backend/certs/supabase-root-2021.crt` (certificado público).
  SHA-256: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.
  Confira com o certificado disponível no painel do Supabase (_Database → SSL Configuration_).
- Tabelas no schema `app`, fora do `public` exposto pelo PostgREST; **RLS ativo** e
  privilégios revogados de `anon`/`authenticated` (defesa em profundidade).
- Todas as queries são **parametrizadas** (sem concatenação de SQL).
- Constraints no banco: e-mail minúsculo e com tamanho limitado, hash de token com 32 bytes.

## Cadastro (A04, A07)

- Validação com Zod no servidor (nome, e-mail normalizado, senha 8–128 com letras e
  números, nascimento opcional com 13+ anos, sexo em lista fechada, aceite obrigatório
  dos termos) e a mesma regra no formulário. Campos desconhecidos são descartados (sem
  _mass assignment_).
- Senha com Argon2id; o aceite dos termos é registrado em `terms_accepted_at`.
- `insert … on conflict do nothing`: dois cadastros simultâneos com o mesmo e-mail não
  criam duplicata nem vazam erro do banco.
- E-mail já usado responde `409 EMAIL_TAKEN` (necessário para a UX). Para limitar a
  enumeração, o cadastro tem **rate limit próprio de 5 tentativas por IP a cada 15 min**,
  em que todas as tentativas contam.
- O cadastro já inicia a sessão com o mesmo cookie `HttpOnly`/`SameSite=Strict` do
  login e passa pela verificação de Origin (CSRF).

## Telas internas (frontend)

- Nenhum conteúdo de usuário é renderizado como HTML: recados, mensagens,
  depoimentos e tópicos usam interpolação do Angular (escapada).
- Uploads de foto aceitam só `image/png` e `image/jpeg` de até 5 MB e ficam como
  _object URL_ local até existir upload na API.
- O `localStorage` guarda apenas preferências não sensíveis (tema, privacidade, idioma,
  notificações), e só depois que o usuário altera algo; nenhum token ou dado pessoal.

## Autenticação e sessão (A07)

- Senhas com **Argon2id** (19 MiB, t=2, p=1). Limite de 128 caracteres evita DoS no hashing.
- **Respostas genéricas** (`E-mail ou senha inválidos.`) para e-mail inexistente, senha
  errada e conta bloqueada — sem enumeração de usuários.
- **Mitigação de timing**: com e-mail inexistente o servidor verifica um hash descartável,
  igualando o tempo de resposta.
- **Bloqueio temporário**: 5 falhas → conta bloqueada por 15 min (contador zerado no sucesso).
- **Rate limit**: 10 falhas de login por IP a cada 15 min (sucessos não contam) e
  300 req/15 min por IP na API.
- **Token de sessão** aleatório de 256 bits; apenas o SHA-256 vai para o banco.
- Sessão de 12 h; com _Lembrar de mim_, 30 dias (cookie persistente). Sem a opção, cookie
  de sessão do navegador — o servidor expira de qualquer forma.
- **Logout revoga** a sessão no banco (o token antigo deixa de funcionar).

### Cookie

| Atributo   | Valor                                                          |
| ---------- | -------------------------------------------------------------- |
| Nome       | `__Host-orkut_sid` em produção (`orkut_sid` em dev, sem HTTPS) |
| `HttpOnly` | sim — inacessível ao JavaScript (mitiga roubo via XSS)         |
| `SameSite` | `Strict`                                                       |
| `Secure`   | sim em produção                                                |
| `Path`     | `/`, sem `Domain`                                              |

O frontend **não armazena nada** em `localStorage`/`sessionStorage` (validado em teste).

## CSRF (A01)

Três camadas: cookie `SameSite=Strict`; **verificação de `Origin`/`Referer`** contra a
allowlist em toda requisição que altera estado (`403` caso contrário); e corpo aceito
apenas como `application/json` (formulários cross-site "simples" são rejeitados).

## Cabeçalhos e transporte (A05)

- **Helmet**: `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` na API,
  `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `X-Frame-Options`,
  `Cross-Origin-Resource-Policy: same-origin`, HSTS em produção. `X-Powered-By` removido.
- **CORS** restrito às origens de `CORS_ORIGINS`, com credenciais, apenas `GET`/`POST`.
- `Cache-Control: no-store` em todas as respostas da API.
- Limite de corpo de **10 kB**.
- Frontend de produção com **CSP automática** (`autoCsp`, hashes dos scripts inline).

## Validação e tratamento de erros (A03, A04)

- Entrada validada com **Zod**: tipos estritos (rejeita `{ "$ne": null }`, arrays etc.),
  normalização de e-mail e descarte de campos extras (mass assignment).
- Erros inesperados retornam `500` genérico, sem stack trace; erros 5xx nunca têm o texto
  exibido no frontend.
- Angular escapa toda interpolação (sem `innerHTML`); teste garante que HTML vindo da API é
  exibido como texto.
- **Open Redirect**: `returnUrl` só aceita caminhos internos (`/…`), recusando `//host`,
  `\`, esquemas, caracteres de controle e loops para `/login`.

## Dependências (A06)

- `npm audit`: **0 vulnerabilidades** no backend e no frontend (28/10/2026).
- Scripts de instalação de pacotes bloqueados por padrão (npm 11 `allowScripts`).

## Checklist de push

```bash
# Nenhum segredo no histórico (deve imprimir 0)
git log -p --all | grep -cE "<senha-do-banco>|<trecho-da-service-role>"
# .env ignorado
git check-ignore backend/.env
```

## Recomendações pendentes

1. **Rotacionar a senha do banco e a service role key**: elas foram compartilhadas em texto
   (chat). Depois da rotação, basta atualizar `backend/.env`.
2. Em produção, servir front e API na mesma origem com HTTPS e definir `TRUST_PROXY`
   conforme o número de proxies (o rate limit depende do IP real).
3. Usar um store compartilhado (ex.: Redis) para o rate limit ao escalar horizontalmente.
4. Agendar limpeza de sessões expiradas/revogadas (`delete from app.sessions where expires_at < now() - interval '7 days'`).
5. Definir CSP também via cabeçalho no servidor estático do frontend.
