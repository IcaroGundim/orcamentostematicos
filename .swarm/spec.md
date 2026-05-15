# Specification: Sub-abas na seção Estrutura Vigente

## Feature Description
Reestruturar a seção "Estrutura vigente" da página Seplan para usar sub-abas (Tabs), separando o conteúdo de gerenciamento (importação, estatísticas, histórico) do conteúdo de consulta (filtros + tabela de ações).

## User Scenarios

### Scenario: Alternar entre sub-abas
**Given** o usuário está na seção "Estrutura vigente"
**When** ele vê as sub-abas "Gerenciamento" e "Consulta"
**Then** pode alternar entre elas clicando nos triggers das tabs

### Scenario: Consulta da estrutura em aba separada
**Given** o usuário está na sub-aba "Consulta"
**When** ele visualiza os filtros (exercício, órgão, unidade, busca) e a tabela de ações
**Then** o conteúdo ocupa a largura total da página (não mais dividido em duas colunas)

### Scenario: Gerenciamento isolado
**Given** o usuário está na sub-aba "Gerenciamento"
**When** ele vê os cards de Importar QDD, Estatísticas da base e Histórico de importações
**Then** estes cards são exibidos em layout vertical (uma coluna)

## Functional Requirements

- **FR-001**: A seção "Estrutura vigente" DEVE exibir sub-abas usando o componente Tabs existente
- **FR-002**: DEVE existir uma sub-aba "Gerenciamento" contendo: Importar QDD, Estatísticas da base vigente, Histórico de importações
- **FR-003**: DEVE existir uma sub-aba "Consulta" contendo: Card "Consulta da estrutura" com filtros e tabela
- **FR-004**: A sub-aba padrão ao entrar na seção DEVE ser "Gerenciamento"
- **FR-005**: A aba "Consulta" DEVE exibir o card com largura total (sem grid de duas colunas)

## Success Criteria

- **SC-001**: O usuário consegue alternar entre as duas sub-abas sem perda de estado dos filtros
- **SC-002**: O layout da aba "Consulta" utiliza a largura disponível sem a coluna lateral de gerenciamento
- **SC-003**: Não há regressão no funcionamento dos filtros, tabela e ações de clique

## Edge Cases
- Ao trocar de sub-aba, os filtros da aba "Consulta" devem preservar seus valores
- A importação de QDD na aba "Gerenciamento" deve continuar funcionando normalmente
