// Coleta o QDD "Saldo Retroativo — Execução" (vTIPOREL=2) do SICAF/SEFAZ-AC e
// entrega o Excel nativo à rota /imports/qdd/from-sicaf do app. A rota usa o mesmo
// parser do upload manual e cria somente uma PRÉVIA, ainda sujeita à confirmação da
// SEPLAN.
//
// Uso:
//   SICAF_CPF=... SICAF_SENHA=... SICAF_JOB_TOKEN=... APP_URL=https://... \
//     node apps/web/scripts/fetch-sicaf-qdd.mjs [--exercicio=2026] [--mes=8] [--dry-run]
//
// O SICAF é GeneXus/WorkWithPlus. A troca de exercício reproduz os três eventos da
// interface (abrir seletor, selecionar linha e atualizar o contexto); a exportação usa
// o postback DOEXCEL, que responde com um redirect para app.adownloadarquivos.

import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCipheriv } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import * as XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEBUG_DIR = join(__dirname, '.sicaf-debug');

const BASE_URL = 'https://sicaf.sefaz.ac.gov.br/sicaf';
const USER_AGENT =
  'Mozilla/5.0 (compatible; SEPLAN-AC-OrcamentosTematicos/1.0; coleta interna do QDD)';
const TIMEOUT_MS = 120_000;

const CPF = process.env.SICAF_CPF;
const SENHA = process.env.SICAF_SENHA;
const JOB_TOKEN = process.env.SICAF_JOB_TOKEN;
const APP_URL = (process.env.APP_URL ?? '').replace(/\/$/, '');

const arg = (nome) => {
  const encontrado = process.argv.find((value) => value.startsWith(`--${nome}=`));
  return encontrado ? encontrado.split('=').slice(1).join('=') : null;
};
const hasFlag = (nome) => process.argv.includes(`--${nome}`);

const DRY_RUN = hasFlag('dry-run');
const agora = new Date();
const EXERCICIO = Number(arg('exercicio') ?? agora.getFullYear());
const MES = Number(arg('mes') ?? agora.getMonth() + 1);

if (!Number.isInteger(EXERCICIO) || EXERCICIO < 2000 || EXERCICIO > 2100) {
  console.error('Informe --exercicio=AAAA entre 2000 e 2100.');
  process.exit(1);
}
if (!Number.isInteger(MES) || MES < 1 || MES > 12) {
  console.error('Informe --mes=1..12.');
  process.exit(1);
}
if (!CPF || !SENHA) {
  console.error('Defina SICAF_CPF e SICAF_SENHA.');
  process.exit(1);
}
if (!DRY_RUN && (!APP_URL || !JOB_TOKEN)) {
  console.error('Defina APP_URL e SICAF_JOB_TOKEN (ou rode com --dry-run).');
  process.exit(1);
}

// Último recurso para runners cujo trust store não aceite o certificado da SEFAZ.
// A opção é removida antes do POST autenticado ao app.
const INSECURE_TLS = process.env.SICAF_INSECURE_TLS === '1';
if (INSECURE_TLS) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.warn('⚠ TLS sem verificação de certificado durante a coleta no SICAF.');
}

// O fetch do Node não persiste cookies.
const cookies = new Map();
const applySetCookie = (res) => {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const raw of list) {
    const [pair] = raw.split(';');
    const separator = pair.indexOf('=');
    if (separator > 0) {
      cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
    }
  }
};
const cookieHeader = () => [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ');

let debugSeq = 0;
const dumpDebug = (nome, corpo) => {
  try {
    mkdirSync(DEBUG_DIR, { recursive: true });
    const arquivo = join(DEBUG_DIR, `${String(++debugSeq).padStart(2, '0')}-${nome}.txt`);
    writeFileSync(arquivo, typeof corpo === 'string' ? corpo : JSON.stringify(corpo, null, 2));
    console.error(`  ↳ resposta salva em ${arquivo}`);
  } catch (error) {
    console.error(`  ↳ não consegui salvar debug: ${error.message}`);
  }
};

async function req(metodo, endpoint, { body, headers } = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}/${endpoint}`;
  const res = await fetch(url, {
    method: metodo,
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...(cookies.size ? { Cookie: cookieHeader() } : {}),
      ...(headers ?? {}),
    },
    body,
  });
  applySetCookie(res);
  return res;
}

// Algumas respostas AJAX chegam em gzip sem Content-Encoding.
async function responseText(res) {
  const buffer = Buffer.from(await res.arrayBuffer());
  const isGzip = buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
  return (isGzip ? gunzipSync(buffer) : buffer).toString('utf8');
}

// Replica gx.sec.encrypt do GeneXus 17: AES-128-CBC, padding zero e IV prefixado.
function encryptGxQuery(value, keyHex, ivHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const raw = Buffer.from(value, 'latin1');
  const remainder = raw.length % 16;
  const padded = remainder === 0 ? raw : Buffer.concat([raw, Buffer.alloc(16 - remainder)]);
  const cipher = createCipheriv(`aes-${key.length * 8}-cbc`, key, iv);
  cipher.setAutoPadding(false);
  return Buffer.concat([iv, cipher.update(padded), cipher.final()]).toString('hex');
}

function extrair(html, regexes, oQue, dumpNome) {
  for (const regex of regexes) {
    const match = html.match(regex);
    if (match?.[1]) return match[1];
  }
  dumpDebug(dumpNome, html);
  throw new Error(
    `Não encontrei ${oQue} na resposta do SICAF. A estrutura do GeneXus pode ter mudado. ` +
      'Veja apps/web/scripts/.sicaf-debug/.',
  );
}

const RE_STATE = [
  /name="GXState"\s+value='([^']+)'/,
  /name="GXState"\s+value="([^"]+)"/,
  /name="GX_STATE"\s+value="([^"]+)"/,
  /name="GX_STATE"\s+value='([^']+)'/,
];

function parseState(html, contexto) {
  const raw = extrair(html, RE_STATE, `o GXState de ${contexto}`, contexto);
  try {
    return { raw, value: JSON.parse(raw) };
  } catch {
    dumpDebug(`${contexto}-gxstate-invalido`, raw);
    throw new Error(`O GXState de ${contexto} não é JSON válido.`);
  }
}

function requireStateFields(state, fields, contexto) {
  const missing = fields.filter((field) => !state[field]);
  if (missing.length) {
    dumpDebug(`${contexto}-estado-incompleto`, { missing });
    throw new Error(`O GXState não trouxe os campos necessários para ${contexto}.`);
  }
}

async function fullAjax(endpoint, state, payload, authToken, etapa) {
  requireStateFields(state, ['GX_AJAX_KEY', 'GX_AJAX_IV', 'AJAX_SECURITY_TOKEN'], etapa);
  if (!authToken) throw new Error(`O SICAF não forneceu o token de autorização para ${etapa}.`);

  const event = encryptGxQuery('gxfullajaxEvt', state.GX_AJAX_KEY, state.GX_AJAX_IV);
  const res = await req('POST', `${endpoint}?${event},gx-no-cache=${Date.now()}`, {
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/javascript, */*; q=0.01',
      Origin: new URL(BASE_URL).origin,
      Referer: `${BASE_URL}/${endpoint}`,
      'X-GXAUTH-TOKEN': authToken,
      AJAX_SECURITY_TOKEN: state.AJAX_SECURITY_TOKEN,
      GxAjaxRequest: '1',
    },
  });
  const body = await responseText(res);
  if (!res.ok) {
    dumpDebug(`${etapa}-http-${res.status}`, body);
    throw new Error(`O SICAF recusou ${etapa} (HTTP ${res.status}).`);
  }
  try {
    return JSON.parse(body);
  } catch {
    dumpDebug(`${etapa}-json-invalido`, body);
    throw new Error(`O SICAF devolveu JSON inválido em ${etapa}.`);
  }
}

async function login() {
  console.log('• Login no SICAF…');
  const inicial = await req('GET', 'app.sicaf');
  const htmlInicial = await responseText(inicial);
  const gxState = extrair(htmlInicial, RE_STATE, 'o GX_STATE do login', 'login-form');

  const payload = new URLSearchParams({
    vUSUARIOLOGIN: CPF,
    vUSUARIOSENHA: SENHA,
    vUSUARIOSENHAAUX: SENHA,
    vURL: '',
    BTNACESSAR: 'Acessar',
    _EventName: "E'DOACESSAR'.",
    _EventGridId: '',
    _EventRowId: '',
    GX_STATE: gxState,
  });
  const res = await req('POST', 'app.sicaf', {
    body: payload,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
  });
  const html = await responseText(res);
  // O login bem-sucedido pode responder 302; com redirect manual isso não conta como
  // `res.ok`, mas os cookies de sessão já foram emitidos.
  if (res.status >= 400 || /FormLogin|Usu[aá]rio ou senha/i.test(html)) {
    dumpDebug('login-falhou', html);
    throw new Error('Falha na autenticação do SICAF. Confira SICAF_CPF/SICAF_SENHA.');
  }
  if (!cookies.has('JSESSIONID')) {
    dumpDebug('login-sem-sessao', html);
    throw new Error('Login não devolveu JSESSIONID — sessão não estabelecida.');
  }
  console.log('  sessão estabelecida.');
}

async function abrirQdd() {
  const res = await req('GET', 'app.quadrodetalhadodespesa');
  const html = await responseText(res);
  if (!res.ok || /FormLogin/i.test(html)) {
    dumpDebug('qdd-tela-falhou', html);
    throw new Error(`Não foi possível abrir o QDD no SICAF (HTTP ${res.status}).`);
  }
  const state = parseState(html, 'qdd-tela');
  return { gxState: state.raw, state: state.value };
}

function currentExercise(state) {
  const value = Number(state.vEXRORC_MPAGE ?? state.vEXRORC);
  return Number.isInteger(value) ? value : null;
}

async function selecionarExercicio(qdd) {
  const { state } = qdd;
  const atual = currentExercise(state);
  if (atual === EXERCICIO && Number(state.vEXRORC) === EXERCICIO) {
    console.log(`  contexto do SICAF confirmado no exercício ${EXERCICIO}.`);
    return qdd;
  }

  console.log(`• Trocando o contexto do SICAF de ${atual ?? '?'} para ${EXERCICIO}…`);
  const masterAuth = state['GX_AUTH_WWPBASEOBJECTS.WORKWITHPLUSMASTERPAGE'];
  const usuarioId = Number(state.vUSUARIOID_MPAGE);
  const entidade = Number(state.vENTIDADE_MPAGE);
  if (!Number.isFinite(usuarioId) || !Number.isFinite(entidade)) {
    throw new Error('O SICAF não informou usuário/entidade para trocar o exercício.');
  }

  const dropdown = await fullAjax(
    'app.quadrodetalhadodespesa',
    state,
    {
      MPage: true,
      cmpCtx: '',
      parms: [usuarioId, entidade],
      hsh: [],
      objClass: 'wwpbaseobjects.workwithplusmasterpage',
      pkgName: 'app',
      events: ['DDC_EXERCICIO_MPAGE.ONLOADCOMPONENT_MPAGE'],
      grids: {},
    },
    masterAuth,
    'abrir o seletor de exercício',
  );

  const componentPrefix = Object.entries(dropdown.gxHiddens ?? {}).find(
    ([key, value]) => key.endsWith('_CMPPGM') && value === 'app.wcexercicio',
  )?.[0].replace(/_CMPPGM$/, '');
  const grid = dropdown.gxGrids?.[0];
  const rowIndex = Array.from({ length: Number(grid?.Count ?? 0) }, (_, index) => index).find(
    (index) => Number(grid?.[String(index)]?.Props?.[2]?.at(-1)) === EXERCICIO,
  );
  if (!componentPrefix || !grid || rowIndex == null) {
    dumpDebug('seletor-exercicio-ausente', {
      exercicio: EXERCICIO,
      componentFound: Boolean(componentPrefix),
      visibleRows: Number(grid?.Count ?? 0),
    });
    throw new Error(`O SICAF não ofereceu o exercício ${EXERCICIO} para esta conta.`);
  }

  const row = grid[String(rowIndex)];
  const rowId = String(rowIndex + 1).padStart(4, '0');
  const status = String(row.Props?.[3]?.at(-1) ?? '');
  const yearHash = dropdown.gxHiddens?.[`${componentPrefix}gxhash_EXRORC_${rowId}`];
  const statusHash = dropdown.gxHiddens?.[`${componentPrefix}gxhash_FLGEXEORC_${rowId}`];
  const componentAuth = dropdown.gxHiddens?.[`GX_AUTH_${componentPrefix}WCEXERCICIO`];
  if (!status || !yearHash || !statusHash || !componentAuth) {
    dumpDebug('seletor-exercicio-incompleto', {
      hasStatus: Boolean(status),
      hasYearHash: Boolean(yearHash),
      hasStatusHash: Boolean(statusHash),
      hasAuth: Boolean(componentAuth),
    });
    throw new Error('O seletor de exercício do SICAF veio incompleto.');
  }

  const selection = await fullAjax(
    'app.quadrodetalhadodespesa',
    state,
    {
      MPage: false,
      cmpCtx: componentPrefix,
      parms: [EXERCICIO, status, usuarioId, entidade],
      hsh: [
        { hsh: yearHash, row: rowId },
        { hsh: statusHash, row: rowId },
      ],
      objClass: 'wcexercicio',
      pkgName: 'app',
      events: ['VSELECIONAR.CLICK'],
      grids: { Grid: { id: 15, lastRow: Number(grid.Count), pRow: '' } },
    },
    componentAuth,
    `selecionar o exercício ${EXERCICIO}`,
  );

  const requestedRefresh = selection.gxCommands?.some(
    (command) =>
      command.exomethod?.Method === 'BuscaAcao' &&
      command.exomethod?.Parms?.includes('BUSCAR_EXERCICIO'),
  );
  if (!requestedRefresh) {
    dumpDebug('selecionar-exercicio-sem-refresh', selection);
    throw new Error('O SICAF não confirmou a seleção do exercício.');
  }

  const refresh = await fullAjax(
    'app.quadrodetalhadodespesa',
    state,
    {
      MPage: true,
      cmpCtx: '',
      parms: ['BUSCAR_EXERCICIO', true, usuarioId, entidade],
      hsh: [],
      objClass: 'wwpbaseobjects.workwithplusmasterpage',
      pkgName: 'app',
      events: ['GLOBALEVENTS_MPAGE.BUSCAACAO_MPAGE'],
      grids: {},
    },
    masterAuth,
    'atualizar o contexto do exercício',
  );
  const updated = refresh.gxCommands?.some(
    (command) =>
      command.ucmethod?.Control === 'DDC_EXERCICIO_MPAGEContainer' &&
      command.ucmethod?.Method === 'Update' &&
      Number(command.ucmethod?.Parms?.[0]) === EXERCICIO,
  );
  if (!updated) {
    dumpDebug('atualizar-exercicio-sem-confirmacao', refresh);
    throw new Error(`O SICAF não confirmou o contexto do exercício ${EXERCICIO}.`);
  }

  const atualizado = await abrirQdd();
  const confirmado = currentExercise(atualizado.state);
  if (confirmado !== EXERCICIO || Number(atualizado.state.vEXRORC) !== EXERCICIO) {
    dumpDebug('exercicio-divergente-apos-troca', {
      solicitado: EXERCICIO,
      masterPage: confirmado,
      relatorio: Number(atualizado.state.vEXRORC),
    });
    throw new Error(
      `O SICAF permaneceu no exercício ${confirmado ?? '?'} após solicitar ${EXERCICIO}.`,
    );
  }
  console.log(`  contexto alterado e confirmado no exercício ${EXERCICIO}.`);
  return atualizado;
}

function downloadFilename(url, contentDisposition, isXlsx) {
  let candidate = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  candidate ??= contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1];
  if (!candidate) {
    const query = new URL(url).search.slice(1).split(',')[0];
    candidate = query && !query.includes('=') ? query : '';
  }
  try {
    candidate = decodeURIComponent(candidate ?? '');
  } catch {
    candidate = candidate ?? '';
  }
  candidate = basename(candidate.replace(/\\/g, '/')).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  if (!candidate) candidate = `QDD_SICAF_${EXERCICIO}.${isXlsx ? 'xlsx' : 'xls'}`;
  if (!/\.xlsx?$/i.test(candidate)) candidate += isXlsx ? '.xlsx' : '.xls';
  return candidate;
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function validarExcel(buffer) {
  const isXls =
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  const isXlsx = buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  if (!isXls && !isXlsx) throw new Error('O download do SICAF não é um arquivo Excel válido.');

  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  } catch (error) {
    throw new Error(`Não foi possível abrir o Excel devolvido pelo SICAF: ${error.message}`);
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
  const headerIndex = rows.findIndex(
    (row) => normalize(row[0]) === 'orgao' && normalize(row[1]) === 'unidade',
  );
  if (headerIndex < 0) throw new Error('O Excel baixado não contém o cabeçalho esperado do QDD.');

  const heading = normalize(rows.slice(0, 5).flat().join(' '));
  const detectedYear = Number(heading.match(/exercicio:\s*(20\d{2})/i)?.[1]);
  if (!Number.isInteger(detectedYear)) {
    throw new Error('Não foi possível confirmar o exercício no cabeçalho do Excel.');
  }
  if (detectedYear !== EXERCICIO) {
    throw new Error(
      `O SICAF devolveu um QDD de ${detectedYear}, mas a coleta solicitou ${EXERCICIO}. ` +
        'O arquivo não será enviado ao app.',
    );
  }
  const rowCount = rows
    .slice(headerIndex + 1)
    .filter((row) => String(row[0] ?? '').trim() && String(row[1] ?? '').trim()).length;
  if (!rowCount) throw new Error('O Excel do QDD não contém linhas de dotação.');
  return { detectedYear, rowCount, isXlsx };
}

async function exportarQdd(qdd) {
  console.log('• Disparando a exportação para Excel (DOEXCEL)…');
  const form = new URLSearchParams({
    _EventName: "E'DOEXCEL'.",
    _EventGridId: '',
    _EventRowId: '',
    GXState: qdd.gxState,
    vTIPOREL: '2',
    vTIPO: '0',
    vEXRORC: String(EXERCICIO),
    vCDGORGI: '000',
    vCDGORGF: '999',
    vCDGUNII: '000',
    vCDGUNIF: '999',
    vRDZFPPAI: '0',
    vRDZFPPAF: '99999999999',
    vCDGDSPRCTI: '0',
    vCDGDSPRCTF: '999999999999',
    vCDGFNTORCI: '0',
    vCDGFNTORCF: '99999999',
    vFUNCPROGI: '0',
    vFUNCPROGF: '999999999999999999',
    vGRAU: '8',
    vCDGSUBPAI: '0000',
    vCDGSUBPAF: '9999',
    vCDGFNCDOTI: '0',
    vCDGFNCDOTF: '99',
    vCDGSFNDOTI: '0',
    vCDGSFNDOTF: '999',
    vMES: String(MES),
    vATEMES: 'S',
  });
  const res = await req('POST', 'app.quadrodetalhadodespesa', {
    body: form,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Origin: new URL(BASE_URL).origin,
      Referer: `${BASE_URL}/app.quadrodetalhadodespesa`,
    },
  });
  const location = res.headers.get('location');
  let fileUrl = location?.toLowerCase().includes('.xls') ? location : null;
  if (!fileUrl) {
    const body = await responseText(res);
    fileUrl = extrair(
      body,
      [
        /(https?:\/\/[^"'\\ ]+\.xls[x]?)/i,
        /["'](\/[^"']*\.xls[x]?)["']/i,
        /["'](gx[^"']*\.xls[x]?)["']/i,
      ],
      'a URL do Excel gerado pelo DOEXCEL',
      'qdd-doexcel',
    );
  }
  const url = new URL(fileUrl, `${BASE_URL}/`).toString();

  console.log('• Baixando e validando o Excel…');
  const download = await req('GET', url);
  const buffer = Buffer.from(await download.arrayBuffer());
  if (!download.ok) throw new Error(`Falha ao baixar o Excel do QDD (HTTP ${download.status}).`);
  if (buffer.length < 2_000) throw new Error(`Excel do QDD veio vazio/curto (${buffer.length} bytes).`);

  const validation = validarExcel(buffer);
  const nome = downloadFilename(url, download.headers.get('content-disposition'), validation.isXlsx);
  console.log(
    `  ${nome}: ${(buffer.length / 1024).toFixed(0)} KB, exercício ` +
      `${validation.detectedYear}, ${validation.rowCount} linhas.`,
  );
  return { nome, buffer };
}

async function enviarAoApp({ nome, buffer }) {
  console.log('• Enviando ao app para gerar a prévia…');
  const form = new FormData();
  form.set('file', new Blob([buffer]), nome);
  form.set('periodType', 'ACUMULADO_ANUAL');
  form.set('referenceMonth', String(MES));
  form.set('year', String(EXERCICIO));
  const res = await fetch(`${APP_URL}/api/imports/qdd/from-sicaf`, {
    method: 'POST',
    headers: { 'x-job-token': JOB_TOKEN },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const texto = await res.text();
  if (!res.ok) {
    dumpDebug('app-recusou', texto);
    throw new Error(`App recusou a prévia (HTTP ${res.status}): ${texto.slice(0, 400)}`);
  }
  let json;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new Error('O app criou a prévia, mas devolveu uma resposta inválida.');
  }
  if (Number(json.year) !== EXERCICIO || Number(json.detectedYear) !== EXERCICIO) {
    throw new Error(
      `O app respondeu com exercício divergente (year=${json.year}, detectedYear=${json.detectedYear}).`,
    );
  }
  console.log(
    `  prévia criada: ${json.actionCount ?? '?'} ações, ` +
      `${json.organizationsCount ?? '?'} órgãos (exercício ${json.year}). ` +
      'Confirme na tela da SEPLAN.',
  );
}

async function main() {
  await login();
  console.log(`• Abrindo o QDD (exercício ${EXERCICIO}, mês ${MES})…`);
  const qdd = await selecionarExercicio(await abrirQdd());
  const excel = await exportarQdd(qdd);

  if (DRY_RUN) {
    mkdirSync(DEBUG_DIR, { recursive: true });
    const destino = join(DEBUG_DIR, excel.nome);
    writeFileSync(destino, excel.buffer);
    console.log(`\n✓ --dry-run: Excel salvo em ${destino}. Nada foi enviado ao app.`);
    return;
  }

  if (INSECURE_TLS) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  await enviarAoApp(excel);
  console.log('\n✓ Coleta concluída.');
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});
