# Pedidos à SEFAZ sobre o SICAF

Rascunho para a SEPLAN enviar à equipe de TI da SEFAZ. São três pedidos independentes;
dá para mandar juntos ou separados. Nenhum deles foi enviado ainda (24/11/2026).

Contexto técnico: [`coleta-automatica.md`](coleta-automatica.md) (seção 3.5) e
[`incidente-coleta-sicaf-2026-11.md`](incidente-coleta-sicaf-2026-11.md) (seção 10).

---

**Assunto:** SICAF — consulta automatizada do QDD pela SEPLAN: troca de exercício, conta
técnica e certificado

Prezados,

A SEPLAN mantém o Sistema de Orçamentos Temáticos, que lê todo dia útil o relatório
*Quadro Detalhado da Despesa — Saldo Retroativo (Execução)* do SICAF. A consulta é só de
leitura e roda às 05:00, a partir de uma máquina da rede da SEPLAN. Como combinado com a
equipe de vocês em 23/11/2026, a coleta do exercício corrente voltou a funcionar. Restam
três pontos em que precisamos da ajuda da SEFAZ:

**1. Troca de exercício bloqueada (HTTP 403)**

Para consultar o QDD de exercícios anteriores, a coleta repete o que o usuário faz no
seletor de exercício do cabeçalho. São chamadas AJAX do GeneXus em
`/sicaf/app.quadrodetalhadodespesa`, com os eventos:

- `DDC_EXERCICIO_MPAGE.ONLOADCOMPONENT_MPAGE` (abrir o seletor);
- `VSELECIONAR.CLICK` no componente `wcexercicio` (escolher o ano);
- `GLOBALEVENTS_MPAGE.BUSCAACAO_MPAGE` (atualizar o contexto).

Essas chamadas recebem **HTTP 403** com uma página de erro que parece vir do proxy/WAF, e
não do SICAF. [CONFIRMAR ANTES DE ENVIAR: pelo navegador, com o mesmo usuário, a troca
funciona?] Pedimos que verifiquem
se alguma regra do WAF está barrando essas requisições e, se for o caso, ajustem a regra ou
liberem o acesso para o endereço de saída da rede da SEPLAN. Podemos repetir o teste em
horário combinado para vocês acompanharem nos logs.

**2. Conta técnica de leitura**

Hoje a coleta usa a conta de um servidor, então todo acesso fica registrado em nome dele e
para se ele trocar a senha ou mudar de lotação. Pedimos uma **conta técnica**, só com
leitura do QDD (exercício corrente e anteriores), para uso exclusivo da automação da
SEPLAN.

**3. Cadeia de certificado do `sicaf.sefaz.ac.gov.br`**

O servidor envia só o certificado do site (`*.sefaz.ac.gov.br`), sem o certificado
intermediário *Sectigo Public Server Authentication CA OV R36*. Navegadores contornam isso,
mas clientes como Node.js, Python e `curl` recusam a conexão
(`unable to verify the first certificate`). Para conferir:

```
openssl s_client -connect sicaf.sefaz.ac.gov.br:443 -servername sicaf.sefaz.ac.gov.br -showcerts
```

A saída mostra um único certificado e termina com `Verify return code: 21`. A correção é
configurar o servidor para enviar também o intermediário (a "cadeia completa" / *fullchain*).
Do nosso lado já contornamos, mas a correção no servidor evita o problema para qualquer
sistema que consuma o SICAF.

Ficamos à disposição para testar junto com vocês.

Atenciosamente,
[nome, cargo, SEPLAN]

---

## Depois da resposta

- **403 resolvido:** rodar `gh workflow run qdd.yml -f exercicio=2025 -f dry_run=true` e
  conferir no log a linha "contexto alterado e confirmado no exercício 2025". Depois,
  atualizar a seção 3.5 de `coleta-automatica.md`.
- **Conta técnica criada:** trocar `SICAF_CPF` e `SICAF_SENHA` em GitHub → Settings →
  Secrets and variables → Actions e rodar um `dry_run`.
- **Cadeia corrigida no servidor:** o PEM em `apps/web/scripts/certs/` pode ficar (não
  atrapalha) ou sair junto com o `NODE_EXTRA_CA_CERTS` do `qdd.yml`.
