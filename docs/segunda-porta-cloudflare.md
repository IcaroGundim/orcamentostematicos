# Segunda porta na Cloudflare — Worker de repasse

Como dar a uma aplicação hospedada na Vercel um **segundo endereço** que atravessa o
filtro de conteúdo de uma rede corporativa. Escrito a partir da implantação feita em
`workers/proxy/` neste projeto, em 10/09/2026, para poder ser repetido em outros.

Leia a seção 7 antes de prometer prazo: há um caminho aparentemente melhor que
**não funciona**, e ele custa horas para descobrir.

---

## 1. O problema que isso resolve

A rede corporativa da SEPLAN roda um **FortiGate** com filtro FortiGuard e inspeção
TLS. Ele trata domínios que ainda não categorizou de duas formas:

| Tratamento | Sintoma | Como identificar |
|---|---|---|
| **Retenção** (categorização pendente) | `ERR_CONNECTION_TIMED_OUT`, intermitente | Handshake TCP não completa; nenhum certificado é trocado |
| **Bloqueio explícito** | HTTP 403 imediato | Certificado emitido pela **Fortinet** no lugar do real, com página "Firewall - Página Bloqueada" |

O padrão que denuncia a retenção: **não abre na primeira tentativa do dia, abre minutos
depois, volta a falhar dias depois**. É o cache do veredito expirando.

`*.vercel.app` é vítima frequente porque é um domínio compartilhado por milhões de
projetos — cada subdomínio novo é um nome que o filtro nunca viu.

## 2. Diagnostique antes de construir

Não presuma. Três testes que separam as hipóteses:

**a) É bloqueio ou é lentidão?** Compare o emissor do certificado.

```bash
echo | openssl s_client -connect SEU.DOMINIO:443 -servername SEU.DOMINIO 2>/dev/null \
  | openssl x509 -noout -issuer
```

Emissor da Fortinet (ou de qualquer appliance) = bloqueio explícito. Emissor legítimo
(Let's Encrypt, Google Trust Services) = o problema é outro.

**b) É a rede ou é o navegador?** Rode pelo terminal no momento da falha:

```bash
curl -m 15 -o /dev/null -w "%{http_code}\n" https://SEU.DOMINIO/
```

Falhou também = é a rede, atinge qualquer cliente. Respondeu 200 enquanto o navegador
trava = é do navegador.

> Cuidado com falso diagnóstico. Neste projeto chegamos a atribuir o problema ao QUIC
> do Chrome. O teste que derrubou a hipótese: o servidor **não anunciava `alt-svc`**,
> logo o Chrome nunca tentava QUIC — e, no momento da falha, `curl` sem suporte a
> HTTP/3 falhava igual, com o handshake TCP nem completando.

**c) É o domínio ou é o provedor?** Teste outros domínios do mesmo provedor.

```bash
curl -o /dev/null -w "%{http_code} %{time_total}s\n" https://vercel.com https://nextjs.org
```

Se eles passam e o seu não, o filtro é por **hostname**, não por IP nem por provedor —
que é o caso que este documento resolve.

## 3. A solução

```
navegador (rede corporativa)  ──►  *.workers.dev  [Cloudflare]
                                          │
                                          │ fetch a partir da rede da Cloudflare,
                                          │ fora do alcance do firewall
                                          ▼
                                   app na Vercel
                                          │
                                          ▼
                                   banco / demais serviços
```

O navegador só conversa com o domínio da Cloudflare. A perna bloqueada **deixa de
existir no caminho do usuário**.

### Pré-requisito que decide a viabilidade

**Como a aplicação autentica.** Neste projeto a sessão vive em `localStorage` e viaja
no header `Authorization: Bearer`. Isso torna o repasse trivial: não há domínio de
cookie para reescrever.

Se a sua aplicação usar **cookies de sessão**, você precisa reescrever `Set-Cookie`
(atributo `Domain`) nos dois sentidos, e cuidar de `SameSite` e `Secure`. É factível,
mas é outro nível de trabalho — confirme isso antes de estimar.

Consequência aceita: `localStorage` é por origem, então o usuário **faz login uma vez
em cada endereço**.

## 4. Arquivos

Estrutura mínima, fora do app:

```
workers/proxy/
  index.ts          o Worker
  wrangler.jsonc    configuração
```

`workers/proxy/wrangler.jsonc`:

```jsonc
{
  "main": "index.ts",
  "name": "NOME-DO-WORKER",        // define a URL: NOME.SUBDOMINIO.workers.dev
  "compatibility_date": "2026-09-10",
  // Sem nodejs_compat: só fetch/Request/Response/URL, que são do próprio runtime.
  // Menos superfície = menos CPU no cold start (ver seção 6).
  "vars": { "ORIGEM": "https://SEU-APP.vercel.app" },
  "observability": { "enabled": true }
}
```

Scripts na raiz do repositório:

```json
"proxy:dev":    "wrangler dev --config workers/proxy/wrangler.jsonc",
"proxy:deploy": "wrangler deploy --config workers/proxy/wrangler.jsonc"
```

Acrescente ao `.gitignore`:

```
.wrangler
```

### Painel da Cloudflare

Se usar o deploy automático por Git:

| Campo | Valor |
|---|---|
| Build command | *(vazio — não há build)* |
| Deploy command | `npm run proxy:deploy` |
| Root directory | `/` |

Ou publique direto do terminal com `npm run proxy:deploy`, que é o caminho mais rápido.

### Pontos do código que não são óbvios

O arquivo `workers/proxy/index.ts` tem os comentários completos. Três decisões merecem
destaque:

1. **`new Request(alvo, request)`** reaproveita método, headers e corpo. O `Host` é
   derivado da nova URL, então a origem recebe o hostname dela mesma.
2. **`redirect: 'manual'`** — quem segue a redireção é o navegador, não o Worker. Sem
   isso, o Worker seguiria internamente e o usuário nunca veria a URL mudar.
3. **Reescrita do `Location`** — uma redireção apontando para a origem levaria o
   navegador de volta ao domínio bloqueado. Só reescreve quando o host bate com o da
   origem; qualquer outro destino passa intacto.

## 5. Política de cache

Sem cache, cada asset paga o salto extra. **A página de login deste projeto puxa 28
arquivos estáticos** — é a multiplicação, não a latência isolada, que faz parecer lento.

Três níveis:

| Tipo | O que é | Política |
|---|---|---|
| `imutavel` | `/_next/static/*`, `/_next/image*`, extensões de asset | `cacheEverything: true` — respeita o `Cache-Control` da origem, que já diz `immutable, max-age=31536000` |
| `pagina` | rotas sem extensão (HTML) | `cacheEverything: true` **+ `cacheTtl: 60`** |
| `nenhum` | `/api/*`, `?_rsc=`, qualquer método ≠ GET | sem cache |

**A pegadinha que custa a maior parte do ganho:** a Vercel manda
`Cache-Control: public, max-age=0, must-revalidate` no HTML. O `cacheEverything`
**respeita** isso, então sozinho ele não cacheia página nenhuma — o `cf-cache-status`
fica `DYNAMIC` e toda visita viaja até a origem. É preciso **forçar** o TTL.

Forçar TTL no HTML só é correto se as telas forem **estáticas no build**. Confira na
saída do `next build`: todas devem estar marcadas com `○ (Static)`. Neste projeto são
cascas, e os dados chegam depois via `/api`. Se houver SSR por usuário, **não faça
isso**.

Nunca cacheie `/api`: é dinâmico e depende do `Authorization`.

### Como verificar

```bash
# asset e página: MISS na primeira, HIT depois
curl -s -D - -o /dev/null https://SEU-WORKER.workers.dev/login | grep -i cf-cache-status
# API: precisa ser DYNAMIC
curl -s -D - -o /dev/null https://SEU-WORKER.workers.dev/api/health | grep -i cf-cache-status
```

## 6. Limitações — leia antes de prometer

**Não há redundância de provedor.** É um app com duas portas, não dois apps. Se a
origem cair, os dois endereços caem. Isso resolve *bloqueio de rede*, não
*indisponibilidade*.

**As chamadas de API continuam mais lentas, e isso é estrutural.** Medido neste
projeto: o `CF-Ray` termina em `GIG` (Rio de Janeiro) e a Vercel serve de `gru1`
(São Paulo). O caminho vira Rio Branco → Rio → São Paulo → volta, contra Rio Branco →
São Paulo direto. HTML e assets passam a morrer no Rio; `/api` paga o desvio inteiro.
A tela principal dispara ~11 chamadas de API ao abrir.

**Um proxy nunca empata com o acesso direto.** Trate-o como rota alternativa para
quando o endereço principal estiver retido — não como endereço principal.

**Medir de dentro da rede filtrada é pouco confiável.** Numa medição o proxy ficou mais
lento que a origem, e na seguinte, mais rápido; no mesmo instante, `google.com` levava
1,07s. Compare os dois endereços no mesmo momento, várias vezes, e confie na percepção
de quem usa.

**A correção de raiz continua sendo a allowlist na TI.** Com o hostname liberado
explicitamente, ele para de passar por categorização e o acesso direto volta a ser
confiável. O proxy vira reserva.

## 7. O caminho que NÃO funciona: publicar o app inteiro

Tentamos primeiro publicar a aplicação Next completa na Cloudflare, via
`@opennextjs/cloudflare`, para ter redundância real. **Bateu em cinco camadas de
incompatibilidade**, quatro contornáveis e uma fatal.

| # | Obstáculo | Saída |
|---|---|---|
| 1 | `@opennextjs/cloudflare` exclui a faixa `16.0`–`16.3.2` do Next no peerDependency | Subir para `>=16.3.3` |
| 2 | `Could not resolve "pg-cloudflare"` — o `pg` entrava no bundle e faz require lazy de um pacote opcional | Tirar o `pg` do grafo do app (driver único do Neon) |
| 3 | `CompileError: Wasm code generation disallowed by embedder` — o `@prisma/client` compila o motor WASM em runtime, o que o workerd proíbe | `@prisma/client/edge`, que carrega o WASM como módulo — trocado por script no build, porque o edge **não roda no Node** |
| 4 | `Cannot perform I/O on behalf of a different request` — o client do Prisma no escopo do módulo reusava a conexão entre requisições | Um client por requisição, com o `ctx` do `getCloudflareContext` como chave de um `WeakMap` |
| 5 | **`Worker exceeded CPU time limit`** | **Sem saída no plano Free** |

O item 5 é o que encerra: o plano Free dá **10 ms de CPU por requisição**. Só o cold
start do Next com o motor WASM do Prisma passa disso — o erro aparecia até em `/login`,
que é página estática. O plano Paid (US$ 5/mês) sobe para 30 s e torna tudo viável.

O Worker de repasse, em comparação, reporta **Worker Startup Time: 5–7 ms**. Cabe
porque não renderiza nada.

**Regra prática:** só tente publicar um app Next com Prisma na Cloudflare se estiver
no plano Paid. No Free, vá direto ao proxy.

Neste repositório os arquivos daquela tentativa continuam em `apps/web`
(`wrangler.jsonc`, `open-next.config.ts`, `scripts/cf-build.mjs`,
`src/lib/prisma-client*.ts`, `src/lib/prisma.workerd.ts`), sem uso. Se o plano subir,
o caminho volta a ser viável sem refazer nada.

## 8. Passo a passo

1. **Diagnostique** (seção 2). Confirme que o filtro é por hostname.
2. **Verifique a autenticação** (seção 3). Cookie de sessão = trabalho extra.
3. Crie `workers/proxy/` com os dois arquivos (seção 4).
4. Adicione os scripts e `.wrangler` ao `.gitignore`.
5. **Teste local** — e este passo funciona mesmo no Windows:
   ```bash
   npm run proxy:dev
   curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8787/login
   ```
6. **Prove o repasse** antes de publicar: método, corpo e headers customizados.
   O melhor teste é uma rota que responde **diferente** conforme o header — se a
   mensagem específica aparecer, o header chegou à origem. Um 401 genérico não prova
   nada, porque os dois caminhos devolvem 401.
7. `npm run proxy:deploy`.
8. Confira o cache (seção 5) e a reescrita de redireção:
   ```bash
   curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" https://SEU-WORKER.workers.dev/
   ```
   O destino tem que apontar para o **próprio Worker**, nunca para a origem.
9. Se a origem tiver segredos cadastrados no Worker de uma tentativa anterior,
   **apague-os** — o proxy não fala com banco nenhum:
   ```bash
   npx wrangler secret delete DATABASE_URL
   ```

## 9. Referências deste projeto

- Worker: `workers/proxy/index.ts` — comentários explicam cada decisão
- Configuração: `workers/proxy/wrangler.jsonc`
- Diagnóstico do firewall e do incidente com `.xyz`: histórico dos commits
  `e04f60e` (Worker), `02cb534` (cache de assets), `333bfcd` (cache de páginas)
