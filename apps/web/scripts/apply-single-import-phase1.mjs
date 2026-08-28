// Aplica somente a expansão não destrutiva do schema da importação única.
// O índice único de BudgetImport.year fica para a fase 2, depois da consolidação.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const prismaCli = require.resolve('prisma/build/index.js');
const finalSchema = path.join(webDir, 'prisma', 'schema.prisma');
const phase1Schema = path.join(webDir, 'prisma', '.single-import-phase1.prisma');
const forwardArgs = process.argv.slice(2).filter((arg) => arg === '--yes');

const source = fs.readFileSync(finalSchema, 'utf8');
const phase1 = source.replace(
  /(model BudgetImport \{[\s\S]*?\n\s*year\s+Int)\s+@unique/,
  '$1',
);
if (phase1 === source) {
  console.error('Não foi possível gerar o schema da fase 1: BudgetImport.year @unique não encontrado.');
  process.exit(1);
}

fs.writeFileSync(phase1Schema, phase1);
try {
  const result = spawnSync(
    process.execPath,
    [
      path.join(webDir, 'scripts', 'safe-push.mjs'),
      `--schema=${path.relative(webDir, phase1Schema)}`,
      ...forwardArgs,
    ],
    { cwd: webDir, env: process.env, stdio: 'inherit' },
  );
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  } else {
    const generate = spawnSync(
      process.execPath,
      [prismaCli, 'generate', '--schema', phase1Schema],
      { cwd: webDir, env: process.env, stdio: 'inherit' },
    );
    if (generate.error) {
      console.error(`Falha ao gerar o Prisma Client: ${generate.error.message}`);
    }
    process.exitCode = generate.status ?? 1;
  }
} finally {
  fs.rmSync(phase1Schema, { force: true });
}
