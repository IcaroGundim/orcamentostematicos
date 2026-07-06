// `prisma db push` PROTEGIDO — o único jeito autorizado de sincronizar o schema.
//
// Garante, nesta ordem:
//   1) backup obrigatório (scripts/backup.mjs) antes de qualquer mudança;
//   2) mostra o diff entre schema.prisma e o banco vivo;
//   3) DETECTA perda de dados (push que dropa tabela/coluna) e ABORTA, a menos
//      que você passe --allow-destructive de propósito;
//   4) pede confirmação explícita e então roda `prisma db push`.
//
// Uso (em apps/web):  npm run db:push
//   flags: --yes (pula a confirmação)  --allow-destructive (permite DROP)
//
// Por que a detecção funciona: o Prisma 7 só diffa a datasource como destino, então
// comparamos schema -> banco. Uma operação `CREATE TABLE`/`ADD COLUMN` nesse diff
// significa que o BANCO tem algo que o schema não tem — ou seja, o push iria DROPar
// (perda de dados). É esse sinal que bloqueamos.

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const SKIP_CONFIRM = args.includes('--yes');
const ALLOW_DESTRUCTIVE = args.includes('--allow-destructive');

if (!process.env.DATABASE_URL) { console.error('Defina DATABASE_URL.'); process.exit(1); }

const run = (cmd, cmdArgs, opts = {}) =>
  spawnSync(cmd, cmdArgs, { cwd: webDir, encoding: 'utf8', shell: process.platform === 'win32', ...opts });

// 1) Backup obrigatório.
console.log('▶ 1/4 Backup obrigatório…');
const bkp = run('node', ['scripts/backup.mjs'], { stdio: 'inherit' });
if (bkp.status !== 0) { console.error('✖ Backup falhou — push abortado.'); process.exit(1); }

// 2/3) Diff schema -> banco e detecção de perda de dados.
console.log('\n▶ 2/4 Analisando diferenças schema × banco…');
const diff = run('npx', ['--no-install', 'prisma', 'migrate', 'diff',
  '--from-schema', './prisma/schema.prisma', '--to-config-datasource', './prisma.config.ts', '--script']);
const script = (diff.stdout || '').trim();

if (diff.status !== 0) {
  console.error('✖ Não foi possível calcular o diff:\n', diff.stderr || diff.stdout);
  process.exit(1);
}
if (/This is an empty migration/i.test(script)) {
  console.log('✔ Banco já está igual ao schema. Nada a fazer.');
  process.exit(0);
}

const destructive = /CREATE TABLE|ADD COLUMN/i.test(script);
console.log('\n— Operações que o db push aplicaria (invertidas do diff schema→banco):');
console.log(script.split('\n').map((l) => '   ' + l).join('\n'));

if (destructive) {
  console.log('\n⚠  ATENÇÃO: este push REMOVERIA tabela(s)/coluna(s) do banco (PERDA DE DADOS).');
  if (!ALLOW_DESTRUCTIVE) {
    console.error('✖ Abortado por segurança. Se for realmente intencional, rode com --allow-destructive.');
    console.error('  O backup acima já preserva os dados atuais em backups/<data>/.');
    process.exit(2);
  }
  console.log('  (--allow-destructive fornecido: prosseguindo mesmo assim.)');
}

// 4) Confirmação + push.
async function confirm() {
  if (SKIP_CONFIRM) return true;
  if (!process.stdin.isTTY) {
    console.error('✖ Sem terminal interativo. Reveja e rode com --yes para aplicar.');
    process.exit(1);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await new Promise((res) => rl.question('\nDigite SIM para aplicar o db push: ', res));
  rl.close();
  return ans.trim().toUpperCase() === 'SIM';
}

if (!(await confirm())) { console.log('Cancelado.'); process.exit(0); }

console.log('\n▶ 4/4 Aplicando prisma db push…');
const pushArgs = ['--no-install', 'prisma', 'db', 'push'];
if (ALLOW_DESTRUCTIVE) pushArgs.push('--accept-data-loss');
const push = run('npx', pushArgs, { stdio: 'inherit' });
process.exit(push.status ?? 0);
