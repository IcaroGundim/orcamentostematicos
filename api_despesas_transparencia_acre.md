# Documentação Completa da API de Despesas Públicas - Portal da Transparência do Estado do Acre

Guia técnico definitivo com a arquitetura de dados, níveis de granularidade, classificação funcional-programática (Projetos e Atividades), endpoints REST/AJAX, parâmetros de requisição e fatos geradores no portal [transparencia.ac.gov.br](https://transparencia.ac.gov.br).

---

## 1. Visão Geral da Arquitetura

O Portal da Transparência do Estado do Acre opera sob o framework **Laravel (PHP)** e consome dados do **SIAFE/SAFIRA** (Sistema Integrado de Administração Financeira do Estado). Ele expõe serviços REST/AJAX em formato **JSON** que alimentam tabelas dinâmicas (*DataTables*), modais de liquidação/pagamento, gráficos interativos (*ApexCharts*) e rotas de exportação em lote (*JSON, CSV e PDF*).

* **URL Base:** `https://transparencia.ac.gov.br`
* **Formato de Resposta:** `application/json`
* **Content-Type para Requisições:** `application/x-www-form-urlencoded; charset=UTF-8`
* **Mecanismo de Segurança:** Requer token CSRF (`X-CSRF-TOKEN`) obtido via tag `<meta name="csrf-token" content="...">` na página inicial ou em `/despesas`.

---

## 2. Níveis de Granularidade da Despesa Pública

Na despesa pública, por força do **Princípio Constitucional da Publicidade (Art. 37 da CF/88)**, da **Lei de Responsabilidade Fiscal (LC nº 101/2000)** e da **Lei de Acesso à Informação (Lei nº 12.527/2011)**, a API atinge a **granularidade máxima possível** (nível atômico transacional).

```
┌────────────────────────────────────────────────────────────────────────────┐
│ NÍVEL 1: MACRO / EXECUTIVO (Total Anual / Mensal do Estado de 1996 a 2026) │
├────────────────────────────────────────────────────────────────────────────┤
│ NÍVEL 2: INSTITUCIONAL (Por Secretaria / Órgão / Poder / Fundo Estadual)   │
├────────────────────────────────────────────────────────────────────────────┤
│ NÍVEL 3: POLÍTICA PÚBLICA (Função e Subfunção Governamental)               │
├────────────────────────────────────────────────────────────────────────────┤
│ NÍVEL 4: PROGRAMÁTICO (Programa do PPA, PROJETO 1xxx e ATIVIDADE 2xxx)     │
├────────────────────────────────────────────────────────────────────────────┤
│ NÍVEL 5: NATUREZA ECONÔMICA (Elemento de Despesa / Padrão STN)             │
├────────────────────────────────────────────────────────────────────────────┤
│ NÍVEL 6: FONTE DE RECURSOS (Próprios, SUS, FUNDEB, Convênios, Empréstimos) │
├────────────────────────────────────────────────────────────────────────────┤
│ NÍVEL 7: TRANSACIONAL / ATÔMICO (Empenho, Credor/CNPJ, Objeto/Histórico)   │
├────────────────────────────────────────────────────────────────────────────┤
│ NÍVEL 8: SUB-TRANSACIONAL (Liquidação / Nota Fiscal e Ordem Bancária / OB) │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Classificação Funcional-Programática (Ações: Projetos e Atividades)

O portal adota a **Classificação de 17 dígitos** regulamentada pela Portaria MOG nº 42/1999 e STN, permitindo rastrear mais de **6.485 Ações Orçamentárias** cadastradas.

### 3.1. Estrutura dos 17 Dígitos

$$\underbrace{\mathbf{FF}}_{\text{Função (2)}} \cdot \underbrace{\mathbf{SSS}}_{\text{Subfunção (3)}} \cdot \underbrace{\mathbf{PPPP}}_{\text{Programa (4)}} \cdot \underbrace{\mathbf{AAAA}}_{\text{Ação (4)}} \cdot \underbrace{\mathbf{LLLL}}_{\text{Localizador (4)}}$$

#### Exemplo Prático: `01.122.2286.2290.0000`
* **Função (`01`):** *Legislativa* (área agregada de atuação).
* **Subfunção (`122`):** *Administração Geral* (segmento específico).
* **Programa (`2286`):** *Gestão Governamental e Apoio Administrativo* (Programa do PPA).
* **Ação Orçamentária (`2290`):** **ATIVIDADE** *(Manutenção das Ações da Representação do Governo)*.
* **Subtítulo / Localizador (`0000`):** *Estado do Acre* (regionalização do gasto).

### 3.2. Identificação do Tipo de Ação Orçamentária (`AAAA`)

O primeiro dígito do bloco de 4 dígitos da Ação define a sua natureza jurídica e operacional:

| Tipo de Ação | Código (`AAAA`) | Finalidade e Conceito | Exemplos no Acre |
| :--- | :---: | :--- | :--- |
| 🚧 **PROJETO** | **`1000` a `1999`** | Ações com **início, meio e fim** que geram novos bens, infraestrutura ou expansão de patrimônio. | • `1027` — Pavimentação e Obras Viárias<br>• `1256` — Construção/Reforma de Unidades de Saúde<br>• `1259` — Implantação de Sistemas de TI |
| 🔄 **ATIVIDADE** | **`2000` a `2999`** | Ações **contínuas e permanentes** para funcionamento e manutenção dos serviços públicos. | • `2290` — Manutenção Administrativa de Órgãos<br>• `2447` — Atendimento Hospitalar e Ambulatorial<br>• `2019` — Policiamento Ostensivo |
| 🏛️ **OPERAÇÃO ESPECIAL** | **`0001` a `0999`** | Gastos que **não resultam em contraprestação direta** em bens ou serviços. | • `0005` — Pagamento de Sentenças Judiciais e Precatórios<br>• `0020` — Amortização e Juros da Dívida Pública |

---

## 4. Fatos Geradores e Objetos das Despesas

Ao contrário da Receita (onde compras individuais são protegidas por sigilo fiscal), na Despesa a API expõe **o fato gerador, a descrição do produto/serviço e os dados do fornecedor**:

| Campo JSON | Tipo | O que Representa | Exemplo Real Extraído da API |
| :--- | :--- | :--- | :--- |
| **`historico`** | `string` | **Fato Gerador / Objeto literal da compra:** descrição do item, quantidades, marca/modelo, processo SEI e contrato. | *"REFERENTE AO FORNECIMENTO DE 60 MONITORES PARA VIDEOCONFERÊNCIA DELL C2423H, CONFORME A ORDEM DE FORNECIMENTO DO EVENTO SEI 0035764, SOB O CONTRATO Nº 50/2024..."* |
| **`razaosocial`** | `string` | **Nome do Credor / Favorecido:** Razão Social da empresa ou nome da pessoa física. | `DELL COMPUTADORES DO BRASIL LTDA` |
| **`cpfcnpjcredor`** | `string` | **CNPJ ou CPF do fornecedor** contratado. | `72.381.189/0001-10` |
| **`elemento_despesa_descricao`** | `string` | **Classificação do objeto contábil.** | `Equipamentos e Material Permanente` |
| **`despesaorcamentaria`** | `string` | Código de 6 a 10 dígitos do elemento da despesa. | `449052` (Equipamentos), `339030` (Consumo), `339039` (Serviços PJ) |
| **`entidade`** | `string` | Órgão/Secretaria compradora. | `SECRETARIA DE ESTADO DA FAZENDA - SEFAZ` |
| **`totalempenho`** | `number` | Valor total empenhado (reserva orçamentária). | `R$ 88.285,80` |
| **`totalliquidacao`** | `number` | Valor liquidado (mercadoria entregue/atestada). | `R$ 88.285,80` |
| **`totalpago`** | `number` | Valor efetivamente pago via Ordem Bancária. | `R$ 88.285,80` |

---

## 5. Catálogo Completo de Endpoints

### 5.1. Módulo Geral de Despesas (`/despesas`)

#### A) Listagem Paginada de Empenhos
* **Endpoint:** `POST /despesas/listar`
* **Descrição:** Retorna a listagem analítica dos empenhos com suporte a busca textual por objeto (`busca`), fornecedor, órgão e datas.
* **Parâmetros (`application/x-www-form-urlencoded`):**
  * `ano` *(string)*: Exercício orçamentário (ex: `'2024'`, `'2025'`).
  * `periodo` *(string)*: `'0'` (Anual), `'2'` (Mensal), `'3'` (Bimestral), `'4'` (Trimestral), etc.
  * `mes` *(string)*: `'01'` a `'12'`.
  * `busca` *(string)*: Termo de pesquisa textual no `historico` ou `razaosocial` (ex: `'computador'`, `'medicamento'`, `'pavimentacao'`, `'software'`).
  * `orgao` *(string)*: Código ou nome do órgão.
  * `fonte` *(string)*: Código da fonte de recursos (ex: `'15000100'`).
  * `elemento_despesa` *(string)*: Código do elemento (ex: `'33903900'`).
  * `start` *(int)*: Índice inicial (paginação).
  * `length` *(int)*: Quantidade de registros por página (ex: `50`).
  * `draw` *(int)*: Contador de requisição do DataTables.

#### B) Detalhamento das Liquidações de um Empenho
* **Endpoint:** `POST /despesas/liquidacao`
* **Parâmetro:** `id_empenho` *(string)* — Concatenação de `<numeroempenho><anoempenho>` (ex: `'30563001802024'`).
* **Campos Retornados:**
  * `numeroliquidacao`: Número da liquidação no SIAFE.
  * `dataemissao`: Data do ateste da entrega.
  * `valordaliquidacao`: Valor parcial ou total liquidado.
  * `historico`: Descrição da Nota Fiscal / Comprovante de entrega atestado.

#### C) Detalhamento dos Pagamentos de um Empenho
* **Endpoint:** `POST /despesas/pagamento`
* **Parâmetro:** `id_empenho` *(string)* (ex: `'30563001802024'`).
* **Campos Retornados:**
  * `numeropagamento`: Número da Ordem Bancária (OB).
  * `dataemissao`: Data em que o pagamento foi debitado da Conta Única.
  * `valorpagamento`: Valor líquido pago ao favorecido.

#### D) Totalizadores Globais de Despesas
* **Endpoint:** `POST /despesas/totais`
* **Parâmetros:** `ano`, `periodo`, `mes`, `orgao`, `programa`, etc.
* **Retorno:**
  ```json
  {
    "empenhado": "123456789.00",
    "liquidado": "98765432.00",
    "pago": "87654321.00"
  }
  ```

#### E) Séries Temporais para Gráficos
* **Endpoint:** `POST /despesas/valores`
* **Parâmetros:** `ano`, `periodo`, `mes`, `orgao`, `programa`.
* **Retorno:** Array com valores mensais/bimestrais contendo `item`, `empenhado`, `liquidado` e `pago`.

#### F) Exportação Completa em Lote
* **Endpoint:** `POST /despesas/dados-exportacao`
* **Descrição:** Retorna todos os registros de despesas do período filtrado.

---

### 5.2. Módulo de Despesas por Classificação (`/despesas-por-classificacao`)

#### A) Listagem com Filtro por Ação / Projeto / Atividade
* **Endpoint:** `POST /despesas-por-classificacao/listar`
* **Parâmetros Principais:**
  * `ano` *(string)*: Ano do exercício.
  * `periodo` *(string)*: `'0'` (anual), `'2'` (mensal).
  * `programa` *(string)*: **Código de 17 dígitos da Ação Orçamentária** (ex: `'01122228622900000'`).
  * `categoria_economica` *(string)*: `'3'` (Correntes), `'4'` (Capital).
  * `grupo_natureza` *(string)*: `'1'` (Pessoal), `'3'` (Custeio), `'4'` (Investimentos).
  * `elemento_despesa` *(string)*: Código do elemento (ex: `'33903000'`).

#### B) Exportação de Despesas por Classificação
* **Endpoint:** `POST /despesas-por-classificacao/dados-exportacao`
* **Parâmetros:** `ano`, `periodo`, `programa`, `elemento_despesa`, etc.

---

### 5.3. Módulo de Despesas por Órgão (`/conteudo/despesas-por-orgao`)

* **`POST /conteudo/despesas-por-orgao/listar`**: Tabela agregada com totais consolidados por órgão.
* **`POST /conteudo/despesas-por-orgao/totais`**: Totalizadores gerais do Estado.
* **`POST /conteudo/despesas-por-orgao/grafico`**: Top 10 órgãos com maiores volumes de despesas.
* **`POST /conteudo/despesas-por-orgao/dados-exportacao`**: Exportação da matriz consolidada de secretarias.

---

### 5.4. Módulos Complementares Especializados

1. **Contratos Públicos (`/contratos`):**
   * Consulta a íntegra dos contratos administrativos, vigência, valores globais, termos aditivos e fiscais responsáveis.
2. **Licitações (`/licitacoes`):**
   * Editais de pregão eletrônico, concorrências públicas, atas de registro de preços e dispensas de licitação.
3. **Diárias de Viagem (`/diarias`):**
   * Nome do servidor, cargo, destino, justificativa da viagem, quantidade de diárias e valor pago.
4. **Obras Públicas (`/conteudo/obras`):**
   * Painel de obras com geolocalização, valor contratado, empresa executora e medições físico-financeiras.

---

## 6. Exemplos Práticos de Consumo da API

### 6.1. Exemplo em Python: Buscar Fatos Geradores por Palavra-Chave (ex: "Computador" ou "Medicamento")

```python
import urllib.request
import urllib.parse
import http.cookiejar
import json
import re
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj), urllib.request.HTTPSHandler(context=ctx))

# 1. Obter CSRF Token
req = urllib.request.Request('https://transparencia.ac.gov.br/despesas', headers={'User-Agent': 'Mozilla/5.0'})
html = opener.open(req).read().decode('utf-8')
csrf = re.search(r'<meta name="csrf-token" content="([^"]+)"', html).group(1)

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'X-Requested-With': 'XMLHttpRequest',
    'X-CSRF-TOKEN': csrf,
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
}

# 2. Consultar empenhos com busca textual no objeto
payload = urllib.parse.urlencode({
    'ano': '2024',
    'periodo': '0',
    'busca': 'computador',
    'start': 0,
    'length': 10,
    'draw': 1
}).encode('utf-8')

req_search = urllib.request.Request('https://transparencia.ac.gov.br/despesas/listar', data=payload, headers=headers)
resposta = json.loads(opener.open(req_search).read().decode('utf-8'))

print(f"Total de empenhos encontrados: {resposta.get('recordsTotal')}")
for emp in resposta.get('data', []):
    print(f"\nEmpenho: {emp.get('numeroempenho')} | Fornecedor: {emp.get('razaosocial')} (CNPJ: {emp.get('cpfcnpjcredor')})")
    print(f"Órgão: {emp.get('entidade')} | Valor Pago: R$ {float(emp.get('totalpago') or 0):,.2f}")
    print(f"Objeto/Fato Gerador: {emp.get('historico')}")
```

---

### 6.2. Exemplo em Python: Consultar Gastos por Ação / Projeto Orçamentário (17 Dígitos)

```python
# Consulta todos os empenhos vinculados à Ação Orçamentária 01.122.2286.2290.0000
payload_acao = urllib.parse.urlencode({
    'ano': '2024',
    'periodo': '0',
    'programa': '01122228622900000',
    'start': 0,
    'length': 25,
    'draw': 1
}).encode('utf-8')

req_acao = urllib.request.Request('https://transparencia.ac.gov.br/despesas-por-classificacao/listar', data=payload_acao, headers=headers)
dados_acao = json.loads(opener.open(req_acao).read().decode('utf-8'))

print(f"Empenhos da Ação: {dados_acao.get('recordsTotal')}")
for it in dados_acao.get('data', []):
    print(f"[{it.get('numeroempenho')}] {it.get('razaosocial')} | R$ {it.get('valorempenhado')} | {it.get('elemento_despesa_descricao')}")
```

---

### 6.3. Exemplo em cURL: Obter Liquidação e Nota Fiscal de um Empenho

```bash
curl -X POST "https://transparencia.ac.gov.br/despesas/liquidacao" \
     -H "User-Agent: Mozilla/5.0" \
     -H "X-Requested-With: XMLHttpRequest" \
     -H "X-CSRF-TOKEN: SEU_TOKEN_CSRF_AQUI" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "id_empenho=30563001802024"
```

---

### 6.4. Exemplo em JavaScript / Node.js: Totais por Órgão

```javascript
const payload = new URLSearchParams({
    ano: '2024',
    periodo: '0'
});

fetch('https://transparencia.ac.gov.br/conteudo/despesas-por-orgao/totais', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-TOKEN': 'TOKEN_CSRF_AQUI',
        'User-Agent': 'Mozilla/5.0'
    },
    body: payload.toString()
})
.then(res => res.json())
.then(totais => {
    console.log(`Empenhado: R$ ${totais.empenhado}`);
    console.log(`Liquidado: R$ ${totais.liquidado}`);
    console.log(`Pago: R$ ${totais.pago}`);
})
.catch(err => console.error('Erro na requisição:', err));
```

---

### 6.5. Exemplo em PowerShell: Consulta de Empenho Individual

```powershell
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$home = Invoke-WebRequest -Uri "https://transparencia.ac.gov.br/despesas" -WebSession $session -UserAgent "Mozilla/5.0"
$csrf = [regex]::Match($home.Content, '<meta name="csrf-token" content="([^"]+)"').Groups[1].Value

$headers = @{
    "X-CSRF-TOKEN" = $csrf
    "X-Requested-With" = "XMLHttpRequest"
    "User-Agent" = "Mozilla/5.0"
}

$body = @{
    ano = "2024"
    periodo = "0"
    busca = "computador"
    start = "0"
    length = "5"
    draw = "1"
}

$response = Invoke-RestMethod -Uri "https://transparencia.ac.gov.br/despesas/listar" -Method Post -Headers $headers -Body $body -WebSession $session
$response.data | Select-Object numeroempenho, razaosocial, totalpago, historico | Format-Table -AutoSize
```
