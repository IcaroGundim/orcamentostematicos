// Coleta a receita do Estado no Portal da Transparência e grava os AGREGADOS por
// categoria (tributo, transferência…) e mês na tabela RevenueMonth. Só agregados de
// natureza de receita — o dado já é público e não identifica pessoa.
//
// Uso:
//   npm run collect:revenue -- --dry-run      (em apps/web; lê o DATABASE_URL do .env.local)
//   DATABASE_URL="postgresql://..." node apps/web/scripts/collect-revenue.mjs
//   ... --ano=2026        (só esse exercício)
//   ... --ano=2016-2025   (uma faixa: é assim que a série histórica foi carregada)
//   ... --dry-run         (consulta e mostra os totais, sem gravar)
//
// Sem --ano, coleta o ano corrente, o anterior (o portal ainda lança ajustes de
// encerramento no começo do ano) e os exercícios com QDD. Os anos mais antigos da
// série histórica não mudam e não são recoletados toda semana.
//
// Roda no CI toda semana (.github/workflows/receitas.yml) e pode ser executado
// localmente. É idempotente: recoletar um exercício substitui todas as linhas dele.
//
// A classificação NÃO é copiada aqui: importamos src/lib/revenue.ts direto (o Node
// ≥ 22.18 remove os tipos sozinho), a mesma que a rota usa para montar o resumo.
//
// Parâmetros do portal que não são óbvios (conferidos em 2026-10-15): `orgao=0`
// (vazio derruba a rota com HTTP 500), `filtro=0`, `periodo=3` com `mes` para um mês
// só, e `periodoReceitaArrecadada=2`. O `arrecadado` que volta é do mês, não
// acumulado; a previsão é a anual, repetida em todo mês.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { bucketRevenue, summarizeRevenue } from '../src/lib/revenue.ts';

// Rodando local (`npm run collect:revenue` em apps/web), lê o DATABASE_URL do
// .env.local, como o db:push; no CI o arquivo não existe e vale o secret.
const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
config({ path: path.resolve(webDir, '.env.local'), quiet: true });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Defina DATABASE_URL.');
  process.exit(1);
}

const BASE_URL = 'https://transparencia.ac.gov.br';
const USER_AGENT =
  'Mozilla/5.0 (compatible; SEPLAN-AC-OrcamentosTematicos/1.0; painel interno de transparencia)';
/** Linhas por consulta; um mês tem ~900, então uma página basta. */
const PAGE_SIZE = 5000;
/** Pausa entre consultas, para não pressionar o portal. */
const REQUEST_DELAY_MS = 400;
const MAX_TENTATIVAS = 4;
const TIMEOUT_MS = 60_000;

const arg = (nome) => {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado ? achado.split('=').slice(1).join('=') : null;
};

/** `--ano=2026` ou `--ano=2016-2025` → lista de anos; `null` sem o argumento. */
function anosPedidos() {
  const valor = arg('ano');
  if (valor == null) return null;
  const [inicio, fim = inicio] = valor.split('-').map(Number);
  if (!Number.isInteger(inicio) || !Number.isInteger(fim) || inicio < 1996 || fim < inicio || fim > 2100) {
    console.error('Use --ano=AAAA ou --ano=AAAA-AAAA (o portal começa em 1996).');
    process.exit(1);
  }
  return Array.from({ length: fim - inicio + 1 }, (_, i) => inicio + i);
}
const DRY_RUN = process.argv.includes('--dry-run');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ano e mês correntes em Rio Branco: não se consulta mês que ainda não começou. */
function anoMesCorrente() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Rio_Branco',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date());
  const pega = (tipo) => Number(partes.find((p) => p.type === tipo)?.value);
  return { ano: pega('year'), mes: pega('month') };
}

/** O portal derruba conexões de vez em quando; uma falha isolada não pode perder a semana. */
async function fetchComRetry(url, init, descricao) {
  for (let tentativa = 1; ; tentativa++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.status >= 500 && tentativa < MAX_TENTATIVAS) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (erro) {
      if (tentativa >= MAX_TENTATIVAS) throw erro;
      const espera = 2_000 * tentativa;
      console.log(`  ${descricao}: ${erro.message} — nova tentativa em ${espera / 1000}s`);
      await sleep(espera);
    }
  }
}

async function abrirSessao() {
  const res = await fetchComRetry(`${BASE_URL}/receitas`, { headers: { 'User-Agent': USER_AGENT } }, 'sessão');
  if (!res.ok) throw new Error(`Portal indisponível (HTTP ${res.status}).`);
  const html = await res.text();
  const token = html.match(/name="csrf-token" content="([^"]+)"/)?.[1];
  if (!token) throw new Error('csrf-token não encontrado — o portal pode ter mudado.');
  const cookie = res.headers
    .getSetCookie()
    .map((raw) => raw.split(';')[0])
    .join('; ');
  return { token, cookie };
}

async function linhasDoMes(sessao, ano, mes) {
  const body = new URLSearchParams({
    draw: '1',
    start: '0',
    length: String(PAGE_SIZE),
    'order[0][column]': '0',
    'order[0][dir]': 'asc',
    ano: String(ano),
    orgao: '0',
    filtro: '0',
    fonte: '',
    busca: '',
    periodo: '3',
    periodoReceitaArrecadada: '2',
    inicio: '',
    fim: '',
    mes: String(mes).padStart(2, '0'),
  });
  const res = await fetchComRetry(
    `${BASE_URL}/receitas/listar`,
    {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        Cookie: sessao.cookie,
        'X-CSRF-TOKEN': sessao.token,
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Referer: `${BASE_URL}/receitas`,
      },
      body,
    },
    `${mes}/${ano}`,
  );
  if (!res.ok) throw new Error(`${mes}/${ano}: portal respondeu HTTP ${res.status}.`);
  const json = await res.json();
  const linhas = Array.isArray(json.data) ? json.data : [];
  // Uma página só: se o portal passar de PAGE_SIZE, somar o que veio esconderia o resto.
  if ((json.recordsTotal ?? linhas.length) > linhas.length) {
    throw new Error(`${mes}/${ano}: ${json.recordsTotal} linhas não cabem numa consulta.`);
  }
  if (!linhas.length) throw new Error(`${mes}/${ano}: o portal não devolveu nenhuma linha.`);
  return linhas;
}

const mi = (valor) => `R$ ${(valor / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;

async function main() {
  const agora = anoMesCorrente();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
  let falhas = 0;
  try {
    const anos =
      anosPedidos() ??
      [
        ...new Set([
          agora.ano - 1,
          agora.ano,
          // Os exercícios do seletor do painel (`loadExercises`): um por BudgetImport.
          ...(
            await prisma.budgetImport.findMany({ distinct: ['year'], select: { year: true } })
          ).map((imp) => imp.year),
        ]),
      ]
        .filter((ano) => ano <= agora.ano)
        .sort((a, b) => a - b);
    if (!anos.length) {
      console.error('Nenhum exercício para coletar.');
      process.exit(1);
    }

    const sessao = await abrirSessao();
    for (const ano of anos) {
      const ultimoMes = ano < agora.ano ? 12 : ano === agora.ano ? agora.mes : 0;
      if (!ultimoMes) {
        console.log(`${ano}: exercício ainda não começou — ignorado.`);
        continue;
      }
      try {
        const meses = [];
        for (let mes = 1; mes <= ultimoMes; mes++) {
          meses.push({ month: mes, rows: await linhasDoMes(sessao, ano, mes) });
          await sleep(REQUEST_DELAY_MS);
        }
        const buckets = bucketRevenue(ano, meses);
        const resumo = summarizeRevenue(ano, buckets);
        console.log(
          `${ano}: ${ultimoMes} meses, ${meses.reduce((t, m) => t + m.rows.length, 0)} linhas → ` +
            `${buckets.length} agregados; líquido ${mi(resumo.netTotal)} ` +
            `(bruto ${mi(resumo.grossTotal)}, deduções ${mi(resumo.deductionsTotal)}), ` +
            `previsão atualizada ${mi(resumo.updatedForecast)}`,
        );
        if (DRY_RUN) continue;

        // O exercício inteiro numa transação: ou entra completo, ou o anterior fica.
        await prisma.$transaction(
          async (tx) => {
            await tx.revenueMonth.deleteMany({ where: { year: ano } });
            await tx.revenueMonth.createMany({
              data: buckets.map((b) => ({
                year: ano,
                month: b.month,
                category: b.category,
                gross: b.gross,
                deductions: b.deductions,
                forecast: b.forecast,
                updatedForecast: b.updatedForecast,
              })),
            });
          },
          { maxWait: 30_000, timeout: 60_000 },
        );
        console.log(`${ano}: gravado.`);
      } catch (erro) {
        // Um ano com falha não derruba os outros; o job termina com erro no fim.
        falhas++;
        console.error(`${ano}: falhou — ${erro.message}. Os dados anteriores desse exercício foram mantidos.`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
  if (falhas) process.exit(1);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
