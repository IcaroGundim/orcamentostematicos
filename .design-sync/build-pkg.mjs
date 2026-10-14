#!/usr/bin/env node
// Monta `.ds-pkg/`, o "pacote" que o conversor do design-sync consome.
//
// O frontend é um app Next.js, não uma biblioteca publicada: não há `dist/`,
// `.d.ts` nem CSS compilado. Este script produz os três a partir do código
// real do app, sem tocar nele:
//
//   .ds-pkg/index.ts      reexporta os componentes de apps/web/src/components
//   .ds-pkg/types/        .d.ts gerados pelo tsc (com `@/` reescrito para
//                         caminho relativo, que o ts-morph do conversor não
//                         conhece os `paths` do tsconfig)
//   .ds-pkg/styles.css    Tailwind v4 compilado a partir do globals.css do app
//
// Uso (da raiz do repositório): node .design-sync/build-pkg.mjs
// `.ds-pkg/` é saída regenerada e fica no .gitignore.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';

const ROOT = process.cwd();
const WEB = join(ROOT, 'apps', 'web');
const COMPONENTS = join(WEB, 'src', 'components');
const OUT = join(ROOT, '.ds-pkg');
const posix = (p) => p.split(sep).join('/');

if (!existsSync(COMPONENTS)) {
  console.error('rode da raiz do repositório (apps/web/src/components não encontrado)');
  process.exit(1);
}

// Fora do pacote, com o motivo. Tudo o mais em ui/, charts/ e domain/ entra.
const EXCLUDED = {
  'domain/secretaria-help-content.tsx': 'importa next/link, que não roda fora do Next',
  'domain/acre-deliveries-map.tsx': 'Leaflet + busca de /maps/*.geojson do próprio servidor',
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// -- 1. entrada ------------------------------------------------------------
const files = [];
for (const dir of ['ui', 'charts', 'domain']) {
  for (const f of readdirSync(join(COMPONENTS, dir)).sort()) {
    const rel = `${dir}/${f}`;
    if (!f.endsWith('.tsx') || EXCLUDED[rel]) continue;
    files.push(rel);
  }
}
const spec = (rel) => posix(relative(OUT, join(COMPONENTS, rel))).replace(/\.tsx$/, '');
// Recharts vai junto, como UM namespace (`OrcamentosTematicos.Recharts`): sem
// ele o agente de design não monta gráfico nenhum com o ChartContainer. O
// `export *` direto colidiria com Tooltip/Label/Legend da UI. Aponta para o
// MESMO arquivo que os gráficos do app resolvem (o campo `module`, que o
// esbuild escolhe em platform=browser) - uma segunda cópia do Recharts
// quebraria o contexto de tamanho que o ChartContainer repassa aos filhos. O
// npm deixou o recharts em apps/web/node_modules, fora do alcance da raiz.
const requireWeb = createRequire(join(WEB, 'package.json'));
const rechartsDir = dirname(requireWeb.resolve('recharts/package.json'));
const rechartsPkg = JSON.parse(readFileSync(join(rechartsDir, 'package.json'), 'utf8'));
const rechartsEntry = posix(relative(OUT, join(rechartsDir, rechartsPkg.module ?? rechartsPkg.main)));
writeFileSync(
  join(OUT, 'index.ts'),
  '// Gerado por .design-sync/build-pkg.mjs - não editar.\n' +
    files.map((rel) => `export * from '${spec(rel)}';`).join('\n') + '\n' +
    `// @ts-ignore - o tsc não resolve os tipos pelo arquivo es6; o namespace não é componente.\n` +
    `export * as Recharts from '${rechartsEntry}';\n`,
);
const webPkg = JSON.parse(readFileSync(join(WEB, 'package.json'), 'utf8'));
writeFileSync(
  join(OUT, 'package.json'),
  JSON.stringify(
    {
      name: 'orcamentos-tematicos',
      version: webPkg.version,
      private: true,
      description: 'Componentes do Sistema de Orçamentos Temáticos do Acre',
      module: 'index.ts',
      types: 'types/.ds-pkg/index.d.ts',
    },
    null,
    2,
  ) + '\n',
);
console.log(`entrada: ${files.length} módulos (${Object.keys(EXCLUDED).length} excluídos)`);

// -- 2. tipos --------------------------------------------------------------
writeFileSync(
  join(OUT, 'tsconfig.json'),
  JSON.stringify(
    {
      extends: '../apps/web/tsconfig.json',
      compilerOptions: {
        noEmit: false,
        declaration: true,
        emitDeclarationOnly: true,
        incremental: false,
        outDir: 'types',
        rootDir: '..',
        plugins: [],
      },
      include: ['index.ts'],
      exclude: [],
    },
    null,
    2,
  ) + '\n',
);
const require = createRequire(join(ROOT, 'package.json'));
const tscBin = join(dirname(require.resolve('typescript/package.json')), 'bin', 'tsc');
let tscOut = '';
try {
  tscOut = execFileSync(process.execPath, [tscBin, '-p', join(OUT, 'tsconfig.json')], { encoding: 'utf8' });
} catch (e) {
  // Erros de tipo do app não impedem a emissão (noEmitOnError=false); só
  // barramos o que quebra a entrada - export * ambíguo entre módulos.
  tscOut = `${e.stdout ?? ''}${e.stderr ?? ''}`;
}
const ambiguous = tscOut.split('\n').filter((l) => /index\.ts.*TS2308/.test(l));
if (ambiguous.length) {
  console.error('nomes exportados por mais de um módulo (o export * os descartaria):');
  for (const l of ambiguous) console.error(`  ${l.trim()}`);
  process.exit(1);
}
const typesRoot = join(OUT, 'types');
const entryDts = join(typesRoot, '.ds-pkg', 'index.d.ts');
if (!existsSync(entryDts)) {
  console.error(`tsc não emitiu ${entryDts}:\n${tscOut}`);
  process.exit(1);
}
// `@/x` -> caminho relativo dentro de types/apps/web/src.
const srcTypes = join(typesRoot, 'apps', 'web', 'src');
let rewritten = 0;
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!p.endsWith('.d.ts')) continue;
    const text = readFileSync(p, 'utf8');
    const next = text.replace(/(from\s+|import\()(['"])@\/([^'"]+)\2/g, (_, lead, q, target) => {
      let r = posix(relative(dirname(p), join(srcTypes, target)));
      if (!r.startsWith('.')) r = `./${r}`;
      rewritten++;
      return `${lead}${q}${r}${q}`;
    });
    if (next !== text) writeFileSync(p, next);
  }
})(typesRoot);
console.log(`tipos: ${entryDts.slice(ROOT.length + 1)} (${rewritten} imports @/ reescritos)`);

// -- 3. CSS ----------------------------------------------------------------
// Mesmo globals.css do app, com base em apps/web para a detecção automática
// de classes enxergar exatamente o que o Next enxerga, mais as prévias.
// A lista `inline` garante o vocabulário de layout que o agente de design
// usa para montar telas (fora dela, só existe o que o app já usa). Sem
// sombras, gradientes nem cantos arredondados - docs/design-orcamento.md 10.
const SAFE = [
  '{,sm:,md:,lg:,xl:}{flex,inline-flex,grid,block,inline-block,hidden,contents}',
  '{,sm:,md:,lg:,xl:}{flex-row,flex-col,flex-wrap,flex-1,flex-none,shrink-0,grow}',
  '{,sm:,md:,lg:,xl:}{items-start,items-center,items-end,items-baseline,items-stretch}',
  '{,sm:,md:,lg:,xl:}{justify-start,justify-center,justify-end,justify-between}',
  '{,sm:,md:,lg:,xl:}grid-cols-{1,2,3,4,5,6,12}',
  '{,sm:,md:,lg:,xl:}col-span-{1,2,3,4,5,6,full}',
  '{,sm:,md:,lg:}{gap,gap-x,gap-y,p,px,py,pt,pb,pl,pr,m,mx,my,mt,mb}-{0,0.5,1,1.5,2,3,4,5,6,8,10,12,16}',
  'space-{x,y}-{1,2,3,4,6,8}',
  '{w,h,min-w,min-h,max-w}-{full,screen,auto,fit}',
  'max-w-{sm,md,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl}',
  'w-{1/2,1/3,2/3,1/4,3/4}',
  'text-{xs,sm,base,lg,xl,2xl,3xl,4xl}',
  'font-{normal,medium,semibold,bold}',
  'text-{left,center,right}',
  '{truncate,tabular-nums,uppercase,tracking-wide,leading-tight,leading-snug,leading-relaxed}',
  '{bg,text,border}-{background,foreground,card,card-foreground,muted,muted-foreground,primary,primary-foreground,secondary,secondary-foreground,accent,accent-foreground,destructive,border}',
  '{border,border-t,border-b,border-l,border-r,border-y,border-x}',
  '{overflow-hidden,overflow-auto,overflow-x-auto}',
];
const srcCss =
  `@import "../apps/web/src/app/globals.css";\n` +
  `@source "../.design-sync/previews";\n` +
  SAFE.map((s) => `@source inline("${s}");\n`).join('') +
  // O app define --font-sans pela classe que o next/font põe no <html>; fora
  // do Next ninguém define, então fixamos a família aqui (a face vem de
  // .design-sync/fonts/geist.css via cfg.extraFonts).
  `\n:root {\n  --font-sans: "Geist", ui-sans-serif, system-ui, sans-serif;\n}\n` +
  `@layer base {\n  html {\n    font-family: var(--font-sans);\n  }\n}\n`;
const srcCssPath = join(OUT, 'styles.src.css');
writeFileSync(srcCssPath, srcCss);
const postcss = (await import(posix(require.resolve('postcss')).replace(/^([A-Za-z]:)/, 'file:///$1'))).default;
const tailwind = (await import(posix(require.resolve('@tailwindcss/postcss')).replace(/^([A-Za-z]:)/, 'file:///$1'))).default;
const result = await postcss([tailwind({ base: WEB, optimize: false })]).process(srcCss, {
  from: srcCssPath,
  to: join(OUT, 'styles.css'),
});
writeFileSync(join(OUT, 'styles.css'), result.css);
console.log(`css: .ds-pkg/styles.css (${(statSync(join(OUT, 'styles.css')).size / 1024).toFixed(0)} KB)`);
