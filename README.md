# Sistema de Gestão dos Orçamentos Temáticos do Acre

MVP em monorepo para importar a estrutura vigente do QDD do Estado do Acre, consolidar ações orçamentárias, classificar manualmente nos orçamentos temáticos e validar entregas pelas secretarias.

## Stack

- Aplicação: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui-style components, Lucide React, React Hook Form, Zod, TanStack Table e Recharts.
- API: Route Handlers do Next.js em `/api`.
- Dados: Prisma com PostgreSQL/Neon.
- Deploy: Vercel.

## Scripts

```bash
npm install
npm run dev
```

Web: `http://localhost:3000`

API interna: `http://localhost:3000/api`

## Usuários de demonstração

- `admin@seplan.ac.gov.br` / `admin123` - SEPLAN Admin
- `revisor@seplan.ac.gov.br` / `revisor123` - SEPLAN Revisor
- `semulher@ac.gov.br` / `secretaria123` - Representante SEMULHER
- `sesacre@ac.gov.br` / `secretaria123` - Representante SESACRE

## Fluxo principal

1. Entrar como SEPLAN Admin.
2. Importar ou consultar a estrutura vigente do QDD.
3. Classificar ações em OCAD, OSG ou Climático, com eixo e metodologia.
4. Abrir ciclo de validação.
5. Entrar como representante de secretaria e preencher a validação.
6. Revisar e aprovar/devolver pela SEPLAN.

## Base vigente e importação

O sistema permite importar manualmente um QDD em `.xls` ou `.xlsx` pela interface da SEPLAN. A prévia consolida as linhas do QDD em ações orçamentárias; ao confirmar, o QDD é registrado como base vigente, preservando órgãos, unidades, aplicações programadas, funções programáticas, projetos/atividades, contas de despesa, descrições, fontes e valores.

Ao registrar um novo QDD, importações vigentes anteriores são marcadas como histórico.
