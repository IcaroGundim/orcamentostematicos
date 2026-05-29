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

## Desenvolvimento local (banco de dados)

O login e as APIs usam PostgreSQL (Neon) via Prisma. Sem `DATABASE_URL`, o login falha com erro de API.

1. Gere o `.env.local` com a URL do Neon (recomendado):

```powershell
npx neonctl auth
.\scripts\setup-local-env.ps1
```

Ou copie `apps/web/.env.example` para `apps/web/.env.local` e cole `DATABASE_URL` manualmente (Vercel → Settings → Environment Variables → Reveal, ou [Neon Console](https://console.neon.tech)). O `vercel env pull` costuma deixar `DATABASE_URL` vazio por causa da integração Neon.

2. Aplique migrações e usuários de teste:

```bash
cd apps/web
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

3. Reinicie `npm run dev` na raiz do monorepo (obrigatório após alterar `.env.local`).

Credenciais padrão do seed: `admin@seplan.ac.gov.br` / `admin123` (SEPLAN).


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
