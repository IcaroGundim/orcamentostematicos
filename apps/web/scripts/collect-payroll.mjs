// Coleta a folha de pagamento do Estado no Portal da Transparência e grava os
// AGREGADOS no banco. Nenhum nome ou matrícula é persistido.
//
// Uso:
//   DATABASE_URL="postgresql://..." node apps/web/scripts/collect-payroll.mjs
//   ... --ano=2026 --mes=1     (força um mês; sem isso usa o mais recente publicado)
//
// Roda no CI (.github/workflows/folha.yml) e pode ser executado localmente.
// É idempotente: recoletar o mesmo mês substitui os agregados daquele mês.

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Defina DATABASE_URL.');
  process.exit(1);
}

const BASE_URL = 'https://transparencia.ac.gov.br';
const USER_AGENT =
  'Mozilla/5.0 (compatible; SEPLAN-AC-OrcamentosTematicos/1.0; painel interno de transparencia)';
const PAGE_SIZE = 5000;
const REQUEST_DELAY_MS = 700;

const CONTRACT_TYPES = [
  'COMISSÃO',
  'CONTRATO CLT',
  'EFETIVO',
  'EFETIVO/COMISSÃO',
  'ELETIVO',
  'ESTAGIÁRIO',
  'PENSIONISTA',
  'TEMPORÁRIO',
];

/**
 * Situa\u00e7\u00e3o funcional do v\u00ednculo, direto do campo `situacao` do portal.
 *
 * N\u00e3o deduzimos a inatividade do tipo de contrato nem do \u00f3rg\u00e3o:
 * - pelo tipo de contrato escapavam ~14,5 mil aposentados, que constam como EFETIVO;
 * - pelo \u00f3rg\u00e3o (Instituto de Previd\u00eancia) entrariam por engano os ~48 servidores que
 *   de fato trabalham no instituto, e ficariam de fora ~690 inativos lotados noutros
 *   \u00f3rg\u00e3os (HANSENIANOS, SGA Aposentados/Pensionistas n\u00e3o previdenci\u00e1rios e afins).
 *
 * Valores observados: ATIVO, INATIVO, PENSIONISTA, EXONERADO/RESCISO. Guardamos o
 * valor bruto para n\u00e3o perder a distin\u00e7\u00e3o; quem consome trata tudo que n\u00e3o \u00e9 ATIVO
 * como inativo.
 */
const situacaoDoVinculo = (linha) => {
  const bruto = String(linha?.situacao ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
  return bruto || 'NAO INFORMADO';
};

const arg = (nome) => {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado ? Number(achado.split('=')[1]) : null;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * O portal derruba conexões esporadicamente em páginas grandes. Sem retentativa, a
 * coleta inteira se perde por uma falha isolada de rede — inaceitável num job diário.
 * Tenta de novo com espera crescente e timeout explícito por requisição.
 */
const MAX_TENTATIVAS = 4;
const TIMEOUT_MS = 120_000;

async function fetchComRetry(url, init, descricao) {
  let ultimoErro;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa += 1) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (erro) {
      ultimoErro = erro;
      if (tentativa === MAX_TENTATIVAS) break;
      const espera = 2000 * 2 ** (tentativa - 1); // 2s, 4s, 8s
      console.log(`  ⚠ ${descricao} falhou (${erro.message}); nova tentativa em ${espera / 1000}s…`);
      await sleep(espera);
    }
  }
  throw new Error(`${descricao}: ${ultimoErro?.message ?? 'falha desconhecida'}`);
}
const num = (v) => {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : 0;
};
const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const brl = (n) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

async function abrirSessao() {
  const res = await fetchComRetry(
    `${BASE_URL}/servidores`,
    { headers: { 'User-Agent': USER_AGENT } },
    'abrir sessão',
  );
  if (!res.ok) throw new Error(`Portal indisponível (HTTP ${res.status}).`);
  const html = await res.text();
  const token = html.match(/name="csrf-token" content="([^"]+)"/)?.[1];
  if (!token) throw new Error('csrf-token não encontrado — o portal pode ter mudado.');
  const cookies = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  return { cookies, token };
}

async function listar(sessao, { ano, mes, tipo = '', start = 0, length = 10 }) {
  const body = new URLSearchParams({
    draw: '1',
    start: String(start),
    length: String(length),
    ano: String(ano),
    mes: String(mes),
    orgao: '',
    filtro: '',
    busca: '',
    situacao: '',
    tipo_contrato: tipo,
    admissao: '',
    exoneracao: '',
    'order[0][column]': '0',
    'order[0][dir]': 'asc',
  });
  const res = await fetchComRetry(
    `${BASE_URL}/servidores/listar`,
    {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-TOKEN': sessao.token,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Referer: `${BASE_URL}/servidores`,
        Cookie: sessao.cookies,
      },
      body,
    },
    `listar ${tipo || 'todos'} (offset ${start})`,
  );
  if (!res.ok) throw new Error(`Falha ao listar (HTTP ${res.status}).`);
  return res.json();
}

/** O portal publica com atraso; volta no tempo até achar um mês com registros. */
async function mesMaisRecente(sessao, tentativas = 6) {
  const agora = new Date();
  let ano = agora.getUTCFullYear();
  let mes = agora.getUTCMonth() + 1;
  for (let i = 0; i < tentativas; i += 1) {
    const d = await listar(sessao, { ano, mes, length: 1 });
    if ((d.recordsTotal ?? 0) > 0) return { ano, mes };
    mes -= 1;
    if (mes === 0) {
      mes = 12;
      ano -= 1;
    }
    await sleep(REQUEST_DELAY_MS);
  }
  return null;
}

function acumular(mapa, chave, rotulo, linha, secundaria = null) {
  let b = mapa.get(chave);
  if (!b) {
    b = {
      key: rotulo,
      secondaryKey: secundaria,
      headcount: 0,
      grossTotal: 0,
      deductionsTotal: 0,
      netTotal: 0,
    };
    mapa.set(chave, b);
  }
  b.headcount += 1;
  b.grossTotal += num(linha.valor_bruto);
  b.deductionsTotal += num(linha.valor_desconto);
  b.netTotal += num(linha.valor_liquido);
}

async function main() {
  const sessao = await abrirSessao();

  const anoArg = arg('ano');
  const mesArg = arg('mes');
  const alvo =
    anoArg && mesArg ? { ano: anoArg, mes: mesArg } : await mesMaisRecente(sessao);

  if (!alvo) {
    console.error('Nenhum mês com dados encontrado nos últimos 6 meses.');
    process.exit(1);
  }

  const { ano, mes } = alvo;
  console.log(`Coletando folha ${String(mes).padStart(2, '0')}/${ano}…`);

  const totais = { headcount: 0, grossTotal: 0, deductionsTotal: 0, netTotal: 0 };
  const porTipo = new Map();
  const porOrgao = new Map();
  const porCarreira = new Map();
  const cruzado = new Map();

  for (const tipo of CONTRACT_TYPES) {
    let start = 0;
    let esperado = Infinity;

    while (start < esperado) {
      const pagina = await listar(sessao, { ano, mes, tipo, start, length: PAGE_SIZE });
      if (esperado === Infinity) {
        esperado = pagina.recordsTotal ?? 0;
        if (esperado === 0) break;
      }
      const linhas = pagina.data ?? [];
      if (!linhas.length) break;

      for (const linha of linhas) {
        const orgao = clean(linha.orgao) || 'Não informado';
        const carreira =
          clean(linha.cargo_efetivo) || clean(linha.cargo_comissao) || 'Não informado';

        totais.headcount += 1;
        totais.grossTotal += num(linha.valor_bruto);
        totais.deductionsTotal += num(linha.valor_desconto);
        totais.netTotal += num(linha.valor_liquido);

        acumular(porTipo, tipo, tipo, linha);
        acumular(porOrgao, orgao, orgao, linha);
        // A carreira guarda a situação em `secondaryKey` em vez de descartar os
        // inativos: descartar na coleta impediria qualquer filtro na interface, já
        // que o dado nunca chegaria ao banco. Com a marca, a tela decide se inclui.
        const situacao = situacaoDoVinculo(linha);
        acumular(porCarreira, `${carreira}||${situacao}`, carreira, linha, situacao);
        acumular(cruzado, `${orgao}||${tipo}`, orgao, linha, tipo);
      }

      start += linhas.length;
      if (start < esperado) await sleep(REQUEST_DELAY_MS);
    }

    const b = porTipo.get(tipo);
    console.log(
      `  ${tipo.padEnd(18)} ${String(b?.headcount ?? 0).padStart(6)} vínculo(s) · ${brl(b?.grossTotal ?? 0)}`,
    );
    await sleep(REQUEST_DELAY_MS);
  }

  const conferencia = await listar(sessao, { ano, mes, length: 1 });
  const portalHeadcount = conferencia.recordsTotal ?? totais.headcount;

  console.log(
    `\nTotal: ${totais.headcount.toLocaleString('pt-BR')} vínculo(s) · ${brl(totais.grossTotal)} bruto`,
  );
  if (portalHeadcount !== totais.headcount) {
    console.log(
      `Aviso: portal informa ${portalHeadcount.toLocaleString('pt-BR')} sem filtro ` +
        `(${portalHeadcount - totais.headcount} sem tipo de contrato definido).`,
    );
  }

  if (totais.headcount === 0) {
    console.error('Coleta vazia — nada será gravado.');
    process.exit(1);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

  const grupos = [
    ...[...porTipo.values()].map((g) => ({ ...g, dimension: 'CONTRACT_TYPE' })),
    ...[...porOrgao.values()].map((g) => ({ ...g, dimension: 'ORGANIZATION' })),
    ...[...porCarreira.values()].map((g) => ({ ...g, dimension: 'CAREER' })),
    ...[...cruzado.values()].map((g) => ({ ...g, dimension: 'ORGANIZATION_CONTRACT' })),
  ];

  // Substitui o mês inteiro numa transação: ou o snapshot novo entra completo, ou
  // o anterior permanece. Evita deixar o painel com dados pela metade.
  await prisma.$transaction(
    async (tx) => {
      await tx.payrollSnapshot.deleteMany({ where: { year: ano, month: mes } });
      const snapshot = await tx.payrollSnapshot.create({
        data: {
          year: ano,
          month: mes,
          headcount: totais.headcount,
          portalHeadcount,
          grossTotal: totais.grossTotal,
          deductionsTotal: totais.deductionsTotal,
          netTotal: totais.netTotal,
        },
      });
      await tx.payrollGroup.createMany({
        data: grupos.map((g) => ({
          snapshotId: snapshot.id,
          dimension: g.dimension,
          key: g.key,
          secondaryKey: g.secondaryKey,
          headcount: g.headcount,
          grossTotal: g.grossTotal,
          deductionsTotal: g.deductionsTotal,
          netTotal: g.netTotal,
        })),
      });
    },
    { maxWait: 30_000, timeout: 60_000 },
  );

  await prisma.$disconnect();

  console.log(
    `\nGravado: ${grupos.length} linha(s) agregada(s) ` +
      `(${porTipo.size} tipos, ${porOrgao.size} órgãos, ${porCarreira.size} carreiras, ${cruzado.size} cruzamentos).`,
  );
}

main().catch((erro) => {
  console.error('Falha na coleta:', erro.message);
  process.exit(1);
});
