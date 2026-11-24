# Coleta automática de dados: como funciona

Este documento explica, de ponta a ponta, como o Sistema de Orçamentos Temáticos se
alimenta sozinho: o que é coletado, de onde, quando, por qual caminho, com que proteções, e
o que fazer quando algo para. É a visão geral. Os detalhes de cada coleta ficam nos
documentos específicos (seção 11).

> **Estado em 23/11/2026.** A coleta do QDD roda num **runner do GitHub instalado numa
> máquina da SEPLAN**, e não mais nos servidores do GitHub. As mudanças estão na branch
> `ci/qdd-runner-seplan`. **Enquanto ela não for mesclada na `main`, o agendamento diário
> do QDD continua apontando para o GitHub e falha.** O motivo está em
> [`incidente-coleta-sicaf-2026-11.md`](incidente-coleta-sicaf-2026-11.md).

---

## 1. Visão geral

O sistema tem **quatro rotinas automáticas**, todas como workflows do GitHub Actions
(`.github/workflows/`). Três delas trazem dados de fora (QDD, folha e receita) e uma protege
o que já existe (backup).

| Rotina | Workflow | Fonte | O que grava | Frequência | Onde roda |
|---|---|---|---|---|---|
| **Backup da curadoria** | `backup.yml` | Banco (Neon) | Arquivos em `backups/<data>/`, commitados no repositório | Todo dia | Servidores do GitHub |
| **Coleta da folha** | `folha.yml` | Portal da Transparência | Agregados da folha (`PayrollSnapshot`, `PayrollGroup`) | Todo dia | Servidores do GitHub |
| **Coleta do QDD** | `qdd.yml` | **SICAF / SEFAZ** | Prévia e publicação do QDD (`BudgetImport`, `BudgetAction`, `ExpenseLine`…) | Dias úteis | **Runner da SEPLAN** |
| **Coleta das receitas** | `receitas.yml` | Portal da Transparência | Receita mensal por categoria (`RevenueMonth`) | Toda segunda | Servidores do GitHub |

Há ainda um quinto workflow, `mirror-gitlab.yml`. Ele não coleta nada: espelha o
repositório no GitLab a cada push na `main`, inclusive os commits de backup.

### 1.1. Agenda do dia (horário de Rio Branco, UTC−5)

```
03:00  Backup da curadoria             (todo dia)
04:00  Coleta das receitas             (só às segundas)
04:30  Coleta da folha                 (todo dia)
05:00  Coleta do QDD                   (dias úteis)
         └─ faz outro backup antes de publicar
```

O GitHub não garante o horário do agendamento. Em dias de carga, as execuções costumam
começar **horas depois** do previsto (no histórico, a coleta do QDD marcada para 05:00 rodou
entre 10h e 15h de Brasília). Isso é normal e não indica falha.

---

## 2. Arquitetura

```
                         GitHub (repositório + Actions)
            ┌───────────────────────────────────────────────────────┐
            │ agenda (cron)  ·  botão "Run workflow"  ·  botão no app │
            └──────┬─────────────────────┬────────────────────┬─────┘
                   │                     │                    │
      servidores do GitHub (ubuntu)      │         runner da SEPLAN (Windows)
     ┌─────────────┴─────────────┐       │        rótulo: seplan-sicaf
     │ backup.yml                │       │        C:\actions-runner
     │ folha.yml    ──► Portal da Transparência    ┌──────────┴───────────┐
     │ receitas.yml ──► (transparencia.ac.gov.br)  │ qdd.yml              │
     └─────────────┬─────────────┘                 │  1. backup + commit  │
                   │ DATABASE_URL                  │  2. SICAF (rede      │
                   ▼                               │     interna da SEFAZ)│
            ┌─────────────┐                        │  3. envia ao app ────┼──┐
            │ Neon        │◄── backup.mjs ─────────┤                      │  │
            │ (PostgreSQL │                        └──────────────────────┘  │
            │  produção)  │                                                  │
            └──────▲──────┘                                                  ▼
                   │                     Worker de repasse (Cloudflare)
                   │                     orcamentostematicos.seplan.workers.dev
                   │                                    │
                   │                                    ▼
                   └──────────────────────── App na Vercel (Next.js)
                                             /api/imports/qdd/from-sicaf
                                             /api/imports/qdd/auto-publish
```

Há **dois jeitos de gravar no banco**, e a diferença é proposital:

- **Folha, receita e backup** acessam o banco **direto**, com o segredo `DATABASE_URL`. São
  dados agregados e regraváveis: recoletar o mesmo período só substitui o que havia.
- **O QDD nunca grava direto.** O coletor só **entrega o arquivo** ao app, que o processa
  com o **mesmo parser do upload manual** (`parseQdd`) e decide se publica. A curadoria
  temática depende das ações do QDD; por isso toda regra de proteção fica num lugar só, o
  app, e é coberta por testes.

---

## 3. Coleta do QDD (SICAF)

É a coleta mais importante e a mais delicada: ela atualiza a base orçamentária sobre a qual
está toda a curadoria. Os detalhes estão em [`ingestao-qdd-sicaf.md`](ingestao-qdd-sicaf.md).

### 3.1. Passo a passo de uma execução

| # | Passo | O que acontece | Se falhar |
|---|---|---|---|
| 1 | Checkout + Node 22 + `npm ci` + `prisma generate` | Prepara o ambiente no runner | Job para; nada foi gravado |
| 2 | **Backup** (`backup.mjs`) | Gera `backups/<data>/` a partir do banco | Job **para**: não publica sem ponto de retorno |
| 3 | **Conferir o dump** | Exige `curadoria.json` existente e não vazio | Job **para** |
| 4 | **Commit do backup** | Commita e dá push (com rebase, pois o `backup.yml` pode ter commitado antes) | Job **para** |
| 5 | **Login no SICAF** | Sessão GeneXus com `SICAF_CPF` / `SICAF_SENHA` | Job falha; ver seção 9 |
| 6 | **Exercício** | Confirma que o SICAF está no exercício pedido (por padrão, o corrente) | Troca de exercício ainda dá 403 (seção 3.5) |
| 7 | **Exportação** | Abre o QDD "Saldo Retroativo — Execução" (`app.quadrodetalhadodespesa`, `vTIPOREL=2`, acumulado até o mês) e dispara o `DOEXCEL` | Job falha |
| 8 | **Validação do Excel** | Confere se é Excel, tem cabeçalho de QDD, é do exercício certo e não está vazio | Job falha **antes** de enviar |
| 9 | **Envio ao app** | `POST /api/imports/qdd/from-sicaf`, com o arquivo e o cabeçalho `x-job-token` | Job falha; nada publicado |
| 10 | **Prévia** | O app roda `parseQdd` e grava uma prévia `sicafpreview-…` | — |
| 11 | **Publicação automática** | `POST /api/imports/qdd/auto-publish`: o app decide se publica (3.2) | Se recusar, o job **não** falha (3.2) |

Uma execução bem-sucedida termina assim:

```
• Login no SICAF…  sessão estabelecida.
• Abrindo o QDD (exercício 2026, mês 11)…  contexto do SICAF confirmado no exercício 2026.
• Disparando a exportação para Excel (DOEXCEL)…
• Baixando e validando o Excel…  2553 KB, exercício 2026, 7336 linhas.
• Enviando ao app para gerar a prévia…  prévia criada: 1762 ações, 33 órgãos (exercício 2026).
• Pedindo a publicação automática…
  publicado: 1734 ações atualizadas, 28 criadas, 0 inativadas, 0 reativadas (exercício 2026).
✓ Coleta concluída.
```

### 3.2. Quando publica sozinho e quando espera a SEPLAN

A decisão é da função `assessAutoPublish` (`apps/web/src/lib/qdd-replacement.ts`, coberta
por testes). Ela **recusa** a publicação automática quando:

| Situação | Limite | Por quê |
|---|---|---|
| Ações **com curadoria** sumiriam do QDD | mais de 5 (`MAX_AUTO_INACTIVATE`) | Inativar uma ação marcada a tira de todos os painéis. Em operação normal, esse número é zero. |
| O número de ações despenca | menos de 90% da base (`MIN_ACTION_COUNT_RATIO`) | Sinal típico de exportação parcial do SICAF. |
| O exercício **ainda não tem base** | qualquer | A primeira importação do ano define se o exercício é corrente ou só comparativo, e essa decisão é da SEPLAN. |
| Chave lógica duplicada no arquivo | qualquer | Defeito do arquivo. |

Quando recusa, a rota responde `200` com `published: false` e o motivo. **O job termina com
sucesso**, porque não houve erro técnico: um humano precisa olhar. A prévia fica guardada e
aparece um aviso **"Prévia do SICAF pronta"** na tela da SEPLAN, que revisa e confirma
manualmente.

Proteções que valem sempre, mesmo na publicação automática:

- **Reimportar não perde curadoria.** As ações equivalentes conservam o ID pela chave
  lógica (`actionLogicalKey`). Ações que somem ficam com `presentInCurrentQdd=false`, sem
  ser apagadas.
- **Um QDD por exercício.** A importação atualiza a base daquele ano e não mexe nos
  outros.
- **A política do exercício não muda sozinha.** Corrente e comparativo só mudam pela tela
  Exercícios.

### 3.3. Por que roda numa máquina da SEPLAN

Desde 03/11/2026, o SICAF **não aceita conexão vinda dos servidores do GitHub** (dá
tempo-limite). Da rede da SEPLAN ele responde. Por isso o `qdd.yml` usa
`runs-on: [self-hosted, seplan-sicaf]`: um runner do GitHub instalado numa estação da
SEPLAN.

| Item | Valor |
|---|---|
| Pasta | `C:\actions-runner` |
| Nome e rótulo | `seplan-sicaf` |
| Como inicia | No logon do usuário, pelo `runner-coleta-qdd.vbs` na pasta **Inicializar** (`shell:startup`), que roda `C:\actions-runner\iniciar.cmd` sem abrir janela |
| O que o `iniciar.cmd` faz | Põe o Git Bash no PATH, pois os passos do workflow usam bash, e sobe o `run.cmd` |
| Serviço do Windows | Não; roda como processo do usuário, sem precisar de admin |

**Consequência prática:** a coleta do QDD só roda com **essa máquina ligada e o usuário
logado**. Se estiver desligada, o job fica **na fila por até 24h** e roda quando ela voltar.
Depois disso, falha. Para conferir se o runner está ativo, veja GitHub → Settings → Actions
→ Runners: `seplan-sicaf` deve aparecer como **Idle** ou **Active**, e não **Offline**.

### 3.4. Por que o envio ao app passa pela Cloudflare

Da rede da SEPLAN, o firewall (FortiGate) retém `*.vercel.app` **de forma intermitente**.
Por isso o passo de coleta usa:

```yaml
APP_URL: ${{ vars.APP_URL_SEPLAN || secrets.APP_URL }}
```

A variável de repositório `APP_URL_SEPLAN` aponta para o **Worker de repasse** na Cloudflare
(`https://orcamentostematicos.seplan.workers.dev`). Ele só encaminha a requisição para a
Vercel, por dentro da rede da Cloudflare, sem passar pelo FortiGate. Veja
[`segunda-porta-cloudflare.md`](segunda-porta-cloudflare.md). Sem essa variável, vale o
segredo `APP_URL` (a Vercel direto).

### 3.5. Particularidades do SICAF

- **GXState fora do POST.** O SICAF usa GeneXus, cujas páginas carregam um campo de estado
  (`GXState`) de cerca de 12 KB, com o HTML do chat da página embutido. O WAF da SEFAZ
  bloqueia ("Acesso bloqueado") os POSTs que levam esse campo inteiro. O login e a
  exportação funcionam sem ele, então o coletor envia `GXState='undefined'`. A SEFAZ
  confirmou que a automação para a plataforma do Governo não é problema.
- **Troca de exercício bloqueada (pendente).** O POST AJAX do seletor de exercício ainda
  recebe 403. Na prática, **só o exercício corrente é coletado automaticamente**.
  Exercícios anteriores (comparativos) entram por upload manual até a SEFAZ ajustar a regra.
- **Conta nominal.** O login usado é de uma pessoa, e toda coleta fica registrada no SICAF
  em nome dela. O ideal é obter da SEFAZ uma conta técnica só de leitura.
- **Cadeia de certificado incompleta.** O servidor do SICAF envia só o certificado final
  (`*.sefaz.ac.gov.br`), sem o intermediário *Sectigo Public Server Authentication CA OV
  R36*. O Node não busca intermediários sozinho e, em 24/11/2026, a coleta agendada falhou
  com `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Só funcionava quando o processo herdava
  `NODE_USE_SYSTEM_CA=1`, que faz o Node usar o repositório do Windows (onde o intermediário
  está em cache). Essa variável não existe no ambiente do usuário nem da máquina, então o
  resultado dependia de como o runner foi iniciado. O intermediário (público, válido até 2036) está
  versionado em `apps/web/scripts/certs/sectigo-ov-r36.pem` e o `qdd.yml` o entrega ao Node
  por `NODE_EXTRA_CA_CERTS`. A verificação de TLS continua ligada. Para rodar o coletor à
  mão, defina a mesma variável antes do `node`.
- **Depuração.** Quando o SICAF responde algo inesperado, o coletor salva a resposta em
  `apps/web/scripts/.sicaf-debug/`, dentro da pasta de trabalho do runner, e tenta
  anexá-la ao job como artefato `sicaf-debug` por 7 dias.

---

## 4. Coleta da folha (`folha.yml`)

- **Fonte:** Portal da Transparência do Acre (`transparencia.ac.gov.br`).
- **Script:** `apps/web/scripts/collect-payroll.mjs`.
- **O que grava:** **só agregados**, somas por carreira, tipo de contrato e órgão. **Nenhum
  nome ou matrícula é persistido.** A situação funcional (ativo, inativo) vem do campo
  `situacao` do portal, e não é deduzida do órgão nem do vínculo.
- **Quando:** todo dia. A folha sai uma vez por mês e com atraso, então o script descobre
  sozinho o mês mais recente publicado.
- **Idempotente:** recoletar um mês substitui os agregados daquele mês.
- **Sob demanda:** aceita `ano` e `mes` para forçar um mês específico.
- Detalhes em [`folha-portal-transparencia.md`](folha-portal-transparencia.md) e na seção 8
  de [`design-orcamento.md`](design-orcamento.md).

## 5. Coleta das receitas (`receitas.yml`)

- **Fonte:** Portal da Transparência do Acre.
- **Script:** `apps/web/scripts/collect-revenue.mjs`, que importa a classificação de
  `src/lib/revenue.ts`, a mesma usada pela tela.
- **O que grava:** receita **por categoria** (tributo, transferência etc.) e mês, na tabela
  `RevenueMonth`. O valor arrecadado é do mês, não acumulado; a previsão é anual e se
  repete em todo mês.
- **Quando:** toda segunda-feira. Sem parâmetro, coleta o ano corrente, o anterior (que
  ainda recebe ajustes no começo do ano) e os exercícios que têm QDD.
- **Sob demanda:** `ano=2026` ou uma faixa, como `ano=2016-2025`. Foi assim que a série
  histórica foi carregada uma única vez.
- **Local:** `npm run collect:revenue -- --dry-run` (em `apps/web`) consulta e mostra os
  totais sem gravar.

## 6. Backup da curadoria (`backup.yml`)

- **Script:** `apps/web/scripts/backup.mjs`.
- **O que gera** em `backups/<AAAA-MM-DD>/`:
  - `curadoria.json`: dump bruto restaurável de `ThematicAssignment`, `ActionValidation`,
    `ValidationCycle` e dos metadados de `BudgetImport`;
  - `marcacoes.json`, `marcacoes.csv` e `marcacoes.xlsx`: as marcações com as colunas da
    chave lógica, prontas para reimportar.
- **Quando:** todo dia, e **também imediatamente antes de cada publicação do QDD** (passo 2
  da seção 3.1).
- **Por que importa:** o banco é produção e o Neon guarda só ~6h de histórico. Um
  `db push` destrutivo já apagou toda a curadoria uma vez. O backup versionado no
  repositório é a rede de segurança. Veja o `CLAUDE.md` da raiz.

---

## 7. Segredos e variáveis

Configurados no GitHub, em **Settings → Secrets and variables → Actions**.

| Nome | Tipo | Usado por | O que é |
|---|---|---|---|
| `DATABASE_URL` | segredo | backup, folha, receitas, QDD (backup) | Conexão com o Neon (**produção**) |
| `SICAF_CPF` / `SICAF_SENHA` | segredo | QDD | Login no SICAF |
| `SICAF_JOB_TOKEN` | segredo | QDD | Senha compartilhada entre o job e as rotas do app. **O mesmo valor** precisa estar na Vercel |
| `APP_URL` | segredo | QDD | Endereço do app (Vercel direto) |
| `APP_URL_SEPLAN` | **variável** | QDD | Endereço do app pela Cloudflare; tem prioridade sobre `APP_URL` |
| `SICAF_INSECURE_TLS` | segredo (opcional) | QDD | `1` desliga a verificação de TLS. Último recurso: antes, confira o intermediário em `scripts/certs/` (3.5) |
| `GITLAB_MIRROR_URL` / `GITLAB_TOKEN` | segredo | espelho GitLab | Destino e token do espelho |

Na **Vercel** (Production): `SICAF_JOB_TOKEN`, com o mesmo valor do GitHub. Para o botão
"Puxar QDD do SICAF agora" funcionar, também são necessários `GITHUB_DISPATCH_TOKEN`,
`GITHUB_REPO` e `GITHUB_WORKFLOW_REF`.

As rotas `/api/imports/qdd/from-sicaf` e `/api/imports/qdd/auto-publish` exigem o
cabeçalho `x-job-token` e respondem **401** sem ele. Elas precisam estar liberadas no
`proxy.ts`, que é onde fica o controle de sessão.

---

## 8. Como rodar manualmente

| Quero… | Como |
|---|---|
| Puxar o QDD agora, pela tela | Em `/seplan`, na seção de importação: **"Puxar QDD do SICAF agora"** |
| Rodar qualquer coleta agora | GitHub → Actions → escolher o workflow → **Run workflow** |
| Testar o QDD sem gravar nada | Run workflow em *Coleta do QDD (SICAF)* com `dry_run = true` (pula o backup e não envia ao app) |
| Coletar um exercício ou mês específico | Run workflow com `exercicio` e `mes` (QDD), `ano` e `mes` (folha) ou `ano` (receitas) |
| Fazer backup antes de uma operação de risco | Run workflow em *Backup da curadoria temática*, ou `npm run db:backup` em `apps/web` |
| Testar uma branch | `gh workflow run qdd.yml --ref <branch> -f dry_run=true` |
| Importar o QDD à mão (paliativo) | Em `/seplan`, Estrutura vigente → importação do arquivo exportado do SICAF |

---

## 9. Monitoramento e diagnóstico

Entre 03/11 e 23/11/2026, a coleta do QDD falhou 14 vezes seguidas sem ninguém notar. Desde
24/11/2026, o painel da SEPLAN avisa:

- **Alerta de coleta parada.** No topo de `/seplan`, em qualquer seção, aparece um aviso
  quando o QDD do exercício corrente está há **2 dias úteis ou mais** sem publicação
  (`QDD_STALE_BUSINESS_DAYS` em `apps/web/src/lib/qdd-freshness.ts`). A conta usa a data da
  revisão mais recente da base (do SICAF ou de upload manual), no fuso de Rio Branco, sem
  contar sábado e domingo.
  - *"QDD sem atualização há N dias úteis"*: nenhuma coleta chegou ao app. Runner
    desligado, SICAF fora do ar, senha vencida ou certificado. Veja o log em Actions.
  - *"Coleta do QDD aguardando a SEPLAN"*: a coleta rodou, mas a publicação automática
    recusou a prévia (travas da seção 3.2). Revise e confirme a prévia.
- **Por que medir no painel, e não no workflow:** com a máquina do runner desligada o job
  fica na fila e **não falha**. Nenhuma notificação de falha pegaria esse caso.

Como complemento, o GitHub manda e-mail de falha de workflow agendado para quem editou o
`cron` por último, se as notificações de Actions estiverem ligadas em
**Settings → Notifications → Actions** da conta.

Para ver o histórico de uma rotina pelo terminal:

```bash
gh run list -w "Coleta do QDD (SICAF)" -L 10
```

Para ver só os passos que falharam numa execução:

```bash
gh run view <id> --log-failed
```

### 9.1. Sintomas comuns na coleta do QDD

| Mensagem no log | Causa provável | O que fazer |
|---|---|---|
| Job fica **"Queued"** por horas | Runner `seplan-sicaf` offline (máquina desligada ou deslogada) | Ligar a máquina e entrar no Windows; se não subir, rodar `C:\actions-runner\iniciar.cmd` |
| `bash: command not found` | Runner iniciado sem o Git Bash no PATH | Iniciar sempre pelo `iniciar.cmd`, nunca pelo `run.cmd` direto |
| `setup-node` parado por muitos minutos | Download de cache remoto retido pela rede | O `qdd.yml` já não usa `cache: npm`; não reative |
| `✗ fetch failed` + `causa: UND_ERR_CONNECT_TIMEOUT` com IP do SICAF | SICAF inacessível dessa rede | Conferir se o job rodou no runner da SEPLAN; testar o acesso ao SICAF dessa máquina |
| `✗ fetch failed` + `causa: UNABLE_TO_VERIFY_LEAF_SIGNATURE` no login | O SICAF não mandou o intermediário e o Node não o achou | Conferir se o passo tem `NODE_EXTRA_CA_CERTS` e se o certificado da SEFAZ ainda é emitido pela *Sectigo CA OV R36* (seção 3.5). Se o emissor mudou, troque o PEM |
| `✗ fetch failed` + `causa: UND_ERR_CONNECT_TIMEOUT` no **envio ao app** | `*.vercel.app` retido pelo FortiGate | Conferir se a variável `APP_URL_SEPLAN` existe e aponta para o Worker |
| `Falha na autenticação do SICAF` | Senha errada ou expirada, **ou** bloqueio do WAF | Abrir o arquivo em `.sicaf-debug/`. Se for a página "Acesso bloqueado", acionar a SEFAZ com os IDs da página; se for a tela de login, revisar `SICAF_SENHA` |
| `401` nas rotas do app | `SICAF_JOB_TOKEN` diferente entre o GitHub e a Vercel | Igualar os valores |
| Job verde, mas o painel não mudou | Publicação **recusada** pelas travas (3.2) | Ver o motivo no log ("published: false") e revisar a prévia em `/seplan` |
| `Backup ausente ou vazio` | `backup.mjs` falhou ou mudou o caminho | Corrigir antes de qualquer publicação; é proposital que pare aqui |

Desde 23/11/2026, o coletor imprime a **causa real** do erro (`causa: …`) abaixo do
`fetch failed`. Antes, só aparecia `fetch failed`, o que escondia se o problema era de rede,
de certificado ou de recusa.

---

## 10. Manutenção e segurança

- **Repositório público + runner próprio.** Um PR de fork pode tentar rodar um workflow no
  runner da SEPLAN, dentro da rede interna. Por isso o repositório exige **aprovação manual
  para workflows de PRs de qualquer colaborador externo** (Settings → Actions → General).
  **Não afrouxe essa regra.** Só o `qdd.yml` deve usar o rótulo `seplan-sicaf`.
- **Trocar a máquina do runner:** remova o runner antigo (`config.cmd remove`) e instale na
  nova máquina. O procedimento completo está na seção 8 de
  [`incidente-coleta-sicaf-2026-11.md`](incidente-coleta-sicaf-2026-11.md). Recrie o
  `iniciar.cmd` e o atalho de logon.
- **Atualizações do runner:** são automáticas.
- **Mudou a senha do SICAF:** atualize `SICAF_SENHA` no GitHub.
- **Mudou o endereço do app ou do Worker:** atualize `APP_URL` e/ou `APP_URL_SEPLAN`.
- **Ajustar as travas da publicação automática:** constantes no topo de `assessAutoPublish`.
  Mantenha os testes em `qdd-replacement.test.ts`.
- **Folha, receitas e backup** continuam nos servidores do GitHub, que alcançam o Portal da
  Transparência e o Neon sem problema. Não precisam do runner da SEPLAN.

### Pendências conhecidas (atualizado em 24/11/2026)

1. ~~Mesclar `ci/qdd-runner-seplan` na `main`.~~ **Feito em 23/11/2026.** A primeira coleta
   agendada pela `main` (24/11) falhou no TLS do SICAF (cadeia incompleta, seção 3.5).
   Correção: intermediário versionado. Falha reproduzida e correção validada com o Node do
   runner (22.23.5) na própria máquina; falta confirmar numa execução do workflow.
2. Resolver com a SEFAZ o **403 na troca de exercício**. Depende da SEFAZ; o pedido
   está redigido em [`pedidos-sefaz.md`](pedidos-sefaz.md).
3. ~~Criar um alerta de coleta parada.~~ **Feito em 24/11/2026** (seção 9).
4. Obter uma **conta técnica** de leitura no SICAF, no lugar da conta nominal. Depende da
   SEFAZ; o pedido está no mesmo documento.

---

## 11. Documentos relacionados

| Documento | Assunto |
|---|---|
| [`ingestao-qdd-sicaf.md`](ingestao-qdd-sicaf.md) | Desenho e validação da coleta do QDD, travas da publicação, botão da tela |
| [`incidente-coleta-sicaf-2026-11.md`](incidente-coleta-sicaf-2026-11.md) | Incidente de novembro/2026: diagnóstico, runner próprio, WAF, Worker |
| [`sicaf-rotas-dados.md`](sicaf-rotas-dados.md) | Rotas e dados do SICAF |
| [`pedidos-sefaz.md`](pedidos-sefaz.md) | Rascunho dos pedidos à SEFAZ (403, conta técnica, certificado) |
| [`folha-portal-transparencia.md`](folha-portal-transparencia.md) | Coleta da folha no Portal da Transparência |
| [`automacao-execucao-transparencia.md`](automacao-execucao-transparencia.md) | Automação da execução orçamentária |
| [`segunda-porta-cloudflare.md`](segunda-porta-cloudflare.md) | Worker de repasse na Cloudflare (contorno do FortiGate) |
| [`design-orcamento.md`](design-orcamento.md) | Contrato do módulo `/orcamento` (inclui a coleta da folha) |
| `CLAUDE.md` (raiz) | Regras críticas do banco de produção e dos backups |
