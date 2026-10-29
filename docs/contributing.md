# Fluxo de versionamento

## Branches

- `main` — estável; recebe mudanças apenas via Pull Request.
- `caualuk-orkut-<tela>` — uma branch por tela/entrega (ex.: `caualuk-orkut-login`).

## Commits

Padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/), em português:

```
<tipo>(<escopo>): <resumo no imperativo>

<corpo opcional com o porquê / lista de mudanças>
```

Tipos usados: `feat`, `fix`, `test`, `docs`, `chore`, `style`, `refactor`, `ci`.
Escopos: `backend`, `frontend`, `auth`, `login`, `db`, `e2e`.

### Exceção: integração da 0.1.0

A primeira entrega (`caualuk-orkut-login`) entrou na `main` por *fast-forward*, sem PR,
porque a `main` só tinha o commit inicial. As próximas telas seguem o fluxo via PR.

Para integrar uma branch localmente sem PR (somente quando a `main` não divergiu):

```bash
git checkout main
git pull
git merge --ff-only caualuk-orkut-<tela>
git push origin main
```

Arquivos fora do Git que cada clone precisa ter: `backend/.env` (copiar de
`backend/.env.example` e preencher) e as dependências (`npm run install:all`).

## Antes de abrir o PR

```bash
npm run lint && npm test && npm run test:db && npm run e2e
git log -p | grep -cE "<trecho de qualquer segredo>"   # deve ser 0
```

## Versão

SemVer nos `package.json`. A entrega da tela de Login é a **0.1.0** (ver CHANGELOG).
