import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';

const THEME_AXES = {
  OCAD: [
    { value: 'EDUCACAO', label: 'Educação' },
    { value: 'SAUDE', label: 'Saúde' },
    { value: 'ASSISTENCIA_SOCIAL', label: 'Assistência Social' },
  ],
  OSG: [
    { value: 'ASSISTENCIA_SOCIAL_DIREITOS_HUMANOS', label: 'Assistência Social e Direitos Humanos' },
    { value: 'EDUCACAO', label: 'Educação' },
    { value: 'SAUDE', label: 'Saúde' },
    { value: 'SEGURANCA', label: 'Segurança' },
    { value: 'ECONOMICO', label: 'Econômico' },
    { value: 'GOVERNANCA', label: 'Governança' },
  ],
  CLIMATICO: [
    { value: 'DESENVOLVIMENTO_SUSTENTAVEL_BIOECONOMIA', label: 'Desenvolvimento sustentável e bioeconomia' },
    { value: 'MITIGACAO', label: 'Mitigação das mudanças climáticas' },
    { value: 'ADAPTACAO', label: 'Adaptação climática' },
    { value: 'JUSTICA_CLIMATICA_INCLUSAO_SOCIAL', label: 'Justiça climática e inclusão social' },
    { value: 'GOVERNANCA_AMBIENTAL_TRANSPARENCIA', label: 'Governança ambiental e transparência' },
    { value: 'EDUCACAO_AMBIENTAL_INOVACAO', label: 'Educação ambiental e inovação' },
    { value: 'GESTAO_RISCOS_PROTECAO_CIVIL', label: 'Gestão de riscos e proteção civil' },
  ],
};

const THEME_CLASSIFICATIONS = {
  OCAD: [
    { value: 'EXCLUSIVO', label: 'Exclusivo' },
    { value: 'NAO_EXCLUSIVO', label: 'Não exclusivo' },
  ],
  OSG: [
    { value: 'CATEGORIA_1', label: 'Categoria 1 - dotação exclusiva para mulheres' },
    { value: 'CATEGORIA_2', label: 'Categoria 2 - dotação genérica estratégica' },
    { value: 'CATEGORIA_3', label: 'Categoria 3 - dotação genérica não estratégica' },
  ],
  CLIMATICO: [
    { value: 'EXCLUSIVA', label: 'Exclusiva' },
    { value: 'INDIRETA', label: 'Não Exclusivo' },
  ],
};

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const vigenteImport = await prisma.budgetImport.findFirst({ where: { status: 'VIGENTE' } });

  return ok({
    themes: ['OCAD', 'OSG', 'CLIMATICO'],
    axes: THEME_AXES,
    classifications: THEME_CLASSIFICATIONS,
    validationStatuses: ['RASCUNHO', 'ENVIADO_REVISOR', 'DEVOLVIDO_REVISOR', 'ENVIADO', 'DEVOLVIDO', 'APROVADO'],
    vigenteImport: vigenteImport ? {
      id: vigenteImport.id,
      filename: vigenteImport.filename,
      year: vigenteImport.year,
      referenceMonth: vigenteImport.referenceMonth,
      periodType: vigenteImport.periodType,
      importedAt: vigenteImport.importedAt.toISOString(),
      rowCount: vigenteImport.rowCount,
      actionCount: vigenteImport.actionCount,
      status: vigenteImport.status,
    } : null,
  });
}
