# Incidente: coleta automática do QDD parada (SICAF/SEFAZ) — novembro de 2026

> **Situação em 23/11/2026, fim da tarde:** a coleta do **exercício corrente (2026)
> voltou a funcionar** no runner da SEPLAN. A primeira coleta real publicou o QDD às 14h03
> (seção 10.6). A SEFAZ confirmou
> que não se trata de um bloqueio geral à automação e que o uso para a plataforma do Governo
> não é problema. O bloqueio era um **falso positivo do WAF** sobre o campo GXState (seção
> 10). Pendências: a mesclagem na `main` (sem ela, o agendamento diário continua falhando) e a
> **troca de exercício**, que ainda recebe 403.
>
> As seções 1 a 9 registram o diagnóstico na ordem em que aconteceu. A conclusão da seção 4.6
> ("bloqueio de política, pedir liberação") foi **revista** na seção 10.

Este documento registra tudo o que foi investigado e feito na sessão de 23/11/2026: o
sintoma, o diagnóstico passo a passo, as mudanças aplicadas (e as que ficaram pendentes de
propósito) e o que fazer a seguir.

---

## 1. Resumo

| Item | Situação |
|---|---|
| O que parou | Workflow **"Coleta do QDD (SICAF)"** (`.github/workflows/qdd.yml`) |
| Desde quando | **03/11/2026**: falha em todo dia útil. Último sucesso em **02/11/2026** |
| Efeito no sistema | O último QDD publicado automaticamente é o de 02/11/2026 |
| O que continua funcionando | Backup diário, coleta da folha e coleta das receitas |
| Causa | A SEFAZ passou a barrar o login automatizado no SICAF (WAF / "Acesso bloqueado") |
| Mudou algo no nosso código antes da falha? | **Não.** Nenhum commit em `scripts/` nem no workflow entre 28/10 e 04/11 |
| Solução | Pedir à SEFAZ a liberação da automação (ou outro canal para obter o QDD) |
| Paliativo | Importação manual do QDD em `/seplan` |

---

## 2. Contexto: como a coleta funciona

O detalhamento está em [`ingestao-qdd-sicaf.md`](ingestao-qdd-sicaf.md). Em resumo:

1. O GitHub Actions roda `qdd.yml` em dias úteis às 10:00 UTC (05:00 em Rio Branco).
2. O job faz **backup** do banco, confere que o dump existe e o versiona em `backups/<data>/`.
3. O script `apps/web/scripts/fetch-sicaf-qdd.mjs`:
   - **faz login no SICAF** (`https://sicaf.sefaz.ac.gov.br/sicaf/app.sicaf`, sessão GeneXus);
   - abre o QDD "Saldo Retroativo — Execução" (`app.quadrodetalhadodespesa`, `vTIPOREL=2`);
   - dispara a exportação para Excel (`DOEXCEL`) e baixa e valida o arquivo;
   - envia o arquivo ao app (`/api/imports/qdd/from-sicaf`), que gera uma **prévia**;
   - pede a publicação automática (`/api/imports/qdd/auto-publish`), que é condicional
     (veja as travas em `assessAutoPublish`).

Desde 09/09/2026 essa publicação é automática. Por isso, quando a coleta para, o painel deixa
de se atualizar sem que ninguém perceba de imediato.

---

## 3. Sintoma

"Parou de atualizar." O histórico do GitHub Actions mostrava:

```
2026-11-02  success   Coleta do QDD (SICAF)
2026-11-03  failure   Coleta do QDD (SICAF)
2026-11-04  failure
...         failure   (todos os dias úteis)
2026-11-20  failure
```

Enquanto isso, os outros workflows (backup, folha e receitas) seguiam com sucesso.

O log de todas as falhas era idêntico:

```
• Login no SICAF…
✗ fetch failed
##[error]Process completed with exit code 1.
```

O erro aparecia cerca de **10 segundos** depois de "Login no SICAF…".

Para comparar, o último sucesso (02/11) levou cerca de 2 segundos no login e seguiu
normalmente até "✓ Coleta concluída.".

---

## 4. Diagnóstico, passo a passo

### 4.1. Não houve mudança de código

```bash
git log origin/main --since=2026-10-28 --until=2026-11-04 -- apps/web/scripts .github/workflows/qdd.yml
```

O comando não retornou nada. A falha começou sem nenhuma alteração do nosso lado.

### 4.2. A assinatura do erro indicava bloqueio de rede

- `fetch failed` depois de cerca de 10s coincide com o **tempo-limite de conexão do Node
  (undici)**. O servidor nem respondeu à tentativa de conexão. Ele não recusou a conexão nem
  devolveu erro.
- Senha errada ou SICAF fora do ar produziriam outro erro: uma resposta HTTP, uma recusa
  imediata ou um nome de host não encontrado.
- O script imprimia só `error.message` e descartava `error.cause`, que é onde fica o motivo
  real (código, endereço). Isso deixou o problema indistinguível de "SICAF fora do ar"
  durante quase três semanas.

### 4.3. O SICAF responde normalmente a partir da rede da SEPLAN

Testes feitos numa máquina da SEPLAN:

| Teste | Resultado |
|---|---|
| DNS interno de `sicaf.sefaz.ac.gov.br` | IP **privado** `10.81.0.100` |
| DNS público (8.8.8.8, 1.1.1.1, dns.google) | `38.191.55.198` e `186.219.245.33` |
| `curl` pelo IP interno | HTTP 404 em 0,4s (o servidor responde) |
| `curl` forçando cada IP público | HTTP 404 em cerca de 0,55s (o servidor responde) |
| `fetch` pelo **Node** (mesmo motor do script) | HTTP 404 (TLS aceito pelo Node) |

O 404 na raiz `/sicaf/` é esperado. O que importa é que a conexão se completa.

**Hipótese naquele momento:** a SEFAZ passou a bloquear conexões vindas de fora do Brasil ou
de datacenters. Os runners do GitHub ficam nos EUA (Azure).

### 4.4. O restante da cadeia também funciona a partir da rede da SEPLAN

Antes de mover a coleta para cá, conferimos cada etapa:

| Etapa | Resultado |
|---|---|
| App na Vercel (`/api/health`) | HTTP 200 (não está retido pelo FortiGate) |
| Neon (`select 1` via `@neondatabase/serverless`) | OK |
| GitHub Actions (broker, pipelines, results) | Acessível |
| API do GitHub (download do runner) | OK |

### 4.5. Com o runner dentro da rede, o bloqueio apareceu de verdade

Com o runner self-hosted instalado (seção 5), rodamos a coleta em modo de teste
(`dry_run=true`, que não toca no banco nem no app):

```
Runner name: 'seplan-sicaf'
• Login no SICAF…
✗ Falha na autenticação do SICAF. Confira SICAF_CPF/SICAF_SENHA.
```

Desta vez a conexão funcionou: o SICAF respondeu em cerca de 0,1s. A mensagem "falha na
autenticação", porém, é só a interpretação do script. O conteúdo real da resposta foi salvo
pelo `dumpDebug` em
`C:\actions-runner\_work\orcamentostematicos\orcamentostematicos\apps\web\scripts\.sicaf-debug\01-login-falhou.txt`.
Era uma página da própria SEFAZ:

> **Acesso bloqueado | SEFAZ-AC**
> Sua solicitação foi bloqueada pela política de segurança da aplicação.
>
> - URL solicitada: `sicaf.sefaz.ac.gov.br/sicaf/app.sicaf`
> - **ID da mensagem: 000011211563**
> - **ID do evento: 20000008**
> - **IP de origem: 10.10.17.128**
>
> Se você precisa concluir a operação, entre em contato com o suporte do sistema e informe os
> identificadores acima, a data e o horário do bloqueio.

O teste foi em 23/11/2026, por volta das 10:18 (horário de Brasília), 15:18 UTC.

### 4.6. Conclusão

A SEFAZ colocou um **firewall de aplicação (WAF)** na frente do SICAF, muito provavelmente
em 03/11/2026. Ele:

- **de fora** (runners do GitHub): descarta a conexão, o que aparece como `fetch failed` por
  tempo-limite;
- **de dentro** (rede da SEPLAN): aceita a conexão, mas **bloqueia o POST de login
  automatizado** e devolve a página "Acesso bloqueado".

Ou seja, **trocar de rede não resolve**. O bloqueio é de política da SEFAZ e não é falha
técnica nossa.

**Decisão:** não tentar contornar o WAF. Isso exclui disfarçar o script como navegador,
alterar cabeçalhos, User-Agent ou o formato do pedido para escapar da regra, e qualquer
técnica parecida. É um controle de segurança de um sistema de outro órgão. A solução
legítima é pedir a liberação.

---

## 5. O que foi feito em 23/11/2026

### 5.1. Segurança do repositório (aplicado)

O repositório `IcaroGundim/orcamentostematicos` é **público**. Um runner self-hosted em
repositório público permite que alguém abra um PR de fork com um workflow que rode código
**na máquina da SEPLAN, dentro da rede interna**.

- Antes, só quem contribuía pela primeira vez precisava de aprovação (`first_time_contributors`).
- Agora, PRs de fork de **qualquer colaborador externo** exigem aprovação manual
  (`all_external_contributors`).
- Onde fica no GitHub: Settings → Actions → General → *Fork pull request workflows from
  outside collaborators* → *Require approval for all external contributors*.

**Não afrouxe essa configuração enquanto houver um runner self-hosted registrado.**

### 5.2. Runner self-hosted (instalado e rodando)

| Item | Valor |
|---|---|
| Máquina | Estação da SEPLAN (Windows 11), rede interna |
| Pasta | `C:\actions-runner` |
| Versão | `actions-runner-win-x64-2.338.2` (SHA-256 conferido com o da release oficial) |
| Nome / rótulo | `seplan-sicaf` / `self-hosted`, `seplan-sicaf` |
| Modo | Processo do usuário, **sem** serviço do Windows e **sem** admin |
| Como iniciar | `C:\actions-runner\iniciar.cmd` |

Conteúdo de `iniciar.cmd`:

```bat
@echo off
rem Inicia o runner do GitHub (coleta do QDD) com o Git Bash no PATH.
set NoDefaultCurrentDirectoryInExePath=
set "PATH=%LOCALAPPDATA%\Programs\Git\bin;%PATH%"
cd /d "%~dp0"
call "%~dp0run.cmd"
```

Problemas encontrados na instalação e como foram resolvidos:

1. **`bash: command not found`** no primeiro job. Todos os passos do `qdd.yml` usam sintaxe
   bash, mas o Windows não tem `bash` no PATH (o Git Bash está instalado por usuário, em
   `%LOCALAPPDATA%\Programs\Git`). Criar o arquivo `C:\actions-runner\.path` **não
   bastou**, porque o runner resolve o shell pelo PATH do próprio processo. A solução foi o
   `iniciar.cmd`, que põe o Git Bash na frente do PATH antes de subir o runner.
2. **`'run.cmd' não é reconhecido`**. O ambiente que disparou o runner tinha
   `NoDefaultCurrentDirectoryInExePath` definido, o que impede o `cmd` de procurar na pasta
   atual. A solução foi zerar a variável e usar caminho absoluto (`%~dp0run.cmd`).

### 5.3. Mudanças no código (na branch `ci/qdd-runner-seplan`, **não mesclada**)

Commit `ci(qdd): coleta do SICAF em runner próprio na rede da SEPLAN`:

- **`.github/workflows/qdd.yml`**
  - `runs-on: ubuntu-latest` → `runs-on: [self-hosted, seplan-sicaf]`
  - `defaults.run.shell: bash` no job
  - comentário explicando o runner próprio, a dependência da máquina ligada e a regra de
    aprovação de forks
  - **só** este workflow mudou. Backup, folha e receitas continuam em `ubuntu-latest`.
- **`apps/web/scripts/fetch-sicaf-qdd.mjs`**
  - o `main().catch` agora imprime também `error.cause` (código, mensagem, endereço:porta).
    Um próximo `fetch failed` vai dizer **por que** falhou.

Testes feitos a partir da branch (`workflow_dispatch`, `dry_run=true`):

| Execução | Resultado | Motivo |
|---|---|---|
| `45200969830` | falhou | `bash: command not found` (seção 5.2, item 1) |
| `45201325287` | falhou | runner chegou ao SICAF; **WAF bloqueou o login** (seção 4.5) |

### 5.4. O que ficou pendente de propósito

- **A branch não foi mesclada na `main`.** Enquanto a SEFAZ bloquear, mover o agendamento
  para o runner local não muda nada.
- **O runner ainda não inicia sozinho no logon.** Ele está rodando agora porque foi iniciado
  manualmente. Se a máquina reiniciar, ele para.
- **Nenhuma coleta real foi testada.** O `dry_run` pula o backup e não chama o app. Só uma
  execução real testa a cadeia inteira.

---

## 6. Próximos passos

### 6.1. Pedir a liberação à SEFAZ (bloqueante)

Abrir chamado no suporte do SICAF/SEFAZ informando:

- **Identificadores do bloqueio:** ID da mensagem `000011211563`, ID do evento `20000008`,
  IP de origem `10.10.17.128`, data e hora 23/11/2026, por volta de 10:18 (Brasília).
- **O que é a automação:** uma consulta diária, em dias úteis, ao relatório QDD "Saldo
  Retroativo — Execução" (`app.quadrodetalhadodespesa`, `vTIPOREL=2`), com o usuário
  institucional da SEPLAN, para alimentar o Sistema de Orçamentos Temáticos. É só leitura:
  um login e uma exportação por dia.
- **O que se pede**, em ordem de preferência:
  1. um canal oficial (API ou arquivo agendado) para obter o QDD; ou
  2. a liberação (allowlist) do acesso automatizado a partir de um IP fixo da rede da SEPLAN
     (o da máquina do runner).
- **Desde quando:** 03/11/2026.

### 6.2. Depois da liberação

1. Se a SEFAZ liberar por IP da rede interna, manter o runner self-hosted. Se liberar para
   acesso externo, avaliar voltar ao `ubuntu-latest` e descartar a branch.
2. Rodar `qdd.yml` pela branch com `dry_run=true` e confirmar "✓" no login, na exportação e
   no download.
3. Mesclar `ci/qdd-runner-seplan` na `main`.
4. Configurar o runner para iniciar no logon: uma tarefa agendada do usuário, ou um atalho
   na pasta Inicializar, apontando para `C:\actions-runner\iniciar.cmd`.
5. Acompanhar a primeira execução **real** (backup, conferência do dump, coleta, prévia e
   publicação) e checar o painel.

### 6.3. Enquanto isso

- Importar o QDD manualmente em `/seplan` (Estrutura vigente → importação), como antes da
  automação.
- O runner pode ficar registrado sem causar problema, desde que a regra de aprovação de forks
  (5.1) continue ativa.

---

## 7. Limitações e riscos do runner self-hosted

- **Disponibilidade:** a coleta só roda com a máquina **ligada e com o usuário logado**. Se
  não estiver, o job fica na fila por até 24h e roda quando a máquina voltar. Depois disso,
  falha.
- **Atualização:** o runner se atualiza sozinho. Se a máquina for formatada ou trocada, é
  preciso reinstalar e registrar de novo (seção 8).
- **Segurança:** em repositório público, a proteção depende da aprovação manual de PRs de
  fork (5.1). Revise a lista de runners em Settings → Actions → Runners.
- **Governança:** é um agente persistente numa estação do governo, conectado ao GitHub.
  Pode ser necessário avisar ou obter autorização da TI.
- **Coleta da folha:** não foi afetada e continua no `ubuntu-latest`.

---

## 8. Como desfazer ou reinstalar

**Remover o runner:**

```powershell
cd C:\actions-runner
$tok = gh api -X POST repos/IcaroGundim/orcamentostematicos/actions/runners/remove-token -q .token
.\config.cmd remove --token $tok
```

Depois, encerre o processo do runner e apague `C:\actions-runner`.

**Reinstalar:** baixe `actions-runner-win-x64-<versão>.zip` em
github.com/actions/runner/releases, confira o SHA-256 e extraia em `C:\actions-runner`. Em
seguida:

```powershell
$tok = gh api -X POST repos/IcaroGundim/orcamentostematicos/actions/runners/registration-token -q .token
.\config.cmd --unattended --url https://github.com/IcaroGundim/orcamentostematicos --token $tok --name seplan-sicaf --labels seplan-sicaf --work _work --replace
```

Por fim, recrie o `iniciar.cmd` (seção 5.2).

**Voltar a coleta para o GitHub:** basta não mesclar a branch, ou reverter `runs-on` para
`ubuntu-latest`.

---

## 9. Lições

1. **Log de erro precisa da causa.** `fetch failed` sem `error.cause` escondeu o problema
   por quase três semanas. Corrigido na branch (5.3).
2. **Falha silenciosa de job agendado.** O workflow falhou 14 vezes seguidas sem ninguém
   notar. Vale configurar um alerta (notificação de falha do GitHub, ou um aviso no painel
   quando o QDD publicado estiver com mais de N dias úteis).
3. **Mudar de rede não resolve bloqueio de política.** O teste de conectividade (curl 404)
   provou que havia rota, mas só o teste ponta a ponta revelou o WAF. Testes de alcance
   precisam incluir a etapa que de fato falha, aqui o POST de login.
4. **"Acesso bloqueado" não é sinônimo de "proibido".** Antes de concluir que é política,
   vale isolar *qual parte do pedido* dispara a regra. Aqui era o conteúdo de um campo, e não
   o acesso em si. A confirmação com o dono do sistema (SEFAZ) fecha a questão.

---

## 10. Atualização (23/11/2026, tarde): falso positivo do WAF

### 10.1. Conversa com a SEFAZ

O responsável conversou com a equipe da SEFAZ. Segundo ela, **não se trata de um bloqueio
geral** ao acesso automatizado, e uma plataforma do Governo consumindo o QDD dessa forma não
é problema.

### 10.2. O que de fato era bloqueado

Testes posteriores, feitos com apoio de outra ferramenta de IA, isolaram a regra:

- O **login sem o GXState passa**.
- O POST **com o GXState inteiro** no corpo é bloqueado. O GXState tem cerca de 12 KB e
  traz, embutido, o HTML/script do widget de chat da página.
- Ou seja, o WAF bloqueia pelo **conteúdo** do campo (provavelmente o HTML/script dentro
  dele), não pelo acesso. É um falso positivo da regra.

O GeneXus aceita o login e a exportação (`DOEXCEL`) **sem** o estado: o próprio formulário
de login envia `GX_STATE=undefined`. Então o campo, que não era necessário, deixou de ser
enviado.

### 10.3. Correção aplicada (branch `ci/qdd-runner-seplan`)

Commit `fix(sicaf): não enviar o GXState no login e no DOEXCEL`, em
`apps/web/scripts/fetch-sicaf-qdd.mjs`:

- `login()`: `GX_STATE: 'undefined'` no lugar do estado extraído da página;
- `exportarQdd()`: `GXState: 'undefined'` no lugar de `qdd.gxState`.

### 10.4. Teste

Execução `45218280275` (`workflow_dispatch`, `dry_run=true`, runner `seplan-sicaf`):

```
• Login no SICAF…
• Abrindo o QDD (exercício 2026, mês 11)…
• Disparando a exportação para Excel (DOEXCEL)…
• Baixando e validando o Excel…
  QDD_Saldo_Retroativo_Execucao-1425-20261123.xls: 2553 KB, exercício 2026, 7336 linhas.
✓ --dry-run: … Nada foi enviado ao app.
```

O `dry_run` não faz backup nem envia ao app. A cadeia completa só é testada numa execução
real.

### 10.5. O que ainda falta

1. **Troca de exercício (403).** O POST AJAX do seletor de exercício ainda recebe 403. O
   corpo da resposta lembra o do Tomcat, o que sugere que vem do proxy/WAF e não de uma regra
   da aplicação. Enquanto não for resolvido, a coleta funciona **só para o exercício
   corrente**. Exercícios anteriores (comparativos) continuam pelo upload manual.
   - **Caminho preferido:** levar a evidência à SEFAZ ("o JSON do seletor, que carrega o HTML
     do chat, é bloqueado") e pedir o ajuste da regra ou a allowlist.
   - **Alternativa:** automação por navegador real (Playwright). Ela segue a mesma via do
     usuário humano, mas é uma dependência pesada no runner Windows e uma mudança grande no
     script.
2. **Primeira coleta real:** `workflow_dispatch` sem `dry_run` pela branch (backup, prévia e
   publicação automática), depois conferir o painel.
3. **Mesclar** `ci/qdd-runner-seplan` na `main`, para o agendamento diário usar o runner.
4. **Iniciar o runner no logon** (seção 6.2, item 4).
5. **Alerta de QDD parado** (lição 2), que hoje não existe.
6. **Ainda não testado:** se, com a correção do GXState, os runners do próprio GitHub também
   voltariam a funcionar. Lá o sintoma era tempo-limite de conexão, um bloqueio de rede
   distinto. Por ora, fica o runner da SEPLAN.

### 10.6. Primeira coleta real (23/11/2026, ~14h)

**Tentativa 1** (`45219981215`, cancelada): o `actions/setup-node` ficou mais de 15 minutos
restaurando o cache remoto do npm, um download do blob storage da Azure que parece ter sido
retido pela rede da SEPLAN. Cancelamos antes do backup, então nada foi gravado.

- Correção: removemos o `cache: npm` do `qdd.yml`. O npm já mantém um cache local no disco
  do runner, então o cache remoto não ganhava nada.

**Tentativa 2** (`45222068246`, falhou no envio ao app):

```
Backup conferido: backups/2026-11-23/curadoria.json (430588 bytes).   ← commitado na branch
• Login no SICAF…  sessão estabelecida.
• Abrindo o QDD (exercício 2026, mês 11)…  contexto do SICAF confirmado no exercício 2026.
• Disparando a exportação para Excel (DOEXCEL)…
• Baixando e validando o Excel…  2553 KB, exercício 2026, 7336 linhas.
• Enviando ao app para gerar a prévia…
✗ fetch failed
  causa: UND_ERR_CONNECT_TIMEOUT · Connect Timeout Error
         (attempted addresses: 216.198.79.194:443, 64.29.17.194:443, timeout: 10000ms)
```

- **O SICAF funcionou de ponta a ponta.**
- O que falhou foi o acesso ao **app na Vercel** (`orcamentostematicos.vercel.app`) a partir
  da rede da SEPLAN. Às 10h ele respondia 200; às 14h dava tempo-limite. É o FortiGate
  retendo `*.vercel.app` de forma intermitente (ver `segunda-porta-cloudflare.md`).
- Nenhuma prévia foi gravada e nada foi publicado. O banco não foi alterado; só o backup foi
  commitado na branch.
- O log com `error.cause` (seção 5.3) mostrou a causa na hora.

**Correção preparada:** no passo de coleta, o `qdd.yml` passou a usar
`APP_URL: ${{ vars.APP_URL_SEPLAN || secrets.APP_URL }}`. Basta criar a variável de
repositório `APP_URL_SEPLAN` com a URL da segunda porta (Worker de repasse na Cloudflare),
cujo tráfego até a Vercel sai da rede da Cloudflare, sem passar pelo FortiGate.

- O endereço registrado na memória do projeto
  (`orcamentostematicos.icarogundim.workers.dev`) estava **desatualizado**. A URL correta é
  `https://orcamentostematicos.seplan.workers.dev`.
- A variável de repositório `APP_URL_SEPLAN` foi criada com essa URL. Pelo Worker, o
  `/api/health` responde 200, e as rotas do job recusam pedidos sem token com 401, como
  esperado.

**Tentativa 3** (`45223157744`, **sucesso**, 23/11/2026, 14h03 de Brasília):

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

O QDD de 2026 voltou a ser publicado automaticamente, pela primeira vez desde 02/11/2026.

### 10.7. Início automático do runner

O arquivo `runner-coleta-qdd.vbs` fica na pasta **Inicializar** do usuário
(`shell:startup`). No logon, ele roda `C:\actions-runner\iniciar.cmd` em segundo plano, sem
janela. Para desativar, apague esse arquivo.

### 10.8. O que ainda falta (após o sucesso)

1. **Mesclar `ci/qdd-runner-seplan` na `main`.** Até lá, o agendamento diário (05:00) roda
   pela `main`, que ainda aponta para `ubuntu-latest` e continua falhando.
2. **Troca de exercício (403)** para exercícios anteriores, conforme a seção 10.5, item 1.
3. **Alerta de QDD parado** (lição 2).
4. **Disponibilidade:** a coleta das 05:00 só roda com a máquina do runner ligada e logada.
   Fora disso, o job fica na fila por até 24h e roda quando a máquina voltar.

### 10.9. Paliativo até lá

Os exercícios anteriores continuam pelo **upload manual** em `/seplan`.
