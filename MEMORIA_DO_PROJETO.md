# Memória do Projeto: Sistema de Gestão dos Orçamentos Temáticos do Acre

## O que é este projeto

Este projeto é um sistema de gerenciamento de informações para os Orçamentos Temáticos do Governo do Estado do Acre, conduzido no contexto da Secretaria de Estado de Planejamento (SEPLAN).

O sistema existe para apoiar a identificação, organização, validação e acompanhamento das ações orçamentárias que compõem três orçamentos temáticos:

- Orçamento Sensível ao Gênero (OSG)
- Orçamento da Criança e do Adolescente (OCAD)
- Orçamento Climático

A ideia central é transformar os dados brutos do orçamento estadual, especialmente o QDD, em uma base organizada de ações temáticas que possam ser validadas pelas secretarias responsáveis e revisadas pela SEPLAN. No MVP, a estrutura vigente do QDD é carregada pela importação manual feita pela SEPLAN.

## Finalidade

A finalidade do sistema é criar um fluxo institucional para que a SEPLAN consiga:

- consultar a estrutura vigente do orçamento do Estado do Acre carregada a partir do QDD;
- atualizar a base vigente quando houver novo QDD oficial;
- consolidar programas, projetos e atividades orçamentárias por órgão e unidade administrativa;
- classificar manualmente quais ações pertencem a cada orçamento temático;
- permitir que uma mesma ação faça parte de mais de um tema;
- enviar as ações para validação das secretarias e autarquias responsáveis;
- garantir que cada secretaria visualize e edite somente as informações sob sua responsabilidade;
- receber informações sobre o que foi realizado, quais entregas foram feitas e quais evidências existem;
- revisar, aprovar ou devolver validações feitas pelas secretarias;
- produzir consultas, tabelas e gráficos para acompanhamento interno.

O sistema não substitui o processo de elaboração do orçamento. Ele organiza e monitora, de forma temática, informações já presentes no orçamento público e complementadas pelas secretarias.

## Dinâmica de uso

O fluxo principal pensado para o projeto é:

1. A SEPLAN importa o QDD oficial pela interface do sistema.
2. O sistema consolida a estrutura vigente do QDD em ações orçamentárias e preserva as linhas de despesa para consulta.
3. Quando houver novo QDD oficial, a SEPLAN pode substituir a base vigente pela importação manual.
4. A SEPLAN realiza a curadoria manual, marcando quais ações pertencem ao OSG, OCAD ou Orçamento Climático.
5. A SEPLAN informa eixo, classificação metodológica, ponderador quando necessário e justificativa da classificação.
6. A SEPLAN abre um ciclo de validação.
7. Cada secretaria acessa o sistema com login próprio e vê apenas suas ações.
8. A secretaria informa status da execução, descrição do realizado, entregas, quantidades, município, público beneficiado, valor executado informado, evidências e observações.
9. A secretaria envia a validação para a SEPLAN.
10. A SEPLAN revisa, podendo aprovar ou devolver para ajustes.

## Regras importantes do domínio

- A SEPLAN é o gestor central do sistema e possui visão completa sobre todos os órgãos, unidades, ações, classificações e validações.
- Representantes de secretarias e autarquias só podem visualizar e preencher informações vinculadas ao seu próprio órgão ou unidade.
- A unidade principal de validação é a ação consolidada, não cada linha individual do QDD.
- As linhas do QDD continuam preservadas como detalhamento consultivo da ação.
- A estrutura vigente do MVP é criada e atualizada pela importação manual de QDD.
- A importação manual de QDD funciona como atualização/substituição da base vigente.
- Uma ação pode pertencer a mais de um orçamento temático.
- A classificação temática é manual no MVP, feita pela equipe gestora da SEPLAN.
- O sistema deve registrar histórico mínimo de status da validação: rascunho, enviado, devolvido e aprovado.

## Orçamentos temáticos considerados

### Orçamento Sensível ao Gênero (OSG)

O OSG organiza ações orçamentárias relacionadas a políticas para mulheres, igualdade de gênero, enfrentamento à violência, autonomia econômica, direitos humanos, segurança, saúde, educação, governança e temas correlatos.

No sistema, o OSG deve permitir o registro de categoria metodológica, eixo temático e, quando aplicável, fator de ponderação.

### Orçamento da Criança e do Adolescente (OCAD)

O OCAD organiza ações voltadas a crianças e adolescentes, com foco em áreas como educação, saúde e assistência social.

No sistema, o OCAD deve permitir classificar ações como exclusivas ou não exclusivas, preservando a possibilidade de ponderação para ações que atendem parcialmente esse público.

### Orçamento Climático

O Orçamento Climático organiza ações relacionadas a mitigação, adaptação, desenvolvimento sustentável, bioeconomia, justiça climática, governança ambiental, educação ambiental, inovação, gestão de riscos e proteção civil.

No sistema, o Orçamento Climático deve permitir classificar a relação da ação com a pauta climática, inclusive quando a contribuição for indireta.

## Estrutura administrativa

O sistema precisa representar a estrutura administrativa do Estado do Acre a partir dos dados orçamentários:

- órgãos;
- secretarias;
- autarquias;
- fundos;
- unidades gestoras;
- programas, projetos e atividades vinculados a essas estruturas.

Essa estrutura é essencial para aplicar as regras de acesso. O usuário representante de uma secretaria deve conseguir validar apenas as informações pertencentes a sua secretaria.

No MVP, essa estrutura é gravada no banco a partir da importação do QDD, incluindo órgãos, unidades, aplicação programada, função programática, projeto atividade, conta de despesa, descrição da despesa e fonte de recurso.

## Estado atual do projeto

O projeto está estruturado como um monorepo com:

- `apps/web`: aplicação Next.js com frontend, API Routes, React, TypeScript, Tailwind CSS e shadcn/ui.

O MVP atual usa Prisma com PostgreSQL/Neon para persistir usuários, sessões, importações de QDD, ações orçamentárias, classificações temáticas, ciclos e validações.

## Tecnologias principais

Frontend:

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide React
- React Hook Form
- Zod
- TanStack Table
- Recharts

Backend:

- Next.js Route Handlers
- Prisma

Controle de acesso:

- RBAC, para perfis de usuário;
- ABAC, para restringir dados por órgão e unidade administrativa.

Banco de dados:

- PostgreSQL/Neon via Prisma.

## Perfis previstos

- SEPLAN Admin: administra importações, usuários, estrutura, curadoria temática e ciclos de validação.
- SEPLAN Revisor: revisa validações enviadas pelas secretarias.
- Representante de Secretaria: visualiza e preenche apenas as ações vinculadas ao seu órgão ou unidade.

## Escopo do MVP

O MVP deve priorizar:

- login próprio;
- estrutura vigente carregada por importação de QDD;
- atualização da base vigente por importação de novo QDD;
- consolidação das ações orçamentárias;
- curadoria manual dos três orçamentos temáticos;
- abertura de ciclos de validação;
- preenchimento pelas secretarias;
- revisão central pela SEPLAN;
- dashboards e tabelas internas para acompanhamento.

Ficam para etapas posteriores:

- auditoria completa;
- exportações oficiais mais robustas;
- publicação pública dos resultados;
- integração com sistemas institucionais de autenticação;
- gestão avançada de anexos e documentos.

## Observação de contexto

Este arquivo serve como memória interna do projeto. Ele deve permanecer na raiz da pasta do projeto para registrar, de forma permanente, o que o sistema é, qual problema resolve e quais decisões de domínio orientam seu desenvolvimento.

Ele não é utilizado diretamente pela aplicação web.
