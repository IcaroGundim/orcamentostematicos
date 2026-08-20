# Espelhar o projeto no GitLab — roteiro

**Cenário escolhido:** gitlab.com · projeto **privado** · **espelho** (GitHub segue principal).
**Data:** 2026-08-20

---

## 0. O achado que muda a rota

A direção que você quer — GitHub principal, GitLab recebendo cópia — é **pull mirroring**,
e na gitlab.com ele é **Premium**. Só o *push* mirroring (GitLab → externo) está no Free.

E inverter não funciona aqui: `.github/workflows/backup.yml` **commita e dá push direto na
main do GitHub** todo dia às 06:00 UTC. Se o GitLab virasse origem de um push mirror, ele
sobrescreveria esses commits de backup — que são justamente a rede de segurança da curadoria.

**Três saídas, sem pagar Premium:**

| Opção | Como funciona | Custo | Recomendo |
| --- | --- | --- | :---: |
| **A. GitHub Action que empurra pro GitLab** | A cada push na main, uma action espelha pro GitLab. GitHub segue autoritativo, commits do bot de backup incluídos. | Grátis | ✅ |
| B. Segundo remoto manual | `git push gitlab main` quando você lembrar. | Grátis | Só se a cópia for cerimonial |
| C. GitLab Premium | Pull mirroring nativo, automático. | Pago | Se o Estado já tiver licença |

O resto do roteiro assume **A**. Em qualquer uma delas, **CI, segredos e Vercel não são
tocados** — continuam no GitHub exatamente como estão.

---

## 1. Pré-voo (faça antes, vale para qualquer opção)

### 1.1 Commitar o que só existe nesta máquina

Espelhar um repositório cuja parte nova está fora do git dá falsa sensação de segurança.
Hoje há ~40 arquivos modificados **e código de funcionalidade não rastreado**:

```
apps/web/src/app/api/exercises/
apps/web/src/components/domain/exercise-select.tsx
apps/web/src/components/domain/exercises-panel.tsx
apps/web/src/lib/exercise-request.ts
apps/web/src/lib/use-exercise.ts
apps/web/scripts/backfill-exercise-structure.mjs
```

É a funcionalidade de múltiplos exercícios que o `CLAUDE.md` já descreve como existente.
Mais `docs/automacao-execucao-transparencia.md` e `docs/migracao-gitlab.md` desta sessão.

### 1.2 Estender o `.gitignore` ANTES de qualquer `git add -A`

Lixo de depuração solto na raiz que não pode entrar:

```
chk.html
edge_dom.html
orc_login_tmp.html
r1.html
r2.html
h1.txt
h2.txt
jars.txt
test_checkpoint.sh
~$*.xlsx
*.zip
```

Verificados: são páginas de desafio do Vercel, um cookie jar vazio e um token de desafio
já expirado. **Não há segredo neles** — mas também não há motivo para versioná-los.

Decidir caso a caso: `.claude/` e `.commandcode/` (configuração compartilhada ou local?),
`shapefile/`, `OSG TOTAL.xlsx`, `relacaodeentregas.pdf`, `apps/web/public/imagens.zip`
(esse último pode ser asset legítimo — conferir antes de ignorar).

### 1.3 O que NÃO fazer

**Não reescrever histórico.** Existe um blob de 55 MB
(`docs/guia-secretaria/.bin/tectonic`), mas o `.git` inteiro tem 38 MB — muito abaixo de
qualquer limite da gitlab.com. `filter-repo` numa migração só torna todo problema futuro
indepurável.

**Não há segredo no histórico.** Varredura completa (`git log --all -p` contra padrões de
Neon, Resend, AWS, tokens) achou só placeholders: `USER:PASSWORD`, `ep-xxx`. O `.env.local`
está no `.gitignore` e nunca foi commitado. Nada a rotacionar.

---

## 2. Criar o projeto no GitLab

1. gitlab.com → **New project** → **Create blank project**.
2. Nome: `orcamentostematicos`. Namespace: seu usuário ou o grupo da SEPLAN.
3. **Visibility: Private.**
4. **Desmarque** "Initialize repository with a README" — o repositório já tem histórico.

> **Por que privado importa aqui:** `backups/` **está versionado** (`curadoria.json`,
> `marcacoes.csv`). Esses dumps carregam `observations`, `reviewerComment`,
> `realizedDescription` e `createdBy`. Num projeto público, isso vira dado de curadoria
> governamental exposto. Privado mantém o regime de hoje.

---

## 3. Primeiro push

```bash
git remote add gitlab https://gitlab.com/<namespace>/orcamentostematicos.git
git push gitlab --all
git push gitlab --tags
```

O `origin` (GitHub) continua sendo o padrão. `git push` sem argumento segue indo pro GitHub.

Confira no GitLab que os commits chegaram e que `backups/` está lá.

---

## 4. Automatizar o espelho (opção A)

### 4.1 Token no GitLab

GitLab → projeto → **Settings → Access tokens** → **Add new token**
· Nome: `mirror-from-github` · Role: **Maintainer** · Scope: **`write_repository`**
· Validade: anote a data — quando expirar, o espelho silenciosamente para.

Copie o token (só aparece uma vez).

### 4.2 Segredos no GitHub

GitHub → repo → **Settings → Secrets and variables → Actions**:

- `GITLAB_MIRROR_URL` → `https://gitlab.com/<namespace>/orcamentostematicos.git`
- `GITLAB_TOKEN` → o token do passo anterior

### 4.3 O workflow

`.github/workflows/mirror-gitlab.yml`:

```yaml
name: Espelhar no GitLab

on:
  push:
    branches: [main]
  workflow_dispatch: {}

concurrency:
  group: mirror-gitlab
  cancel-in-progress: false

jobs:
  espelhar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # histórico completo; sem isso o push é rejeitado

      - name: Push para o GitLab
        env:
          URL: ${{ secrets.GITLAB_MIRROR_URL }}
          TOKEN: ${{ secrets.GITLAB_TOKEN }}
        run: |
          git push --prune "https://oauth2:${TOKEN}@${URL#https://}" \
            "+refs/remotes/origin/*:refs/heads/*" "+refs/tags/*:refs/tags/*"
```

`fetch-depth: 0` é obrigatório — o checkout raso padrão faz o push ser recusado.

### 4.4 Por que isso resolve o conflito do backup

O `backup.yml` roda 06:00 UTC, commita em `backups/` e dá push na main do GitHub. Esse push
dispara este workflow, que leva o commit de backup pro GitLab. GitHub continua sendo a
única fonte de verdade; o GitLab nunca escreve nada de volta.

---

## 5. O que fica intocado

- **Vercel:** segue conectado ao GitHub. Nada a repontar.
- **`backup.yml` e `folha.yml`:** continuam como GitHub Actions.
- **Segredo `DATABASE_URL`:** permanece só no GitHub. Não recrie no GitLab — não há CI lá.
- **Não arquive o repositório do GitHub.** Nesta topologia ele é o principal.

---

## 6. Se um dia virar migração de verdade

Guardado para referência — o que quebra ao mover CI para o GitLab:

- `CI_JOB_TOKEN` **não consegue dar `git push`**. O `backup.yml` depende disso; exigiria um
  Project Access Token com `write_repository`.
- O commit de backup dispararia pipeline em loop. Precisa de
  `rules: - if: $CI_PIPELINE_SOURCE == "schedule"` e `[skip ci]` na mensagem.
- `concurrency: group:` → `resource_group:`. `workflow_dispatch` inputs → "Run pipeline" com
  `variables:`. `schedule: cron` sai do YAML e vira **CI/CD → Schedules** na interface.
- Mascarar uma `DATABASE_URL` completa nas variáveis do GitLab costuma esbarrar nas regras
  de caractere permitido — pode ser preciso marcar como **Protected**.
- E o Vercel precisaria ser repontado **antes** de desligar o GitHub.
