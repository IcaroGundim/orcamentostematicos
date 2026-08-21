# Ingestão automática do QDD a partir do SICAF

Automatiza a alimentação do QDD ("Saldo Retroativo — Execução") no Orçamentos Temáticos,
para que a SEPLAN **não precise mais exportar e enviar o arquivo** manualmente. A gravação
no banco continua sob **confirmação humana** — nada entra no orçamento sozinho.

## Como funciona

```
GitHub Actions (.github/workflows/qdd.yml)
  └─ node apps/web/scripts/fetch-sicaf-qdd.mjs
       1. login no SICAF (app.sicaf) com SICAF_CPF / SICAF_SENHA
       2. confirma/troca o exercício no seletor GeneXus do SICAF
       3. abre app.quadrodetalhadodespesa e dispara DOEXCEL (vTIPOREL=2)
       4. baixa o Excel e confere formato, cabeçalho, exercício e linhas
       5. POST multipart → APP_URL/api/imports/qdd/from-sicaf  (header x-job-token)
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
