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

## Antes de abrir o PR

```bash
npm run lint && npm test && npm run test:db && npm run e2e
git log -p | grep -cE "<trecho de qualquer segredo>"   # deve ser 0
```

## Versão

SemVer nos `package.json`. A entrega da tela de Login é a **0.1.0** (ver CHANGELOG).
