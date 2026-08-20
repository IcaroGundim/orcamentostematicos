// Coleta o QDD "Saldo Retroativo — Execução" (vTIPOREL=2) do SICAF/SEFAZ-AC e entrega
// o Excel nativo à rota /imports/qdd/from-sicaf do app, que o processa com o MESMO
// parser do upload manual e grava uma PRÉVIA (a SEPLAN confirma na tela).
//
// Uso:
//   SICAF_CPF=... SICAF_SENHA=... SICAF_JOB_TOKEN=... APP_URL=https://... \
//     node apps/web/scripts/fetch-sicaf-qdd.mjs [--exercicio=2026] [--mes=8] [--dry-run]
//
// Roda no CI (.github/workflows/qdd.yml) e localmente. É idempotente: cada execução
// substitui a prévia do SICAF ainda não confirmada.
//
// ⚠️ SEAM NÃO VALIDADO CONTRA O SISTEMA VIVO. O SICAF é GeneXus/WorkWithPlus: não há
// REST — tudo é evento AJAX com GXState + token de segurança por renderização, e a
// própria documentação (sicaf_acre_documentacao_completa.md vs docs/sicaf-rotas-dados.md)
// diverge nos nomes de campo (GX_STATE × GXState). Por isso este script:
//   • roda os passos nomeados e, em QUALQUER falha, grava a resposta em .sicaf-debug/
//     dizendo QUAL extração quebrou — para a 1ª validação levar minutos, não uma tarde;
//   • com --dry-run baixa e valida SEM enviar ao app (zero risco ao banco de produção).
// Faça UMA validação assistida (--dry-run) antes de confiar no agendamento.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado ? achado.split('=').slice(1).join('=') : null;
};
const hasFlag = (nome) => process.argv.includes(`--${nome}`);

const DRY_RUN = hasFlag('dry-run');
const agora = new Date();
const EXERCICIO = Number(arg('exercicio')) || agora.getFullYear();
const MES = Number(arg('mes')) || agora.getMonth() + 1;

if (!CPF || !SENHA) {
  console.error('Defina SICAF_CPF e SICAF_SENHA.');
  process.exit(1);
}
if (!DRY_RUN && (!APP_URL || !JOB_TOKEN)) {
  console.error('Defina APP_URL e SICAF_JOB_TOKEN (ou rode com --dry-run).');
  process.exit(1);
}
if (process.env.SICAF_INSECURE_TLS === '1') {
  // Último recurso: só se o handshake TLS da SEFAZ falhar no runner do CI.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.warn('⚠ TLS sem verificação de certificado (SICAF_INSECURE_TLS=1).');
}

// ── Cookie jar mínimo (o fetch do Node não persiste cookies) ─────────────────
const cookies = new Map();
const applySetCookie = (res) => {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const raw of list) {
    const [pair] = raw.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0) cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
};
const cookieHeader = () => [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

let debugSeq = 0;
const dumpDebug = (nome, corpo) => {
  try {
    mkdirSync(DEBUG_DIR, { recursive: true });
    const arquivo = join(DEBUG_DIR, `${String(++debugSeq).padStart(2, '0')}-${nome}.txt`);
    writeFileSync(arquivo, typeof corpo === 'string' ? corpo : JSON.stringify(corpo, null, 2));
    console.error(`  ↳ resposta salva em ${arquivo}`);
  } catch (e) {
    console.error(`  ↳ não consegui salvar debug: ${e.message}`);
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

/** Extrai um campo do HTML ou falha nomeando qual quebrou (com dump para depuração). */
function extrair(html, regexes, oQue, dumpNome) {
  for (const re of regexes) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  dumpDebug(dumpNome, html);
  throw new Error(
    `Não encontrei ${oQue} na resposta do SICAF. A estrutura do GeneXus pode ter mudado ` +
      `(build nova) ou o nome do campo diverge da documentação. Veja .sicaf-debug/.`,
  );
}

// GeneXus usa ora GX_STATE (login), ora GXState (telas WWP); a doc diverge, então
// tentamos os dois em toda extração de estado.
const RE_STATE = [
  /name="GXState"\s+value='([^']+)'/,
  /name="GXState"\s+value="([^"]+)"/,
  /name="GX_STATE"\s+value="([^"]+)"/,
  /name="GX_STATE"\s+value='([^']+)'/,
];
const RE_TOKEN = [
  /ajaxSecurityToken['"]?\s*[:=]\s*['"]([^'"]+)['"]/,
  /name="GXAJAX_SECURITY_TOKEN"\s+value="([^"]+)"/,
];

async function login() {
  console.log('• Login no SICAF…');
  const inicial = await req('GET', 'app.sicaf');
  const htmlInicial = await inicial.text();
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
  const html = await res.text();
  if (/FormLogin|Usu[aá]rio ou senha/i.test(html)) {
    dumpDebug('login-falhou', html);
    throw new Error('Falha na autenticação do SICAF. Confira SICAF_CPF/SICAF_SENHA.');
  }
  if (!cookies.has('JSESSIONID')) {
    dumpDebug('login-sem-sessao', html);
    throw new Error('Login não devolveu JSESSIONID — sessão não estabelecida.');
  }
  console.log('  sessão estabelecida.');
}

async function exportarQdd() {
  console.log(`• Abrindo o QDD (exercício ${EXERCICIO}, mês ${MES})…`);
  const tela = await req('GET', 'app.quadrodetalhadodespesa');
  const htmlTela = await tela.text();
  const gxState = extrair(htmlTela, RE_STATE, 'o GXState da tela do QDD', 'qdd-tela');
  const token = extrair(htmlTela, RE_TOKEN, 'o ajaxSecurityToken da tela do QDD', 'qdd-tela');

  // vTIPOREL=2 → "Saldo Retroativo — Execução" (o relatório do arquivo importado hoje).
  // Faixas Inicial/Final de órgão/unidade deixadas abertas = Estado inteiro.
  console.log('• Disparando a exportação para Excel (DOEXCEL)…');
  const payload = new URLSearchParams({
    _EventName: "E'DOEXCEL'.",
    _EventGridId: '',
    _EventRowId: '',
    GXState: gxState,
    GXAJAX_SECURITY_TOKEN: token,
    vTIPOREL: '2',
    vEXRORC: String(EXERCICIO),
    vMES: String(MES),
    vATEMES: 'S',
    vGRAU: '8',
    vTIPO: '0',
  });
  const res = await req('POST', 'app.quadrodetalhadodespesa', {
    body: payload,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-GXAUTH-TOKEN': token,
      'GxAjaxRequest': '1',
    },
  });
  const corpo = await res.text();

  // A resposta AJAX do GeneXus traz a URL do arquivo gerado (…/gxexport… .xls[x]).
  const fileUrl = extrair(
    corpo,
    [
      /(https?:\/\/[^"'\\ ]+\.xls[x]?)/i,
      /["'](\/[^"']*\.xls[x]?)["']/i,
      /["'](gx[^"']*\.xls[x]?)["']/i,
    ],
    'a URL do Excel gerado (DOEXCEL)',
    'qdd-doexcel',
  );
  const urlAbs = fileUrl.startsWith('http')
    ? fileUrl
    : `${BASE_URL}/${fileUrl.replace(/^\//, '').replace(/^sicaf\//, '')}`;

  console.log('• Baixando o Excel…');
  const download = await req('GET', urlAbs);
  const buffer = Buffer.from(await download.arrayBuffer());
  if (buffer.length < 2000) {
    dumpDebug('qdd-download-curto', corpo);
    throw new Error(`Excel do QDD veio vazio/curto (${buffer.length} bytes).`);
  }
  const nome = decodeURIComponent(urlAbs.split('/').pop().split('?')[0]) || 'QDD_SICAF.xls';
  console.log(`  baixado: ${nome} (${(buffer.length / 1024).toFixed(0)} KB).`);
  return { nome, buffer };
}

async function enviarAoApp({ nome, buffer }) {
  console.log('• Enviando ao app para gerar a prévia…');
  const form = new FormData();
  form.set('file', new Blob([buffer]), nome);
  form.set('periodType', 'ACUMULADO_ANUAL');
  form.set('referenceMonth', String(MES));
  form.set('year', String(EXERCICIO)); // exercício explícito — nunca deixar o parser adivinhar
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
    json = {};
  }
  console.log(
    `  prévia criada: ${json.actionCount ?? '?'} ações, ${json.organizationsCount ?? '?'} órgãos ` +
      `(exercício ${json.year ?? EXERCICIO}). Confirme na tela da SEPLAN.`,
  );
}

async function main() {
  await login();
  const excel = await exportarQdd();
  if (DRY_RUN) {
    mkdirSync(DEBUG_DIR, { recursive: true });
    const destino = join(DEBUG_DIR, excel.nome);
    writeFileSync(destino, excel.buffer);
    console.log(`\n✓ --dry-run: Excel salvo em ${destino}. Nada foi enviado ao app.`);
    return;
  }
  await enviarAoApp(excel);
  console.log('\n✓ Coleta concluída.');
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});
