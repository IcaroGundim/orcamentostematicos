import 'server-only';

/**
 * Coleta da folha de pagamento no Portal da Transparência do Acre.
 *
 * O portal não publica API documentada nem arquivo de dados abertos, mas a própria
 * página `/servidores` consome uma API JSON (Laravel + DataTables server-side) que
 * está liberada para acesso automatizado — o `robots.txt` traz `Disallow:` vazio e o
 * rodapé declara licença aberta.
 *
 * **Privacidade:** a resposta traz nome e matrícula de cada servidor. Nada disso sai
 * daqui: {@link collectPayroll} devolve apenas somas por carreira, tipo de contrato e
 * órgão. Não persistimos dado pessoal identificável.
 *
 * **Fragilidade conhecida:** é um endpoint interno, não um contrato público. Pode
 * mudar sem aviso — por isso o parsing é defensivo e a coleta é isolada do resto do
 * sistema (a aba do painel lê do banco, nunca do portal em tempo real).
 */

const BASE_URL = 'https://transparencia.ac.gov.br';
const USER_AGENT =
  'Mozilla/5.0 (compatible; SEPLAN-AC-OrcamentosTematicos/1.0; painel interno de transparencia)';

/** Registros por requisição. 5.000 responde em ~4s; acima disso o payload fica pesado. */
const PAGE_SIZE = 5000;
/** Pausa entre requisições, para não pressionar o portal. */
const REQUEST_DELAY_MS = 700;

/**
 * Tipos de contrato conforme `/servidores/contratos`.
 *
 * O campo `contrato` que vem em cada registro **não** é o tipo — é o número
 * sequencial do vínculo daquela matrícula. O tipo só existe como filtro de entrada,
 * então é preciso uma consulta por tipo.
 */
export const CONTRACT_TYPES = [
  'COMISSÃO',
  'CONTRATO CLT',
  'EFETIVO',
  'EFETIVO/COMISSÃO',
  'ELETIVO',
  'ESTAGIÁRIO',
  'PENSIONISTA',
  'TEMPORÁRIO',
] as const;

export type ContractType = (typeof CONTRACT_TYPES)[number];

/**
 * Situação funcional do vínculo, direto do campo `situacao` do portal.
 *
 * Não deduzimos inatividade do tipo de contrato nem do órgão:
 * - pelo tipo de contrato escapavam ~14,5 mil aposentados, que constam como EFETIVO;
 * - pelo órgão (Instituto de Previdência) entrariam por engano os ~48 servidores que
 *   de fato trabalham no instituto, e ficariam de fora ~690 inativos lotados noutros
 *   órgãos (HANSENIANOS, SGA Aposentados/Pensionistas não previdenciários e afins).
 *
 * Valores observados: ATIVO, INATIVO, PENSIONISTA, EXONERADO/RESCISO. Guardamos o
 * valor bruto para não perder a distinção; quem consome trata o que não é ATIVO
 * como inativo.
 */
function situacaoOf(row: PortalRow): string {
  return clean(row.situacao).toUpperCase() || 'NAO INFORMADO';
}

/** Linha crua devolvida pelo portal (só os campos que usamos). */
interface PortalRow {
  orgao?: string | null;
  cargo_efetivo?: string | null;
  cargo_comissao?: string | null;
  situacao?: string | null;
  valor_bruto?: string | number | null;
  valor_desconto?: string | number | null;
  valor_liquido?: string | number | null;
}

interface PortalResponse {
  recordsTotal?: number;
  data?: PortalRow[];
}

export interface PayrollTotals {
  headcount: number;
  grossTotal: number;
  deductionsTotal: number;
  netTotal: number;
}

export interface PayrollGroup extends PayrollTotals {
  key: string;
  label: string;
}

/** Cruzamento órgão × tipo de contrato — quantos vínculos de cada tipo por órgão. */
export interface PayrollOrganizationContract extends PayrollTotals {
  organization: string;
  contractType: string;
}

export interface PayrollSnapshot {
  year: number;
  month: number;
  collectedAt: string;
  totals: PayrollTotals;
  /**
   * Total que o portal informa sem nenhum filtro. Guardado junto para tornar
   * verificável a diferença em relação a `totals.headcount`: a varredura é feita por
   * tipo de contrato, e o portal tem alguns vínculos sem tipo definido que não podem
   * ser isolados (filtrar por tipo vazio devolve a base inteira). Em 01/2026 a
   * diferença era de 2 em 53.985. Se um dia crescer, fica evidente em vez de sumir.
   */
  portalHeadcount: number;
  byContractType: PayrollGroup[];
  byOrganization: PayrollGroup[];
  byCareer: PayrollGroup[];
  byOrganizationContract: PayrollOrganizationContract[];
}

interface PortalSession {
  cookies: string;
  token: string;
}

function toNumber(value: unknown): number {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

/** O portal devolve texto com espaços de preenchimento à direita. */
function clean(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Abre sessão e captura o CSRF: o endpoint de listagem exige ambos, da mesma sessão. */
async function openSession(): Promise<PortalSession> {
  const response = await fetch(`${BASE_URL}/servidores`, {
    headers: { 'User-Agent': USER_AGENT },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Portal indisponível ao abrir sessão (HTTP ${response.status}).`);

  const html = await response.text();
  const token = html.match(/name="csrf-token" content="([^"]+)"/)?.[1];
  if (!token) throw new Error('csrf-token não encontrado na página do portal.');

  const cookies = (response.headers.getSetCookie?.() ?? [])
    .map((cookie) => cookie.split(';')[0])
    .join('; ');

  return { cookies, token };
}

async function fetchPage(
  session: PortalSession,
  params: { year: number; month: number; contractType: string; start: number; length: number },
): Promise<PortalResponse> {
  const body = new URLSearchParams({
    draw: '1',
    start: String(params.start),
    length: String(params.length),
    ano: String(params.year),
    mes: String(params.month),
    orgao: '',
    filtro: '',
    busca: '',
    situacao: '',
    tipo_contrato: params.contractType,
    admissao: '',
    exoneracao: '',
    'order[0][column]': '0',
    'order[0][dir]': 'asc',
  });

  const response = await fetch(`${BASE_URL}/servidores/listar`, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-TOKEN': session.token,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Referer: `${BASE_URL}/servidores`,
      Cookie: session.cookies,
    },
    body,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Falha ao listar servidores (HTTP ${response.status}).`);
  }
  return (await response.json()) as PortalResponse;
}

/** Acumulador mutável, convertido em {@link PayrollGroup} no fim. */
type Bucket = PayrollTotals & { label: string };

function bucketOf(map: Map<string, Bucket>, key: string, label: string): Bucket {
  let bucket = map.get(key);
  if (!bucket) {
    bucket = { label, headcount: 0, grossTotal: 0, deductionsTotal: 0, netTotal: 0 };
    map.set(key, bucket);
  }
  return bucket;
}

function addRow(bucket: PayrollTotals, row: PortalRow): void {
  bucket.headcount += 1;
  bucket.grossTotal += toNumber(row.valor_bruto);
  bucket.deductionsTotal += toNumber(row.valor_desconto);
  bucket.netTotal += toNumber(row.valor_liquido);
}

function toGroups(map: Map<string, Bucket>): PayrollGroup[] {
  return [...map.entries()]
    .map(([key, bucket]) => ({ key, ...bucket }))
    .sort((a, b) => b.grossTotal - a.grossTotal);
}

/**
 * A carreira é o cargo efetivo; quando ele não existe (comissionado puro), cai no
 * cargo em comissão. Sem nenhum dos dois, o vínculo é agrupado como não informado.
 */
function careerOf(row: PortalRow): string {
  return clean(row.cargo_efetivo) || clean(row.cargo_comissao) || 'Não informado';
}

/**
 * Percorre a folha do mês e devolve **apenas agregados**.
 *
 * Faz uma varredura por tipo de contrato (o portal não devolve o tipo na linha),
 * paginando em blocos de {@link PAGE_SIZE} com pausa entre requisições.
 */
export async function collectPayroll(
  year: number,
  month: number,
  options: { onProgress?: (message: string) => void } = {},
): Promise<PayrollSnapshot> {
  const report = options.onProgress ?? (() => {});
  const session = await openSession();

  const totals: PayrollTotals = { headcount: 0, grossTotal: 0, deductionsTotal: 0, netTotal: 0 };
  const byContractType = new Map<string, Bucket>();
  const byOrganization = new Map<string, Bucket>();
  const byCareer = new Map<string, Bucket>();
  const byOrgContract = new Map<string, PayrollOrganizationContract>();

  for (const contractType of CONTRACT_TYPES) {
    let start = 0;
    let expected = Infinity;

    while (start < expected) {
      const page = await fetchPage(session, {
        year,
        month,
        contractType,
        start,
        length: PAGE_SIZE,
      });

      if (expected === Infinity) {
        expected = page.recordsTotal ?? 0;
        report(`${contractType}: ${expected.toLocaleString('pt-BR')} registro(s)`);
        if (expected === 0) break;
      }

      const rows = page.data ?? [];
      if (rows.length === 0) break;

      for (const row of rows) {
        const organization = clean(row.orgao) || 'Não informado';
        const career = careerOf(row);

        addRow(totals, row);
        addRow(bucketOf(byContractType, contractType, contractType), row);
        addRow(bucketOf(byOrganization, organization, organization), row);
        // Inativos são marcados, não descartados — descartar na coleta tornaria
        // impossível oferecer o filtro na interface.
        const activity = situacaoOf(row);
        addRow(bucketOf(byCareer, `${career}||${activity}`, career), row);

        const crossKey = `${organization}||${contractType}`;
        let cross = byOrgContract.get(crossKey);
        if (!cross) {
          cross = {
            organization,
            contractType,
            headcount: 0,
            grossTotal: 0,
            deductionsTotal: 0,
            netTotal: 0,
          };
          byOrgContract.set(crossKey, cross);
        }
        addRow(cross, row);
      }

      start += rows.length;
      if (start < expected) await sleep(REQUEST_DELAY_MS);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  // Conferência: total do portal sem filtro, para a diferença ficar auditável.
  const unfiltered = await fetchPage(session, {
    year,
    month,
    contractType: '',
    start: 0,
    length: 1,
  });

  return {
    year,
    month,
    collectedAt: new Date().toISOString(),
    totals,
    portalHeadcount: unfiltered.recordsTotal ?? totals.headcount,
    byContractType: toGroups(byContractType),
    byOrganization: toGroups(byOrganization),
    byCareer: toGroups(byCareer),
    byOrganizationContract: [...byOrgContract.values()].sort(
      (a, b) => b.grossTotal - a.grossTotal,
    ),
  };
}

/**
 * Mês de referência mais recente com dados publicados.
 *
 * O portal publica a folha com atraso, então o mês corrente normalmente ainda está
 * vazio. Volta no tempo a partir do mês atual até achar um com registros.
 */
export async function findLatestPublishedMonth(
  maxLookback = 6,
): Promise<{ year: number; month: number } | null> {
  const session = await openSession();
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth() + 1;

  for (let attempt = 0; attempt < maxLookback; attempt += 1) {
    const page = await fetchPage(session, {
      year,
      month,
      contractType: '',
      start: 0,
      length: 1,
    });
    if ((page.recordsTotal ?? 0) > 0) return { year, month };

    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    await sleep(REQUEST_DELAY_MS);
  }

  return null;
}
