# Sistema de Gestão dos Orçamentos Temáticos do Acre

MVP em monorepo para manter a estrutura vigente do QDD do Estado do Acre pré-carregada, consolidar ações orçamentárias, classificar manualmente nos orçamentos temáticos e validar entregas pelas secretarias.

## Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui-style components, Lucide React, React Hook Form, Zod, TanStack Table e Recharts.
- Backend: NestJS e TypeScript.
- Dados: armazenamento temporário em memória, iniciado com seed do QDD de referência, com contratos preparados para futura persistência em PostgreSQL/Neon.

## Scripts

```bash
npm install
npm run dev
```

API: `http://localhost:3001`

Web: `http://localhost:3000`

## Usuários de demonstração

- `admin@seplan.ac.gov.br` / `admin123` - SEPLAN Admin
- `revisor@seplan.ac.gov.br` / `revisor123` - SEPLAN Revisor
- `semulher@ac.gov.br` / `secretaria123` - Representante SEMULHER
- `sesacre@ac.gov.br` / `secretaria123` - Representante SESACRE

## Fluxo principal

1. Entrar como SEPLAN Admin.
2. Consultar a estrutura vigente já pré-carregada do QDD de referência.
3. Classificar ações em OCAD, OSG ou Climático, com eixo e metodologia.
4. Abrir ciclo de validação.
5. Entrar como representante de secretaria e preencher a validação.
6. Revisar e aprovar/devolver pela SEPLAN.

## Base vigente

A API nasce com uma seed gerada a partir de `QDD_Saldo_Retroativo_Execucao-1425-20260513.xls`, preservando órgãos, unidades, aplicações programadas, funções programáticas, projetos/atividades, contas de despesa, descrições, fontes e valores.

Para regenerar a seed depois de atualizar o arquivo de referência:

```bash
npm run generate:qdd-seed -w apps/api
```

A importação manual pela interface continua disponível como atualização/substituição da base vigente.
