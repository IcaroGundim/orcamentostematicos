# Ingestão automática do QDD a partir do SICAF

Automatiza a alimentação do QDD ("Saldo Retroativo — Execução") no Orçamentos Temáticos,
para que a SEPLAN **não precise mais exportar e enviar o arquivo** manualmente. A gravação
no banco continua sob **confirmação humana** — nada entra no orçamento sozinho.

## Como funciona

```
GitHub Actions (.github/workflows/qdd.yml)
  └─ node apps/web/scripts/fetch-sicaf-qdd.mjs
       1. login no SICAF (app.sicaf) com SICAF_CPF / SICAF_SENHA
       2. abre app.quadrodetalhadodespesa, dispara DOEXCEL (vTIPOREL=2)
       3. baixa o Excel nativo do "Saldo Retroativo — Execução"
       4. POST multipart → APP_URL/api/imports/qdd/from-sicaf  (header x-job-token)
                                   │
Vercel (app)                       ▼
  /api/imports/qdd/from-sicaf → parseQdd (o MESMO do upload) → ImportPreview "sicafpreview-…"
                                   │
Tela da SEPLAN                     ▼
  banner "Prévia do SICAF pronta" → Revisar → reconciliação → Confirmar (/imports/qdd/confirm)
```

**Por que baixar o Excel em vez de ler um JSON do SICAF?** O único trecho do sistema
validado contra dados reais é o `parseQdd` (ver `docs/automacao-execucao-transparencia.md`
§1.2). Reaproveitá-lo sobre o arquivo real mantém essa validação e reduz a superfície não
verificada a "obter os bytes". Um mapeador de GXState→ExpenseLine escrito à mão jogaria
fora essa garantia.

**Por que Actions e não Vercel?** A raspagem depende de sessão GeneXus e do TLS da SEFAZ,
como a coleta da folha (`folha.yml`). O serverless da Vercel não é o lugar para isso.

**Por que confirmação humana?** O banco é produção com retenção de ~6h e já teve perda
silenciosa de curadoria (ver `CLAUDE.md`). A prévia é barata e reversível; a escrita, não.

## Segredos a configurar

No **GitHub → Settings → Secrets and variables → Actions**:

| Secret | O que é |
|---|---|
| `SICAF_CPF` | Login nominal habilitado na SEFAZ (perfil de leitura do QDD). |
| `SICAF_SENHA` | Senha do login. Trocar se algum dia vazar. |
| `SICAF_JOB_TOKEN` | Segredo compartilhado job ↔ rota. Gere aleatório (`openssl rand -hex 32`). |
| `APP_URL` | Base do app publicado (ex.: `https://orcamentos.vercel.app`). |
| `SICAF_INSECURE_TLS` | Opcional, `1` só se o handshake TLS da SEFAZ falhar no runner. |

Na **Vercel → Project → Settings → Environment Variables** (Production): `SICAF_JOB_TOKEN`
com o **mesmo valor**. É o que autentica o job na rota `/imports/qdd/from-sicaf`.

> A conta é nominal. Toda coleta fica registrada no SICAF como ação do titular. Se a SEFAZ
> permitir, peça uma **conta técnica de leitura** para desacoplar a automação da pessoa.

## Rodar

- **Agendado:** dias úteis, 08:00 UTC (05:00 Rio Branco). Idempotente — cada execução
  substitui a prévia do SICAF ainda não confirmada.
- **Sob demanda:** GitHub → Actions → *Coleta do QDD (SICAF)* → *Run workflow* (aceita
  `exercicio`, `mes` e `dry_run`).
- **Local (validação assistida):**
  ```bash
  SICAF_CPF=... SICAF_SENHA=... node apps/web/scripts/fetch-sicaf-qdd.mjs --dry-run --exercicio=2026
  ```
  `--dry-run` baixa o Excel para `apps/web/scripts/.sicaf-debug/` e **não** envia ao app.

## ⚠️ Antes de confiar no agendamento: validar o seam do SICAF UMA vez

A raspagem **não foi validada contra o sistema vivo** (não há acesso ao SICAF a partir do
ambiente de desenvolvimento) e a documentação de referência diverge em nomes de campo
(`GX_STATE` × `GXState`; `app.consultadotacao` × `app.quadrodetalhadodespesa`). Por isso o
script foi feito para **falhar de forma legível**: em qualquer passo que não encontre o
campo esperado, ele grava a resposta bruta em `apps/web/scripts/.sicaf-debug/` dizendo
**qual** extração quebrou (login form, GXState da tela, ajaxSecurityToken, URL do Excel).

Passo a passo da 1ª validação:

1. Rode `--dry-run` localmente. Se baixar o `.xls`, o seam está correto — importe uma vez
   pela tela para conferir que o `parseQdd` casa as colunas.
2. Se falhar, abra o arquivo indicado em `.sicaf-debug/` e ajuste o regex/campo
   correspondente em `fetch-sicaf-qdd.mjs` (as listas `RE_STATE`, `RE_TOKEN`, os nomes dos
   parâmetros `vTIPOREL`/`vEXRORC`/… e o padrão da URL do Excel). Idealmente capture uma
   requisição real do DOEXCEL pelo DevTools do navegador (HAR) e alinhe o payload.
3. Só depois habilite o `schedule`.

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
