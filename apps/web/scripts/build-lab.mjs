/**
 * Build com o laboratório de cores ligado.
 *
 * Existe porque `NEXT_PUBLIC_LAB_CORES=1 npm run build` é sintaxe de shell POSIX
 * e quebra no PowerShell, que é onde este projeto é operado — não há prefixo de
 * variável inline lá, e o erro que aparece ("não é reconhecido como nome de
 * cmdlet") não sugere em nada qual é a causa.
 *
 * Definir a variável aqui, em Node, funciona igual em PowerShell, cmd e bash, e
 * não deixa a variável presa na sessão do terminal depois do build.
 *
 *     npm run build:lab
 *
 * Mesmo padrão dos demais scripts do projeto (`cf-build.mjs`, `safe-push.mjs`).
 */

import { spawnSync } from 'node:child_process';

// O comando vai como string única, e não como (programa, argumentos): com
// `shell: true` o Node avisa que argumentos separados não são escapados
// (DEP0190). Aqui não há entrada de usuário, mas o aviso poluiria a saída do
// build toda vez.
const resultado = spawnSync('npm run build', {
  stdio: 'inherit',
  // `shell: true` é necessário no Windows: `npm` é um .cmd, não um executável.
  shell: true,
  env: { ...process.env, NEXT_PUBLIC_LAB_CORES: '1' },
});

if (resultado.error) {
  console.error(`\nFalha ao iniciar o build: ${resultado.error.message}\n`);
  process.exit(1);
}

if (resultado.status !== 0) process.exit(resultado.status ?? 1);

console.log(
  '\nBuild concluído COM o laboratório de cores.\n' +
    'Rode `npm start` e procure o botão "Cores" no canto inferior direito.\n' +
    'Para voltar ao normal, basta `npm run build` de novo.\n',
);
