# Ingestão automática do QDD a partir do SICAF

Automatiza a alimentação do QDD ("Saldo Retroativo — Execução") no Orçamentos Temáticos,
para que a SEPLAN **não precise mais exportar e enviar o arquivo** manualmente. Desde
setembro/2026 a coleta também **publica sozinha** quando o delta é inofensivo, para o
painel refletir a execução do dia sem ninguém clicar.

Publicar sozinho não é publicar às cegas: a rota mede o que a gravação faria e **recusa**
os casos perigosos, devolvendo a decisão à SEPLAN com a prévia intacta. Ver
[Quando a publicação é automática](#quando-a-publicação-é-automática).

## Como funciona

```
GitHub Actions (.github/workflows/qdd.yml)  — dias úteis, 10:00 UTC
  ├─ backup.mjs → confere que backups/<data>/curadoria.json existe → commit + push
  │     qualquer um dos três falhando PARA o job, antes de qualquer escrita
  └─ node apps/web/scripts/fetch-sicaf-qdd.mjs
       1. login no SICAF (app.sicaf) com SICAF_CPF / SICAF_SENHA
       2. confirma/troca o exercício no seletor GeneXus do SICAF
       3. abre app.quadrodetalhadodespesa e dispara DOEXCEL (vTIPOREL=2)
       4. baixa o Excel e confere formato, cabeçalho, exercício e linhas
       5. POST multipart → APP_URL/api/imports/qdd/from-sicaf   (header x-job-token)
       6. POST           → APP_URL/api/imports/qdd/auto-publish (header x-job-token)
                                   │
Vercel (app)                       ▼
  /imports/qdd/from-sicaf   → parseQdd (o MESMO do upload) → ImportPreview "sicafpreview-…"
  /imports/qdd/auto-publish → planQddReplacement → assessAutoPublish
                                   │
                    ┌──────────────┴──────────────┐
              delta limpo                    delta suspeito
                    │                              │
       replaceImportedBudget                 prévia preservada
       + syncStructureFromImport                   │
       + reconcileExecutors            banner "Prévia do SICAF pronta" na tela
       (prévia apagada)                → Revisar → Confirmar (/imports/qdd/confirm)
```

**Por que duas chamadas e não uma.** A rota `from-sicaf` já gasta boa parte dos 60 s de
`maxDuration` da Vercel baixando e parseando ~7 mil linhas. Somar a gravação na mesma
invocação estoura o limite. Duas chamadas = duas janelas de 60 s, espelhando o que o
fluxo humano sempre fez (prévia, depois confirmação).

**Por que uma rota nova e não o `confirm`.** O `confirm` é a porta da SEPLAN, guardada por
sessão e papel. Afrouxá-lo para aceitar um token de job alargaria uma fronteira de
autorização humana para todos os chamadores. `auto-publish` tem autorização própria e
escopo restrito.

## Quando a publicação é automática

`assessAutoPublish` (`src/lib/qdd-replacement.ts`, coberto por testes) decide. Ela **não**
repete o que já está garantido em outro lugar — `planQddReplacement` nunca apaga ação com
curadoria, `syncStructureFromImport` só faz upsert e o `fiscalYear.upsert` não altera a
política de um exercício existente. O que sobra de perigoso é o QDD **encolher**.

Recusa, e devolve à SEPLAN, quando:

| Condição | Limite | Por quê |
|---|---|---|
| Ações **com curadoria** sumiriam do QDD | > 5 (`MAX_AUTO_INACTIVATE`) | Inativar ação marcada a tira de todos os painéis e totais. Em operação normal esse número é **zero**. |
| Contagem de ações despenca | < 90% da base (`MIN_ACTION_COUNT_RATIO`) | Exportação parcial do SICAF passa na checagem de "não vazio" do coletor, mas inativaria a curadoria em massa. |
| Exercício ainda **sem base vigente** | qualquer | A primeira importação do ano define `comparisonOnly`, decisão reservada à SEPLAN. |
| Chave lógica duplicada no arquivo | qualquer | Defeito do arquivo; `planQddReplacement` aborta. |

Recusa **não** derruba o job: responde `200` com `published: false` e o motivo, e a prévia
segue pendente. Falhar o job por um QDD suspeito só produziria alarme vermelho para o caso
em que a decisão certa é justamente um humano olhar.

Ajustar os limites: as duas constantes ficam no topo de `assessAutoPublish`.

**Por que baixar o Excel em vez de ler um JSON do SICAF?** O único trecho do sistema
validado contra dados reais é o `parseQdd` (ver `docs/automacao-execucao-transparencia.md`
§1.2). Reaproveitá-lo sobre o arquivo real mantém essa validação e reduz a superfície não
verificada a "obter os bytes". Um mapeador de GXState→ExpenseLine escrito à mão jogaria
fora essa garantia.

**Por que Actions e não Vercel?** A raspagem depende de sessão GeneXus e do TLS da SEFAZ,
como a coleta da folha (`folha.yml`). O serverless da Vercel não é o lugar para isso.

**Por que backup antes de publicar?** O banco é produção com retenção point-in-time de
~6h e já teve perda silenciosa de curadoria (ver `CLAUDE.md`). Enquanto a confirmação era
humana, a pessoa que clicava era a rede. Sem ela, o dump commitado em `backups/<data>/`
logo antes da coleta passa a ser a única — por isso o job **para** se o dump não for
gerado, não existir em disco ou não for para o repositório, em vez de publicar assim
mesmo. Um QDD ruim publicado às 05:00 (Rio Branco) só seria notado horas depois, muito
além da janela de recuperação do Neon.

Parar nesse ponto é seguro por construção: nada foi escrito ainda, então perder o dump
com o runner não custa nada — o job simplesmente não publica naquele dia e o GitHub
avisa da falha.

## Segredos a configurar

No **GitHub → Settings → Secrets and variables → Actions**:

| Secret | O que é |
|---|---|
| `SICAF_CPF` | Login nominal habilitado na SEFAZ (perfil de leitura do QDD). |
| `SICAF_SENHA` | Senha do login. Trocar se algum dia vazar. |
| `SICAF_JOB_TOKEN` | Segredo compartilhado job ↔ rota. Gere aleatório (`openssl rand -hex 32`). |
| `APP_URL` | Base do app publicado: `https://orcamentostematicos.vercel.app`. |
| `SICAF_INSECURE_TLS` | Opcional, `1` só se o handshake TLS da SEFAZ falhar no runner. |

Na **Vercel → Project → Settings → Environment Variables** (Production): `SICAF_JOB_TOKEN`
com o **mesmo valor**. É o que autentica o job na rota `/imports/qdd/from-sicaf`.

> A conta é nominal. Toda coleta fica registrada no SICAF como ação do titular. Se a SEFAZ
> permitir, peça uma **conta técnica de leitura** para desacoplar a automação da pessoa.

## Rodar

- **Pela interface (SEPLAN):** botão **"Puxar QDD do SICAF agora"** na seção de importação.
  Ele aciona o workflow via GitHub API (`workflow_dispatch`) — a raspagem roda no Actions,
  não na Vercel — e a prévia aparece no banner em seguida (use *Verificar prévia* para
  atualizar). Requer os segredos `GITHUB_*` abaixo **e** o `qdd.yml` mesclado na branch
  default do repositório (o dispatch só enxerga workflows da branch default).
- **Agendado:** dias úteis, 10:00 UTC (05:00 Rio Branco). Idempotente — cada execução
  substitui a prévia do SICAF ainda não confirmada.
- **Sob demanda (direto no GitHub):** Actions → *Coleta do QDD (SICAF)* → *Run workflow*
  (aceita `exercicio`, `mes` e `dry_run`).

### Segredos do botão da interface (na Vercel, escopo Production)

| Variável | O que é |
|---|---|
| `GITHUB_DISPATCH_TOKEN` | PAT fine-grained com permissão **Actions: read/write** no repositório. |
| `GITHUB_REPO` | `owner/repo` (default `IcaroGundim/orcamentostematicos`). |
| `GITHUB_WORKFLOW_REF` | Branch de execução (default `main`). |

Sem esses segredos o botão responde 503 com instrução clara; a coleta agendada continua
funcionando de qualquer forma.
- **Local (validação assistida):**
  ```bash
  SICAF_CPF=... SICAF_SENHA=... node apps/web/scripts/fetch-sicaf-qdd.mjs --dry-run --exercicio=2026
  ```
  `--dry-run` baixa o Excel para `apps/web/scripts/.sicaf-debug/` e **não** envia ao app.

## Validação do protocolo do SICAF

O fluxo foi validado contra o SICAF de produção em **21/08/2026**, sempre com
`--dry-run` (nenhum envio ao app):

- troca de contexto **2026 → 2025** e **2025 → 2026**, confirmada pelo novo GXState;
- exportação DOEXCEL por postback e download pelo `app.adownloadarquivos`;
- QDD/2025: 9.279 linhas reconhecidas;
- QDD/2026: 7.053 linhas, 1.730 ações, 33 órgãos e 129 unidades reconhecidos pelo
  `parseQdd` usado na aplicação.

O coletor agora falha antes do envio se o arquivo não for Excel, não tiver o cabeçalho
do QDD, estiver vazio ou declarar exercício diferente do solicitado. A rota do app repete
a conferência antes de criar/substituir a prévia.

Se uma futura versão do GeneXus mudar o protocolo, o script grava a resposta da etapa que
falhou em `apps/web/scripts/.sicaf-debug/`. Use esses arquivos apenas para diagnóstico:
eles podem conter estado e tokens temporários de sessão.

O `.sicaf-debug/` está no `.gitignore` (contém dados brutos) e é publicado como artifact do
Actions quando o job falha, para depurar sem expor no repositório.

## Detalhes que parecem bugs mas são deliberados

- **Exercício explícito (`year`) obrigatório na rota.** O job manda o `vEXRORC` que
  consultou; a rota recusa prévia sem ano. Deixar o `parseQdd` adivinhar pelo nome do
  arquivo faria uma exportação carimbada em 2027 cair no exercício 2026 (o nome
  `QDD_Saldo_Retroativo_Execucao-1425-20260804.xls` traz a data, não o exercício).
- **Prévia com prefixo `sicafpreview-`.** Permite substituir a pendente sem tocar nas
  prévias de upload manual, e alimenta o aviso da tela (`/imports/qdd/pending`).
- **`comparisonOnly` continua decidido no `confirm`**, pela SEPLAN — o job nunca define a
  política do exercício.
- **Prévia aberta + nova coleta = confirm 404.** Se o job substituir a prévia enquanto a
  SEPLAN a revisa, o `confirm` responde "prévia expirada"; a tela ressincroniza o aviso
  para ela reabrir a versão nova. É esperado, não um botão quebrado.
