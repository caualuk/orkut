# Deploy em produção (Vercel + Supabase)

Um único projeto na Vercel serve tudo na **mesma origem**, como o cookie de sessão
(`__Host-`, `SameSite=Strict`) exige:

| Caminho      | Quem responde                                                       |
| ------------ | ------------------------------------------------------------------- |
| `/api/*`     | Serverless Function `api/index.mjs` (app Express de `backend/dist`) |
| arquivos     | Build do Angular (`frontend/dist/orkut/browser`)                    |
| todo o resto | `index.html` (rotas do Angular, como `/login` e `/recados`)         |

Tudo isso está em `vercel.json`; não há comando para configurar no painel.

## 1. Banco de dados

As migrations **não** rodam no deploy: aplique antes de publicar uma versão que as exija.

```bash
npm run db:migrate    # usa o DATABASE_URL de backend/.env
```

## 2. Projeto na Vercel

- **Root Directory**: a raiz do repositório (deixe em branco; não use `frontend/`).
- **Framework Preset**: Other. Build, instalação e saída vêm do `vercel.json`.
- **Node.js**: 22 ou superior.

## 3. Variáveis de ambiente

Em _Settings → Environment Variables_ (a Vercel já define `NODE_ENV=production`):

| Variável                | Valor                                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | **Obrigatório o Transaction pooler** do Supabase (host `*.pooler.supabase.com`, porta 6543). A conexão direta `db.<ref>.supabase.co` só tem IPv6, que a Vercel não alcança |
| `DATABASE_SSL`          | `true`                                                                                                                                                                     |
| `DATABASE_SSL_CA_PATH`  | `backend/certs/supabase-root-2021.crt` (incluído no bundle da função)                                                                                                      |
| `CORS_ORIGINS`          | `https://<seu-dominio>`, sem barra no final; separe vários por vírgula                                                                                                     |
| `TRUST_PROXY`           | `1`                                                                                                                                                                        |
| `SESSION_TTL_HOURS`     | opcional (padrão 12)                                                                                                                                                       |
| `SESSION_REMEMBER_DAYS` | opcional (padrão 30)                                                                                                                                                       |

> `CORS_ORIGINS` também alimenta a verificação de Origin: sem o domínio exato do site, todo
> `POST` (login, cadastro…) responde `403`. URLs de preview da Vercel têm outro domínio;
> inclua-as se quiser testar por lá.

Depois de mudar variáveis, faça **Redeploy**: elas só valem para novos deploys.

## 4. Verificação

```bash
curl https://<seu-dominio>/api/health     # {"status":"ok"} = API e banco respondendo
```

| Sintoma                                       | Causa provável                                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `404 NOT_FOUND` da Vercel em todas as páginas | Root Directory errado ou deploy anterior a este `vercel.json`                                             |
| `npm ci` falha pedindo `package-lock.json`    | Comando rodou fora de `backend/` ou `frontend/`; confira se o Install Command do painel está sem override |
| `/api/health` responde `503`, login dá `500`  | `DATABASE_URL` com a conexão direta (IPv6), senha ou TLS incorretos                                       |
| `FUNCTION_INVOCATION_FAILED` em `/api/*`      | Variável obrigatória ausente (veja os logs da função)                                                     |
| `403` ao entrar ou se cadastrar               | Domínio do site fora de `CORS_ORIGINS`                                                                    |
| `500` nas telas internas                      | Migrations não aplicadas (passo 1)                                                                        |
