# Fluxo de versionamento

## Branches

- `main` — **única branch** do projeto. Os commits são feitos e enviados direto nela
  (`git push origin main`), sem branches de feature nem Pull Requests.
- As branches por tela usadas até a 0.1.0 (`caualuk-orkut-<tela>`) foram removidas na
  0.2.0, quando tudo foi consolidado na `main`.

## Commits

Padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/), em português:

```
<tipo>(<escopo>): <resumo no imperativo>

<corpo opcional com o porquê / lista de mudanças>
```

Tipos usados: `feat`, `fix`, `test`, `docs`, `chore`, `style`, `refactor`, `ci`.
Escopos: `backend`, `frontend`, `auth`, `login`, `signup`, `db`, `e2e` e o nome da tela
(`home`, `recados`, `mensagens`…).

### Histórico

A 0.1.0 (Login) entrou na `main` por _fast-forward_ a partir de `caualuk-orkut-login`.
A partir da 0.2.0 todo o trabalho acontece direto na `main`.

Arquivos fora do Git que cada clone precisa ter: `backend/.env` (copiar de
`backend/.env.example` e preencher) e as dependências (`npm run install:all`).

## Antes de cada push

```bash
npm run lint && npm test && npm run test:db && npm run e2e
git log -p | grep -cE "<trecho de qualquer segredo>"   # deve ser 0
```

## Versão

SemVer nos `package.json`. Login é a **0.1.0**; cadastro e telas internas, a **0.2.0**
(ver CHANGELOG).
