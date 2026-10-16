# Teste de carga — "dia de prazo do ciclo"

Simula o pico real do sistema: as secretarias entrando juntas para preencher e enviar
entregas enquanto a SEPLAN acompanha os painéis.

> ⚠️ **Nunca aponte para produção.** `DATABASE_URL`, a Vercel e o Neon apontam todos para
> o mesmo banco, em branch único com retenção de ~6h. Gerar carga contra ele grava sessões,
> consome o pool de conexões e derruba o sistema para os usuários reais.

Três travas, todas testadas:

1. `prepare.mjs` ignora `DATABASE_URL` por completo e só aceita `LOADTEST_DATABASE_URL`;
   aborta se a string contiver o endpoint do Neon de produção.
2. `drive.mjs` aborta se o host do alvo for o de produção.
3. `drive.mjs` faz uma requisição autenticada **antes da rampa** com um token que só existe
   no banco de teste. Se vier 401, o servidor está ligado a outro banco e o teste para.
   Essa é a trava que importa: sem ela, `BASE_URL=localhost` passa enquanto o `npm start`
   pode estar conectado a produção, caso o `DATABASE_URL` da linha de comando não vença o
   `.env.local`.

## 1. Criar o banco isolado

```bash
npx neonctl auth
```

Descubra os nomes reais antes de criar — não presuma que o branch padrão se chama `main`:

```bash
npx neonctl projects list
npx neonctl branches list --project-id <id do projeto>
```

Crie um branch descartável (cópia-na-escrita: instantânea, com schema e dados reais) e
guarde a string de conexão:

```bash
npx neonctl branches create --project-id <id> --name carga-20260918 --parent <branch de origem>
```

## 2. Preparar os usuários de teste

```bash
cd apps/web
LOADTEST_DATABASE_URL="<string do branch>" node scripts/loadtest/prepare.mjs --deadline
```

Cria um usuário por executor real (`ExerciseUnitExecutor`), abre a sessão de cada um direto
na tabela `Session` e escreve `targets.json`.

**Por que a sessão é inserida direto no banco:** `/api/auth/login` serializa as tentativas
da mesma conta num `pg_advisory_xact_lock` e bloqueia a conta após 5 falhas. Um teste que
loga a cada iteração mede esse lock, não a aplicação — e uma senha errada no script
bloquearia a conta por 5 minutos. Usuário real loga uma vez e depois faz centenas de
requisições autenticadas; é isso que o teste reproduz.

**Por que `--deadline`:** hoje 121 das 259 validações já estão `APROVADO`, deixando só
**17 unidades** com trabalho aberto. Sem reabrir, a carga se concentra em poucas linhas e o
que se mede vira disputa de lock de linha, não capacidade. O `--deadline` devolve todas as
validações do exercício a `RASCUNHO` — no branch, nunca em produção — colocando os **19
executores** que alcançam as 259 validações para trabalhar ao mesmo tempo.

Esses 19 são o **teto honesto de usuários virtuais distintos**. Rampas acima disso ainda
servem para saturar o servidor, mas deixam de representar "N secretarias diferentes", e o
`drive.mjs` avisa quando o pico ultrapassa esse número.

O `prepare.mjs` **recusa sobrescrever** um `baseline.json` existente: ele guarda o estado
original do branch, e um segundo preparo o substituiria pelo estado já mutado, levando o
`--reset` a restaurar lixo. Rode `--reset` antes de preparar de novo.

## 3. Subir o alvo

Use o **build de produção**, nunca `next dev` — o modo de desenvolvimento compila por
requisição e qualquer número medido nele é ficção.

```bash
cd apps/web
DATABASE_URL="<string do branch>" npm run build
DATABASE_URL="<string do branch>" npm start
```

## 4. Fumaça antes da rampa

Um usuário, cinco segundos. Confirme **200 nos quatro endpoints** antes de investir na
bateria inteira: um payload recusado viraria 500 e seria lido como "a aplicação quebra sob
carga", quando na verdade o script é que está errado.

```bash
BASE_URL=http://localhost:3000 STAGES="1:5" node scripts/loadtest/drive.mjs
```

## 5. Gerar a carga

```bash
BASE_URL=http://localhost:3000 node scripts/loadtest/drive.mjs
```

Rampa padrão: 5 → 20 → 50 → 100 → 120 usuários simultâneos. Para mudar:

```bash
STAGES="10:30,50:60,200:60,0:10" BASE_URL=http://localhost:3000 node scripts/loadtest/drive.mjs
```

O relatório traz, por endpoint, o número de requisições, erros, p50/p95/p99/máximo e a
distribuição de status HTTP. O script avisa quando o pico da rampa supera o número de
secretarias distintas disponíveis.

## 6. Restaurar e descartar

```bash
LOADTEST_DATABASE_URL="<branch>" node scripts/loadtest/prepare.mjs --reset   # devolve as validações
LOADTEST_DATABASE_URL="<branch>" node scripts/loadtest/prepare.mjs --clean   # remove usuários e sessões
npx neonctl branches delete --project-id <id> carga-20260918                 # descarta o branch
```

**A ordem importa: `--reset` antes de `--clean`.** O `--reset` restaura os dados e apaga o
`baseline.json`; o `--clean` só remove usuários e sessões. Quem roda apenas `--clean` fica
com os dados mutados e sem baseline para recuperar — aí só descartando o branch.

O `--reset` restaura as seis colunas que o cenário altera (`status`, `submittedAt`,
`realizedDescription`, `observations`, `deliveries`, `informedExecutedValue`) a partir do
`baseline.json` capturado antes da primeira escrita. Ainda assim, descartar o branch é a
limpeza completa — o `--reset` serve para repetir baterias comparáveis, não para substituir
o descarte.

## Primeira bateria — 18/09/2026

Rodada local (`npm start` em Rio Branco) contra o branch `carga-20260918`, rampa
5 → 19 → 40 → 80 usuários simultâneos, 170s:

| endpoint | reqs | erros | p50 | p95 | máx |
|---|---:|---:|---:|---:|---:|
| `GET /validations/my` | 335 | 0 | 8369ms | 16467ms | 16983ms |
| `PATCH /validations/:id/draft` | 287 | 0 | 7702ms | 15679ms | 16974ms |
| `GET /budget-actions` | 32 | 0 | 7621ms | 16059ms | 16072ms |
| `GET /reports/summary` | 35 | 0 | 3126ms | 12064ms | 12202ms |
| `POST /validations/:id/submit` | 24 | 0 | 9126ms | 17594ms | 18152ms |
| `POST /validations/submit-all` | 10 | 0 | 9564ms | 18875ms | 18875ms |

**723 requisições, 0 erros, 4,3 req/s.** Nenhum 500, nenhum esgotamento de pool: sob
pressão o sistema enfileira e fica lento, não quebra.

**Mas esses milissegundos não valem para produção.** Medições de apoio:

- RTT de Rio Branco até o Neon em `us-east-1`: **200ms por consulta** (mediana de 12).
- Idas ao banco por requisição (20 iterações, com controle de ociosidade):
  `validations/my` **11,2**, `reports/summary` **9,1**, `budget-actions` **8,3**,
  `/api/health` **0,0** — o zero do health confirma que a medição está limpa.
- O caminho rede+banco escala: 1 conexão → 5,4 consultas/s; 10 → 55,3; 40 → **220,4**.
  O banco não era o gargalo.
- `PrismaNeon` abre um pool com o padrão do `pg`: **10 conexões**.

O teto observado é aritmética: 10 conexões ÷ 200ms = 50 consultas/s, ÷ ~9 consultas por
requisição ≈ **5 req/s** — e medimos 4,3. **A rodada local mede a distância Acre →
Virgínia, não a capacidade do sistema.**

> **Projeção, não medição.** *Se* a Vercel executar em `us-east-1`, ao lado do Neon, o RTT
> cai para 1-3ms e a mesma conta daria centenas de req/s por instância. A região **não foi
> verificada**: nem `vercel.json` nem `next.config.ts` declaram `regions`, então vale o
> padrão do projeto, que ninguém conferiu. Trate esse número como hipótese até medir.

Para responder de fato "quantos usuários o sistema aguenta em produção", é preciso um
preview deployment na Vercel apontado para o branch, e gerar carga contra ele.

## O que os números significam — e o que não significam

- **O piso de custo de toda requisição é uma consulta ao banco.** `getAuthUser` faz
  `session.findUnique({ include: { user: true } })` em *toda* rota autenticada, sem cache.
  Nenhum endpoint pode ser mais rápido que isso.
- Um resultado medido no branch **não transfere para produção**: o compute do branch tem
  limites próprios, e em produção o teto tende a ser o pool de conexões do Neon somado à
  concorrência de lambdas da Vercel — não o código das consultas.
- Este cenário mede **código + banco**. Ele não mede a Vercel nem o Worker da Cloudflare,
  que faz cache de HTML e assets na borda e melhoraria os números artificialmente. Medir o
  ambiente real exigiria um preview deployment apontado para o branch.
- `imports/qdd/confirm` está deliberadamente **fora** do cenário: segura uma transação
  interativa de 60s sob advisory lock e roda uma vez por dia, por job. Medir concorrência
  nela não diz nada útil.
