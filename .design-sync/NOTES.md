# design-sync — notas do repositório

Sincroniza o frontend (`apps/web/src/components`) com um projeto de design system no
Claude Design. Primeira sincronização: 2026-09-29.

## Projeto no Claude Design

- Alvo: "Orçamentos Temáticos do Acre",
  https://claude.ai/design/p/bd93b527-0f52-44d0-843b-d2da203c8f74 (`projectId` em
  `config.json`).
- O projeto "Orçamentos Temáticos do Acre — Design System" (`b671d08a…`) é outro. Foi
  montado à mão, com templates, ui_kits e guidelines próprios, e **não** é alvo desta
  sincronização. Nunca envie para ele.
- Primeiro envio em 2026-09-29: 717 arquivos, mais `report_validate` limpo e a âncora
  `_ds_sync.json` gravada por último, depois da aprovação do usuário. Re-sincronizações
  baixam essa âncora para `.design-sync/.cache/remote-sync.json` e passam
  `--remote` ao driver.
- Se a âncora sumir do projeto, a próxima sincronização o trata como não ancorado:
  vai pelo caminho atômico e re-verifica tudo. Isso é o esperado, não uma falha. Neste
  computador as notas de avaliação continuam valendo pelo `.design-sync/.cache/`; num
  clone novo, não.
- O `/design-login` só roda num `claude` interativo no terminal, não na aba Code do
  app desktop. Na primeira tentativa a API também respondeu 503 por algum tempo.

## Como este repositório é montado (não é uma biblioteca publicada)

- O frontend é um app Next.js, sem `dist/`, sem `.d.ts` e sem CSS compilado. O
  `buildCmd` (`node .design-sync/build-pkg.mjs`, rodar da raiz) monta `.ds-pkg/`
  (gitignored), que o conversor consome como se fosse o pacote:
  - `index.ts` reexporta (`export *`) todo `.tsx` de `ui/`, `charts/` e `domain/`,
    menos a lista `EXCLUDED` do script;
  - `types/` sai do `tsc --emitDeclarationOnly`; o script reescreve `@/…` para caminho
    relativo porque o ts-morph do conversor não lê `paths`;
  - `styles.css` é o Tailwind v4 compilado do `globals.css` do app (base
    `apps/web`, a mesma detecção de classes do Next) + `@source` das prévias + uma
    lista `inline` de utilitários de layout para o agente de design.
- Ordem de uma build completa: `node .design-sync/build-pkg.mjs` →
  `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle`
  → `node .ds-sync/package-validate.mjs ./ds-bundle`. Sem `--entry` na linha de
  comando: vem de `cfg.entry`.
- `--node-modules` é o da RAIZ: o npm workspaces içou tudo, e
  `apps/web/node_modules` só tem next/recharts/open-next.
- Não rode `npm ci` para sincronizar: o `node_modules` já funciona e reinstalar no
  Windows arrisca os binários nativos do Tailwind (oxide, lightningcss).
- Caminhos de config (`srcDir`, `tsconfig`, `cssEntry`, `extraFonts`) são relativos
  ao pacote `.ds-pkg/`; por isso começam com `../`.

## Exclusões do pacote (lista `EXCLUDED` em build-pkg.mjs)

- `domain/secretaria-help-content.tsx`: importa `next/link`, que não roda fora do Next.
- `domain/acre-deliveries-map.tsx`: Leaflet, com busca de `/maps/*.geojson` no
  próprio servidor.
- `dev/` não entra (fora de `ui|charts|domain`).
- Nenhum componente alcança código só de servidor (Prisma, `server-only`, `pg`).
  Rastreamento transitivo feito em 2026-09-29. Se um componente novo importar algo
  de `lib/store.ts`, `lib/prisma*`, `lib/auth-server.ts` etc., o bundle inteiro
  quebra: exclua-o no `EXCLUDED`.

## Fonte

- Geist vem do `next/font/google` no app, que só existe dentro do build do Next.
  Os subconjuntos latin e latin-ext (OFL) estão vendorizados em `.design-sync/fonts/`
  (copiados de `.next/static/media` em 2026-09-29) e entram via `cfg.extraFonts`.
- O `build-pkg.mjs` fixa `--font-sans: "Geist", …` em `:root`. O app define essa
  variável pela classe que o next/font põe no `<html>`, e no `@theme inline` do
  `globals.css` ela é autorreferente (`--font-sans: var(--font-sans)`).

## Armadilhas encontradas

- **Regex com caracteres não-ASCII crus quebram o bundle inteiro** quando ele é
  lido sem charset UTF-8 (o teste `[BUNDLE_EXPORT]` do validate carrega assim). O
  esbuild não escapa conteúdo de regex. Corrigido na origem em
  `searchable-combobox.tsx` e `relocated-units-panel.tsx`
  (`/[̀-ͯ]/g`, forma escapada, idêntica em comportamento). Se o
  `[BUNDLE_EXPORT]` voltar a acusar 100% dos componentes, procure com
  `LC_ALL=C grep -n -P '/\[[^\]]*[^\x00-\x7F]' apps/web/src -r`. Faixa invertida em
  Latin-1 é o que vira SyntaxError; `[IÍ]` e o `xlsx` apenas perdem semântica.
- O Bash tool desta máquina converte `\uXXXX` em caracteres antes de executar.
  Scripts com escapes devem ser escritos com a ferramenta Write, não via heredoc.
- Playwright: o cache em `%LOCALAPPDATA%\ms-playwright` tem chromium-1243, que é o
  do playwright **1.63.0**. Instale em `.ds-sync` com
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright@1.63.0`.
- Grupos: `ui/` é "diretório genérico" para o conversor, então esses componentes caem
  em `general`. As exportações de `domain/badges.tsx` e
  `domain/execution-breakdown-panel.tsx` são fixadas em `componentSrcMap`, senão
  também cairiam em `general`.
- Subcomponentes do shadcn (CardHeader, DialogTitle…) viram componentes próprios
  com o cartão simples. As prévias ricas ficam no componente raiz, compondo as partes.

## Recharts

- O recharts está em `apps/web/node_modules`, fora do alcance da raiz. O
  `build-pkg.mjs` o reexporta como namespace (`export * as Recharts`) apontando para o
  MESMO arquivo que os gráficos do app resolvem (campo `module`). Uma segunda cópia
  quebra o contexto de tamanho do `ChartContainer`.
- O `export *` direto colidiria com `Tooltip`/`Label`/`Legend` da UI. Por isso é
  namespace, fora da lista de componentes (`componentSrcMap.Recharts: null`).
- Nas prévias: `import { Recharts } from 'orcamentos-tematicos'`. Nunca `from 'recharts'`,
  que não resolve da raiz.
- Não use `cfg.extraEntries` para isso: ele entra na chave global das notas, e mudá-lo
  invalida a avaliação de TODAS as prévias.

## Prévias

- Escopo da primeira sincronização (escolha do usuário: "núcleo"): 25 primitivos de
  `ui/` e 13 de domínio/gráficos, mais o `SidebarMenuSkeleton` (39 no total). Esse
  último ganhou prévia porque o cartão simples dele saía quase em branco e o validate o
  marcava como `bad`. Os painéis grandes (curadoria, SEPLAN, folha, usuários…) ficam
  com o cartão simples.
- CSS das prévias: o `styles.css` é pré-compilado. Uma prévia com classe nova só
  renderiza depois de `build-pkg.mjs` + `package-build.mjs`. O `preview-rebuild` não
  recompila CSS. Em agentes paralelos, use `style={{…}}` para valores arbitrários. Para
  conferir uma classe: `grep -cF 'w-\[26rem\]' .ds-pkg/styles.css` (com `-F`).
- **A ordem das células é alfabética**, não a do arquivo. Nos cartões `single`, a capa é
  definida por `overrides.<Nome>.primaryStory` (`Aberto`/`Aberta`), que é só de
  apresentação e não invalida notas.
- Cartões `single` no produto renderizam sem margem (sem `?story=`). Popover e Select
  abertos têm `padding: 1.5rem` próprio na célula `Aberto`, senão a borda cola em (0,0).
- Na grade, cada célula tem ~390px com `overflow:hidden`. Largura fixa maior corta:
  use `width: 100%` + `maxWidth`, ou `cardMode: column` (o validate sugere com
  `[GRID_OVERFLOW]`).
- Overlays abertos usam `onOpenAutoFocus={(e) => e.preventDefault()}`. Sem isso, o anel
  de foco do Radix parece sombra na captura estática.
- `ScrollArea` nas prévias usa `type="always"` (no app é hover), senão a barra some na
  captura.
- Estados não capturáveis (hover, a pílula animada do `HoverTabsList` em movimento)
  ficaram de fora.
- `ExerciseSelect` só fechado: ele não repassa `open`/`defaultOpen` ao `Select`.
- **Sem dados pessoais nas prévias**: o projeto do Claude Design é compartilhado. Use
  papéis ("Representante da SEE", "Administrador SEPLAN") e e-mails
  `@exemplo.gov.br`, nunca nomes de pessoas nem endereços `@ac.gov.br`. Antes de cada
  envio, varra `_ds_bundle.js`, `_preview/*.js`, `components/**` e `README.md` atrás de
  e-mails, tokens e URLs internas.
- Dados das prévias no formato real do QDD: órgão de 3 dígitos (`717`), unidade `001`,
  projeto/atividade de 8 dígitos (`10400000`), nomes em maiúsculas. Referência:
  `backups/<data>/marcacoes.csv`. Classificação ≠ eixo: "Exclusivo" é classificação,
  "Adaptação climática" é eixo (`app/api/metadata/route.ts`).

## Known render warns (triados, legítimos)

- `SidebarMenuSkeleton`: largura aleatória (50–90%) por design do componente; a captura muda a cada execução e isso não é regressão.
- `ThemeExecutionGauge`: o `package-capture` fotografa ~500ms após o carregamento, e o
  `<Pie>` do Recharts anima por ~1,9s. A folha de avaliação mostra lascas. A nota "good"
  veio de captura com espera de 3s (`.ds-sync/probe-shot.mjs`, fotos em
  `.design-sync/.cache/probe/`). Esse script é local e não vai para o git. Para
  recriar: playwright + `serveDir` de `.ds-sync/storybook/http-serve.mjs`, abrir
  `components/charts/ThemeExecutionGauge/ThemeExecutionGauge.html?story=<Export>` a
  900x700, esperar 3s e fotografar. Em máquina lenta, os gráficos de barras correm o mesmo
  risco. O Recharts 3.8 só desliga a animação com `prefers-reduced-motion`.
- `Skeleton`: a captura pega um quadro do `animate-pulse`, por isso os blocos saem claros.
- `Sidebar`: na folha de avaliação (`?story=`, margem de 24px) o rodapé perde ~24px. No
  cartão do produto (sem margem, 1000x600) cabe inteiro.

## Achados sobre o app (não corrigidos: fora do escopo da sincronização)

- `Tooltip` na variante clara da curadoria: `[&>svg]:fill-white` não alcança a seta
  (o Radix embrulha o svg num span), e a seta fica preta ao lado do balão branco.
- Os três gráficos de resumo (`ThemeLiquidated…`, `ClassificationLiquidated…`,
  `LiquidatedByAxis…`) pintam os temas com `--chart-1/2/3`, e não com as cores de dado
  dos temas: OCAD e OSG ficam dois verdes da marca.
- `docs/design-orcamento.md` diverge do código em dois pontos: §4.3 descreve o cabeçalho
  do painel como `bg-green-900 text-white` (o código usa `bg-marca text-marca-contraste`),
  e §9 diz que as cores dos gráficos são `#5f8f70/#365f47` (o `globals.css` tem
  `--chart-1: var(--marca-escura)`). Pelo CLAUDE.md o código vence.
- `/seplan` formata o percentual do velocímetro com `toFixed(1)` ("52.4%", com ponto).
- `DeliveryReviewCard` mostra `quantity` sem separador de milhar.

## Riscos de re-sincronização

- **Fonte vendorizada**: se o app trocar a Geist ou os pesos, atualize
  `.design-sync/fonts/`. Os arquivos saíram do cache `.next` de 2026-09-29.
- **Dados embutidos nas prévias** (fontes de 2025/2026, catálogo de eixos e
  classificações, códigos do QDD) podem envelhecer com um novo exercício ou catálogo.
- **Nomes de ação e órgão** vêm do QDD de 2026. Um QDD novo pode renomear.
- **`EXCLUDED` e o rastreamento de código de servidor**: todo componente novo em
  `domain/` entra no pacote automaticamente. Refaça o rastreamento se o bundle quebrar.
- **Recharts fora da raiz**: se um `npm install` passar a içá-lo, o `build-pkg` continua
  funcionando (resolve a partir de `apps/web`). Confira que o bundle tem uma só cópia.
- **Playwright 1.63.0** está amarrado ao chromium-1243 em cache. Se o cache mudar,
  reinstale a versão correspondente.
- **Velocímetro**: a nota foi dada fora do `package-capture`. Numa re-sincronização com
  a prévia alterada, repita a captura com espera (`probe-shot.mjs`).
