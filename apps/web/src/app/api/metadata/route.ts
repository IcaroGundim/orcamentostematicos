import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized } from '@/lib/auth-server';
import { resolveRequestYear } from '@/lib/exercise-request';
import { prisma } from '@/lib/prisma';
import { getCurrentYear, listExercises } from '@/lib/store';

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
    { value: 'CATEGORIA_1', label: 'Categoria 1 - Exclusivo para mulheres' },
    { value: 'CATEGORIA_2', label: 'Categoria 2 - Não exclusivo (Previsto no PPA)' },
    { value: 'CATEGORIA_3', label: 'Categoria 3 - Não exclusivo (Não previsto no PPA)' },
  ],
  CLIMATICO: [
    { value: 'EXCLUSIVA', label: 'Exclusiva' },
    { value: 'INDIRETA', label: 'Não Exclusivo' },
  ],
};

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const exercise = await resolveRequestYear(req, user);
  if (exercise.response) return exercise.response;

  const [allExercises, currentYear] = await Promise.all([listExercises(), getCurrentYear()]);

  // Exercícios apenas comparativos são exclusivos da SEPLAN — as secretarias nem
  // chegam a vê-los no seletor.
  const exercises =
    user.role === 'SEPLAN_ADMIN' ? allExercises : allExercises.filter((e) => !e.comparisonOnly);

  const selectedYear = exercise.year;
  // `vigenteImport` continua sendo o do exercício selecionado: o campo é o mesmo de
  // antes, então nenhum consumidor precisou mudar.
  const vigenteImport =
    selectedYear == null
      ? null
      : await prisma.budgetImport.findFirst({
          where: { status: 'VIGENTE', year: selectedYear },
          orderBy: { importedAt: 'desc' },
        });

  return ok({
    themes: ['OCAD', 'OSG', 'CLIMATICO'],
    axes: THEME_AXES,
    classifications: THEME_CLASSIFICATIONS,
    validationStatuses: ['RASCUNHO', 'ENVIADO', 'DEVOLVIDO', 'APROVADO'],
    exercises: exercises.map((e) => ({
      year: e.year,
      comparisonOnly: e.comparisonOnly,
      isCurrent: e.isCurrent,
    })),
    currentYear,
    year: selectedYear,
    comparisonOnly: exercises.find((e) => e.year === selectedYear)?.comparisonOnly ?? false,
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
